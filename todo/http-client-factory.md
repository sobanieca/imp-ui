# HTTP client factory

Ship a built-in HTTP client factory so an app can configure its network layer once instead of
hand-rolling `fetch` wrappers. `httpClientFactory` produces a configured, named client with
cross-cutting concerns baked in — the app calls the client, imp handles retries, timeouts, caching,
request-state, and (in local dev) mocking.

## Shape

```js
const api = httpClientFactory('api', {
  baseUrl: env.API_URL,
  headers: { accept: 'application/json' },
  retry: { attempts: 3, backoff: 'exponential', retryOn: [502, 503, 504] },
  timeout: 10_000,
  cache: { ttl: 30_000, staleWhileRevalidate: true },
})

const user = await api.get(`/users/${id}`)
await api.post('/users', { body: draft })
```

- **Named instance.** The first argument names the client (`"api"`), matching the `initState` naming
  convention. The name is the handle a future stdlib component uses to wire itself to _this_
  client's request state (see _Standard-library integration_), and it namespaces the client's cache
  and mock registry. A client can be created once at app start and imported where needed.
- **Verb methods** (`get`/`post`/`put`/`patch`/`delete`) over a raw `fetch`-passthrough, each
  returning a promise of the parsed body, with an escape hatch (`api.request(...)`) that returns the
  full response for callers that need headers/status.

## What it configures

- **Retries** — retry policy declared once at construction: `attempts`, `backoff`
  (`fixed`/`exponential` with jitter), and a `retryOn` predicate over status codes and network
  errors. Honors `Retry-After` on `429`/`503`. Only idempotent verbs retry by default; opt-in per
  call for `post`.
- **Timeouts** — per-client default and per-call override, implemented with `AbortController` so an
  expired request truly aborts in flight; a caller-supplied `signal` composes with it.
- **Cache** — response caching keyed by method + resolved URL (+ a `vary` selection), in-memory by
  default with a pluggable store. Supports `ttl`, `staleWhileRevalidate` (serve stale, revalidate in
  the background), and per-call cache modes (`no-store`, `reload`, `force-cache`). **In-flight
  deduplication** (request coalescing): concurrent identical GETs share one network call. Mutating
  verbs can declare `invalidates` to drop matching cache entries so a `post` refreshes a stale list.
- Room to grow: auth-token refresh hook, a persistent cache store (`localStorage`/IndexedDB) — keep
  the surface small to start and extend as needs appear.

## Interceptors — full control over what is sent and received

Extensibility is a first-class goal: the app must be able to see and rewrite **every** outgoing
request before it leaves and **every** incoming response before it is handed back, without patching
`fetch` or wrapping the client. Two ordered hook lists, declared once at construction (and
extendable per call), give that full control:

- **`onRequest`** — runs after imp resolves the request (baseUrl, headers, body serialization) but
  **before it is sent**. It receives the fully-formed request descriptor
  (`{ method, url, headers, body, signal, meta }`) and returns it, mutated or replaced — attach an
  auth header, sign the payload, rewrite the URL, inject a correlation id, swap the body encoding.
  It may be async (e.g. await a fresh token) and may throw to abort the request before any network
  call.
- **`onResponse`** — runs **after a response arrives** but before the promise resolves. It receives
  the response (status, headers, and parsed/raw body) plus the request that produced it, and returns
  the value the caller ultimately sees — unwrap an envelope, remap error shapes, decrypt or
  transform the body, surface a header into `meta`. It may be async and may throw to turn a
  "successful" transport response into a rejected call.

Design rules:

- **Naming.** `onRequest`/`onResponse` (not `beforeSend`/`afterResponse`) match imp's existing
  lifecycle-hook naming (`onMount`/`onUnmount`/`onError`) so the client reads like the rest of the
  toolkit.
- **Ordered, composable, and awaited.** Each accepts a single hook or an array run in order; a
  per-call `onRequest`/`onResponse` composes with (does not replace) the client-level list, so one
  call can add a header without discarding the client's defaults. Hooks may be sync or async — the
  pipeline `await`s each one (and each in an array, in sequence), so an async hook fully resolves
  before the next hook, the network send, or the caller's promise proceeds. The per-request timeout
  budget covers hook time too, so a hung hook aborts like a hung request.
- **Placement in the pipeline is defined, not incidental.** `onRequest` runs **inside** the
  retry/timeout loop so a token refreshed by a hook applies to every retry attempt and an aborted
  hook counts as an aborted attempt; `onResponse` runs before caching and request-state settle so a
  hook can normalize a response (or reject it) and have retries, cache, and `lastError` observe the
  transformed result. Mocked responses (above) flow through `onResponse` too, so mock and real paths
  stay identical.
- **This is the extension substrate.** Auth-token refresh, envelope unwrapping, request signing, and
  logging are all just `onRequest`/`onResponse` hooks rather than bespoke options — imp may ship
  thin helpers built on them later, but the app can always reach the raw hooks for total control.

## Mocking for backend-less local development

A client can serve **mock responses** so the UI runs with no backend, and switching between mock and
real is a config choice, not a code edit — reusing the environments mechanism
(`adr/environments.md`) rather than inventing a second selector.

- **Mock handlers are code, selection is config.** Handlers can't live in a flat env value bag, so
  they're passed to the factory as a `mock` map (route pattern → handler), while _whether mocking is
  active_ comes from the selected environment. A `mock` env (or an `IMP_MOCK`-style flag surfaced
  through `env`) turns handlers on; without it the client goes to the network.
  `imp start --env mock` then runs the whole app against mocks with no source change.

  ```js
  httpClientFactory('api', {
    baseUrl: env.API_URL,
    mock: env.MOCK && {
      'GET /users/:id': ({ params }) => ({ id: params.id, name: 'Ada' }),
      'POST /users': ({ body }) => ({ id: 'new', ...body }),
      'GET /flaky': () => mock.error(503),
    },
  })
  ```

- **Handler capabilities.** A handler receives `{ params, query, body, headers }` and returns the
  response body (200 by default), or uses helpers to shape status, headers, simulated `latency`, and
  errors — enough to exercise loaders, retries, and failure banners locally. Route patterns match on
  method + path with named params (`:id`); an unmatched request either falls through to the network
  or 404s (configurable), so a partial mock set is viable while a backend is half-built.
- **Mocks stay out of production.** Because the `mock` option is gated behind an `env` flag that is
  falsy in prod, the handler map is dead code esbuild drops from the build
  (`adr/production-bundling.md`); for large fixtures, `mock` also accepts a thunk / dynamic
  `import()` so the fixture module is never fetched when mocking is off.
- **Same path exercised.** Mocked responses flow through the identical retry/cache/request-state
  pipeline, so the mock and real code paths behave the same — a mocked `503` still retries, a mocked
  latency still drives the spinner.

## Request state (bindable)

Each client exposes **observable request state** shaped like named state (`get`/`watch`, per
`adr/event-propagated-state.md`) so views bind to it reactively instead of each call site plumbing
loading/error flags by hand. At minimum a per-client aggregate (`pending`/`inFlight` count,
`lastError`) plus opt-in per-request or per-key handles. This is the substrate the stdlib
integration binds to; it is useful on its own
(`div({ hidden: computed([api.pending], (n) => !n) })`) before any stdlib component exists.

## Standard-library integration (later)

Once the standard component library exists (`todo/stdlib-components.md`), a component wires to a
client _by name_ so request state renders without manual plumbing:

- **Pending loader** — a `spinner`/`progressBar` bound to the client's `pending` state shows while a
  request is in flight and clears when it settles.
- **Failure banner** — a failed request surfaces a standard `alert`/`toast` automatically from
  `lastError`.

Because request state is state-shaped, this is ordinary reactive binding through the landed state
layer, not a new coupling mechanism.

## Dependencies

- **Standalone** for the core factory (retries, timeouts, cache, dedup) and mocking — depends only
  on the shipped `env`/environments layer (`adr/environments.md`) and named state
  (`adr/event-propagated-state.md`), both in place. Can land on its own.
- The auto-rendered loader/banner integration depends on `todo/stdlib-components.md`.

## ADR impact

Record an ADR once the approach is settled (`http-client-factory.md`): that imp ships a configured,
named HTTP client factory as part of the all-in-one toolkit — its retry/timeout/cache model, the
env-selected mocking layer and how mocks are kept out of production, the bindable request-state
contract, and how stdlib feedback components attach by client name. Update the ADR table; document
the client and the mocking workflow in `docs/`.

## Open questions

- **Cache store interface.** The minimal contract a pluggable store must satisfy (sync vs async
  `get`/`set`/`delete`), and whether a persistent store ships in v1 or stays a fast-follow.
- **Mock route syntax.** `"METHOD /path/:param"` strings vs. a structured entry (method, matcher,
  handler); how much of MSW-style flexibility is worth it inside the 80% scope.
- **Per-request state granularity.** Whether every call gets an addressable state handle by default
  or only when the caller opts in (naming/keying cost vs. convenience for wiring one spinner to one
  request).
- **Auth-token refresh.** The `onRequest`/`onResponse` interceptors (above) are the substrate; open
  is whether imp ships a dedicated token-refresh helper on top (single-flight refresh, retry the
  original request once) or leaves it as an app-written interceptor pair.
