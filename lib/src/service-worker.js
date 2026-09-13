const LOG_ENDPOINT = '/@imp/log'

const FLUSH_DELAY = 200

const JSON_BODY = /^application\/([\w.-]+\+)?json\b/i

const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

const describeTarget = (request) => {
  const { url, method, destination } = request
  return destination === ''
    ? { type: 'net', method, url, kind: 'fetch' }
    : { type: 'net', method, url, kind: 'resource', destination }
}

const registeredMocks = () => self.__impMocks ?? []

const createDevMode = () => {
  const report = createReporter()

  const mockProblem = (text) =>
    report({ type: 'console', level: 'error', text: `imp mocks: ${text}` })
  for (const text of self.__impMockProblems ?? []) mockProblem(text)

  const matchingMock = async (description) => {
    for (const entry of registeredMocks()) {
      try {
        if (await entry.match(description)) return entry
      } catch (error) {
        mockProblem(`${entry.source} match() threw: ${error?.message || error}`)
      }
    }
    return null
  }

  const answerFromMock = async (entry, description, base, started, clientId) => {
    try {
      if (entry.delay) await sleep(entry.delay)
      const response = mockResponse(await entry.handler(description))
      report(
        { ...base, status: response.status, ms: Date.now() - started, mock: entry.source },
        clientId,
      )
      return response
    } catch (error) {
      report({
        ...base,
        error: String(error?.message || error),
        ms: Date.now() - started,
        mock: entry.source,
      }, clientId)
      throw error
    }
  }

  const answer = async (request, clientId) => {
    const base = describeTarget(request)
    const started = Date.now()
    if (registeredMocks().length) {
      const description = await describeRequest(request)
      const entry = await matchingMock(description)
      if (entry) return answerFromMock(entry, description, base, started, clientId)
    }
    try {
      const response = await fetch(request)
      report({ ...base, status: response.status, ms: Date.now() - started }, clientId)
      return response
    } catch (error) {
      report({ ...base, error: String(error), ms: Date.now() - started }, clientId)
      throw error
    }
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
