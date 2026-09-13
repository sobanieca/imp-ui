# Mocks are a dev-server feature, answered by the service worker

## Context

People routinely build an app before its backend exists, or with no backend at all. So imp must
answer the question "how do I run this UI with no server behind it?". The first answer put the
handlers in the HTTP client. A `mock` map sat where somebody configured the client, and an
environment value turned it on. That put a fixture in the source of the application, and in the
production bundle. It made the question "is mocking on?" a branch at runtime that no bundler can
fold away. It also limited mocking to the client of imp. A plain `fetch`, an `<img>`, and an
`XMLHttpRequest` inside a dependency, all went to the real network.

The dev server already runs a service worker at root scope, for the network telemetry, see
`service-worker-dev-mode.md`. It also already bundles code in process, with esbuild, see
`in-process-dependency-bundling.md`. Between them, the machinery to answer a request before it
leaves the browser already runs in development, and it is absent from a build.

## Decision

**You declare a mock response in a `*.mock.js` file. imp discovers those files from a folder that
`imp.json` names, and the service worker of the dev server serves them.**
`"mocks": { "folder": "mocks", "enabled": true }` points at a folder. Every `*.mock.js` file under
that folder is part of the mock set, and imp also reads a nested folder. So you split the routes
across files, in the way that the app is split.

- **A mock file exports `mocks`, which is an array of `{ match, delay, handler }`.**
  `match(request)` is a predicate over `{ method, url, path, query, headers, body }`. It is a
  function, and not a route pattern. A pattern language is a second thing to learn, and it is always
  one case short of what a predicate expresses. `handler(request)` receives the same object. It
  returns `{ status, headers, body }`, where imp serializes a plain `body` as JSON, or it returns a
  `Response`. `delay` is the simulated latency in milliseconds. **The first entry that matches
  answers**, in file-path order.
- **A handler is code, and not data.** imp bundles the files. So a file imports a shared fixture, a
  vendored dependency, and whatever else it needs. imp evaluates each file once per install of the
  worker. So a closure over a counter is how a handler keeps state across requests. A `throw` inside
  a handler is how it simulates a transport failure, and the `fetch` of the page then rejects
  exactly as it does when the machine is offline.
- **An unmatched request goes to the network.** So an API that is half mocked is the normal case,
  and not a case that somebody configures. To mock one endpoint never takes the rest of the app
  offline.
- **The selection is a mode of a run, and never a branch in app code.** To run against a fixture,
  and to run against the real API, are both everyday choices. So each one is one word on the command
  line. `--mock` and `--no-mock` work on `imp start`, `imp preview` and `imp test`. They override
  the default of the project, for that run. The default comes from the config, and **you must state
  it**. `mocks` takes a `folder` and an `enabled`. There is no short form, and imp infers no value.
  So a repository can never be unclear about whether a checkout, and a run, talk to a backend. That
  is what lets a project with a live backend keep its mocks in the tree, and not change what
  `imp start` does. There is no env value, and no flag that app source can reach. `imp build` copies
  neither the folder nor anything in it. So none of this affects what production carries.
- **The interception is at the network boundary, and not in the client of imp.** imp matches every
  request that the page makes, whatever issued it. A mocked answer is a real `Response`, and it
  arrives over the same path as a real one. A retry, a timeout, an interceptor and the request state
  in the HTTP client, see `http-client.md`, cannot tell the two apart. From their side there is
  nothing to tell apart.

**The bundle rides on the service worker script that the dev server serves.** imp generates the
worker per request. The bundled mocks come first, and the worker code that calls `startDevMode()`
follows. So the mock set is whatever is on disk at that moment. imp rebuilds the bundle only when
the timestamp or the size of a mock file changes. The bytes of the script change with the bundle. So
the ordinary update check of the browser, on the next navigation, installs the new worker. An edit
to a mock file then reloads like an edit to any other file. imp reports a file that fails to bundle
in the terminal, with its line, and serves the worker with no mocks, in place of no worker at all.

**A page that loaded before the worker took control reloads itself, but only when it missed
something.** A newly installed worker claims the page a moment after the page loads. A request in
that window would reach the network. The injected client script wraps `fetch` while the page has no
controller. It reloads once when, and only when, a request really went out unmocked. In the common
case, where a worker from the previous page load is already active, it does no work.

## Consequences

- A mock fixture lives beside the app, and not inside it, and it cannot ship. There is no gated
  branch to remove, because there is no branch. No feature flag, see `adr/feature-flags.md`, is
  needed to keep a mock out of a production build.
- imp mocks everything, and not only the HTTP client of imp. That covers a third-party SDK, an image
  and an `XMLHttpRequest`. The cost is that the mock set is global to the served origin. Two clients
  that call two different APIs share one list, and the matcher separates them.
- Mock code runs in a service worker. So it has no DOM, no `window`, and no access to the state of
  the app. Mocking also needs a context that supports a worker and that is secure. That is
  `localhost` and `https`, and `imp start` serves both.
- The author owns the state, in an ordinary closure. imp does not reset the counter of a handler
  between two page loads, because the worker lives longer than a page. That is what makes "fail
  every second call", and "the second poll returns done", expressible. It is also what makes a stale
  counter the problem of the author.
- The mocked path and the real path are the same code in the browser. So a mocked `503` retries, a
  `delay` keeps the spinner up, and an app cannot behave differently against a mock, except in the
  answers that it gets.
- `imp preview`, and the server of `imp test --e2e`, are built on the same dev server. So the mocks
  of a project apply there too, under the same default, and with the same two flags. An e2e suite
  that is pinned to a fixture is `imp test --e2e --mock`, and nothing in the specs says so.
- The command that started a run decides the mode of that run. So the mode is visible in the
  terminal, because the server reports the folder that it serves. Nobody has to infer the mode from
  a request that did or did not reach the backend.
