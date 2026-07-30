# Mocks are a dev-server feature, answered by the service worker

## Context

An app is routinely built before — or without — the backend it talks to, so imp has to answer "run
this UI with no server behind it". The first answer put the handlers in the HTTP client: a `mock`
map declared where the client was configured, switched on by an environment value. That put fixtures
in application source and in the production bundle, made "is mocking on?" a runtime branch no
bundler can fold away, and scoped mocking to imp's own client — a plain `fetch`, an `<img>`, an
`XMLHttpRequest` in a dependency all went to the real network regardless.

The dev server already registers a service worker at root scope for network telemetry
(`built-in-logger.md`), and already bundles code in-process with esbuild
(`in-process-dependency-bundling.md`). Between them, the machinery to answer a request before it
leaves the browser is already running in development and absent from a build.

## Decision

**Mock responses are declared in `*.mock.js` files, discovered from a folder named by `imp.json`,
and served by the dev server's service worker.** `"mocks": { "folder": "mocks", "enabled": true }`
points at a folder; every `*.mock.js` under it (nested folders included) is part of the mock set, so
routes are split across files the way the app is.

- **A mock file exports `mocks`, an array of `{ match, delay, handler }`.** `match(request)` is a
  predicate over `{ method, url, path, query, headers, body }` — a function rather than a route
  pattern, because a pattern language is a second thing to learn and always one case short of what a
  predicate expresses. `handler(request)` receives the same object and returns
  `{ status, headers, body }` (a plain `body` is serialized as JSON) or a `Response`. `delay` is
  milliseconds of simulated latency. **The first matching entry answers**, in file-path order.
- **Handlers are code, not data.** The files are bundled — they import shared fixtures, vendored
  dependencies, whatever they need — and each is evaluated once per worker install, so a closure
  over a counter is how a handler is stateful across requests, and `throw` inside a handler is how
  it simulates a transport failure (the page's `fetch` rejects exactly as it would offline).
- **An unmatched request goes to the network**, so a half-mocked API is the normal case rather than
  a configured one, and mocking a single endpoint never takes the rest of the app offline.
- **Selection is a run mode, never a branch in app code.** Running against fixtures and running
  against the real API are both everyday choices, so each is one word on the command line: `--mock`
  and `--no-mock` on `imp start`, `imp preview` and `imp test`, overriding the project's default for
  that run. The default is the config's, and **stating it is mandatory**: `mocks` takes both a
  `folder` and an `enabled`, with no shorthand and no inferred value, so a repository can never be
  ambiguous about whether checking out and running it talks to a backend. That is what lets a
  project with a live backend keep mocks in the tree without changing what `imp start` does. There
  is no env value and no flag reachable from app source, and `imp build` copies neither the folder
  nor anything in it, so what production carries is unaffected by any of it.
- **Interception is at the network boundary, not in imp's client.** Every request the page makes is
  matched, whatever issues it, and a mocked answer is a real `Response` arriving over the same path
  as a real one — retries, timeouts, interceptors and request state in the HTTP client
  (`http-client.md`) cannot tell the two apart, because from their side there is nothing to tell
  apart.

**The bundle rides the service worker script the dev server already serves.** `/@imp/sw.js` is
generated per request: the telemetry worker first, the bundled mocks appended, so the mock set is
whatever is on disk at that moment. The bundle is rebuilt only when a mock file's timestamp or size
changes, and because the script's bytes change with it, the browser's ordinary update check on the
next navigation installs the new worker — an edit to a mock file reloads like an edit to any other
file. A file that fails to bundle is reported in the terminal with its line, and the worker is
served without mocks rather than not at all.

**A page that loaded before the worker took control reloads itself, but only if it missed
something.** A newly installed worker claims the page a moment after it loads, and requests made in
that window would reach the network. The injected client script wraps `fetch` while the page is
uncontrolled, and reloads once if — and only if — a request actually went out unmocked. The common
case (a worker already active from the previous page load) does no work at all.

## Consequences

- Mock fixtures live beside the app instead of inside it, and cannot ship: there is no gated branch
  to eliminate, because there is no branch — no feature flag (`adr/feature-flags.md`) is needed to
  keep mocks out of a production build.
- Everything is mocked, not just imp's HTTP client — third-party SDKs, images, `XMLHttpRequest`. The
  cost is that the mock set is global to the served origin: two clients hitting different APIs share
  one list, and telling them apart is the matcher's job.
- Mock code runs in a service worker, so it has no DOM, no `window`, and no access to app state; and
  mocking requires a worker-capable, secure context (`localhost` and `https`, which is what
  `imp start` serves).
- Statefulness is the author's, in ordinary closures. imp does not reset a handler's counter between
  page loads — the worker outlives them — which is what makes "fail every other call" and "the
  second poll returns done" expressible, and what makes a stale counter the author's to notice.
- The mocked path and the real path are the same code in the browser, so a mocked `503` retries, a
  `delay` keeps the spinner up, and an app cannot behave differently against mocks in any way except
  the answers it gets.
- `imp preview` and the `imp test --e2e` server are built on the same dev server, so a project's
  mocks apply there too, under the same default and the same two flags — an e2e suite pinned to
  fixtures is `imp test --e2e --mock`, and nothing in the specs says so.
- Which mode a run is in is a property of the command that started it, so it is visible in the
  terminal (the server reports the folder it is serving) rather than inferable only from a request
  that did or did not reach the backend.
