import { test } from 'imp/test'
import { source } from './worker-source.js'

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

const PWA_ORIGIN = 'https://pwa.test'

function fakeCacheStorage() {
  const stores = new Map()
  const keyOf = (request) => (typeof request === 'string' ? request : request.url)
  const usage = () =>
    [...stores.values()].flatMap((entries) => [...entries.values()])
      .reduce((sum, { body }) => sum + body.length, 0)
  const answer = ({ body, status, headers }) => new Response(body, { status, headers })
  const cacheOf = (entries) => ({
    put: async (request, response) => {
      const body = new Uint8Array(await response.arrayBuffer())
      const replaced = entries.get(keyOf(request))?.body.length ?? 0
      if (usage() - replaced + body.length > storage.quota) {
        throw new DOMException('the storage quota is full', 'QuotaExceededError')
      }
      entries.set(keyOf(request), { body, status: response.status, headers: [...response.headers] })
    },
    match: (request) => {
      const entry = entries.get(keyOf(request))
      return Promise.resolve(entry ? answer(entry) : undefined)
    },
  })
  const storage = {
    quota: Infinity,
    names: () => [...stores.keys()],
    keys: () => Promise.resolve([...stores.keys()]),
    has: (name) => Promise.resolve(stores.has(name)),
    open: (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      return Promise.resolve(cacheOf(stores.get(name)))
    },
    delete: (name) => Promise.resolve(stores.delete(name)),
    match: (request, { cacheName } = {}) => {
      for (const name of cacheName ? [cacheName] : stores.keys()) {
        const entry = stores.get(name)?.get(keyOf(request))
        if (entry) return Promise.resolve(answer(entry))
      }
      return Promise.resolve(undefined)
    },
  }
  return storage
}

function pwaOrigin(source) {
  const caches = fakeCacheStorage()
  const served = new Map()
  const origin = {
    caches,
    served,
    requests: [],
    warnings: [],
    clients: [],
    unreachable: new Set(),
    offline: false,
    now: 0,
  }
  const network = (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    origin.requests.push({ url, cache: init?.cache ?? 'default' })
    if (origin.offline || origin.unreachable.has(url)) {
      return Promise.reject(new TypeError('Failed to fetch'))
    }
    return Promise.resolve(
      served.has(url) ? new Response(served.get(url)) : new Response('not found', { status: 404 }),
    )
  }
  const workerConsole = {
    log: () => {},
    warn: (...parts) => origin.warnings.push(parts.join(' ')),
    error: (...parts) => origin.warnings.push(parts.join(' ')),
  }
  class WorkerDate extends Date {
    static now() {
      return origin.now
    }
  }
  const url = (path) => `${PWA_ORIGIN}${path}`

  origin.upload = (scopePath, { version, files, optional = {} }) => {
    for (const key of [...served.keys()]) {
      if (key.startsWith(url(scopePath))) served.delete(key)
    }
    for (const [name, body] of Object.entries({ ...files, ...optional })) {
      served.set(url(`${scopePath}${name}`), body)
    }
    const names = Object.keys(files)
    const paths = (list) => list.map((name) => `${scopePath}${name}`)
    return {
      version,
      shell: `${scopePath}index.html`,
      hashed: paths(names.filter((name) => name.startsWith('chunks/'))),
      required: paths(names.filter((name) => !name.startsWith('chunks/'))),
      optional: paths(Object.keys(optional)),
    }
  }

  origin.startWorker = (scopePath, precache) => {
    const listeners = {}
    const scope = {
      __IMP_PRECACHE__: precache,
      registration: { scope: url(scopePath) },
      location: new URL(url(`${scopePath}sw.js`)),
      addEventListener: (type, handler) => {
        listeners[type] = handler
      },
      skipWaiting: () => Promise.resolve(),
      clients: {
        claim: () => Promise.resolve(),
        matchAll: () => Promise.resolve(origin.clients.map((client) => ({ ...client }))),
      },
    }
    new Function('self', 'fetch', 'caches', 'globalThis', 'console', 'Date', source)(
      scope,
      network,
      caches,
      scope,
      workerConsole,
      WorkerDate,
    )
    const lifecycle = async (type) => {
      const pending = []
      listeners[type]({ waitUntil: (promise) => pending.push(promise) })
      await Promise.all(pending)
    }
    const dispatchFetch = async (path, mode) => {
      const pending = []
      let answered = null
      listeners.fetch({
        request: { url: url(path), method: 'GET', mode },
        respondWith: (value) => answered = value,
        waitUntil: (promise) => pending.push(promise),
      })
      try {
        const response = await (answered ?? network(url(path)))
        return response.type === 'error' ? null : await response.text()
      } catch {
        return null
      } finally {
        await Promise.all(pending)
      }
    }
    return {
      install: () => lifecycle('install'),
      activate: () => lifecycle('activate'),
      load: (path) => dispatchFetch(path, 'no-cors'),
      navigate: (path) => dispatchFetch(path, 'navigate'),
    }
  }

  origin.deploy = async (scopePath, release) => {
    const worker = origin.startWorker(scopePath, origin.upload(scopePath, release))
    await worker.install()
    await worker.activate()
    return worker
  }

  origin.buildCaches = (scopePath) =>
    caches.names().filter((name) => name.startsWith(`imp-pwa ${scopePath} `))

  return origin
}


const appBuild = (tag, extra = {}) => ({
  version: tag,
  files: {
    'index.html': `page ${tag}`,
    'manifest.webmanifest': `manifest ${tag}`,
    [`chunks/app-${tag}.js`]: `app ${tag}`,
    [`chunks/lazy-${tag}.js`]: `lazy ${tag}`,
    ...extra,
  },
})

test('apps on one origin keep the caches of each other', async () => {
  const origin = pwaOrigin(source)
  origin.clients = ['/a/', '/b/', '/c/'].map((path) => ({
    id: path,
    url: `${PWA_ORIGIN}${path}`,
  }))
  await origin.deploy('/b/', appBuild('b1'))
  const c = await origin.deploy('/c/', appBuild('c1'))
  const b = await origin.deploy('/b/', appBuild('b2'))
  let a = null
  for (const tag of ['a1', 'a2', 'a3', 'a4']) {
    a = await origin.deploy('/a/', appBuild(tag))
    await a.navigate('/a/')
  }
  check(origin.buildCaches('/a/').length === 2, `app a has ${origin.buildCaches('/a/')}`)
  check(origin.buildCaches('/b/').length === 2, `app b has ${origin.buildCaches('/b/')}`)
  check(origin.buildCaches('/c/').length === 1, `app c has ${origin.buildCaches('/c/')}`)
  origin.offline = true
  const loaded = [
    await a.load('/a/chunks/lazy-a4.js'),
    await a.load('/a/chunks/lazy-a3.js'),
    await b.load('/b/chunks/lazy-b2.js'),
    await b.load('/b/chunks/lazy-b1.js'),
    await c.load('/c/chunks/lazy-c1.js'),
    await b.navigate('/b/deep/link'),
  ]
  const expected = ['lazy a4', 'lazy a3', 'lazy b2', 'lazy b1', 'lazy c1', 'page b2']
  check(JSON.stringify(loaded) === JSON.stringify(expected), `offline: ${loaded}`)
})

test('an optional file that fails does not block the install', async () => {
  const origin = pwaOrigin(source)
  const precache = origin.upload('/', {
    ...appBuild('v1'),
    optional: { 'robots.txt': 'robots', 'gone.txt': 'gone', 'far.txt': 'far' },
  })
  origin.served.delete(`${PWA_ORIGIN}/gone.txt`)
  origin.unreachable.add(`${PWA_ORIGIN}/far.txt`)
  const worker = origin.startWorker('/', precache)
  await worker.install()
  await worker.activate()
  check(
    origin.warnings.some((line) => line.includes('/gone.txt') && line.includes('404')),
    `no warning for the missing file: ${origin.warnings}`,
  )
  check(
    origin.warnings.some((line) => line.includes('/far.txt')),
    `no warning for the unreachable file: ${origin.warnings}`,
  )
  origin.offline = true
  check(await worker.load('/robots.txt') === 'robots', 'an optional file was not cached')
  check(await worker.load('/chunks/lazy-v1.js') === 'lazy v1', 'a chunk was not cached')
})

test('a required file that fails keeps the previous build', async () => {
  const origin = pwaOrigin(source)
  const current = await origin.deploy('/', appBuild('v1'))
  const precache = origin.upload('/', appBuild('v2'))
  origin.served.delete(`${PWA_ORIGIN}/chunks/lazy-v2.js`)
  const failed = await origin.startWorker('/', precache).install().then(
    () => 'installed',
    (error) => error.message,
  )
  check(failed.includes('/chunks/lazy-v2.js'), `the install did not fail: ${failed}`)
  check(
    origin.buildCaches('/').length === 1,
    `the failed install left a cache: ${origin.caches.names()}`,
  )
  origin.offline = true
  check(await current.navigate('/') === 'page v1', 'the previous build did not serve offline')
})

test('a failed read of the grace cache falls back to the network', async () => {
  const origin = pwaOrigin(source)
  await origin.deploy('/', appBuild('v1'))
  const precache = origin.upload('/', appBuild('v2'))
  const deployed = origin.startWorker('/', precache)
  await deployed.install()
  await deployed.activate()
  origin.served.set(`${PWA_ORIGIN}/fresh.txt`, 'from the network')
  const restarted = origin.startWorker('/', precache)
  origin.caches.keys = () => Promise.reject(new Error('the storage is not readable'))
  check(
    await restarted.load('/fresh.txt') === 'from the network',
    'a failed grace cache did not fall back to the network',
  )
  check(await restarted.load('/chunks/app-v2.js') === 'app v2', 'the own cache stopped serving')
})

test('a full storage does not stop the updates', async () => {
  const origin = pwaOrigin(source)
  await origin.deploy('/', appBuild('v1'))
  origin.caches.quota = 400
  const big = 'x'.repeat(500)
  const worker = await origin.deploy('/', appBuild('v2', { 'chunks/big-v2.js': big }))
  check(
    origin.warnings.some((line) => line.includes('could not store')),
    `no warning for the full storage: ${origin.warnings}`,
  )
  check(await worker.load('/chunks/big-v2.js') === big, 'a file that did not fit did not load')
  const next = await origin.deploy('/', appBuild('v3'))
  origin.offline = true
  check(await next.navigate('/') === 'page v3', 'the next build did not install')
})

test('a rollback keeps the build that the open tabs run', async () => {
  const origin = pwaOrigin(source)
  origin.clients = [{ id: 'tab', url: `${PWA_ORIGIN}/` }]
  for (const tag of ['v1', 'v2', 'v3']) await origin.deploy('/', appBuild(tag))
  await origin.deploy('/', appBuild('v2'))
  const worker = await origin.deploy('/', appBuild('v4'))
  origin.offline = true
  const loaded = [
    await worker.load('/chunks/lazy-v4.js'),
    await worker.load('/chunks/lazy-v2.js'),
    await worker.load('/chunks/lazy-v3.js'),
  ]
  check(
    JSON.stringify(loaded) === JSON.stringify(['lazy v4', 'lazy v2', null]),
    `after the rollback: ${JSON.stringify(loaded)}`,
  )
})

test('the build caches stay bounded without a navigation', async () => {
  const origin = pwaOrigin(source)
  origin.clients = [{ id: 'tab', url: `${PWA_ORIGIN}/` }]
  let worker = null
  for (const tag of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
    worker = await origin.deploy('/', appBuild(tag))
    check(origin.buildCaches('/').length <= 2, `after ${tag}: ${origin.buildCaches('/')}`)
  }
  origin.now += 60000
  await worker.load('/chunks/app-v6.js')
  check(origin.buildCaches('/').length === 2, 'the grace cache went while its tab is open')
  origin.clients = []
  origin.now += 1000
  await worker.load('/chunks/app-v6.js')
  check(origin.buildCaches('/').length === 2, 'the worker checked the clients on every request')
  origin.now += 60000
  await worker.load('/chunks/app-v6.js')
  check(
    origin.buildCaches('/').length === 1,
    `the grace cache stayed after its tab closed: ${origin.buildCaches('/')}`,
  )
  await origin.deploy('/', appBuild('v7'))
  check(
    origin.buildCaches('/').length === 1,
    `an update with no open tab kept the grace cache: ${origin.buildCaches('/')}`,
  )
})

test('an update copies the unchanged hashed files', async () => {
  const origin = pwaOrigin(source)
  await origin.deploy('/', appBuild('v1', { 'chunks/shared-1.js': 'shared' }))
  origin.requests.length = 0
  const worker = await origin.deploy('/', appBuild('v2', { 'chunks/shared-1.js': 'shared' }))
  const requested = origin.requests
    .map(({ url, cache }) => `${url.slice(PWA_ORIGIN.length)} ${cache}`)
    .sort()
  const expected = [
    '/chunks/app-v2.js default',
    '/chunks/lazy-v2.js default',
    '/index.html reload',
    '/manifest.webmanifest reload',
  ]
  check(JSON.stringify(requested) === JSON.stringify(expected), `requests: ${requested}`)
  origin.offline = true
  check(await worker.load('/chunks/shared-1.js') === 'shared', 'the copied file did not load')
})
