export const clientScript = ({ mocks = false } = {}) => `
(() => {
  let es = null
  const connect = () => {
    es = new EventSource('/@imp/events')
    es.onmessage = (e) => { if (e.data === 'reload') location.reload() }
  }
  connect()
  addEventListener('pagehide', () => es?.close())
  addEventListener('pageshow', (e) => { if (e.persisted) connect() })

  const queue = []
  let timer = null

  const safe = (v) => {
    try {
      if (v instanceof Error) return v.stack || String(v)
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    } catch {
      return String(v)
    }
  }

  const flush = () => {
    timer = null
    const batch = queue.splice(0)
    if (!batch.length) return
    fetch('/@imp/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {})
  }

  const push = (entry) => {
    queue.push(entry)
    if (!timer) timer = setTimeout(flush, 200)
  }
  globalThis.__impFlushTelemetry = flush

  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const orig = console[level]
    console[level] = (...args) => {
      orig.apply(console, args)
      push({ type: 'console', level, text: args.map(safe).join(' ') })
    }
  }

  addEventListener('error', (e) => {
    push({ type: 'page', text: \`\${e.message || 'error'} @ \${e.filename || '?'}:\${e.lineno || 0}\` })
  })
  addEventListener('unhandledrejection', (e) => {
    push({ type: 'page', text: \`Unhandled rejection: \${safe(e.reason)}\` })
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/@imp/sw.js', { scope: '/' })
      .catch((error) => console.error('imp: the dev service worker failed to start -', error))

    if (${mocks} && !navigator.serviceWorker.controller) {
      const network = globalThis.fetch
      let missed = false
      globalThis.fetch = (...args) => {
        const target = String(args[0]?.url ?? args[0] ?? '')
        if (!target.includes('/@imp/') && !navigator.serviceWorker.controller) missed = true
        return network.apply(globalThis, args)
      }
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        globalThis.fetch = network
        if (missed) location.reload()
      }, { once: true })
    }
  }
})()
`

export const serviceWorkerScript = ({ mockBundle = '' } = {}) => `
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const queue = []
let timer = null

const flush = () => {
  timer = null
  const batch = queue.splice(0)
  if (!batch.length) return
  fetch('/@imp/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  }).catch(() => {})
}

const report = (entry) => {
  queue.push(entry)
  if (!timer) timer = setTimeout(flush, 200)
}

self.__impMocks = []
self.__impMockProblem = (text) =>
  report({ type: 'console', level: 'error', text: \`imp mocks: \${text}\` })

const JSON_BODY = /^application\\/([\\w.-]+\\+)?json\\b/i

const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

const isRawBody = (body) =>
  body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body) ||
  body instanceof FormData || body instanceof URLSearchParams || body instanceof ReadableStream

const mockResponse = (result) => {
  if (result instanceof Response) return result
  const descriptor = result || {}
  const status = descriptor.status ?? 200
  const headers = new Headers(descriptor.headers || {})
  let body = descriptor.body
  if (body === undefined || body === null || EMPTY_BODY_STATUSES.has(status)) {
    body = null
  } else if (typeof body === 'string') {
    if (!headers.has('content-type')) headers.set('content-type', 'text/plain;charset=utf-8')
  } else if (!isRawBody(body)) {
    body = JSON.stringify(body)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  return new Response(body, { status, statusText: descriptor.statusText || '', headers })
}

const matchingMock = async (description) => {
  for (const entry of self.__impMocks) {
    try {
      if (await entry.match(description)) return entry
    } catch (error) {
      self.__impMockProblem(\`\${entry.source} match() threw: \${error?.message || error}\`)
    }
  }
  return null
}

const answerFromMock = async (entry, description, started) => {
  try {
    if (entry.delay) await sleep(entry.delay)
    const response = mockResponse(await entry.handler(description))
    report({
      type: 'net',
      method: description.method,
      url: description.url,
      status: response.status,
      ms: Date.now() - started,
      mock: entry.source,
    })
    return response
  } catch (error) {
    report({
      type: 'net',
      method: description.method,
      url: description.url,
      error: String(error?.message || error),
      ms: Date.now() - started,
      mock: entry.source,
    })
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const { url, method } = request
  if (url.includes('/@imp/')) return
  const started = Date.now()
  event.respondWith((async () => {
    if (self.__impMocks.length) {
      const description = await describeRequest(request)
      const entry = await matchingMock(description)
      if (entry) return answerFromMock(entry, description, started)
    }
    try {
      const response = await fetch(request)
      report({ type: 'net', method, url, status: response.status, ms: Date.now() - started })
      return response
    } catch (error) {
      report({ type: 'net', method, url, error: String(error), ms: Date.now() - started })
      throw error
    }
  })())
})
${mockBundle ? `\n;${mockBundle}` : ''}`
