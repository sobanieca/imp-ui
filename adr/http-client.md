# DOM-scoped HTTP client, with retries, interceptors and bindable request state

## Context

Every app talks to a backend. Every app that starts from a bare `fetch` grows the same layer again,
by hand. That layer holds a base URL, default headers, JSON in and out, a retry loop, an
`AbortController` for a timeout, and a pair of flags for loading and for an error, which somebody
passes through the components that call it. Each app writes that layer once, and differently. Its
failure modes are the ones that nobody tests. Two examples are a `POST` that imp retried, and a
timeout that leaves the request running. For a complete toolkit, the network layer is not a concern
of an app to discover again. It is a part that imp ships, like the router, or the theme.

A named state, see `event-propagated-state.md`, decides part of the shape. It gives a `get` and
`watch` contract, which the renderer detects by shape at the position of a prop. So a client can
expose its own request state, and imp invents no second reactive mechanism. The client also does not
have to be a component. To run the app with no backend is deliberately _not_ part of this decision.
An app declares a mock outside itself, and the service worker of the dev server answers it, see
`dev-server-mocks.md`. So the client has one code path, and it never learns whether an answer was
mocked.

## Decision

imp ships **`initHttpClient`, `useHttpClient` and `createHttpClient`, from `imp/http`**. That is a
new row in the shared table of subpaths, see `library-import-namespaces.md`. The first pair is
deliberately the pair that `initState` and `useState` already establish. A component initializes a
named, configured client in its `build`. A component that mounts below it resolves the client by
name. The lifetime of the client is the lifetime of the component that initialized it. The client
exposes a method per verb, which are `get`, `post`, `put`, `patch`, `delete` and `head`. Each one
resolves to the parsed body. There is also a `request()` escape hatch, which returns the whole
response, for a caller that needs the status or the headers. You declare every concern that cuts
across calls once, at construction, and you can override it per call.

- **The component that owns the client is the default scope.** An app-wide client is a client that
  the root component of the app initializes. A client that must end with a section is a client that
  the root component of that section initializes. To point at a component answers the question "how
  long does this client live?". The client of an area, with its request state and its work in
  flight, is gone when the router swaps the area out.
- **A client that owns itself is the deliberate exception, for what the DOM cannot reach.** A client
  is useful outside a tree of components. A service worker, and a web worker, have no DOM, no
  component, and no scope to hang a lifetime on. So `createHttpClient(name, options)` builds the
  same client anywhere, and gives it a public `close()`. It is **not** a second way to do the
  ordinary thing. The pair that the DOM scopes covers every case inside a page. The escape hatch has
  a price, which is an explicit lifetime that the author now owns. To pass such a client to
  `initHttpClient(client)` provides it to a subtree, under its own name. That is dispatch by type,
  see `type-based-argument-dispatch.md`. A name means "create one", and a client means "share this
  one". So one client can serve a worker and a tree of components at the same time, with one set of
  request state. **imp does not close a shared client when that subtree unmounts**, because imp
  cannot know what else still holds it. Only `close()` ends it. That asymmetry is the point of the
  distinction, and imp shows it in place of hiding it. imp closes the client that a component
  created. The client that you created is yours to close.
- **A request is plain data.** A request is `{ method, url, headers, body, signal, meta }`, with
  headers as a plain object, in lower case. A response carries `status`, `statusText`, `ok`, `url`,
  `method`, `headers` and the parsed `body`. Those are plain objects, and not a `Headers` or a
  `Response` instance, because a plain object is what a hook reads and rewrites, and what a state
  stores.
- **The retry options are `attempts`, `backoff`, `delay`, `maxDelay` and `retryOn`.** `backoff` is
  `exponential`, with jitter, or `fixed`. `retryOn` is a list of statuses, or a predicate over
  `{ status, error, attempt, request }`. A `Retry-After` header on a `429` or a `503` wins against
  the computed backoff. **By default, only an idempotent verb retries.** `post` and `patch` retry
  only when the call passes `retry` explicitly. So imp never repeats a write that is not idempotent
  behind the back of the author.
- **A timeout has a default per client, and an override per call.** imp implements it with an
  `AbortController` per attempt. So a request that expires really aborts in flight. A `signal` from
  the caller composes with it, through `AbortSignal.any`. imp never retries an abort from a caller.
  It does retry a timeout that expired.
- **There is no cache of a response, and imp does not merge two identical requests.** imp sends
  every call. Two identical `GET` requests at the same time are two requests, and not one. A cache
  is the part of this layer with the most policy in it. That policy covers a window of freshness,
  what varies a key, when a write invalidates a read, and where an entry lives. Every one of those
  answers is specific to an app, in a way that a retry and a timeout are not. To ship a cache that
  is wrong is worse than to ship none. A wrong cache serves stale data with no message. Its absence
  costs a request that the author can see in the network panel. An app that needs a cache today
  loads the data once, above the components that share it, and holds it in a named state. That is
  the existing answer of imp to "two components want the same thing". Somebody can add a cache of
  responses later, behind a new option, with no change to a call site, see
  `todo/http-client-cache.md`.
- **Every call has an identity by default.** imp sends a UUID per call, as `x-request-id`. It
  generates that id in the builder of the request. So a hook, a mock and the network all see the
  same value. The id is also **stable across a retry**. The id names the call that the author made,
  and not the attempt that imp made. That is what makes a retried request recognizable as one call,
  in the log of a server. `x-request-id` is a convention in practice, and not a registered header.
  RFC 6648 discourages the `X-` prefix, and the `traceparent` header of the W3C is the standard
  alternative. So the name is not for imp to fix. `requestId` renames the header, per client or per
  call. `requestId: false` removes it. imp never overwrites a header that somebody set by hand. Off
  is a supported position, because a custom header forces a CORS preflight on a cross-origin call,
  and a backend that the author does not control can refuse that. imp generates the id, and never
  reads it back. To correlate it with a trace is the business of the app, over `onRequest`.
- **There is one type of error.** A response that is not 2xx, a transport failure, a timeout, an
  abort, a JSON body that imp cannot parse, and a hook that rejects, all reject with an `HttpError`.
  That error carries `status`, `code`, `method`, `url`, `headers` and `body`. `code` is `status`,
  `network`, `timeout`, `aborted`, `parse` or `hook`. `request()` differs from a verb in what it
  returns on success, and not in when it throws. So there is one meaning of a failure, for a retry,
  for the request state, and for a hook.

**The resolution and the disposal ride the DOM, on the mechanism of the state, and not on a second
one.** The lookup of a provider is the bubbling, composed `CustomEvent` that the nearest ancestor
answers, when that ancestor registered the name. imp factored that lookup into one internal seam,
keyed by a `kind`. The state and the HTTP client both use it. To add a resource that the DOM scopes,
later, costs a `kind`, and not another lookup. Everything about the scope follows from where the
provider listens. So the rules are the rules of the state, and they do not change. The nearest
client wins. An area **shadows** an app-wide client, when it initializes the same name. To
initialize a name again, in one scope, throws. Two sibling instances own independent clients. imp
resolves again when a component moves, see `component-moves-rebind.md`. Both helpers throw outside a
component that mounts, and they must run before the first `await` of an async `build`. A name is
namespaced. The rule is the same, and the lint treatment is the same, through
`imp/http-client-name-namespace` and `imp/http-client-setup-before-await`. **An unmount closes the
client that the component created**, and never a shared client. imp composes a client-wide
`AbortController` into the signal of every request. So an attempt in flight aborts. A retry that
waits on a backoff delay stops, in place of firing into a dead screen. imp drops the tracker of each
request. A call that somebody makes afterwards, through a handle that they kept, rejects, and it
does not reach the network. To close a client is about stopping _work_, and not about reclaiming
memory. Nothing global holds a client. So a client that nothing references was always collectable.
What the app could not do before was to cancel what a screen that left had started. The same routine
backs the public `close()`. imp carries the reason for the close into the message of the rejection.
So "the client was closed when its component unmounted" and "the client was closed" are different at
the call site.

**An interceptor is the place to extend the client.** `onRequest` and `onResponse` carry the names
of the existing lifecycle hooks of imp. Each one takes a function, or an ordered array of functions.
Each one can be async. A list on a call **composes with** the list of the client. It never replaces
it. `onRequest` runs after imp has resolved the URL, merged the headers and serialized the body, and
before the send. It returns the request that it received, or a replacement. `onResponse` runs after
imp parses the response, and before imp decides about a retry, and before the request state settles.
It returns the response. The placement is deliberate. `onRequest` runs **inside** the retry loop,
from the headers of the call each time. So a token that a hook refreshes applies to the next
attempt. `onResponse` runs before everything after it. So an envelope that a hook unwrapped, or an
error that a hook remapped, is what a retry and `lastError` both see. The timeout budget per attempt
covers the time of a hook. So a hook that hangs aborts like a request that hangs. An auth token
refresh, an unwrap of an envelope, a signature of a request, and logging, are hooks, and not options
of their own. **imp ships no helper for a token refresh.** A refresh with one flight is ten lines of
app code over this base. The policy behind it is not for imp to choose. That policy answers when to
refresh once, when to retry once, and when to sign the person out.

**The client knows nothing about a mock.** To run with no backend is a capability of the dev server,
see `dev-server-mocks.md`. A mock handler lives in a `*.mock.js` file, outside the app, and the
service worker answers from it. So what reaches the client is an ordinary `Response`, over an
ordinary `fetch`. Nobody configures anything on the client. App code branches on nothing. Nothing
about mocking travels in a production bundle. That also means that a mocked `503` retries, and that
a mocked latency drives the spinner. That is not by design. It happens because the client cannot see
a difference.

**The request state is a state, and not a new mechanism.** Each client exposes `pending` and
`lastError`. Both are read-only, and both have the shape of a state. `pending` is the number of
calls in flight. So a `computed` over `api.pending` binds straight to a `hidden` prop, and
`api.pending.text()` renders the count. There is no new concept. `lastError` holds **plain data**,
which is `{ message, status, code, method, url, body }`, and not the `Error` object. A state value
is plain data, see `state-plain-data-values.md`. The next call that succeeds clears `lastError`, and
`clearError()` clears it by hand. Granularity per request is a **choice that you make**. A call that
passes `track: 'users.list'` also drives `api.tracked('users.list')`. So to connect one spinner to
one request costs one name, and every other call costs nothing.

## Consequences

- An app configures its network layer once, and then calls it. A retry and a timeout are declarative
  options, and not code that each app writes again. The defaults of imp decide the sharp cases,
  which are a `POST` that somebody retried, and a timeout that does not abort.
- Everything that an app might want to intercept is reachable. So imp needs no option per concern.
  The cost is that a hook is an ordinary function, with no sandbox. A hook that throws fails the
  call, and that is also how a hook aborts a call on purpose.
- The request state binds like any other state. So the planned loader of the standard library, and
  its banner for a failure, see `todo/stdlib-components.md`, attach by the name of the client,
  through the existing rules of a binding. There is no new coupling.
- A duplicate read is a problem for the app to notice. Two components that both fetch `/users` at
  mount make two requests. The fix is to lift the fetch above them, and not to configure the client.
  That is a visible cost, and imp pays it to keep the behaviour of the client literal. What you call
  is what imp sends.
- There is one concept of a scope across the framework, and not one per subject. A component owns a
  state and an HTTP client, and imp resolves both through the tree. So an author who has learned one
  has learned the other. Two islands that somebody bundled separately also work with both.
- Nobody disposes of anything by hand in the ordinary case. The case that a manual call would serve,
  which is to leave a section, is exactly the case that an unmount already covers. An API that
  somebody can forget is an API that somebody will forget. `close()` exists only on the client that
  you asked to own. There, to forget it is a decision that you made, and not a default that you
  received.
- A client can live longer than the DOM. So imp works in a worker. `createHttpClient` needs no
  document, and the pipeline of a request, with its retries and its hooks, is free of the DOM. The
  reactive half of the request state does not follow it there. `watch`, `text`, `view` and `each`
  need a component that mounts. `pending.get()` and `lastError.get()` work anywhere. That costs a
  worker nothing, because a worker has no DOM to bind to.
- The cost is that you cannot import a client. A plain helper module that used to write
  `import { api }` now takes the client as an argument, from the component that resolved it. That is
  the same trade that a state makes. It is the price of the DOM as the only scope.
- A test and a preview mount a host component, to initialize a client in. They already do that for a
  state.
