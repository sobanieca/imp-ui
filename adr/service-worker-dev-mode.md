# Dev mode is one call in a service worker, and a project keeps its own worker

## Context

`imp start` runs a service worker at root scope. It reports every request of the page as a `[net]`
line, and it sends a request to the `*.mock.js` files, see `dev-server-mocks.md`. A browser runs one
service worker per scope. So an app with a worker of its own, for a push notification, a background
sync or an offline strategy that imp does not emit, could not run it in development. Its
registration and the registration of imp replaced each other, and the last one won.

A worker cannot use the import map of the page. So a source file that imports from imp cannot be
served raw, the way the dev server serves the modules of the page.

## Decision

**Dev mode is `startDevMode()` from `imp/service-worker`, and the dev server bundles the worker that
runs it.** The library holds the code that reports a request and relays it to the mocks. The worker
of imp is that one call. A project names its own worker in `imp.json`, and it makes the same call
itself.

- **`imp.json` names the worker.** `"serviceWorker": "src/sw.js"` is the path of the source. With
  the key, the injected client registers no worker of imp. The dev server bundles the source in
  process, with esbuild, and serves it at `/sw.js`. `imp build` bundles the same source into `sw.js`
  in the output folder. The app registers `/sw.js` itself, in both modes. There is one registration,
  and the app owns it.
- **`startDevMode()` adds exactly the dev behaviour.** It adds a `fetch` listener that reports each
  request and relays it to the mocks, an `install` listener that calls `skipWaiting()`, and an
  `activate` listener that claims the clients. The last two are what an edit needs: the new bundle
  takes over on the next navigation. The call touches nothing else. The app keeps its own listeners
  for push, sync and everything else.
- **The app decides when dev mode runs.** The call is not folded away by the build, and imp adds no
  flag for it. The bundle starts with the values of the selected environment, as the page does, so
  `env` from `imp` works in the worker. An app gates the call on an environment value. The docs say
  why: a production worker with the call would report to a dev server that is not there.
- **The worker carries no mock code.** When mocking is on, the dev server starts the worker script
  with the path of the mock endpoint, before the worker bundle. So `startDevMode()` knows the
  endpoint whatever the order of the statements in the worker. The mocks run in the dev server
  process, which reports a mock file that fails to bundle or fails its shape check.
- **`imp build --pwa` keeps the worker of the project.** It writes the manifest and the icons, and
  registers the worker of the project. It writes no second worker, because two workers cannot share
  `sw.js` and root scope. It writes the precache values in front of the bundle, and a
  `precacheBuild()` call in the worker installs the offline behaviour, see `pwa-toolkit.md`.
- **`precacheBuild()` does nothing in development.** The dev server writes no precache values, so
  the call adds no listener, and the `fetch` listener of `startDevMode()` answers every request.
- **The bundle is fresh per request.** The dev server keeps the stamps of every file that the last
  bundle read. A request rebuilds only when one of them changed. A failed bundle answers the worker
  request with the error, and the terminal names the file and the line.

## Consequences

- One implementation serves the worker of imp and the worker of a project. The dev worker of imp is
  a two-line entry that the same bundler builds.
- A project worker is bundled in development. That is the one place where the dev server bundles app
  code. The page keeps its raw modules and the import map.
- `imp/service-worker` is a library module. Nothing in it runs at module scope, so a worker that
  imports it and never calls `startDevMode()` carries the code and runs none of it.
- The worker of a project imports `env` from `imp`. The bundle then carries the modules that the
  root barrel reaches, at a few kilobytes. That cost is accepted over a second home for `env`.
- A project worker gets the offline precache from `--pwa` with one call, and needs no gate for it.
  The worker of imp and the worker of a project run the same code.
