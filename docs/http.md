# imp-ui — HTTP

A configured HTTP client, so your app talks to its backend without hand-rolling `fetch` wrappers.
You describe the network layer once — base URL, headers, retries, timeouts — and call it everywhere.
Loading and error state come with it, ready to bind to the DOM, and the whole app can run against
mock responses with no backend at all.

```js
import { component } from 'imp'
import { initHttpClient, useHttpClient } from 'imp/http'
import { env } from 'imp'

const app = component('my-app', {
  onMount: () => {
    initHttpClient('myapp.api', {
      baseUrl: env.API_URL,
      headers: { accept: 'application/json' },
      retry: { attempts: 3, backoff: 'exponential', retryOn: [502, 503, 504] },
      timeout: 10_000,
    })
    return screens()
  },
})

const profile = component('user-profile', {
  onMount: async (_instance, { id }) => {
    const api = useHttpClient('myapp.api')
    const user = await api.get(`/users/${id}`)
    return card(user)
  },
})
```

## Mental model

- **A client belongs to a component.** `initHttpClient(name, options)` in a component's `onMount`
  configures it; every component mounted below reaches it with `useHttpClient(name)`. It is the same
  shape as [state](state.md) — named, resolved through the DOM, owned by the component that
  initialized it.
- **Its lifetime is that component's lifetime.** When the owner unmounts, the client goes with it:
  requests in flight are cancelled and retries stop. Nothing to dispose by hand.
- **Unless you take the lifetime yourself.** `createHttpClient(name, options)` builds a client
  anywhere — module scope, a worker — that lives until you `close()` it, and it can be shared into a
  component subtree without becoming the subtree's to end.
- **A client is named** (`'myapp.api'`), with the same namespaced names states use. The name labels
  its request state and is how a component asks for _this_ client.
- **Verbs return the body.** `get`, `post`, `put`, `patch`, `delete`, and `head` resolve to the
  parsed response body. When you need the status or the headers, `request` gives you the whole
  response.
- **A failure rejects.** Any non-2xx status, transport failure, timeout, or abort rejects with an
  `HttpError` carrying everything about what went wrong. There are no `if (response.ok)` checks to
  forget.
- **Every call goes to the network.** The client holds no response cache and does not join identical
  requests together — a call you make is a request that is sent. Two components that each ask for
  `/users` at mount make two requests; when that matters, load the data once in a component above
  them and pass it down, or hold it in [state](state.md) they share.
- **Every call is identified.** imp generates a UUID per call and sends it as `x-request-id`, so the
  request in your network panel and the line in your backend's log share a name. Rename the header
  or turn it off with `requestId`.
- **Everything is declared once, overridable per call.** Every option below can be set on the client
  and overridden on a single call.
- **Requests and responses are plain data** — `{ method, url, headers, body, signal, meta }` in,
  `{ status, statusText, ok, url, method, headers, body }` out, with header names lower-cased. That
  is what interceptors read and rewrite.

## Where a client lives

You decide a client's reach by choosing which component initializes it — there is no other scope.

**An app-wide client** is one your root component initializes. It spans the whole tree and never
goes away, because the root never unmounts:

```js
component('my-app', {
  onMount: () => {
    initHttpClient('myapp.api', { baseUrl: env.API_URL })
    return layout()
  },
})
```

**A section-wide client** is one an [area's](routing.md) root component initializes. It exists while
the user is in that section and is gone the moment they navigate out:

```js
// admin/area.js — downloaded the first time someone visits /admin
const shell = component('admin-shell', {
  onMount: () => {
    initHttpClient('myapp.admin', { baseUrl: '/admin/api', timeout: 5000 })
    return div(adminNav(), router())
  },
})

export default area({ root: () => shell(), routes: adminRoutes })
```

The section's screens render into the `router()` inside `admin-shell`, so every one of them reaches
the client with `useHttpClient('myapp.admin')` — and nothing outside `/admin` can. The shell stays
mounted while the user moves between admin screens, so they share one client; it unmounts when they
leave the section.

That is the whole lifetime story. When `admin-shell` unmounts:

- every request still in flight is **cancelled** — the calls reject with `code: 'aborted'`, and any
  retry waiting on a backoff delay stops instead of firing later;
- the request state of every tracked call is **dropped**;
- a call made afterwards through a handle you kept rejects instead of quietly hitting the network.

**A client you own yourself** is the third option, for the cases a component cannot cover — a client
you hand to a worker, or one that must survive navigation on purpose. `createHttpClient` builds one
anywhere, including at module scope, and it is yours until you `close()` it:

```js
// api.js
export const sync = createHttpClient('myapp.sync', { baseUrl: env.API_URL })

// worker.js
import { sync } from './api.js'
self.onmessage = async ({ data }) => postMessage(await sync.get(`/orders/${data.id}`))
```

Share the same client with a component subtree by passing it to `initHttpClient` instead of options:

```js
component('my-app', {
  onMount: () => {
    initHttpClient(sync) // provided under its own name, 'myapp.sync'
    return layout()
  },
})
```

Below that component, `useHttpClient('myapp.sync')` reaches it like any other client — one client,
one set of request state, shared by your worker and your components.

**A shared client is not closed when that component unmounts.** That is the deliberate trade: imp
cannot know whether your worker is still using it, so `createHttpClient` hands you the lifetime and
`close()` is how you end it — cancelling everything in flight and rejecting later calls. Reach for
it only when something outside the DOM shares the client; a client used by components alone belongs
to a component.

A few rules follow from clients being owned by components, and they are the same ones states follow:

- **The nearest client wins.** If an area initializes `myapp.api` and the app root already has one,
  components inside the area get the area's. Two sibling areas initializing the same name each get
  their own — separate configuration, separate request state.
- **One name per component.** Initializing the same name twice in one component throws, so an
  accidental collision fails loudly instead of silently sharing.
- **Resolve before the first `await`.** In an `async onMount`, call `initHttpClient` /
  `useHttpClient` before you await anything; keep the handle and call it whenever you like
  afterwards, including in event handlers. The `imp/http-client-setup-before-await` lint rule
  catches this at write time.
- **Names are namespaced** — at least two dot-separated segments (`myapp.api`), like state names.

Because a client is reached through the DOM rather than imported, a plain helper module takes it as
an argument (`loadUsers(api, page)`) instead of importing it — the component that resolved the
client passes it in.

## Calling

Every verb takes a path and an options object:

```js
await api.get('/users', { query: { page: 2, tag: ['new', 'active'] } })
await api.post('/users', { body: { name: 'Ada' } })
await api.patch(`/users/${id}`, { body: { name: 'Grace' }, headers: { 'if-match': etag } })
await api.delete(`/users/${id}`)
```

- **`query`** is appended to the URL. `null` and `undefined` values are skipped; an array repeats
  the key.
- **`body`** — a plain object or array is serialized as JSON and given a
  `content-type: application/json` header. A `FormData`, `URLSearchParams`, `Blob`, string, or
  buffer is passed through untouched, with no content type imposed.
- **The response body is parsed by content type** — JSON into a value, `text/*` and XML into a
  string, anything else into a `Blob`. A `204` and an empty body resolve to `null`.
- Paths are joined onto `baseUrl`; a full URL (`https://…`) is used as given.

`request` returns the whole response, and takes the method as an option:

```js
const response = await api.request('/users', { method: 'POST', body: draft })
response.status // 201
response.headers.location // 'https://api.example.com/users/u1'
response.body // { id: 'u1', name: 'Ada' }
```

## Request ids

Every call carries an `x-request-id` header holding a UUID imp generated for it, so the request you
see in the network panel and the line it wrote in your backend's log share a name. There is nothing
to switch on:

```js
await api.get('/users') // x-request-id: 2f5a3c1e-9d84-4a17-b0f2-6c1de0b3a7e4
```

- **One id per call, not per attempt.** A retried request keeps the id it started with, so three
  tries read as the one call they are.
- **Rename the header** when your backend reads a different one — on the client or on a single call:

  ```js
  initHttpClient('myapp.api', { baseUrl, requestId: 'x-correlation-id' })
  await api.get('/users', { requestId: 'x-correlation-id' })
  ```

- **Turn it off** with `requestId: false`. Worth reaching for on a cross-origin API you do not
  control: a custom header makes the browser send a CORS preflight, and a server that does not list
  the header in `Access-Control-Allow-Headers` will refuse the call.
- **An id you set yourself wins.** Put the header in the client's `headers` or the call's and imp
  leaves it alone, which is how you carry an id you already have — one a server-rendered page handed
  you, or a trace id from elsewhere in your system.
- **Interceptors and mocks see it** like any other header, so `onRequest` can log it and a mock
  handler can echo it back.

## When a call fails

```js
import { HttpError } from 'imp/http'

try {
  await api.get(`/users/${id}`)
} catch (error) {
  if (error instanceof HttpError && error.status === 404) return null
  throw error
}
```

An `HttpError` carries:

| Field             | What it holds                                                         |
| ----------------- | --------------------------------------------------------------------- |
| `status`          | The response status, or `0` when no response arrived                  |
| `code`            | `status`, `network`, `timeout`, `aborted`, `parse`, or `hook`         |
| `method`, `url`   | The call that failed                                                  |
| `headers`, `body` | The response, when there was one — a parsed error body is right there |

`request` throws on the same failures as the verbs; it differs only in what it gives you on success.

## Retries

```js
const api = initHttpClient('myapp.api', {
  baseUrl,
  retry: { attempts: 3, backoff: 'exponential', delay: 300, retryOn: [502, 503, 504] },
})
```

- **`attempts`** counts total tries, not extra ones (`3` means at most three requests). `retry: 3`
  is shorthand for `{ attempts: 3 }`.
- **`backoff`** is `'exponential'` (doubling from `delay`) or `'fixed'`, capped by `maxDelay` (30
  seconds). Jitter spreads retries out so a recovering server is not hit by a synchronized wave —
  turn it off with `jitter: false` when you want exact timing in a test.
- **`retryOn`** is a list of statuses, or a function deciding from
  `{ status, error, attempt, request }`. Left out, imp retries `408`, `429`, `500`, `502`, `503`,
  `504`, plus network failures and timeouts.
- **`Retry-After`** on a `429` or `503` is honoured over the computed backoff, in seconds or as a
  date.
- **Only idempotent verbs retry.** `get`, `head`, `put`, and `delete` follow the client's policy;
  `post` and `patch` are sent once unless that call passes `retry` itself:

  ```js
  await api.post('/reports', { body: draft, retry: { attempts: 3 } })
  ```

## Timeouts and cancelling

`timeout` sets a per-attempt budget in milliseconds, on the client or on one call. When it expires
the request is genuinely aborted, not just abandoned, and the call rejects with `code: 'timeout'`.

Your own `signal` composes with it — the request ends when either fires:

```js
const controller = new AbortController()
const users = api.get('/users', { signal: controller.signal, timeout: 2000 })
controller.abort()
```

A call you aborted rejects with `code: 'aborted'` and is never retried. A timeout is retried like
any other failure.

**You rarely need to cancel by hand.** When the component that owns the client unmounts, everything
still in flight is aborted for you — that is what makes a screen's requests stop when the user
navigates away. Reach for your own `signal` for the cases the client's lifetime does not cover: a
search-as-you-type call superseded by the next keystroke, or a request you want a cancel button for.

## Interceptors

`onRequest` and `onResponse` are the way to change what is sent and what comes back. Both take a
function or an array of them, both may be async, and a per-call hook **adds to** the client's rather
than replacing it.

```js
const api = initHttpClient('myapp.api', {
  baseUrl,
  onRequest: (request) => {
    request.headers.authorization = `Bearer ${token()}`
    return request
  },
  onResponse: (response) => ({ ...response, body: response.body.data }),
})
```

- **`onRequest`** receives the fully-formed request — `{ method, url, headers, body, signal, meta }`
  — after imp has resolved the URL, merged the headers, and serialized the body, but before it goes
  out. Return it changed, or return a replacement. Throwing stops the call before any network
  traffic.
- **`onResponse`** receives `(response, request)` after the body is parsed and before anything else
  sees it. Return the response, changed or replaced. Throwing turns a transport success into a
  failed call — how you reject a `200` that carries an error envelope.
- **Order is defined.** `onRequest` runs _inside_ the retry loop, starting from the call's headers
  each attempt, so a token refreshed by a hook applies to the next try. `onResponse` runs _before_
  retry decisions and request state, so what it returns is what both see.
- **A hung hook aborts like a hung request** — the timeout budget covers hook time too.
- Mocked responses travel the same hooks as real ones.

Auth refresh, envelope unwrapping, request signing, and logging are all just hooks:

```js
let refreshing = null

const api = initHttpClient('myapp.api', {
  baseUrl,
  onRequest: async (request) => {
    if (isExpired(token)) {
      refreshing ??= refreshToken().finally(() => refreshing = null)
      token = await refreshing
    }
    request.headers.authorization = `Bearer ${token}`
    return request
  },
})
```

## Running without a backend

A client can answer from **mock handlers**, so the UI runs before (or without) its backend. The
handlers are code; whether they are used is configuration — an
[environment](cli.md#environments--per-target-config) value:

```js
import { initHttpClient, mock } from 'imp/http'

const api = initHttpClient('myapp.api', {
  baseUrl: env.API_URL,
  mock: env.MOCK && {
    'GET /users': () => [{ id: 'u1', name: 'Ada' }],
    'GET /users/:id': ({ params }) => ({ id: params.id, name: 'Ada' }),
    'POST /users': ({ body }) => mock.response({ id: 'new', ...body }, { status: 201 }),
    'GET /flaky': () => mock.error(503),
    'GET /slow': () => mock.response([], { latency: 1500 }),
  },
})
```

With `"mock": "env/mock.json"` in your `imp.json` environments and `MOCK: true` in that file,
`imp start --env mock` runs the whole app against the handlers. No source changes, no branches in
your components.

- **Routes** read `'METHOD /path'`, with `:name` for a parameter and `*` for the rest of a path.
  They match the path you call, so they read exactly like the call sites.
- **Handlers** receive `{ params, query, body, headers, method, url }` — `body` arrives parsed when
  it was sent as JSON — and return the response body, a `mock.response` (with `status`, `headers`
  and `latency`), a `mock.error(status, body)`, or a `Response` of your own.
- **Unmatched requests 404** by default, so a missing route is obvious. `mockFallback: 'network'`
  lets them through to the real backend instead, which is how you mock the half of an API that does
  not exist yet.
- **Mocks take the same path as the network.** A mocked `503` retries, a mocked `latency` keeps the
  spinner up, and a mocked response passes through your interceptors — mock and real behave the same
  because they _are_ the same code path.
- **Mocks stay asleep in production.** `env.MOCK` is falsy there, so the client never consults a
  handler. The map itself still travels in the bundle, though — environment values are read when the
  page loads, not baked in at build time, so the bundler cannot tell the branch is dead. To keep
  fixtures out of the bundle, pass a function instead of a map: imp only calls it when mocking is
  on, and `imp build` puts the module in a chunk of its own that is never fetched otherwise.

  ```js
  mock: env.MOCK && (() => import('./mocks.js'))
  ```

## Request state

Every client publishes its own state, shaped exactly like [state](state.md) — `get`, `watch`,
`text`, `view`, `each` — so you bind it instead of threading loading flags through your components:

```js
import { computed } from 'imp/state'
import { div, p } from 'imp/html'
import { useHttpClient } from 'imp/http'

const status = component('api-status', {
  onMount: () => {
    const api = useHttpClient('myapp.api')
    return div(
      div({ class: 'spinner', hidden: computed([api.pending], (count) => count === 0) }),
      api.lastError.view((error) => error && p({ class: 'error' }, error.message)),
    )
  },
})
```

- **`api.pending`** — how many calls are in flight right now.
- **`api.lastError`** — the most recent failure as plain data
  (`{ message, status, code, method, url, body }`), or `null`. It clears when a later call succeeds,
  and `api.clearError()` dismisses it by hand.

For one spinner on one request, name that call:

```js
await api.get('/users', { track: 'users.list' })

const { pending, lastError } = api.tracked('users.list')
```

`tracked` returns the same pair for that name; untracked calls cost nothing.

## Testing

Unit tests can stand in for the network by spying on `fetch`, and virtual time makes retries and
timeouts instant (see **[Testing](testing.md)**):

```js
import { component, mount } from 'imp'
import { expect, spy, test } from 'imp/test'
import { initHttpClient } from 'imp/http'

const owner = component('test-owner', { onMount: (_instance, setup) => setup() })

test('retries a failing read', async ({ clock }) => {
  let attempt = 0
  spy(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: attempt++ === 0 ? 503 : 200,
        headers: { 'content-type': 'application/json' },
      }),
    ))
  let api
  mount(
    document.body,
    owner(() =>
      void (api = initHttpClient('test.api', {
        baseUrl: 'https://api.test',
        retry: { attempts: 2, delay: 100, jitter: false },
      }))
    ),
  )

  const pending = api.get('/things')
  await clock.tick(100)

  expect(await pending).toEqual({ ok: true })
}, { fakeTimers: true })
```

A client is owned by a component, so a test mounts a small host to initialize it in — the same
one-liner works for every test in the file, and removing the host from the DOM is how you test that
unmounting cancels what was in flight.

A client configured with `mock` handlers needs no `fetch` stub at all — point the test at the same
handler map your `--env mock` run uses.

## Debugging

Set `IMP_LOG_LEVEL` to `debug` and the client traces itself in the console: which mock route
answered, every retry with the delay before it, and where a client was resolved from. See
**[Logging](logging.md)**.
