# imp-ui - HTTP

imp gives you a configured HTTP client. So your app talks to its backend, and you write no `fetch`
wrapper. You describe the network layer once, with a base URL, headers, retries and timeouts, and
you call it everywhere. The loading state and the error state come with it, ready to bind to the
DOM. The whole app can also run against [mock responses](cli.md#mock-responses--mockjs), with no
backend.

```js
import { component } from 'imp'
import { initHttpClient, useHttpClient } from 'imp/http'
import { env } from 'imp'

const app = component('my-app', {
  build: () => {
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
  build: async (_instance, { id }) => {
    const api = useHttpClient('myapp.api')
    const user = await api.get(`/users/${id}`)
    return card(user)
  },
})
```

## The mental model

- **A client belongs to a component.** `initHttpClient(name, options)` in the `build` of a component
  configures the client. Every component that mounts below it reaches the client with
  `useHttpClient(name)`. The shape is the same as [state](state.md). The client is named, imp
  resolves it through the DOM, and the component that initialized it owns it.
- **The client lives as long as that component.** When the owner unmounts, the client goes with it.
  imp cancels the requests in flight, and the retries stop. There is nothing to dispose of by hand.
- **You can take the lifetime yourself.** `createHttpClient(name, options)` builds a client
  anywhere, at module scope or in a worker. That client lives until you call `close()`. You can
  share it into a component subtree, and the subtree does not end it.
- **A client is named**, such as `'myapp.api'`. It uses the same namespaced names as a state. The
  name labels the request state of the client, and it is how a component asks for _this_ client.
- **A verb returns the body.** `get`, `post`, `put`, `patch`, `delete` and `head` resolve to the
  parsed response body. When you need the status or the headers, `request` gives you the whole
  response.
- **A failure rejects.** Any status that is not 2xx, a transport failure, a timeout and an abort all
  reject with an `HttpError`. That error carries everything about the failure. There is no
  `if (response.ok)` check that you can forget.
- **Every call goes to the network.** The client holds no response cache, and it does not join two
  identical requests. A call that you make is a request that imp sends. Two components that each ask
  for `/users` at mount make two requests. When that matters, load the data once in a component
  above them and pass it down, or hold it in a [state](state.md) that they share.
- **Every call has an identity.** imp generates a UUID per call and sends it as `x-request-id`. So
  the request in your network panel and the line in the log of your backend share a name. To rename
  the header, or to turn it off, use `requestId`.
- **You declare everything once, and you can override it per call.** You can set every option below
  on the client, and override it on a single call.
- **A request and a response are plain data.** A request is
  `{ method, url, headers, body, signal, meta }`, and a response is
  `{ status, statusText, ok, url, method, headers, body }`. imp lower-cases the header names. That
  is what an interceptor reads and rewrites. An interceptor can be an `async` function. So it can
  await work, such as a token refresh or a read from storage, before the call continues.

## Where a client lives

You decide the reach of a client when you choose the component that initializes it. There is no
other scope.

**An app-wide client** is a client that your root component initializes. It covers the whole tree,
and it never goes away, because the root never unmounts:

```js
component('my-app', {
  build: () => {
    initHttpClient('myapp.api', { baseUrl: env.API_URL })
    return layout()
  },
})
```

**A section-wide client** is a client that the root component of an [area](routing.md) initializes.
It exists while the user is in that section, and it is gone the moment when they navigate out:

```js
// admin/area.js - downloaded the first time someone visits /admin
const shell = component('admin-shell', {
  build: () => {
    initHttpClient('myapp.admin', { baseUrl: '/admin/api', timeout: 5000 })
    return div(adminNav(), router())
  },
})

export default area({ root: () => shell(), routes: adminRoutes })
```

The screens of the section render into the `router()` inside `admin-shell`. So every one of them
reaches the client with `useHttpClient('myapp.admin')`, and nothing outside `/admin` can. The shell
stays mounted while the user moves between the admin screens, so those screens share one client. The
shell unmounts when the user leaves the section.

That is the whole lifetime story. When `admin-shell` unmounts:

- imp **cancels** every request that is still in flight. The calls reject with `code: 'aborted'`,
  and a retry that waits on a backoff delay stops instead of firing later.
- imp **drops** the request state of every tracked call.
- A later call through a handle that you kept rejects. It does not go to the network.

**A client that you own yourself** is the third option. It covers the cases that a component cannot,
such as a client that you hand to a worker, or a client that must survive a navigation on purpose.
`createHttpClient` builds one anywhere, including at module scope. It is yours until you call
`close()`:

```js
// api.js
export const sync = createHttpClient('myapp.sync', { baseUrl: env.API_URL })

// worker.js
import { sync } from './api.js'
self.onmessage = async ({ data }) => postMessage(await sync.get(`/orders/${data.id}`))
```

To share the same client with a component subtree, pass it to `initHttpClient` in place of the
options:

```js
component('my-app', {
  build: () => {
    initHttpClient(sync) // provided under its own name, 'myapp.sync'
    return layout()
  },
})
```

Below that component, `useHttpClient('myapp.sync')` reaches the client like any other client. There
is one client and one set of request state, shared by your worker and your components.

**imp does not close a shared client when that component unmounts.** That is the deliberate trade.
imp cannot know whether your worker still uses the client. So `createHttpClient` gives you the
lifetime, and `close()` is how you end it. `close()` cancels everything in flight and rejects a
later call. Use this form only when something outside the DOM shares the client. A client that only
components use belongs to a component.

A few rules follow from a component owning a client. They are the same rules that a state follows:

- **The nearest client wins.** When an area initializes `myapp.api` and the app root already has
  one, a component inside the area gets the client of the area. Two sibling areas that initialize
  the same name each get their own client, with separate configuration and separate request state.
- **One name per component.** A second initialization of the same name in one component throws. So
  an accidental collision fails with a message, instead of sharing in silence.
- **Resolve before the first `await`.** In an `async build`, call `initHttpClient` or
  `useHttpClient` before you await anything. Keep the handle and call it at any time after that,
  including in an event handler. The `imp/http-client-setup-before-await` lint rule catches this
  while you write.
- **A name is namespaced.** It has two or more dot-separated segments, such as `myapp.api`, like a
  state name.

imp reaches a client through the DOM, and you do not import it. So a plain helper module takes the
client as an argument, as in `loadUsers(api, page)`. The component that resolved the client passes
it in.

## How to call

Every verb takes a path and an options object:

```js
await api.get('/users', { query: { page: 2, tag: ['new', 'active'] } })
await api.post('/users', { body: { name: 'Ada' } })
await api.patch(`/users/${id}`, { body: { name: 'Grace' }, headers: { 'if-match': etag } })
await api.delete(`/users/${id}`)
```

- **`query`** goes onto the end of the URL. imp skips a `null` or `undefined` value. An array
  repeats the key.
- **`body`.** imp serializes a plain object or an array as JSON, and gives it a
  `content-type: application/json` header. It passes `FormData`, `URLSearchParams`, `Blob`, a string
  and a buffer through without a change, and it imposes no content type on them.
- **imp parses the response body by its content type.** It parses JSON into a value, `text/*` and
  XML into a string, and anything else into a `Blob`. A `204` response, and an empty body, resolve
  to `null`.
- imp joins a path onto `baseUrl`. It uses a full URL, such as `https://...`, as you give it.

`request` returns the whole response, and it takes the method as an option:

```js
const response = await api.request('/users', { method: 'POST', body: draft })
response.status // 201
response.headers.location // 'https://api.example.com/users/u1'
response.body // { id: 'u1', name: 'Ada' }
```

## Request ids

Every call carries an `x-request-id` header. It holds a UUID that imp generated for the call. So the
request in your network panel, and the line that it wrote in the log of your backend, share a name.
There is nothing to turn on:

```js
await api.get('/users') // x-request-id: 2f5a3c1e-9d84-4a17-b0f2-6c1de0b3a7e4
```

- **There is one id per call, not per attempt.** A retried request keeps the id that it started
  with. So three tries read as the one call that they are.
- **Rename the header** when your backend reads a different one. Do it on the client, or on a single
  call:

  ```js
  initHttpClient('myapp.api', { baseUrl, requestId: 'x-correlation-id' })
  await api.get('/users', { requestId: 'x-correlation-id' })
  ```

- **Turn the header off** with `requestId: false`. This is worth doing on a cross-origin API that
  you do not control. A custom header makes the browser send a CORS preflight, and a server that
  does not list the header in `Access-Control-Allow-Headers` refuses the call.
- **An id that you set yourself wins.** Put the header in the `headers` of the client, or of the
  call, and imp leaves it as it is. That is how you carry an id that you already have, such as one
  from a server-rendered page, or a trace id from elsewhere in your system.
- **An interceptor and a mock handler see the id** like any other header. So `onRequest` can log it,
  and a mock can send it back.

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

An `HttpError` carries these fields:

| Field             | What it holds                                                         |
| ----------------- | --------------------------------------------------------------------- |
| `status`          | The response status, or `0` when no response arrived                  |
| `code`            | `status`, `network`, `timeout`, `aborted`, `parse`, or `hook`         |
| `method`, `url`   | The call that failed                                                  |
| `headers`, `body` | The response, when there was one - a parsed error body is right there |

`request` throws on the same failures as a verb. It differs only in what it gives you on success.

## Retries

```js
const api = initHttpClient('myapp.api', {
  baseUrl,
  retry: { attempts: 3, backoff: 'exponential', delay: 300, retryOn: [502, 503, 504] },
})
```

- **`attempts`** counts the total tries, not the extra ones. So `3` means at most three requests.
  `retry: 3` is short for `{ attempts: 3 }`.
- **`backoff`** is `'exponential'`, which doubles from `delay`, or `'fixed'`. `maxDelay` caps it at
  30 seconds.
- **`jitter`** is on by default. It randomizes every wait to a value between half of the computed
  backoff and all of it. With a `delay` of `300`, imp waits 150 ms to 300 ms before the second
  attempt, and 300 ms to 600 ms before the third.

  Jitter exists because an outage is rarely yours alone. When a backend goes down for a few seconds,
  every browser that talks to it fails at nearly the same moment. Without jitter, every one of them
  retries on exactly the same schedule. There is a wave at 300 ms, another at 600 ms, and another at
  1.2 s. The server comes back into a synchronized spike, which is the thundering herd, and it fails
  again. That failure synchronizes everyone for the next round. When each client waits a random
  time, the spike becomes a slow flow that the recovering server can accept. The more clients that
  share the failure, the more this matters. A deploy, a rate limit and a dropped connection all do
  it. The same applies inside one page. Several components that failed on mount otherwise retry
  together.

  Turn jitter off with `jitter: false` when you want exact, reproducible timing. Examples are a test
  that asserts _when_ a retry fires, and a measurement where the randomness is only noise.
- **`retryOn`** is a list of statuses, or a function that decides from
  `{ status, error, attempt, request }`. When you leave it out, imp retries `408`, `429`, `500`,
  `502`, `503` and `504`, and also a network failure and a timeout.
- **imp obeys `Retry-After`** on a `429` or a `503`, and prefers it to the computed backoff. The
  header holds a number of seconds or a date. imp uses the value as it is, with no jitter, because
  the server named the moment when it wants you back.
- **Only an idempotent verb retries.** `get`, `head`, `put` and `delete` follow the policy of the
  client. imp sends `post` and `patch` once, unless that call passes `retry` itself:

  ```js
  await api.post('/reports', { body: draft, retry: { attempts: 3 } })
  ```

## Timeouts and cancelling

`timeout` sets a budget per attempt, in milliseconds. Set it on the client or on one call. When the
budget expires, imp truly aborts the request. It does not only stop waiting. The call rejects with
`code: 'timeout'`.

Your own `signal` composes with the timeout. The request ends when either one fires:

```js
const controller = new AbortController()
const users = api.get('/users', { signal: controller.signal, timeout: 2000 })
controller.abort()
```

A call that you aborted rejects with `code: 'aborted'`, and imp never retries it. imp retries a
timeout like any other failure.

**Usually you do not cancel by hand.** When the component that owns the client unmounts, imp aborts
everything that is still in flight. That is what stops the requests of a screen when the user
navigates away. Use your own `signal` for the cases that the lifetime of the client does not cover.
Two examples are a search-as-you-type call that the next keystroke replaces, and a request that
needs a cancel button.

## Interceptors

`onRequest` and `onResponse` are how you change what imp sends and what comes back. Each one takes a
function, or an array of functions. Each one can be async. A per-call hook **runs in addition to**
the hook of the client. It does not replace it.

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

- **`onRequest`** receives the complete request, `{ method, url, headers, body, signal, meta }`. imp
  has resolved the URL, merged the headers and serialized the body, and the request has not gone
  out. Return the request changed, or return a replacement. A throw stops the call before any
  network traffic.
- **`onResponse`** receives `(response, request)` after imp parses the body, and before anything
  else sees it. Return the response, changed or replaced. A throw turns a transport success into a
  failed call. That is how you reject a `200` that carries an error envelope.
- **The order is defined.** `onRequest` runs _inside_ the retry loop, and it starts from the headers
  of the call on each attempt. So a token that a hook refreshes applies to the next try.
  `onResponse` runs _before_ imp decides on a retry, and before it updates the request state. So
  what it returns is what both see.
- **A hook that hangs aborts like a request that hangs.** The timeout budget covers the time of a
  hook.
- A mocked response travels through the same hooks as a real one.

An auth refresh, an envelope unwrap, a request signature and logging are all hooks:

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

## How to run without a backend

You change nothing on the client. Describe the mock answers in a `*.mock.js` file, and point
`imp.json` at the folder that holds them. `imp start` then answers a matching request itself:

```js
// mocks/users.mock.js
export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 800,
    handler: () => ({ status: 200, body: [{ id: 'u1', name: 'Ada' }] }),
  },
]
```

Your client keeps its real `baseUrl`, and your components keep their real calls. Nothing in your
source knows about the mocks, and nothing about mocking ships. You decide the mode when you start
the server, with `imp start --mock`, `imp start --no-mock`, or the default in your `imp.json`. The
answers arrive as ordinary responses. So everything on this page still applies to them. A mocked
`503` retries, a `delay` keeps `pending` above zero, and your interceptors run. See
**[Mock responses](cli.md#mock-responses--mockjs)** for the full format.

## Request state

Every client publishes its own state. The shape is exactly that of a [state](state.md), with `get`,
`watch`, `text`, `view` and `each`. So you bind the state, instead of passing a loading flag through
your components:

```js
import { computed } from 'imp/state'
import { div, p } from 'imp/html'
import { useHttpClient } from 'imp/http'

const status = component('api-status', {
  build: () => {
    const api = useHttpClient('myapp.api')
    return div(
      div({ class: 'spinner', hidden: computed([api.pending], (count) => count === 0) }),
      api.lastError.view((error) => error && p({ class: 'error' }, error.message)),
    )
  },
})
```

- **`api.pending`** is the number of calls in flight now.
- **`api.lastError`** is the most recent failure as plain data, in the shape
  `{ message, status, code, method, url, body }`, or `null`. It clears when a later call succeeds.
  `api.clearError()` dismisses it by hand.

For one spinner on one request, name that call:

```js
await api.patch(`/users/${id}`, { body: changes, track: 'users.save' })

const { pending, lastError } = api.tracked('users.save')
```

`tracked` returns the same pair for that name. A call that you do not track costs nothing.

## Testing

A unit test can replace the network with a spy on `fetch`. Virtual time makes a retry and a timeout
instant. See **[Testing](testing.md)**:

```js
import { component, mount } from 'imp'
import { expect, spy, test } from 'imp/test'
import { initHttpClient } from 'imp/http'

const owner = component('test-owner', { build: (_instance, setup) => setup() })

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

A component owns a client. So a test mounts a small host to initialize the client in. The same short
host works for every test in the file. To test that an unmount cancels what was in flight, remove
the host from the DOM.

An end-to-end spec runs against the served app. So it gets your `*.mock.js` files, with no stub. See
**[Mock responses](cli.md#mock-responses--mockjs)**.

## Debugging

Set `IMP_LOG_LEVEL` to `debug`, and the client traces itself in the console. It logs every retry
with the delay before it, and where it resolved a client from. The terminal reports a mocked answer,
with the file that produced it. See **[Logging](logging.md)**.
