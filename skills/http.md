# http - the configured HTTP client, owned by a component

Everything comes from `imp/http`. `initHttpClient(self, name, options)` in the `setup` of a
component configures a client. `useHttpClient(self, name)` finds the nearest client above the host.
`self` is the first argument of `setup`. The shape is the same as [state](state.md). A client is
named and namespaced, imp resolves it through the DOM, and the component that initialized it owns
it. Never write your own `fetch` wrapper.

```js
import { component, env } from 'imp'
import { div, p } from 'imp/html'
import { initHttpClient, useHttpClient } from 'imp/http'

const profile = component('myapp-profile', {
  setup: async (self, { id }) => {
    const user = await useHttpClient(self, 'myapp.api').get(`/users/${id}`)
    return div(p(user.name))
  },
})

export const app = component('myapp-root', {
  setup: (self) => {
    initHttpClient(self, 'myapp.api', {
      baseUrl: env.API_URL,
      headers: { accept: 'application/json' },
      retry: { attempts: 3, retryOn: [502, 503, 504] },
      timeout: 10_000,
    })
    return profile({ id: '1' })
  },
})
```

## The handle

| Member                                     | Returns                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `get`/`post`/`put`/`patch`/`delete`/`head` | the **parsed body**, as a promise                                                      |
| `request(path, options)`                   | the whole response, `method` an option                                                 |
| `pending`                                  | read-only state: calls in flight (a number)                                            |
| `lastError`                                | read-only state: `{ message, userMessage, status, code, method, url, body }` or `null` |
| `clearError()`                             | drops `lastError`                                                                      |
| `tracked(key)`                             | `{ pending, lastError }` for calls made with `track: key`                              |
| `close()`                                  | **only** on a `createHttpClient` handle                                                |

`useHttpClient` returns the same members, but not `close`. The owner ends the client. A consumer
never ends it.

## Options

You can set every option on the client, and override it on a single call.

| Option                   | Default        | Means                                                                            |
| ------------------------ | -------------- | -------------------------------------------------------------------------------- |
| `baseUrl`                | `''`           | paths are joined onto it; a full `https://...` path is used as given             |
| `headers`                | `{}`           | merged per call, names lower-cased                                               |
| `timeout`                | none           | ms **per attempt**; aborts for real, rejects with `code: 'timeout'`              |
| `retry`                  | `1` attempt    | number of attempts, or `{ attempts, backoff, delay, maxDelay, jitter, retryOn }` |
| `requestId`              | `x-request-id` | header carrying a generated UUID; a header name, or `false` for none             |
| `onRequest`/`onResponse` | none           | interceptor, or an array of them; may be async                                   |
| `userMessage`            | none           | `(error) => string`: the text for a person, read from a failed response          |

These options work on a call only: `query`, where imp skips a `null` or `undefined` value and
repeats the key for an array, `body`, `signal`, `track`, which is a name for `tracked()`, `meta`,
which is yours and which an interceptor can read, and `method` on `request`. `silent: true` keeps a
failure of the call out of `lastError`, so a `toast` does not show it. `detached: true` lets a call
through `useHttpClient` outlive the component that made it.

```js
await api.get('/users', { query: { page: 2, tag: ['new', 'active'] } })
await api.post('/users', { body: { name: 'Ada' } })
await api.patch(`/users/${id}`, { body: changes, track: 'users.save' })
const created = await api.request('/users', { method: 'POST', body: draft })
created.status // 201 - request() gives { status, statusText, ok, url, method, headers, body }
```

imp sends a plain object or an array `body` as JSON, with a `content-type` header. It passes
`FormData`, `URLSearchParams`, `Blob`, a string and a buffer through without a change. imp parses
the response body by its content type. It parses JSON to a value, `text/*` and XML to a string, and
anything else to a `Blob`. A `204` response and an empty body both give `null`.

## Rules an agent gets wrong

- **A client name needs a namespace.** Use two or more dot-separated segments, such as `myapp.api`.
  Never write `api`. The lint rule is `imp/http-client-name-namespace`, and the runtime throws.
- **`self` comes first.** `initHttpClient(self, name, options)` and `useHttpClient(self, name)` need
  the `self` that imp passes to `setup`, `error`, `onMount` and `onRemove`. A call with anything
  else as the first argument throws. The lint rule is `imp/self-first-argument`.
- **Resolution goes through `self`, at any point in `setup`.** `useHttpClient` works before and
  after any `await`. It throws after the component has left the page. In `onRemove` it returns the
  handle that `setup` resolved, so a component can report its exit through a client of an ancestor
  that is still mounted.
- **A failure rejects.** Any response that is not 2xx, a transport failure, a timeout and an abort
  all throw an `HttpError`. There is no `response.ok` to check, and no `null` on failure.
- **A verb returns the body, not the response.** Use `request` when you need `status` or `headers`.
- **imp does not retry until you ask for it.** The default is one attempt. `retry: 3` or
  `retry: { attempts: 3 }` turns retries on. Only `get`, `head`, `put` and `delete` follow the
  policy of the client. imp sends `post` and `patch` once, unless **that call** passes `retry`
  itself.
- **Every call goes to the network.** There is no response cache, and imp does not merge two
  identical calls in flight. Two components that each load `/users` on mount make two requests. Load
  the data once above them and pass it down, or hold it in [state](state.md).
- **`useHttpClient` throws when no ancestor initialized the name.** `initHttpClient` throws when the
  same component already initialized it. The nearest client wins. A nested client shadows the client
  of an ancestor for its subtree.
- **A helper module takes the client as an argument**, as in `loadUsers(api, page)`. imp reaches a
  client through the DOM. Never import one. Do the same for DOM that imp renders outside the
  subtree, such as a second `mount` into another element of the page. Pass the handle.
- **Do not cancel a call by hand for a navigation.** A call through `useHttpClient(self)` belongs to
  that component. When it unmounts, imp aborts the call, and the call rejects with `code: 'aborted'`
  even when the response already arrived. So the code after `await api.get(...)` in an async
  `setup` never runs after an unmount, and needs no `self.abortSignal` check. Use your own `signal`
  only for a search-as-you-type call that a newer call replaces, or for a cancel button.
- **A call that must finish after the component leaves takes `detached: true`**, such as an event
  that a component sends as it closes. A call made in `onRemove` is never bound to the mount.
- **An aborted call never writes `lastError`.** A cancel is not a failure, so no toast shows it.
- **Read the error text for a person from `error.userMessage`.** Set `userMessage` on the client
  once, for example `(error) => error.body?.error`. A `form` shows that text when `onSubmit` throws
  the error, and a `toast` uses it as the title. Without it, `userMessage` is `null`.
- **A failure that the screen shows itself takes `silent: true`**, such as a 404 for a dead link
  that renders an empty state. Do not make a second client only to keep a toast quiet.
- **`requestId` can break a cross-origin call.** A custom header causes a CORS preflight. Set
  `requestId: false` for an API that does not list the header in `Access-Control-Allow-Headers`. imp
  leaves an `x-request-id` that you set yourself in `headers` as it is.

## Where a client lives

A client reaches the subtree of the component that initialized it. It lives as long as that
component. There is no other scope, and there is nothing to dispose of.

- **App-wide.** Initialize the client in the root component, which never unmounts.
- **Section-wide.** Initialize the client in the `root` component of an [area](routing.md). It then
  exists while the user is in that section, and nothing outside the section can reach the name.
- **Your own.** `createHttpClient(name, options)` builds a client anywhere, including at module
  scope or in a worker. It lives until you call `close()`. To share it with a subtree, pass the
  client itself to `initHttpClient(self, client)`. imp provides it under its own name, and does
  **not** close it when that component unmounts. Use this form only when something outside the DOM
  holds the client.

When the owner unmounts, imp cancels the requests in flight, and they reject with `code: 'aborted'`.
A retry that waits on its backoff stops. imp drops the tracked request state. A later call through a
handle that you kept rejects instead of going to the network.

## Failures

```js
import { HttpError } from 'imp/http'

try {
  await api.get(`/users/${id}`)
} catch (error) {
  if (error instanceof HttpError && error.status === 404) return null
  throw error
}
```

An `HttpError` carries `status`, which is `0` when no response arrived, and `code`, which is
`status`, `network`, `timeout`, `aborted`, `parse` or `hook`. It also carries `method`, `url` and
`userMessage`, which is the text of the `userMessage` option of the client, or `null`.
When a response arrived, it carries the `headers` and the `body` of that response, so a parsed error
envelope is available.

These are the retry details. `backoff` is `'exponential'` or `'fixed'`. The exponential form doubles
from `delay`, which defaults to 300 ms, and `maxDelay` caps it at 30 s. `jitter` is on. It
randomizes each wait to half of the computed backoff or more. Turn it off only for a test that
asserts exact timing. `retryOn` is a list of statuses, or a function of
`{ status, error, attempt, request }`. When you do not set it, imp retries `408`, `429`, `500`,
`502`, `503` and `504`, and also a network failure and a timeout. A `Retry-After` header on a `429`
or a `503` wins against the computed delay. imp uses one request id per **call**, not per attempt.

## Interceptors

```js
initHttpClient(self, 'myapp.api', {
  baseUrl,
  onRequest: (request) => {
    request.headers.authorization = `Bearer ${token()}`
    return request
  },
  onResponse: (response) => ({ ...response, body: response.body.data }),
})
```

`onRequest` sees a complete `{ method, url, headers, body, signal, meta }`. It returns that object
changed, or a replacement. A throw stops the call before any traffic. `onResponse` sees
`(response, request)` after imp parses the response. A throw turns a `200` that carries an error
envelope into a failed call. A per-call hook **runs in addition to** the hook of the client.
`onRequest` runs inside the retry loop, so a refreshed token applies to the next attempt.
`onResponse` runs before imp decides on a retry, and before it updates the request state. The time
that a hook takes counts against the timeout. An auth refresh, an envelope unwrap and a signature
are all hooks. There is no plugin API.

## How to bind loading state and error state

`pending` and `lastError` are ordinary states. Bind them instead of passing flags through your code:

```js
import { computed } from 'imp/state'

const api = useHttpClient(self, 'myapp.api')
div(
  div({ class: 'spinner', hidden: computed([api.pending], (count) => count === 0) }),
  api.lastError.view((error) => error && p({ class: 'error' }, error.message)),
)
```

`lastError` clears when a later call succeeds. For one spinner on one request, name the call with
`track: 'users.save'` and read `api.tracked('users.save')`. A call that you do not track costs
nothing.

## Without a backend, and in tests

A `*.mock.js` file answers the real calls of the client, through the service worker of the dev
server. Nothing in your source changes, and nothing about mocking ships. A mocked `503` retries, a
`delay` keeps `pending` above zero, and an interceptor runs. See [mocks](mocks.md).

A unit test spies on `fetch` and uses `{ fakeTimers: true }`, so a retry and a timeout are instant.
Mount a host component of one line to own the client. To test that an unmount cancels a call, remove
that component from the DOM. An e2e spec gets the `*.mock.js` files, with no stub. See
[testing](testing.md).

`IMP_LOG_LEVEL=debug` traces every retry with its delay, and says where imp resolved each client
from. See [logging](logging.md).
