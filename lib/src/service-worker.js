import { impLogger } from './logger.js'

const LOG_ENDPOINT = '/@imp/log'

const FLUSH_DELAY = 200

const JSON_BODY = /^application\/([\w.-]+\+)?json\b/i

const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const MOCK_VERDICT_HEADER = 'x-imp-mock'

const createReporter = () => {
  const queue = []
  let timer = null
  const flush = () => {
    timer = null
    const batch = queue.splice(0)
    if (!batch.length) return
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    }).catch(() => {})
  }
  return (entry, clientId = null) => {
    queue.push(entry)
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY)
    if (clientId) {
      self.clients.get(clientId)
        .then((client) => client?.postMessage({ imp: 'telemetry', entry }))
        .catch(() => {})
    }
  }
}

const requestBody = async (request) => {
  if (request.method === 'GET' || request.method === 'HEAD') return null
  const text = await request.clone().text()
  if (text === '') return null
  if (!JSON_BODY.test(request.headers.get('content-type') || '')) return text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const describeRequest = async (request) => {
  const url = new URL(request.url)
  return {
    method: request.method,
    url: request.url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(request.headers),
    body: await requestBody(request),
  }
}

const describeTarget = (request) => {
  const { url, method, destination } = request
  return destination === ''
    ? { type: 'net', method, url, kind: 'fetch' }
    : { type: 'net', method, url, kind: 'resource', destination }
}

const mockEndpoint = () => globalThis.__IMP_MOCK_ENDPOINT__ ?? null

const askMocks = async (endpoint, request) => {
  const relay = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(await describeRequest(request)),
    cache: 'no-store',
  })
  const verdict = relay.headers.get(MOCK_VERDICT_HEADER)
  return verdict ? { ...JSON.parse(decodeURIComponent(verdict)), body: relay.body } : null
}

const mockedResponse = ({ status, statusText, headers, body }) =>
  new Response(EMPTY_BODY_STATUSES.has(status) ? null : body, { status, statusText, headers })

const createDevMode = () => {
  const report = createReporter()
  const endpoint = mockEndpoint()

  const answerFromMock = (mocked, base, started, clientId) => {
    const timing = { ms: Date.now() - started, mock: mocked.source }
    if (mocked.error) {
      report({ ...base, error: mocked.error, ...timing }, clientId)
      throw new TypeError(mocked.error)
    }
    report({ ...base, status: mocked.status, ...timing }, clientId)
    return mockedResponse(mocked)
  }

  const answerFromNetwork = async (request, base, started, clientId) => {
    try {
      const response = await fetch(request)
      report({ ...base, status: response.status, ms: Date.now() - started }, clientId)
      return response
    } catch (error) {
      report({ ...base, error: String(error), ms: Date.now() - started }, clientId)
      throw error
    }
  }

  const answer = async (request, clientId) => {
    const base = describeTarget(request)
    const started = Date.now()
    let mocked = null
    if (endpoint) {
      try {
        mocked = await askMocks(endpoint, request)
      } catch (error) {
        report({ ...base, error: `imp mocks: ${error}`, ms: Date.now() - started }, clientId)
        throw error
      }
    }
    if (mocked) return answerFromMock(mocked, base, started, clientId)
    return answerFromNetwork(request, base, started, clientId)
  }

  return answer
}

export function startDevMode() {
  const answer = createDevMode()
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
  self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.url.includes('/@imp/')) return
    event.respondWith(answer(request, event.clientId || null))
  })
}

const BUILD_CACHE_PREFIX = 'imp-pwa'

const ACTIVATION_ENTRY = '.imp-pwa-activation'

const GRACE_CHECK_INTERVAL = 10000

const byNewestActivation = (one, other) => other.marker.order - one.marker.order

const fetchChecked = async (url, init) => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`the server answered ${response.status}`)
  return response.redirected ? new Response(response.body, response) : response
}

const fetchRequired = async (url, init) => {
  try {
    return await fetchChecked(url, init)
  } catch (error) {
    throw new Error(`imp: the offline cache cannot install without ${url} - ${error.message}`, {
      cause: error,
    })
  }
}

const createBuildCaches = ({ version, hashed, required, optional }) => {
  const scope = self.registration.scope
  const prefix = `${BUILD_CACHE_PREFIX} ${new URL(scope).pathname} `
  const current = `${prefix}${version}`
  const activationEntry = new URL(ACTIVATION_ENTRY, scope).href
  const absolute = (file) => new URL(file, scope).href
  let grace = null
  let lastGraceCheck = -Infinity

  const ownCaches = async () => (await caches.keys()).filter((key) => key.startsWith(prefix))

  const markerOf = async (cacheName) =>
    (await (await caches.match(activationEntry, { cacheName }))?.json()) ?? null

  const writeMarker = async (cacheName, marker) =>
    (await caches.open(cacheName)).put(activationEntry, Response.json(marker))

  const withMarkers = async () =>
    Promise.all((await ownCaches()).map(async (name) => ({ name, marker: await markerOf(name) })))

  const clientsInScope = async () =>
    (await self.clients.matchAll({ type: 'all', includeUncontrolled: true }))
      .filter((client) => client.url.startsWith(scope))
      .map((client) => client.id)

  const findGrace = async () =>
    (await withMarkers())
      .filter(({ name, marker }) => name !== current && marker)
      .sort(byNewestActivation)[0]?.name ?? null

  const graceCache = () =>
    grace ??= findGrace().catch((error) => {
      grace = null
      throw error
    })

  const reuseHashed = async (url, sources) => {
    for (const cacheName of sources) {
      const cached = await caches.match(url, { cacheName })
      if (cached) return cached
    }
    return fetchRequired(url)
  }

  const fill = async () => {
    const cache = await caches.open(current)
    const sources = (await ownCaches()).filter((name) => name !== current)
    const store = async (url, response) => {
      try {
        await cache.put(url, response)
      } catch (error) {
        impLogger.warn(`the offline cache could not store ${url} - ${error}`)
      }
    }
    const storeOptional = async (url) => {
      try {
        await store(url, await fetchChecked(url, { cache: 'reload' }))
      } catch (error) {
        impLogger.warn(`the offline cache leaves out ${url} - ${error.message}`)
      }
    }
    await Promise.all([
      ...hashed.map(absolute).map(async (url) => store(url, await reuseHashed(url, sources))),
      ...required.map(absolute).map(async (url) =>
        store(url, await fetchRequired(url, { cache: 'reload' }))
      ),
      ...optional.map(absolute).map(storeOptional),
    ])
  }

  const removeNeverActivated = async () => {
    for (const { name, marker } of await withMarkers()) {
      if (name !== current && !marker) await caches.delete(name)
    }
  }

  const releaseUnusedGrace = async () => {
    const graceName = await graceCache()
    if (!graceName) return
    const recorded = (await markerOf(graceName))?.clients ?? []
    const open = new Set(await clientsInScope())
    if (recorded.some((id) => open.has(id))) return
    await caches.delete(graceName)
    grace = Promise.resolve(null)
  }

  return {
    install: async () => {
      const existed = await caches.has(current)
      await removeNeverActivated()
      try {
        await fill()
      } catch (error) {
        if (!existed) await caches.delete(current)
        throw error
      }
    },
    activate: async () => {
      const activated = (await withMarkers()).filter(({ marker }) => marker)
      const order = Math.max(0, ...activated.map(({ marker }) => marker.order)) + 1
      const [previous, ...older] = activated
        .filter(({ name }) => name !== current)
        .sort(byNewestActivation)
      for (const { name } of older) await caches.delete(name)
      await writeMarker(current, { order })
      if (previous) {
        await writeMarker(previous.name, {
          order: previous.marker.order,
          clients: await clientsInScope(),
        })
      }
      grace = Promise.resolve(previous?.name ?? null)
      lastGraceCheck = Date.now()
      await releaseUnusedGrace()
    },
    releaseGraceWhenUnused: () => {
      if (Date.now() - lastGraceCheck < GRACE_CHECK_INTERVAL) return null
      lastGraceCheck = Date.now()
      return releaseUnusedGrace()
    },
    lookup: async (request) => {
      const own = await caches.match(request, { cacheName: current })
      if (own) return own
      try {
        const graceName = await graceCache()
        return graceName ? (await caches.match(request, { cacheName: graceName })) ?? null : null
      } catch (error) {
        impLogger.warn(`the offline cache could not read the previous build - ${error}`)
        return null
      }
    },
  }
}

export function precacheBuild() {
  const precache = globalThis.__IMP_PRECACHE__
  if (!precache) return
  const builds = createBuildCaches(precache)
  const shell = new URL(precache.shell, self.registration.scope).href
  self.addEventListener('install', (event) => {
    event.waitUntil(builds.install().then(() => self.skipWaiting()))
  })
  self.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([builds.activate(), self.clients.claim()]))
  })
  self.addEventListener('fetch', (event) => {
    const release = builds.releaseGraceWhenUnused()
    if (release) event.waitUntil(release.catch(() => {}))
    const { request } = event
    if (request.method !== 'GET') return
    if (new URL(request.url).origin !== self.location.origin) return
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(async () =>
          (await builds.lookup(shell).catch(() => null)) ?? Response.error()
        ),
      )
      return
    }
    event.respondWith(
      builds.lookup(request).catch(() => null).then((cached) => cached ?? fetch(request)),
    )
  })
}
