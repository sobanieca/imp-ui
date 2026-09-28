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
