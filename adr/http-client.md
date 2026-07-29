# DOM-scoped HTTP client, with retries, interceptors and bindable request state

## Context

Every app talks to a backend, and every app that starts from bare `fetch` re-grows the same layer by
hand: a base URL, default headers, JSON in and out, a retry loop, an `AbortController` for timeouts,
and a pair of loading/error flags threaded through the components that call it. That layer is
written once per app, differently each time, and its failure modes (a retried `POST`, a timeout that
leaves the request running) are the ones nobody tests. For an all-in-one toolkit the network layer
is not an app concern to be rediscovered; it is a shipped part, like the router or the theme.

Named state (`event-propagated-state.md`) decides part of the shape: it gives a `get`/`watch`
contract that the renderer duck-types at prop position, so a client can expose its own request state
without inventing a second reactive mechanism — and without the client needing to be a component.
Running the app with no backend is deliberately _not_ part of this decision: mocks are declared
outside the app and answered by the dev server's service worker (`dev-server-mocks.md`), so the
client has one code path and never learns whether an answer was mocked.

## Decision

imp ships **`initHttpClient`, `useHttpClient` and `createHttpClient` from `imp/http`** (a new row in
the shared subpath table, `library-import-namespaces.md`). The first pair is deliberately the one
`initState`/`useState` already establishes: a component initializes a named, configured client in
its `onMount`, components mounted below resolve it by name, and the client's lifetime is the
initializing component's lifetime. It exposes verb methods
(`get`/`post`/`put`/`patch`/`delete`/`head`) resolving to the parsed body, plus a `request()` escape
hatch returning the whole response for callers that need status or headers. Every cross-cutting
concern is declared once at construction and overridable per call.

- **The owning component is the default scope.** An app-wide client is a client initialized in the
  app's root component; a client that must die with a section is initialized in that section's root
  component. Pointing at a component answers "how long does this client live?", and an area's client
  — its request state, its in-flight work — is gone when the router swaps the area out.
- **A self-owned client is the deliberate exception, for what the DOM cannot reach.** A client is
  useful outside a component tree — a service or web worker has no DOM, no components, and no scope
  to hang a lifetime on — so `createHttpClient(name, options)` builds the same client anywhere and
  gives it a public `close()`. It is **not** a second way to do the ordinary thing: the DOM-scoped
  pair covers every in-page case, and the escape hatch is priced in an explicit lifetime the author
  now owns. Passing such a client to `initHttpClient(client)` (type-based dispatch,
  `type-based-argument-dispatch.md` — a name means "create one", a client means "share this one")
  provides it to a subtree under its own name, so one client can serve a worker and a component tree
  at once, with one set of request state. **A shared client is not closed when that subtree
  unmounts**, because imp cannot know what else still holds it; only `close()` ends it. That
  asymmetry is the point of the distinction, and is surfaced rather than smoothed over — the client
  a component created is closed for you, the client you created is yours to close.
- **Requests are plain data.** A request is `{ method, url, headers, body, signal, meta }` with
  lower-cased plain-object headers; a response carries `status`, `statusText`, `ok`, `url`,
  `method`, `headers` and the parsed `body`. Plain objects, not `Headers`/`Response` instances,
  because they are what hooks read and rewrite and what state stores.
- **Retries** — `attempts`, `backoff` (`exponential` with jitter, or `fixed`), `delay`/`maxDelay`,
  and `retryOn` as either a list of statuses or a predicate over
  `{ status, error, attempt, request }`. `Retry-After` on `429`/`503` wins over the computed
  backoff. **Only idempotent verbs retry by default**; `post`/`patch` retry only when the call
  passes `retry` explicitly, so a non-idempotent write is never repeated behind the author's back.
- **Timeouts** — a per-client default and a per-call override, implemented with an `AbortController`
  per attempt so an expired request truly aborts in flight; a caller-supplied `signal` composes with
  it through `AbortSignal.any`. A caller abort is never retried; an expired timeout is.
- **No response cache, and no request coalescing.** Every call is sent; identical concurrent `GET`s
  are two requests, not one. A cache is the part of this layer with the most policy in it —
  freshness windows, what varies a key, when a write invalidates a read, where entries live — and
  every one of those answers is app-specific in a way retry and timeout are not. Shipping it wrong
  is worse than not shipping it: a wrong cache serves stale data silently, while its absence costs a
  request the author can see in the network panel. An app that needs one today loads the data once
  above the components that share it and holds it in named state, which is imp's existing answer to
  "two components want the same thing". A response cache remains addable later behind new options
  without changing any call site (`todo/http-client-cache.md`).
- **Every call is identified by default.** A UUID per call goes out as `x-request-id`, generated in
  the request builder so hooks, mocks and the network all see the same value, and **stable across
  retries** — the id names the call the author made, not the attempt imp made, which is what makes a
  retried request recognisable as one call in a server log. `x-request-id` is a de-facto convention
  rather than a registered header (RFC 6648 discourages the `X-` prefix, and W3C `traceparent` is
  the standardised alternative), so the name is not imp's to fix: `requestId` renames it per client
  or per call, `requestId: false` removes it, and a header set by hand is never overwritten. Off is
  a supported position because a custom header forces a CORS preflight on cross-origin calls, which
  a backend the author does not control may refuse. imp generates the id and never reads it back —
  correlating it with a trace is the app's business, over `onRequest`.
- **Errors are one type.** A non-2xx response, a transport failure, a timeout, an abort, a broken
  JSON body and a rejecting hook all reject with an `HttpError` carrying `status`, `code`
  (`status`/`network`/`timeout`/`aborted`/`parse`/`hook`), `method`, `url`, `headers` and `body`.
  `request()` differs from the verbs only in what it returns on success, not in when it throws — one
  meaning of failure for retries, request state and hooks alike.

**Resolution and disposal ride the DOM, on state's mechanism rather than a second one.** Provider
lookup — the bubbling, composed `CustomEvent` answered by the nearest ancestor that registered the
name — is factored into one internal seam keyed by a `kind`, which state and the HTTP client both
use; adding a DOM-scoped resource later costs a `kind`, not another lookup. Everything scoping
follows from where the provider listens, so the rules are state's, unchanged: the nearest client
wins, an area **shadows** an app-wide client by initializing the same name, re-initializing a name
in one scope throws, sibling instances own independent clients, resolution re-runs when a component
moves (`component-moves-rebind.md`), both helpers throw outside a mounting component and must run
before the first `await` of an async `onMount`, and names are namespaced — the same rule and the
same lint treatment (`imp/http-client-name-namespace`, `imp/http-client-setup-before-await`).
**Unmount closes the client the component created** (never a shared one): a client-wide
`AbortController` composed into every request's signal means in-flight attempts abort, a retry
waiting on a backoff delay stops instead of firing into a dead screen, per-request trackers are
dropped, and a call made afterwards through a kept handle rejects rather than reaching the network.
Closing is about stopping _work_, not reclaiming memory — nothing global holds a client, so an
unreferenced one was always collectable; what the app could not do before was cancel what a departed
screen had started. The same routine backs the public `close()`, with the reason it was closed
carried into the rejection message, so "the client was closed when its component unmounted" and "the
client was closed" are told apart at the call site.

**Interceptors are the extension substrate.** `onRequest` and `onResponse` — named after imp's
existing lifecycle hooks — take a function or an ordered array, may be async, and a per-call list
**composes with** (never replaces) the client's. `onRequest` runs after imp has resolved the URL,
merged headers and serialized the body, but before the send, and returns the request it received or
a replacement; `onResponse` runs after the response is parsed and before retry decisions and request
state settle, and returns the response. Placement is deliberate: `onRequest` runs **inside** the
retry loop, from the call's headers each time, so a token refreshed by a hook applies to the next
attempt; `onResponse` runs before everything downstream, so an unwrapped envelope or a remapped
error is what both retries and `lastError` observe. The per-attempt timeout budget covers hook time
— a hung hook aborts like a hung request. Auth-token refresh, envelope unwrapping, request signing
and logging are hooks, not bespoke options; **imp ships no token-refresh helper**, because a
single-flight refresh is ten lines of app code over this substrate and the policy behind it (refresh
once, retry once, log out when) is not imp's to choose.

**The client knows nothing about mocks.** Running with no backend is a dev-server capability
(`dev-server-mocks.md`): mock handlers live in `*.mock.js` files outside the app and answer from the
service worker, so what reaches the client is an ordinary `Response` over an ordinary `fetch`.
Nothing is configured on the client, nothing is branched on in app code, and nothing about mocking
travels in a production bundle — which also means a mocked `503` retries and a mocked latency drives
the spinner, not by design but because the client cannot tell the difference.

**Request state is state, not a new mechanism.** Each client exposes read-only, state-shaped
`pending` (the number of calls in flight) and `lastError`, so a `computed` over `api.pending` binds
straight to a `hidden` prop and `api.pending.text()` renders the count, with no new concepts.
`lastError` holds **plain data** (`{ message, status, code, method, url, body }`), not the `Error`
object, because state values are plain data (`state-plain-data-values.md`); it is cleared by the
next successful call or by `clearError()`. Per-request granularity is **opt-in**: a call passing
`track: 'users.list'` also drives `api.tracked('users.list')`, so wiring one spinner to one request
costs one name and every other call costs nothing.

## Consequences

- An app configures its network layer once and calls it. Retry and timeout are declarative options
  rather than code each app rewrites, and the sharp cases (a retried `POST`, a timeout that does not
  abort) are decided by imp's defaults.
- Everything an app might want to intercept is reachable, so imp does not need an option per
  concern; the cost is that hooks are ordinary functions with no sandbox — a hook that throws fails
  the call (which is also how a hook aborts one deliberately).
- Request state binds like any other state, so the planned stdlib loader and failure banner
  (`todo/stdlib-components.md`) attach by client name through the existing binding rules rather than
  a new coupling.
- Duplicate reads are the app's problem to notice: two components that both fetch `/users` at mount
  make two requests, and the fix is to hoist the fetch above them rather than to configure the
  client. That is a visible cost paid to keep the client's behaviour literal — what you call is what
  is sent.
- There is one scope concept across the framework, not one per subject: state and HTTP clients are
  both owned by a component and resolved through the tree, so an author who has learned one has
  learned the other, and separately bundled islands interoperate with both.
- Nothing has to be disposed by hand in the ordinary case — the case a manual call would serve
  (leaving a section) is exactly the case unmounting already covers, and an API that can be
  forgotten is one that will be. `close()` exists only on the client you asked to own, where
  forgetting it is a decision you made rather than a default you inherited.
- A client can outlive the DOM, so imp works in a worker: `createHttpClient` needs no document, and
  the request pipeline (retries, hooks) is DOM-free. What does not follow it there is the reactive
  half of request state — `watch`/`text`/`view`/`each` need a mounting component, while
  `pending.get()` and `lastError.get()` work anywhere — which costs a worker nothing, having no DOM
  to bind to.
- The cost is that a client is no longer importable: a plain helper module that used to
  `import { api }` now takes the client as an argument from the component that resolved it. That is
  the same trade state makes, and it is the price of the DOM being the only scope.
- Tests and previews mount a host component to initialize a client in, as they already do for state.
