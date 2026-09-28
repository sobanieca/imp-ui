# service-worker - your own service worker, with dev mode from startDevMode()

A browser runs one service worker per scope. When the app has a worker of its own, name it in
`imp.json`, and imp registers no dev worker. imp bundles your source and serves it at `/sw.js`.
`imp build` writes the same bundle as `sw.js`. The app registers `/sw.js` itself.

```json
{ "serviceWorker": "src/sw.js" }
```

```js
import { env } from 'imp'
import { startDevMode } from 'imp/service-worker'

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification(event.data.text()))
})

if (env.DEV_TOOLS === 'on') startDevMode()
```

```js
navigator.serviceWorker.register('/sw.js')
```

## What startDevMode() does

| Listener   | Effect                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| `fetch`    | reports every request as a `[net]` line, asks imp for a `*.mock.js` answer  |
| `install`  | `skipWaiting()`, so an edited bundle takes over on the next navigation      |
| `activate` | `clients.claim()`, so the page that loaded the bundle is controlled at once |

It adds nothing else. Your own listeners stay as written.

## Rules an agent gets wrong

- **Call `startDevMode()` at the top level of the worker.** A browser only honours a listener that a
  worker adds while the script first runs. A call inside an event handler or after an `await` adds
  listeners that never fire.
- **Gate the call yourself.** The build does not remove it. A production worker with the call would
  report every request to a dev server that is not there. Read `env` from `imp`, which works in the
  worker because the bundle starts with the values of the selected environment, and gate on a value
  that production does not set. See [config](config.md) for environments.
- **Register `/sw.js`, not the source path.** The source at `src/sw.js` has a bare `imp` import that
  no worker can resolve. Only the bundle at `/sw.js` runs. Under a sub-path, register
  `url('/sw.js')` from `imp/router`.
- **Never register `/@imp/sw.js` yourself.** With `serviceWorker` in `imp.json`, that path is gone.
- **Do not add `serviceWorker` to a project with no worker of its own.** The dev worker of imp
  already gives telemetry and mocks. The key is for a worker that the app needs in production.
- **`imp build --pwa` writes no offline worker for you.** It registers your worker and writes the
  manifest and the icons. Offline caching is then your code.
- An edit to the worker, or to a file that it imports, reloads the browser. A bundle that fails
  answers the worker request with the error, and the terminal names the file and the line.

Related: [start](start.md), [mocks](mocks.md), [build](build.md), [config](config.md),
[routing](routing.md)
