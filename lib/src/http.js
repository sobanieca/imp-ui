import { createFollowingState, createState, readableState } from './state.js'
import { findProvided, namespacedNameProblem, provideOnHost } from './provide.js'
import { claimThroughSelf, resolveThroughSelf } from './component.js'
import { impLogger } from './logger.js'
import { reportError } from './analytics-bus.js'
import { isPlainObject } from './render.js'

const CLIENT_KIND = 'http'

const CLIENT_BRAND = Symbol('imp.http.client')

const TRACKER_STATES = Symbol('imp.http.trackerStates')

const CLOSE_WITH_OWNER = Symbol('imp.http.closeWithOwner')

const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])

const BODILESS_METHODS = new Set(['GET', 'HEAD'])

const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const BACKOFF_STRATEGIES = ['exponential', 'fixed']

const RETRIED_STATUSES = new Set([408, 429, 500, 502, 503, 504])

const RETRIED_CODES = new Set(['network', 'timeout'])

const RETRY_AFTER_STATUSES = new Set([429, 503])

const DEFAULT_REQUEST_ID_HEADER = 'x-request-id'

const HEADER_NAME = /^[!#$%&'*+.^_`|~\dA-Za-z-]+$/

const JSON_TYPE = /^application\/([\w.-]+\+)?json\b/i

const TEXT_TYPE = /^text\/|\+xml\b|^application\/xml\b|x-www-form-urlencoded/i

const DEFAULT_RETRY = {
  attempts: 1,
  backoff: 'exponential',
  delay: 300,
  maxDelay: 30_000,
  jitter: true,
  retryOn: null,
}

export class HttpError extends Error {
  constructor(message, details = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause })
    this.name = 'HttpError'
    this.status = details.status ?? 0
    this.code = details.code ?? 'status'
    this.method = details.method ?? null
    this.url = details.url ?? null
    this.headers = details.headers ?? {}
    this.body = details.body
  }
}

const abortedError = (request) =>
  new HttpError(`imp: http - ${request.method} ${request.url} was aborted`, {
    code: 'aborted',
    method: request.method,
    url: request.url,
  })

const cancelledError = (subject, reason, request) =>
  new HttpError(`imp: ${subject} - ${request.method} ${request.url} was cancelled: ${reason}`, {
    code: 'aborted',
    method: request.method,
    url: request.url,
  })

const timedOutError = (request, timeout, cause) =>
  new HttpError(`imp: http - ${request.method} ${request.url} timed out after ${timeout}ms`, {
    code: 'timeout',
    method: request.method,
    url: request.url,
    cause,
  })

const REPORTED_FAILURE_CODES = new Set(['network', 'timeout'])

const isReportedFailure = (error) =>
  REPORTED_FAILURE_CODES.has(error?.code) || (error?.code === 'status' && error.status >= 500)

const asHttpError = (error, request) =>
  error instanceof HttpError
    ? error
    : new HttpError(
        `imp: http - ${request.method} ${request.url} failed: ${error?.message ?? error}`,
        { code: 'network', method: request.method, url: request.url, cause: error },
      )

const headerEntries = (input) => {
  if (!input) return []
  if (typeof input.forEach === 'function' && typeof input.get === 'function') {
    const entries = []
    input.forEach((value, key) => entries.push([key, value]))
    return entries
  }
  if (Array.isArray(input)) return input
  return Object.entries(input)
}

const normalizeHeaders = (input) => {
  const headers = {}
  for (const [key, value] of headerEntries(input)) {
    if (value === undefined || value === null) continue
    headers[String(key).toLowerCase()] = String(value)
  }
  return headers
}

const randomRequestId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(
    20,
  )}`
}

const normalizeRequestIdHeader = (requestId, subject, fallback = DEFAULT_REQUEST_ID_HEADER) => {
  if (requestId === undefined) return fallback
  if (requestId === false || requestId === null) return null
  if (requestId === true) return DEFAULT_REQUEST_ID_HEADER
  const header = typeof requestId === 'string' ? requestId.trim().toLowerCase() : ''
  if (!HEADER_NAME.test(header)) {
    throw new Error(
      `imp: ${subject} - requestId must be a header name like '${DEFAULT_REQUEST_ID_HEADER}', or false to send no request id`,
    )
  }
  return header
}

const joinUrl = (baseUrl, path) => {
  if (ABSOLUTE_URL.test(path)) return path
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

const documentBase = () => globalThis.location?.href ?? 'http://localhost/'

const appendQuery = (url, query, subject) => {
  if (query === undefined || query === null) return
  if (!isPlainObject(query)) {
    throw new Error(`imp: ${subject} - query must be a plain object of values, like { page: 2 }`)
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null) continue
      url.searchParams.append(key, String(item))
    }
  }
}

const isJsonValue = (body) =>
  isPlainObject(body)
  || Array.isArray(body)
  || typeof body === 'number'
  || typeof body === 'boolean'

const serializeBody = (body, headers) => {
  if (body === undefined || body === null) return null
  if (!isJsonValue(body)) return body
  headers['content-type'] ??= 'application/json'
  return JSON.stringify(body)
}

const isPlainValue = (value) =>
  value === null
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean'
  || Array.isArray(value)
  || isPlainObject(value)

const delay = (ms, signal) => {
  if (!ms) return
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      stop()
      reject(new HttpError('imp: http - the request was aborted', { code: 'aborted' }))
    }
    if (signal?.aborted) {
      reject(new HttpError('imp: http - the request was aborted', { code: 'aborted' }))
      return
    }
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

const rejectOnAbort = (signal, buildError) => {
  let release = () => {}
  const stopped = new Promise((_resolve, reject) => {
    if (!signal) return
    if (signal.aborted) {
      reject(buildError())
      return
    }
    const onAbort = () => reject(buildError())
    signal.addEventListener('abort', onAbort, { once: true })
    release = () => signal.removeEventListener('abort', onAbort)
  })
  return { stopped, release }
}

const readBody = async (response, request) => {
  if (EMPTY_BODY_STATUSES.has(response.status)) return null
  const type = response.headers.get('content-type') ?? ''
  if (JSON_TYPE.test(type)) {
    const text = await response.text()
    if (text === '') return null
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new HttpError(
        `imp: http - ${request.method} ${request.url} answered with ${type} that is not valid JSON`,
        {
          code: 'parse',
          status: response.status,
          method: request.method,
          url: request.url,
          cause: error,
        },
      )
    }
  }
  if (TEXT_TYPE.test(type)) return response.text()
  if (type === '') {
    const text = await response.text()
    return text === '' ? null : text
  }
  return response.blob()
}

const responseRecord = async (response, request) => ({
  status: response.status,
  statusText: response.statusText,
  ok: response.status >= 200 && response.status < 300,
  url: request.url,
  method: request.method,
  headers: normalizeHeaders(response.headers),
  body: await readBody(response, request),
})

const errorFromRecord = (record) =>
  new HttpError(
    `imp: http - ${record.method} ${record.url} answered ${record.status}${
      record.statusText ? ` ${record.statusText}` : ''
    }`,
    {
      code: 'status',
      status: record.status,
      method: record.method,
      url: record.url,
      headers: record.headers,
      body: record.body,
    },
  )

const retryAfterDelay = (record) => {
  if (!record || !RETRY_AFTER_STATUSES.has(record.status)) return null
  const header = record.headers['retry-after']
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

const backoffDelay = (retry, attempt, retryAfter) => {
  if (retryAfter !== null) return Math.min(retryAfter, retry.maxDelay)
  const base = retry.backoff === 'fixed' ? retry.delay : retry.delay * 2 ** (attempt - 1)
  const capped = Math.min(base, retry.maxDelay)
  return retry.jitter ? capped / 2 + Math.random() * (capped / 2) : capped
}

const shouldRetry = (retry, outcome) => {
  if (typeof retry.retryOn === 'function') {
    return (
      retry.retryOn({
        status: outcome.record?.status ?? null,
        error: outcome.error,
        attempt: outcome.attempt,
        request: outcome.request,
      }) === true
    )
  }
  if (!outcome.record) return RETRIED_CODES.has(outcome.error.code)
  if (Array.isArray(retry.retryOn)) return retry.retryOn.includes(outcome.record.status)
  return RETRIED_STATUSES.has(outcome.record.status)
}

const hookList = (hooks, subject, option) => {
  if (hooks === undefined || hooks === null) return []
  const list = Array.isArray(hooks) ? hooks : [hooks]
  for (const hook of list) {
    if (typeof hook !== 'function') {
      throw new Error(
        `imp: ${subject} - ${option} takes a function (or an array of them) receiving the ${
          option === 'onRequest' ? 'request before it is sent' : 'response before it is returned'
        }`,
      )
    }
  }
  return list
}

const runHooks = async (hooks, subject, option, request, initial, hookArgs = []) => {
  let value = initial
  for (const hook of hooks) {
    let next
    try {
      next = await hook(value, ...hookArgs)
    } catch (error) {
      throw error instanceof HttpError
        ? error
        : new HttpError(
            `imp: http - an ${option} hook rejected ${request.method} ${request.url}: ${
              error?.message ?? error
            }`,
            { code: 'hook', method: request.method, url: request.url, cause: error },
          )
    }
    if (next === undefined || next === null) continue
    if (!isPlainObject(next)) {
      impLogger.error(
        `${subject}: an ${option} hook returned ${typeof next} instead of the ${
          option === 'onRequest' ? 'request' : 'response'
        } - keeping the one it received`,
      )
      continue
    }
    value = next
  }
  return value
}

const normalizeTimeout = (timeout, subject) => {
  if (timeout === undefined || timeout === null || timeout === false) return 0
  if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 0) {
    throw new Error(`imp: ${subject} - timeout must be a number of milliseconds, like 10000`)
  }
  return timeout
}

const normalizeRetry = (retry, subject, base = DEFAULT_RETRY) => {
  if (retry === undefined || retry === null) return base
  if (retry === false) return { ...base, attempts: 1 }
  if (retry === true) return { ...base, attempts: 3 }
  if (typeof retry === 'number') return { ...base, attempts: retry }
  if (!isPlainObject(retry)) {
    throw new Error(
      `imp: ${subject} - retry takes a number of attempts or an object like { attempts: 3, backoff: 'exponential', retryOn: [502, 503] }`,
    )
  }
  const merged = { ...base, ...retry }
  if (!Number.isInteger(merged.attempts) || merged.attempts < 1) {
    throw new Error(`imp: ${subject} - retry.attempts must be a whole number of attempts, like 3`)
  }
  if (!BACKOFF_STRATEGIES.includes(merged.backoff)) {
    throw new Error(
      `imp: ${subject} - retry.backoff must be ${BACKOFF_STRATEGIES.map(
        (strategy) => `'${strategy}'`,
      ).join(' or ')}`,
    )
  }
  const { retryOn } = merged
  if (retryOn !== null && typeof retryOn !== 'function' && !Array.isArray(retryOn)) {
    throw new Error(
      `imp: ${subject} - retry.retryOn must be an array of status codes or a function deciding from { status, error, attempt, request }`,
    )
  }
  return merged
}

const readOnlyState = (state) => readableState(state.name, () => state)

const errorValue = (error) => ({
  message: error?.message ?? String(error),
  status: error?.status ?? 0,
  code: error?.code ?? 'error',
  method: error?.method ?? null,
  url: error?.url ?? null,
  body: isPlainValue(error?.body) ? error.body : null,
})

const createTracker = (prefix) => {
  const pending = createState(`${prefix}.pending`, 0)
  const lastError = createState(`${prefix}.lastError`, null)
  return {
    start: () => pending.set(pending.get() + 1),
    settle: (error, { keepError = false } = {}) => {
      pending.set(Math.max(0, pending.get() - 1))
      if (keepError) return
      if (error) {
        if (error.code !== 'aborted') lastError.set(errorValue(error))
      } else if (lastError.get() !== null) lastError.set(null)
    },
    clearError: () => lastError.set(null),
    pending: readOnlyState(pending),
    lastError: readOnlyState(lastError),
    states: { pending, lastError },
  }
}

const createAttemptSignal = (timeout, callerSignal) => {
  if (!timeout) return { signal: callerSignal, release: () => {}, expired: () => false }
  const controller = new AbortController()
  let expired = false
  const timer = setTimeout(() => {
    expired = true
    controller.abort()
  }, timeout)
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, controller.signal])
    : controller.signal
  return { signal, release: () => clearTimeout(timer), expired: () => expired }
}

const createClient = (name, options) => {
  const subject = `http client '${name}'`
  if (!isPlainObject(options)) {
    throw new Error(`imp: ${subject} - the second argument configures the client, like { baseUrl }`)
  }
  const baseUrl = options.baseUrl ?? ''
  if (typeof baseUrl !== 'string') {
    throw new Error(`imp: ${subject} - baseUrl must be a string like 'https://api.example.com'`)
  }
  const clientHeaders = normalizeHeaders(options.headers)
  const clientRetry = normalizeRetry(options.retry, subject)
  const clientTimeout = normalizeTimeout(options.timeout, subject)
  const clientOnRequest = hookList(options.onRequest, subject, 'onRequest')
  const clientOnResponse = hookList(options.onResponse, subject, 'onResponse')
  const clientRequestIdHeader = normalizeRequestIdHeader(options.requestId, subject)

  const tracker = createTracker(name)
  const trackers = new Map()
  const trackerFor = (key) => {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error(
        `imp: ${subject} - track needs a name for the request, like track: 'users.list'`,
      )
    }
    let found = trackers.get(key)
    if (!found) {
      found = createTracker(`${name}.${key}`)
      trackers.set(key, found)
    }
    return found
  }

  const clientAbort = new AbortController()
  let closed = null

  const buildRequest = (method, path, callOptions, requestIdHeader) => {
    if (typeof path !== 'string' || path === '') {
      throw new Error(
        `imp: ${subject} - ${method.toLowerCase()} needs a path, like ${method.toLowerCase()}('/users')`,
      )
    }
    const url = new URL(joinUrl(baseUrl, path), documentBase())
    appendQuery(url, callOptions.query, subject)
    const headers = { ...clientHeaders, ...normalizeHeaders(callOptions.headers) }
    if (requestIdHeader) headers[requestIdHeader] ??= randomRequestId()
    const body = BODILESS_METHODS.has(method) ? null : serializeBody(callOptions.body, headers)
    return {
      method,
      url: url.href,
      headers,
      body,
      signal: callOptions.signal
        ? AbortSignal.any([clientAbort.signal, callOptions.signal])
        : clientAbort.signal,
      meta: callOptions.meta ?? {},
    }
  }

  const sendRequest = (request) =>
    globalThis.fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ?? undefined,
      signal: request.signal ?? undefined,
    })

  const attempt = async (baseRequest, settings) => {
    const attemptSignal = createAttemptSignal(settings.timeout, baseRequest.signal)
    const request = {
      ...baseRequest,
      headers: { ...baseRequest.headers },
      signal: attemptSignal.signal,
    }
    const interrupted = () => {
      if (attemptSignal.expired()) return timedOutError(request, settings.timeout)
      return clientAbort.signal.aborted
        ? cancelledError(subject, closed, request)
        : abortedError(request)
    }
    const abortWatch = rejectOnAbort(attemptSignal.signal, interrupted)
    const { stopped } = abortWatch
    try {
      const prepared = await Promise.race([
        runHooks(settings.onRequest, subject, 'onRequest', request, request),
        stopped,
      ])
      let response
      try {
        response = await Promise.race([sendRequest(prepared), stopped])
      } catch (error) {
        if (attemptSignal.signal?.aborted) throw interrupted()
        throw asHttpError(error, prepared)
      }
      const record = await Promise.race([responseRecord(response, prepared), stopped])
      return {
        record: await Promise.race([
          runHooks(settings.onResponse, subject, 'onResponse', prepared, record, [prepared]),
          stopped,
        ]),
        request: prepared,
      }
    } finally {
      abortWatch.release()
      attemptSignal.release()
    }
  }

  const sendWithRetries = async (baseRequest, settings) => {
    for (let count = 1; ; count++) {
      let record = null
      let failure
      try {
        const outcome = await attempt(baseRequest, settings)
        if (outcome.record.ok) return outcome.record
        record = outcome.record
        failure = errorFromRecord(record)
      } catch (error) {
        failure = asHttpError(error, baseRequest)
      }
      const outcome = { error: failure, record, attempt: count, request: baseRequest }
      if (
        failure.code === 'aborted'
        || count >= settings.retry.attempts
        || !shouldRetry(settings.retry, outcome)
      ) {
        throw failure
      }
      const wait = backoffDelay(settings.retry, count, retryAfterDelay(record))
      impLogger.debug(
        `${subject}: ${baseRequest.method} ${baseRequest.url} failed (${failure.code}${
          failure.status ? ` ${failure.status}` : ''
        }) - retrying in ${Math.round(wait)}ms`,
      )
      try {
        await delay(wait, baseRequest.signal)
      } catch {
        throw clientAbort.signal.aborted
          ? cancelledError(subject, closed, baseRequest)
          : abortedError(baseRequest)
      }
    }
  }

  const call = async (method, path, callOptions, full) => {
    if (closed) {
      throw new HttpError(`imp: ${subject} - ${method} ${path} was not sent: ${closed}`, {
        code: 'aborted',
        method,
        url: path,
      })
    }
    if (callOptions !== undefined && callOptions !== null && !isPlainObject(callOptions)) {
      throw new Error(
        `imp: ${subject} - the second argument of ${method.toLowerCase()} is the call's options, like { body, query, headers }`,
      )
    }
    const given = callOptions ?? {}
    const settings = {
      retry:
        given.retry === undefined
          ? IDEMPOTENT_METHODS.has(method)
            ? clientRetry
            : { ...clientRetry, attempts: 1 }
          : normalizeRetry(given.retry, subject, clientRetry),
      timeout:
        given.timeout === undefined ? clientTimeout : normalizeTimeout(given.timeout, subject),
      onRequest: [...clientOnRequest, ...hookList(given.onRequest, subject, 'onRequest')],
      onResponse: [...clientOnResponse, ...hookList(given.onResponse, subject, 'onResponse')],
      requestIdHeader: normalizeRequestIdHeader(given.requestId, subject, clientRequestIdHeader),
    }
    const request = buildRequest(method, path, given, settings.requestIdHeader)
    const tracked = given.track === undefined ? null : trackerFor(given.track)
    const silent = given.silent === true

    tracker.start()
    tracked?.start()
    try {
      const record = await sendWithRetries(request, settings)
      if (closed) throw cancelledError(subject, closed, request)
      tracker.settle(null)
      tracked?.settle(null)
      return full ? record : record.body
    } catch (error) {
      if (silent) tracker.settle(null, { keepError: true })
      else tracker.settle(error)
      tracked?.settle(error)
      if (isReportedFailure(error)) reportError()
      throw error
    }
  }

  const verb = (method) => (path, callOptions) => call(method, path, callOptions, false)

  const closeClient = (reason) => {
    if (closed) return
    closed = reason
    clientAbort.abort()
    trackers.clear()
    impLogger.debug(`${subject}: ${reason} - requests in flight cancelled`)
  }

  return {
    name,
    get: verb('GET'),
    post: verb('POST'),
    put: verb('PUT'),
    patch: verb('PATCH'),
    delete: verb('DELETE'),
    head: verb('HEAD'),
    request: (path, callOptions) =>
      call((callOptions?.method ?? 'GET').toUpperCase(), path, callOptions, true),
    pending: tracker.pending,
    lastError: tracker.lastError,
    clearError: () => tracker.clearError(),
    tracked: (key) => {
      const found = trackerFor(key)
      return { pending: found.pending, lastError: found.lastError }
    },
    close: () => closeClient('the client was closed'),
    [CLIENT_BRAND]: true,
    [TRACKER_STATES]: (key) => (key === null ? tracker : trackerFor(key)).states,
    [CLOSE_WITH_OWNER]: () => closeClient('the client was closed when its component unmounted'),
  }
}

export const httpClientNameProblem = (name) =>
  namespacedNameProblem(name, 'http client name', 'myapp.api')

const assertValidClientName = (name) => {
  const problem = httpClientNameProblem(name)
  if (problem) throw new Error(`imp: ${problem}`)
}

const isPlainOrMissing = (value) => value === undefined || value === null || isPlainObject(value)

const unmountedError = (name, host, verb, path) =>
  new HttpError(
    `imp: http client '${name}' - ${verb} ${path} was cancelled: <${host.localName}> left the page`,
    { code: 'aborted', method: String(verb).toUpperCase(), url: path },
  )

const createClientConsumer = (name, initialProvider, scope) => {
  let provider = initialProvider

  const providedClient = () => findProvided(CLIENT_KIND, name, scope.host)?.value ?? null

  scope.addRebind(() => {
    const found = providedClient()
    if (!found) {
      impLogger.error(
        `http client '${name}' is not provided at the new position of <${scope.host.localName}> - keeping the previous client: calls still go through it, but nothing at this position shares it`,
      )
      return
    }
    provider = found
  })

  const following = (key, field) =>
    createFollowingState(
      `${key === null ? name : `${name}.${key}`}.${field}`,
      initialProvider[TRACKER_STATES](key)[field],
      () => providedClient()?.[TRACKER_STATES](key)[field] ?? null,
      scope,
    )

  const pending = following(null, 'pending')
  const lastError = following(null, 'lastError')

  const mountAbort = new AbortController()
  scope.addCleanup(() => mountAbort.abort())

  const boundToMount = (verb) => (path, callOptions) => {
    if (scope.ended || callOptions?.detached === true || !isPlainOrMissing(callOptions)) {
      return provider[verb](path, callOptions)
    }
    const signal = callOptions?.signal
      ? AbortSignal.any([mountAbort.signal, callOptions.signal])
      : mountAbort.signal
    return provider[verb](path, { ...callOptions, signal }).then((result) => {
      if (scope.ended) throw unmountedError(name, scope.host, callOptions?.method ?? verb, path)
      return result
    })
  }

  return {
    name,
    get: boundToMount('get'),
    post: boundToMount('post'),
    put: boundToMount('put'),
    patch: boundToMount('patch'),
    delete: boundToMount('delete'),
    head: boundToMount('head'),
    request: boundToMount('request'),
    pending,
    lastError,
    clearError: () => provider.clearError(),
    tracked: (key) => ({
      pending: following(key, 'pending'),
      lastError: following(key, 'lastError'),
    }),
  }
}

export function createHttpClient(name, options = {}) {
  assertValidClientName(name)
  const client = createClient(name, options)
  impLogger.debug(`http client '${name}' created`)
  return client
}

const isHttpClient = (value) => Boolean(value?.[CLIENT_BRAND])

const provideHttpClient = (scope, nameOrClient, options, shared) => {
  const name = shared ? nameOrClient.name : nameOrClient
  const providerNode = scope.host
  const existing = findProvided(CLIENT_KIND, name, providerNode)
  if (existing && existing.provider === providerNode) {
    throw new Error(
      `imp: http client '${name}' is already initialized in this scope - initHttpClient runs once per scope; call useHttpClient(self, '${name}') to reach the existing client`,
    )
  }
  const client = shared ? nameOrClient : createClient(name, options)
  impLogger.debug(
    `http client '${name}' ${
      shared ? 'shared into' : 'initialized in'
    } <${providerNode.localName}>`,
  )
  provideOnHost(CLIENT_KIND, name, client, providerNode, scope)
  if (!shared) scope.addCleanup(() => client[CLOSE_WITH_OWNER]())
  return client
}

const consumeHttpClient = (scope, name) => {
  const found = findProvided(CLIENT_KIND, name, scope.host)
  if (!found) {
    throw new Error(
      `imp: no http client '${name}' is initialized in the ancestors of <${scope.host.localName}> - call initHttpClient(self, '${name}', { baseUrl }) in the setup of an ancestor component first`,
    )
  }
  impLogger.debug(`http client '${name}' resolved from <${found.provider.localName}>`)
  return createClientConsumer(name, found.value, scope)
}

export function initHttpClient(self, nameOrClient, options = {}) {
  const shared = isHttpClient(nameOrClient)
  const name = shared ? nameOrClient.name : nameOrClient
  return claimThroughSelf(self, CLIENT_KIND, 'initHttpClient', name, (scope) => {
    if (!shared && typeof nameOrClient !== 'string') {
      throw new Error(
        `imp: initHttpClient takes self, a name and options, like initHttpClient(self, 'myapp.api', { baseUrl }), or self and a client from createHttpClient to share with this subtree`,
      )
    }
    if (!shared) assertValidClientName(name)
    return provideHttpClient(scope, nameOrClient, options, shared)
  })
}

export function useHttpClient(self, name) {
  return resolveThroughSelf(self, CLIENT_KIND, 'useHttpClient', name, (scope) => {
    assertValidClientName(name)
    return consumeHttpClient(scope, name)
  })
}
