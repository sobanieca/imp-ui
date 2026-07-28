import { component, mount } from 'imp'
import { div, span } from 'imp/html'
import { createHttpClient, HttpError, initHttpClient, mock, useHttpClient } from 'imp/http'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'

const jsonResponse = (body, options = {}) =>
  new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { 'content-type': 'application/json', ...options.headers },
  })

const sequence = (...handlers) => {
  let index = 0
  return (...args) => handlers[Math.min(index++, handlers.length - 1)](...args)
}

const stubFetch = (handler) => spy(globalThis, 'fetch', (...args) => handler(...args))

const deferred = () => {
  let settle
  return { promise: new Promise((resolve) => settle = resolve), answer: (value) => settle(value) }
}

const failure = (promise) => promise.then(() => null, (error) => error)

const probe = component('http-probe', { onMount: (_instance, run) => run() })

const owner = (run) => {
  const container = document.createElement('div')
  document.body.append(container)
  const host = probe(run)
  mount(container, host)
  return host
}

const client = (options) => {
  let api
  owner(() =>
    void (api = initHttpClient('test.api', { baseUrl: 'https://api.test/v1', ...options }))
  )
  return api
}

const setupProblem = (setup) => {
  let problem = null
  owner(() => {
    try {
      setup()
    } catch (error) {
      problem = error
    }
  })
  return problem?.message ?? ''
}

const clientProblem = (options) =>
  setupProblem(() => initHttpClient('test.api', { baseUrl: 'https://api.test/v1', ...options }))

beforeEach(() => {
  document.body.replaceChildren()
})

test('a verb resolves the parsed JSON body from the base URL', async () => {
  const fetched = stubFetch(() => jsonResponse({ id: 'u1', name: 'Ada' }))
  const api = client({ headers: { accept: 'application/json' } })

  expect(await api.get('/users/u1')).toEqual({ id: 'u1', name: 'Ada' })
  expect(fetched.calls[0][0]).toEqual('https://api.test/v1/users/u1')
  expect(fetched.calls[0][1].headers.accept).toEqual('application/json')
})

test('every call carries a request id of its own', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  const api = client()

  await api.get('/users')
  await api.post('/users', { body: { name: 'Ada' } })

  const ids = fetched.calls.map(([, init]) => init.headers['x-request-id'])
  expect(ids[0]).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/)
  expect(ids[1]).not.toEqual(ids[0])
})

test('the request id header is renamed, disabled and overridden per call', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  const renamed = client({ requestId: 'X-Correlation-Id' })

  await renamed.get('/users')
  expect(fetched.calls[0][1].headers['x-correlation-id']).toBeTruthy()
  expect(fetched.calls[0][1].headers['x-request-id']).toEqual(undefined)

  await renamed.get('/users', { requestId: false })
  expect(fetched.calls[1][1].headers['x-correlation-id']).toEqual(undefined)

  const off = client({ requestId: false })
  await off.get('/users')
  expect(fetched.calls[2][1].headers['x-request-id']).toEqual(undefined)

  await off.get('/users', { requestId: true })
  expect(fetched.calls[3][1].headers['x-request-id']).toBeTruthy()
})

test('a request id given by hand wins over the generated one, and survives retries', async () => {
  const fetched = stubFetch(sequence(
    () => jsonResponse({}, { status: 503 }),
    () => jsonResponse({}),
  ))
  const api = client({ retry: { attempts: 2, delay: 0 } })

  await api.get('/users', { headers: { 'X-Request-Id': 'mine-1' } })

  expect(fetched.calls.map(([, init]) => init.headers['x-request-id'])).toEqual([
    'mine-1',
    'mine-1',
  ])
})

test('interceptors and mock handlers see the request id', async () => {
  let seen = null
  const api = client({
    onRequest: (request) => {
      seen = request.headers['x-request-id']
      return request
    },
    mock: { 'GET /users': ({ headers }) => ({ id: headers['x-request-id'] }) },
  })

  const body = await api.get('/users')

  expect(seen).toBeTruthy()
  expect(body.id).toEqual(seen)
})

test('query values are appended to the URL, arrays repeated', async () => {
  const fetched = stubFetch(() => jsonResponse([]))
  const api = client()

  await api.get('/users', { query: { page: 2, tag: ['a', 'b'], skipped: null } })

  expect(fetched.calls[0][0]).toEqual('https://api.test/v1/users?page=2&tag=a&tag=b')
})

test('an object body is sent as JSON, other bodies are passed through', async () => {
  const fetched = stubFetch(() => jsonResponse({ id: 'new' }))
  const api = client()

  await api.post('/users', { body: { name: 'Ada' } })
  const form = new URLSearchParams({ name: 'Grace' })
  await api.post('/users', { body: form })

  expect(fetched.calls[0][1].body).toEqual('{"name":"Ada"}')
  expect(fetched.calls[0][1].headers['content-type']).toEqual('application/json')
  expect(fetched.calls[1][1].body).toEqual(form)
  expect(fetched.calls[1][1].headers['content-type']).toEqual(undefined)
})

test('a failing status rejects with an HttpError carrying the response', async () => {
  stubFetch(() => jsonResponse({ error: 'nope' }, { status: 422 }))
  const api = client()

  const error = await failure(api.post('/users', { body: {} }))

  expect(error instanceof HttpError).toBeTruthy()
  expect(error.status).toEqual(422)
  expect(error.code).toEqual('status')
  expect(error.body).toEqual({ error: 'nope' })
  expect(error.message).toMatch('answered 422')
})

test('request returns the whole response, verbs return the body', async () => {
  stubFetch(() => jsonResponse({ id: 'u1' }, { headers: { 'x-total': '12' } }))
  const api = client()

  const response = await api.request('/users/u1')

  expect(response.status).toEqual(200)
  expect(response.ok).toBeTruthy()
  expect(response.headers['x-total']).toEqual('12')
  expect(response.body).toEqual({ id: 'u1' })
})

test('a 204 and an empty body resolve to null', async () => {
  stubFetch(() => new Response(null, { status: 204 }))
  const api = client()

  expect(await api.delete('/users/u1')).toEqual(null)
})

test(
  'an idempotent call retries and resolves once a retried status succeeds',
  async ({ clock }) => {
    const fetched = stubFetch(sequence(
      () => jsonResponse({}, { status: 503 }),
      () => jsonResponse({ ok: true }),
    ))
    const api = client({ retry: { attempts: 3, delay: 100, jitter: false } })

    const pending = api.get('/things')
    await clock.tick(100)

    expect(await pending).toEqual({ ok: true })
    expect(fetched.calls.length).toEqual(2)
  },
  { fakeTimers: true },
)

test('retries stop at the configured number of attempts', async ({ clock }) => {
  const fetched = stubFetch(() => jsonResponse({}, { status: 500 }))
  const api = client({ retry: { attempts: 3, delay: 10, jitter: false } })

  const pending = failure(api.get('/things'))
  await clock.tick(1000)

  expect((await pending).status).toEqual(500)
  expect(fetched.calls.length).toEqual(3)
}, { fakeTimers: true })

test('retryOn narrows which statuses are retried', async ({ clock }) => {
  const fetched = stubFetch(() => jsonResponse({}, { status: 500 }))
  const api = client({ retry: { attempts: 3, delay: 10, jitter: false, retryOn: [502, 503] } })

  const pending = failure(api.get('/things'))
  await clock.tick(1000)

  expect((await pending).status).toEqual(500)
  expect(fetched.calls.length).toEqual(1)
}, { fakeTimers: true })

test('a post retries only when the call asks for it', async ({ clock }) => {
  const fetched = stubFetch(() => jsonResponse({}, { status: 503 }))
  const api = client({ retry: { attempts: 2, delay: 10, jitter: false } })

  await failure(api.post('/things', { body: {} }))
  expect(fetched.calls.length).toEqual(1)

  const pending = failure(api.post('/things', { body: {}, retry: { attempts: 2 } }))
  await clock.tick(1000)
  await pending

  expect(fetched.calls.length).toEqual(3)
}, { fakeTimers: true })

test('Retry-After decides how long a 429 waits', async ({ clock }) => {
  const fetched = stubFetch(sequence(
    () => new Response(null, { status: 429, headers: { 'retry-after': '2' } }),
    () => jsonResponse({ ok: true }),
  ))
  const api = client({ retry: { attempts: 2, delay: 10, jitter: false } })

  const pending = api.get('/things')
  await clock.tick(1000)
  expect(fetched.calls.length).toEqual(1)

  await clock.tick(1000)
  expect(await pending).toEqual({ ok: true })
}, { fakeTimers: true })

test('a timeout aborts the request in flight', async ({ clock }) => {
  stubFetch((_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    )
  )
  const api = client({ timeout: 5000 })

  const pending = failure(api.get('/slow'))
  await clock.tick(5000)
  const error = await pending

  expect(error.code).toEqual('timeout')
  expect(error.message).toMatch('timed out after 5000ms')
}, { fakeTimers: true })

test("a caller's signal aborts the request and is never retried", async ({ clock }) => {
  const fetched = stubFetch((_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    )
  )
  const api = client({ retry: { attempts: 3, delay: 10, jitter: false } })
  const controller = new AbortController()

  const pending = failure(api.get('/slow', { signal: controller.signal }))
  controller.abort()
  await clock.tick(1000)

  expect((await pending).code).toEqual('aborted')
  expect(fetched.calls.length).toEqual(1)
}, { fakeTimers: true })

test('every call reaches the network — nothing is cached or shared', async () => {
  const answering = deferred()
  const fetched = stubFetch(async () => {
    await answering.promise
    return jsonResponse({ id: 'u1' })
  })
  const api = client()

  const both = Promise.all([api.get('/users/u1'), api.get('/users/u1')])
  answering.answer()

  expect(await both).toEqual([{ id: 'u1' }, { id: 'u1' }])
  expect(fetched.calls.length).toEqual(2)

  expect(await api.get('/users/u1')).toEqual({ id: 'u1' })
  expect(fetched.calls.length).toEqual(3)
})

test('onRequest and onResponse hooks run in order, per call composing with the client', async () => {
  const fetched = stubFetch(() => jsonResponse({ data: { id: 'u1' } }))
  const seen = []
  const api = client({
    onRequest: [
      (request) => {
        seen.push('client onRequest')
        request.headers.authorization = 'Bearer token'
        return request
      },
    ],
    onResponse: (response) => {
      seen.push('client onResponse')
      return { ...response, body: response.body.data }
    },
  })

  const user = await api.get('/users/u1', {
    onRequest: (request) => {
      seen.push('call onRequest')
      request.headers['x-request-id'] = 'r1'
    },
    onResponse: (response, request) => {
      seen.push(`call onResponse for ${request.method}`)
      return response
    },
  })

  expect(user).toEqual({ id: 'u1' })
  expect(seen).toEqual([
    'client onRequest',
    'call onRequest',
    'client onResponse',
    'call onResponse for GET',
  ])
  expect(fetched.calls[0][1].headers.authorization).toEqual('Bearer token')
  expect(fetched.calls[0][1].headers['x-request-id']).toEqual('r1')
})

test('an onRequest hook that throws stops the request before it is sent', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  const api = client({
    onRequest: () => {
      throw new Error('no token')
    },
  })

  const error = await failure(api.get('/users'))

  expect(error.code).toEqual('hook')
  expect(error.message).toMatch('no token')
  expect(fetched.calls.length).toEqual(0)
})

test('a refreshed token from onRequest applies to the next attempt', async ({ clock }) => {
  const fetched = stubFetch(sequence(
    () => jsonResponse({}, { status: 503 }),
    () => jsonResponse({ ok: true }),
  ))
  let token = 'stale'
  const api = client({
    retry: { attempts: 2, delay: 10, jitter: false },
    onRequest: (request) => {
      request.headers.authorization = token
      token = 'fresh'
      return request
    },
  })

  const pending = api.get('/things')
  await clock.tick(100)
  await pending

  expect(fetched.calls[0][1].headers.authorization).toEqual('stale')
  expect(fetched.calls[1][1].headers.authorization).toEqual('fresh')
}, { fakeTimers: true })

test('mock routes answer with no backend, matching params, query and body', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  const api = client({
    mock: {
      'GET /users/:id': ({ params, query }) => ({ id: params.id, page: query.page }),
      'POST /users': ({ body }) => mock.response({ id: 'new', ...body }, { status: 201 }),
    },
  })

  expect(await api.get('/users/u1', { query: { page: '2' } })).toEqual({ id: 'u1', page: '2' })

  const created = await api.request('/users', { method: 'POST', body: { name: 'Ada' } })
  expect(created.status).toEqual(201)
  expect(created.body).toEqual({ id: 'new', name: 'Ada' })
  expect(fetched.calls.length).toEqual(0)
})

test('an unmatched route 404s, or reaches the network when configured to', async () => {
  const fetched = stubFetch(() => jsonResponse({ real: true }))
  const mocked = client({ mock: { 'GET /users': () => [] } })
  const partial = client({ mock: { 'GET /users': () => [] }, mockFallback: 'network' })

  expect((await failure(mocked.get('/orders'))).status).toEqual(404)
  expect(await partial.get('/orders')).toEqual({ real: true })
  expect(fetched.calls.length).toEqual(1)
})

test(
  'a mocked failure and latency travel the same retry path as the network',
  async ({ clock }) => {
    let attempts = 0
    const api = client({
      retry: { attempts: 3, delay: 10, jitter: false },
      mock: {
        'GET /flaky': () => {
          attempts++
          return attempts < 3 ? mock.error(503) : mock.response({ ok: true }, { latency: 50 })
        },
      },
    })

    const pending = api.get('/flaky')
    await clock.tick(1000)

    expect(await pending).toEqual({ ok: true })
    expect(attempts).toEqual(3)
  },
  { fakeTimers: true },
)

test('mock handlers can be loaded lazily through a thunk', async () => {
  const api = client({
    mock: () => Promise.resolve({ default: { 'GET /users': () => [{ id: 'u1' }] } }),
  })

  expect(await api.get('/users')).toEqual([{ id: 'u1' }])
})

test('pending counts requests in flight and lastError keeps the last failure', async () => {
  const answering = deferred()
  stubFetch(sequence(() => answering.promise, () => jsonResponse({ ok: true })))
  const api = client()

  expect(api.pending.get()).toEqual(0)
  const pending = failure(api.get('/users'))
  expect(api.pending.get()).toEqual(1)

  answering.answer(jsonResponse({ error: 'boom' }, { status: 500 }))
  await pending

  expect(api.pending.get()).toEqual(0)
  expect(api.lastError.get().status).toEqual(500)
  expect(api.lastError.get().body).toEqual({ error: 'boom' })

  await api.get('/users')
  expect(api.lastError.get()).toEqual(null)
})

test('clearError resets the last failure', async () => {
  stubFetch(() => jsonResponse({}, { status: 500 }))
  const api = client()

  await failure(api.get('/users'))
  expect(api.lastError.get()).not.toEqual(null)

  api.clearError()
  expect(api.lastError.get()).toEqual(null)
})

test('a tracked call gets request state of its own', async () => {
  stubFetch(() => jsonResponse({}, { status: 500 }))
  const api = client()
  const list = api.tracked('users.list')

  await failure(api.get('/users', { track: 'users.list' }))

  expect(list.pending.get()).toEqual(0)
  expect(list.lastError.get().status).toEqual(500)
  expect(api.tracked('users.detail').lastError.get()).toEqual(null)
})

test('pending binds to the DOM like any other state', async () => {
  const answering = deferred()
  stubFetch(() => answering.promise)
  const api = client()

  const meter = component('http-meter', {
    onMount: () => div(api.pending.text((count) => `${count} in flight`)),
  })
  const host = document.createElement('div')
  document.body.append(host)
  mount(host, meter())
  await settled()
  const rendered = () => renderedText(host.firstElementChild)

  expect(rendered()).toEqual('0 in flight')

  const pending = api.get('/users')
  expect(rendered()).toEqual('1 in flight')

  answering.answer(jsonResponse({}))
  await pending
  expect(rendered()).toEqual('0 in flight')
  host.remove()
})

test('initHttpClient reports what it cannot accept', () => {
  expect(clientProblem({ retry: { backoff: 'linear' } })).toContain(
    "must be 'exponential' or 'fixed'",
  )
  expect(clientProblem({ timeout: 'soon' })).toContain('timeout must be a number of milliseconds')
  expect(clientProblem({ onRequest: 'later' })).toContain('onRequest takes a function')
  expect(clientProblem({ mock: { 'users/:id': () => ({}) } })).toContain(
    "must read like 'GET /users/:id'",
  )
  expect(clientProblem({ mockFallback: 'guess' })).toContain("must be 'notFound' or 'network'")
  expect(clientProblem({ requestId: 'x request id' })).toContain('requestId must be a header name')
})

test('useHttpClient reaches the client an ancestor initialized', async () => {
  const fetched = stubFetch(() => jsonResponse([{ id: 'u1' }]))
  let used
  const reader = component('h1-reader', {
    onMount: () => void (used = useHttpClient('test.api')),
  })
  owner(() => {
    initHttpClient('test.api', { baseUrl: 'https://api.test/v1' })
    return reader()
  })

  expect(await used.get('/users')).toEqual([{ id: 'u1' }])
  expect(fetched.calls[0][0]).toEqual('https://api.test/v1/users')
})

test('the nearest client wins, so an area shadows the app-wide one', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  let inArea
  const reader = component('h2-reader', {
    onMount: () => void (inArea = useHttpClient('test.api')),
  })
  const area = component('h2-area', {
    onMount: () => {
      initHttpClient('test.api', { baseUrl: 'https://area.test' })
      return reader()
    },
  })
  owner(() => {
    initHttpClient('test.api', { baseUrl: 'https://app.test' })
    return area()
  })

  await inArea.get('/users')
  expect(fetched.calls[0][0]).toEqual('https://area.test/users')
})

test('unmounting the owner cancels the requests in flight', async () => {
  const answering = deferred()
  stubFetch(() => answering.promise)
  let api
  const host = owner(() =>
    void (api = initHttpClient('test.area', { baseUrl: 'https://api.test' }))
  )

  const pending = failure(api.get('/users'))
  expect(api.pending.get()).toEqual(1)
  host.remove()
  await settled()

  const error = await pending
  expect(error instanceof HttpError).toBeTruthy()
  expect(error.code).toEqual('aborted')
  expect(error.message).toContain('unmounted')
})

test('unmounting the owner refuses later calls through a kept handle', async () => {
  const fetched = stubFetch(() => jsonResponse({ id: 'u1' }))
  let api
  const host = owner(() =>
    void (api = initHttpClient('test.area', { baseUrl: 'https://api.test' }))
  )

  await api.get('/users')
  expect(fetched.calls.length).toEqual(1)

  host.remove()
  await settled()

  const error = await failure(api.get('/users'))
  expect(error.code).toEqual('aborted')
  expect(error.message).toContain('unmounted')
  expect(fetched.calls.length).toEqual(1)
})

test('a moved component uses the client at its new position', async () => {
  const fetched = stubFetch(() => jsonResponse({}))
  const reader = component('h5-reader', {
    onMount: () => void (used = useHttpClient('test.api')),
  })
  const area = component('h5-area', {
    onMount: (_instance, baseUrl) => {
      initHttpClient('test.api', { baseUrl })
      return div({ class: 'slot' })
    },
  })
  let used
  const first = area('https://first.test')
  const second = area('https://second.test')
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.shadowRoot.querySelector('.slot').append(readerHost)

  await used.get('/users')
  expect(fetched.calls[0][0]).toEqual('https://first.test/users')

  second.shadowRoot.querySelector('.slot').append(readerHost)
  await used.get('/users')
  expect(fetched.calls[1][0]).toEqual('https://second.test/users')
})

test('request state of a used client binds to the DOM and follows a move', async () => {
  const answering = deferred()
  stubFetch(() => answering.promise)
  const reader = component('h6-reader', {
    onMount: () => {
      used = useHttpClient('test.api')
      return span(used.pending.text((count) => `${count}`))
    },
  })
  const area = component('h6-area', {
    onMount: (_instance, baseUrl) => {
      areas.push(initHttpClient('test.api', { baseUrl }))
      return div({ class: 'slot' })
    },
  })
  let used
  const areas = []
  const first = area('https://first.test')
  const second = area('https://second.test')
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('0')

  const pending = failure(areas[0].get('/users'))
  expect(renderedText(readerHost)).toEqual('1')

  second.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('0')
  const alsoPending = failure(areas[1].get('/users'))
  expect(renderedText(readerHost)).toEqual('1')

  answering.answer(jsonResponse({}))
  await pending
  await alsoPending
})

test('createHttpClient works outside a component and closes on demand', async () => {
  const answering = deferred()
  stubFetch(sequence(() => jsonResponse({ id: 'u1' }), () => answering.promise))
  const api = createHttpClient('test.shared', { baseUrl: 'https://api.test' })

  expect(await api.get('/users')).toEqual({ id: 'u1' })

  const pending = failure(api.get('/users/u1'))
  await api.close()
  const error = await pending

  expect(error.code).toEqual('aborted')
  expect(error.message).toContain('the client was closed')
  expect((await failure(api.get('/users'))).message).toContain('was not sent')
})

test('a client you created can be shared into a subtree and outlives it', async () => {
  const fetched = stubFetch(() => jsonResponse({ ok: true }))
  const api = createHttpClient('test.shared', { baseUrl: 'https://api.test' })
  let used
  const reader = component('h7-reader', {
    onMount: () => void (used = useHttpClient('test.shared')),
  })
  const host = owner(() => {
    initHttpClient(api)
    return reader()
  })

  expect(await used.get('/users')).toEqual({ ok: true })

  host.remove()
  await settled()

  expect(await api.get('/users')).toEqual({ ok: true })
  expect(fetched.calls.length).toEqual(2)
  await api.close()
})

test('initHttpClient reports a first argument that is neither a name nor a client', () => {
  expect(setupProblem(() => initHttpClient({ baseUrl: 'https://api.test' }))).toContain(
    'takes a name and options',
  )
})

test('initHttpClient and useHttpClient need a mounting component', () => {
  expect(() => initHttpClient('test.api', {})).toThrow('needs a mounting component')
  expect(() => useHttpClient('test.api')).toThrow('needs a mounting component')
})

test('client names must be namespaced', () => {
  expect(setupProblem(() => initHttpClient('api', {}))).toContain('must include a namespace')
  expect(setupProblem(() => useHttpClient('api'))).toContain('must include a namespace')
  expect(() => createHttpClient('api')).toThrow('must include a namespace')
  expect(() => createHttpClient(42)).toThrow('must be a namespaced string')
})

test('useHttpClient without a provider reports where to initialize it', () => {
  expect(setupProblem(() => useHttpClient('test.missing'))).toContain(
    "no http client 'test.missing' is initialized",
  )
})

test('initHttpClient twice in the same component scope throws', () => {
  const problem = setupProblem(() => {
    initHttpClient('test.api', { baseUrl: 'https://api.test' })
    initHttpClient('test.api', { baseUrl: 'https://api.test' })
  })
  expect(problem).toContain("http client 'test.api' is already initialized")
})
