# Mocks are a dev-server feature, run in the imp process and reached through the service worker

## Context

People routinely build an app before its backend exists, or with no backend at all. So imp must
answer the question "how do I run this UI with no server behind it?". A `mock` map in the HTTP
client puts a fixture in the source of the application, and in the production bundle. It makes the
question "is mocking on?" a branch at runtime that no bundler can fold away. It also limits mocking
to the client of imp. A plain `fetch`, an `<img>`, and an `XMLHttpRequest` inside a dependency, all
go to the real network.

The dev server already runs a service worker at root scope, for the network telemetry, see
`service-worker-dev-mode.md`. That worker sees every request of the page before it leaves the
browser, and it is absent from a build.

A service worker cannot keep state. The browser starts a worker for an event and can stop it when no
event is pending. Chrome and Firefox stop an idle worker after about 30 seconds. The next event runs
the whole script again from nothing. So a mock that keeps its state in the worker loses it. A
counter for new ids starts again, and a created item gets the id of an item that the page already
holds.

## Decision

**You declare a mock response in a `*.mock.js` file. imp discovers those files from a folder that
`imp.json` names, and runs them in the process of the dev server. The service worker sends each
request of the page to that process.** `"mocks": { "folder": "mocks", "enabled": true }` points at a
folder. Every `*.mock.js` file under that folder is part of the mock set, and imp also reads a
nested folder. So you split the routes across files, in the way that the app is split.

- **A mock file exports `mocks`, which is an array of `{ match, delay, handler }`.**
  `match(request)` is a predicate over `{ method, url, path, query, headers, body }`. It is a
  function, and not a route pattern. A pattern language is a second thing to learn, and it is always
  one case short of what a predicate expresses. `handler(request)` receives the same object. It
  returns `{ status, headers, body }`, where imp serializes a plain `body` as JSON. A handler sets a
  `content-type` header to send anything else. `delay` is the simulated latency in milliseconds. **The first entry that matches
  answers**, in file-path order.
- **A handler is code, and not data.** imp bundles the files with its bundler and loads the bundle
  once in an embedded QuickJS, on a thread of the dev server process, see `native-toolchain.md`. So
  a file imports a shared fixture, a vendored dependency, and whatever else it needs. The engine
  gives a handler the language, `console` and timers, and no DOM and no `fetch`, because a mock
  answers for the network and never calls it. A closure over a counter is how a handler keeps state
  across requests. That state lives as long as the run. Every tab shares it, and a reload or a
  stopped worker keeps it. A `throw` inside a handler is how it simulates a transport failure, and
  the `fetch` of the page then rejects exactly as it does when the machine is offline.
- **An edit loads the mocks again.** Before it answers, the dev server compares the timestamp and
  the size of every mock file, and of every file that the last bundle read. When one of them
  changed, or a mock file was added or removed, it bundles and loads the set again. The state of the
  handlers then starts again from the files. A file that fails to bundle is reported in the terminal
  with its line, and imp serves no mocks until the file is repaired.
- **An edit during a load is never lost.** imp records the timestamps before it bundles, and reads
  them again after. When a file changed in between, or the bundle read a file that the record did
  not cover, imp bundles again before it loads anything. One load runs at a time. A request that
  arrives during a load waits for the next check, so it cannot get the answer of an older set.
- **Each load gets a new worker thread.** A module that a process imports stays in memory for the
  life of the process. So imp never imports mock code into the dev server itself. It evaluates each
  bundle in a new worker, and it stops the old worker after its last answer and its last streamed
  body. The memory of a long session does not grow with the number of edits. A worker is also a
  boundary for failure. An error that mock code throws outside a handler, for example in a timer,
  stops that worker and not the dev server. imp reports the error, and the next request loads the
  set again.
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
- **The interception is at the network boundary, and not in the client of imp.** The worker matches
  every request that the page makes, whatever issued it. A mocked answer is a real `Response`, and
  it arrives over the same path as a real one. A retry, a timeout, an interceptor and the request
  state in the HTTP client, see `http-client.md`, cannot tell the two apart. From their side there
  is nothing to tell apart.

**The worker relays a request to `/@imp/mock`.** When mocking is on, the dev server starts the
worker script with the path of that endpoint. The worker posts a description of each request there.
The dev server answers "no match" with no verdict header, and the worker then fetches the request
from the network. For a match, the `x-imp-mock` header carries the entry, the status, the status
text and the headers, and the body is the body of the mock. The relay itself always answers `200`,
so the browser never follows a mocked redirect or shows an authentication prompt. For a handler that
throws, the header carries the message, and the worker rejects the request. The worker reports each
request as before, with the file and the entry that answered it.

**A page that loaded before the worker took control reloads itself, but only when it missed
something.** A newly installed worker claims the page a moment after the page loads. A request in
that window would reach the network. The injected client script wraps `fetch` while the page has no
controller. It reloads once when, and only when, a request really went out unmocked. In the common
case, where a worker from the previous page load is already active, it does no work.

## Consequences

- A mock fixture lives beside the app, and not inside it, and it cannot ship. There is no gated
  branch to remove, because there is no branch. No build flag, see `adr/build-flags.md`, is needed
  to keep a mock out of a production build.
- imp mocks everything, and not only the HTTP client of imp. That covers a third-party SDK, an image
  and an `XMLHttpRequest`. The cost is that the mock set is global to the served origin. Two clients
  that call two different APIs share one list, and the matcher separates them.
- While mocking is on, every request of the page makes one more round-trip to the dev server on the
  same machine. That includes a request that no mock matches.
- Mock code runs in a worker thread of the dev server process. So it has no DOM, no `window`, and no
  access to the state of the app. It runs with the rights of `imp start`, as any other build script
  of the project does. Mocking also needs a context that supports a worker and that is secure. That
  is `localhost` and `https`, and `imp start` serves both.
- The author owns the state, in an ordinary closure. imp does not reset the counter of a handler
  between two page loads. That is what makes "fail every second call", and "the second poll returns
  done", expressible. A fresh state needs an edit to a mock file, or a new run.
- The mocked path and the real path are the same code in the browser. So a mocked `503` retries, a
  `delay` keeps the spinner up, and an app cannot behave differently against a mock, except in the
  answers that it gets.
- `imp preview`, and the server of `imp test --e2e`, are built on the same dev server. So the mocks
  of a project apply there too, under the same default, and with the same two flags. An e2e suite
  that is pinned to a fixture is `imp test --e2e --mock`, and nothing in the specs says so.
- The command that started a run decides the mode of that run. So the mode is visible in the
  terminal, because the server reports the folder that it serves. Nobody has to infer the mode from
  a request that did or did not reach the backend.
