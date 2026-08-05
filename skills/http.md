# http - the configured HTTP client, owned by a component

Everything comes from `imp/http`. `initHttpClient(name, options)` in a component's `onMount`
configures a client; `useHttpClient(name)` finds the nearest one above. Same shape as
[state](state.md) - named, namespaced, resolved through the DOM, owned by the component that
initialized it. Never hand-roll a `fetch` wrapper.

```js
import { component, env } from 'imp'
import { div, p } from 'imp/html'
import { initHttpClient, useHttpClient } from 'imp/http'

const profile = component('myapp-profile', {
  onMount: async (_instance, { id }) => {
    const api = useHttpClient('myapp.api') // resolve first…
    const user = await api.get(`/users/${id}`) // …then await
    return div(p(user.name))
  },
})

export const app = component('myapp-root', {
  onMount: () => {
    initHttpClient('myapp.api', {
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

| Member                                     | Returns                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `get`/`post`/`put`/`patch`/`delete`/`head` | the **parsed body**, as a promise                                         |
| `request(path, options)`                   | the whole response, `method` an option                                    |
| `pending`                                  | read-only state: calls in flight (a number)                               |
| `lastError`                                | read-only state: `{ message, status, code, method, url, body }` or `null` |
| `clearError()`                             | drops `lastError`                                                         |
| `tracked(key)`                             | `{ pending, lastError }` for calls made with `track: key`                 |
| `close()`                                  | **only** on a `createHttpClient` handle                                   |

`useHttpClient` returns the same members except `close` - the owner ends the client, a consumer
never does.

## Options

Every option can be set on the client and overridden on a single call.

| Option                   | Default        | Means                                                                            |
| ------------------------ | -------------- | -------------------------------------------------------------------------------- |
| `baseUrl`                | `''`           | paths are joined onto it; a full `https://…` path is used as given               |
| `headers`                | `{}`           | merged per call, names lower-cased                                               |
| `timeout`                | none           | ms **per attempt**; aborts for real, rejects with `code: 'timeout'`              |
| `retry`                  | `1` attempt    | number of attempts, or `{ attempts, backoff, delay, maxDelay, jitter, retryOn }` |
| `requestId`              | `x-request-id` | header carrying a generated UUID; a header name, or `false` for none             |
| `onRequest`/`onResponse` | none           | interceptor, or an array of them; may be async                                   |

Call-only options: `query` (`null`/`undefined` skipped, an array repeats the key), `body`, `signal`,
`track` (a name for `tracked()`), `meta` (yours, visible to interceptors), and `method` on
`request`.

```js
await api.get('/users', { query: { page: 2, tag: ['new', 'active'] } })
await api.post('/users', { body: { name: 'Ada' } })
await api.patch(`/users/${id}`, { body: changes, track: 'users.save' })
const created = await api.request('/users', { method: 'POST', body: draft })
created.status // 201 - request() gives { status, statusText, ok, url, method, headers, body }
```

A plain object or array `body` is sent as JSON with a `content-type` header; `FormData`,
`URLSearchParams`, `Blob`, strings and buffers pass through untouched. The response body is parsed
by content type - JSON to a value, `text/*` and XML to a string, anything else to a `Blob`; `204`
and an empty body give `null`.

## Rules an agent gets wrong

- **Client names need a namespace** - at least two dot-separated segments (`myapp.api`, never
  `api`). Lint rule `imp/http-client-name-namespace`; runtime throws.
- **Resolve before the first `await`.** `initHttpClient`/`useHttpClient` throw after the first
  `await` of an async `onMount` and outside a mounting component
  (`imp/http-client-setup-before-await`). Keep the handle and call it whenever - event handlers,
  after awaits.
- **A failure rejects.** Any non-2xx, transport failure, timeout or abort throws an `HttpError`.
  There is no `response.ok` to check and no `null` on failure.
- **Verbs return the body, not the response.** Reach for `request` when you need `status` or
  `headers`.
- **Retries are off until you ask.** The default is one attempt; `retry: 3` or
  `retry: { attempts: 3 }` turns them on. Only `get`, `head`, `put` and `delete` follow the client's
  policy - `post` and `patch` are sent once unless **that call** passes `retry` itself.
- **Every call goes to the network.** No response cache, no de-duplication of identical calls in
  flight. Two components each loading `/users` on mount make two requests - load once above them and
  pass it down, or hold it in [state](state.md).
- **`useHttpClient` throws when no ancestor initialized the name**, and `initHttpClient` throws when
  the same component already initialized it. The nearest client wins; a nested one shadows an
  ancestor's for its subtree.
- **A helper module takes the client as an argument** (`loadUsers(api, page)`) - a client is reached
  through the DOM, never imported. Same for DOM rendered outside the subtree (an overlay on
  `document.body`): pass the handle.
- **Do not cancel by hand for navigation.** Unmounting the owner aborts what is in flight; use your
  own `signal` only for a superseded search-as-you-type call or a cancel button.
- **`requestId` can break a cross-origin call.** A custom header triggers a CORS preflight - set
  `requestId: false` for an API that does not list it in `Access-Control-Allow-Headers`. An
  `x-request-id` you set yourself in `headers` is left alone.

## Where a client lives

Its reach is the subtree of the component that initialized it, and its lifetime is that component's
lifetime - there is no other scope and nothing to dispose.

- **App-wide**: initialized in the root component, which never unmounts.
- **Section-wide**: initialized in the `root` component of an [area](routing.md), so it exists while
  the user is in that section and nothing outside it can reach the name.
- **Yours**: `createHttpClient(name, options)` builds one anywhere, including module scope or a
  worker, and it lives until you `close()` it. Share it with a subtree by passing the client itself
  to `initHttpClient(client)` - it is provided under its own name and is **not** closed when that
  component unmounts. Only reach for this when something outside the DOM holds the client.

When the owner unmounts: requests in flight are cancelled (rejecting with `code: 'aborted'`), a
retry waiting on its backoff stops, tracked request state is dropped, and a later call through a
kept handle rejects instead of hitting the network.

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

`status` (`0` when no response arrived), `code` (`status`, `network`, `timeout`, `aborted`, `parse`,
`hook`), `method`, `url`, and `headers`/`body` of the response when there was one - a parsed error
envelope is right there.

Retry detail: `backoff` is `'exponential'` (doubling from `delay`, default 300 ms, capped by
`maxDelay` of 30 s) or `'fixed'`; `jitter` is on and randomizes each wait to half the computed
backoff or more - turn it off only for a test asserting exact timing. `retryOn` is a list of
statuses or a function of `{ status, error, attempt, request }`; unset, imp retries `408`, `429`,
`500`, `502`, `503`, `504`, network failures and timeouts. `Retry-After` on a `429`/`503` wins over
the computed delay. One request id per **call**, not per attempt.

## Interceptors

```js
initHttpClient('myapp.api', {
  baseUrl,
  onRequest: (request) => {
    request.headers.authorization = `Bearer ${token()}`
    return request
  },
  onResponse: (response) => ({ ...response, body: response.body.data }),
})
```

`onRequest` sees `{ method, url, headers, body, signal, meta }` fully formed and returns it changed
or replaced; throwing stops the call before any traffic. `onResponse` sees `(response, request)`
after parsing; throwing turns a `200` carrying an error envelope into a failed call. A per-call hook
**adds to** the client's. `onRequest` runs inside the retry loop (so a refreshed token applies to
the next attempt); `onResponse` runs before retry decisions and request state. Hook time counts
against the timeout. Auth refresh, envelope unwrapping and signing are all just hooks - there is no
plugin API.

## Binding loading and error state

`pending` and `lastError` are ordinary states, so bind them instead of threading flags:

```js
import { computed } from 'imp/state'

const api = useHttpClient('myapp.api')
div(
  div({ class: 'spinner', hidden: computed([api.pending], (count) => count === 0) }),
  api.lastError.view((error) => error && p({ class: 'error' }, error.message)),
)
```

`lastError` clears when a later call succeeds. For one spinner on one request, name the call with
`track: 'users.save'` and read `api.tracked('users.save')`; untracked calls cost nothing.

## Without a backend, and in tests

`*.mock.js` files answer the client's real calls through the dev server's service worker - nothing
in your source changes and nothing about mocking ships. A mocked `503` retries, a `delay` keeps
`pending` up, interceptors run. See [mocks](mocks.md).

Unit tests spy on `fetch` and use `{ fakeTimers: true }` so retries and timeouts are instant; mount
a one-line host component to own the client (removing it from the DOM is how you test that
unmounting cancels). E2E specs get the `*.mock.js` files with no stub at all. See
[testing](testing.md).

`IMP_LOG_LEVEL=debug` traces every retry with its delay and where each client was resolved from -
see [logging](logging.md).
