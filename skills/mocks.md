# mocks - running the app without its backend, from `*.mock.js` files

Point `imp.json` at a folder. The dev server then answers a matching request itself. The dev service
worker, or your own worker when it calls `startDevMode()`, sends each request of the page to the
`imp start` process, where the mocks run. See [service-worker](service-worker.md). **Nothing in the
app changes.** The app keeps its real `baseUrl` and its real calls. There is no stub and no import.
`imp build` never copies the folder.

```json
{ "mocks": { "folder": "mocks", "enabled": true } }
```

Both keys are necessary. `folder` says where the files are. `enabled` says whether the files answer
by default. So a project always states which backend it develops against. A malformed block fails
the command, and the error names the key. See [config](config.md).

```js
// mocks/users.mock.js
export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 800,
    handler: () => ({ status: 200, body: [{ id: 'u1', name: 'Ada' }] }),
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/users',
    handler: (request) => ({ status: 201, body: { id: 'u3', ...request.body } }),
  },
]
```

Every `*.mock.js` file under the folder exports a `mocks` array of `{ match, handler, delay? }`. imp
also reads a nested folder.

| Key                | Gets                                          | Returns                                                    |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| `match(request)`   | `{ method, url, path, query, headers, body }` | `true` to answer this request                              |
| `handler(request)` | the same object                               | `{ status, headers, body }`. Can be async.                 |
| `delay`            | -                                             | milliseconds of simulated latency, so a spinner is visible |

The default `status` is `200`. imp sends a `body` that is not a string as JSON. A request `body`
arrives parsed when the page sent it as JSON. A mock runs in the `imp start` process, not in the
page. It has `setTimeout` and `console`, and no DOM and no `fetch`.

## How to turn the mocks on and off

```
imp start              # what imp.json says
imp start --mock       # this run answers from the mocks folder
imp start --no-mock    # this run goes to the real API
```

The same two flags work on `imp preview`, where the files are fixtures for a previewed component,
and on `imp test`, where they are fixtures for an e2e spec. So `imp test --e2e --mock` runs the
suite with no backend. Set `"enabled": true` while the backend does not exist. Set it to `false`
when the backend exists. A plain `imp start` is then a real run, and you ask for mocking when you
want it.

When the mocks are on, the server says so as it starts. It reports every mocked answer like any
other request, and adds the file and the entry that answered:

```
[INFO] mocks - 2 file(s) from mocks/ answering requests
[HTTP] GET http://localhost:4507/api/users -> 200 802ms (mock: mocks/users.mock.js #1)
```

## Rules an agent gets wrong

- **The first match wins**, in file-path order across all files. Put the specific entry before the
  broad one.
- **imp sends an unmatched request to the real network.** So you can mock the half of an API that
  does not exist yet, while the rest goes to your backend.
- **A thrown error simulates a failed connection, not a `500`.** The request fails in the page as if
  the server were unreachable. To simulate a server error, return `{ status: 500 }`.
- **Mock code runs in a worker thread of the `imp start` process, outside the page and outside the
  service worker.** There is no `document`, no access to app state, and no import from the DOM layer
  of your app. A plain module and a vendored dependency both work.
- **An error thrown outside a handler, such as in a timer, stops only the mocks.** imp reports it,
  and the next request loads the files again with a new state.
- **imp loads the files once per run.** So a closure is how a mock keeps state between requests.
  Examples are a counter that fails every second call, and an in-memory list that remembers a
  `POST`. All tabs share the state. A reload and a stopped service worker keep it.
- **An edit to a mock file, or to a file that it imports, resets the state.** imp loads the files
  again in a new thread. An edit saved during a load starts one more load, so it is never lost. To
  start again from the seed data with no edit, restart `imp start`.
- **An answer is a real response over the network layer of the browser.** So everything after it
  behaves normally. An [http](http.md) client retries a mocked `503`, a `delay` keeps `pending`
  true, and an interceptor runs.
- **Never branch your app on the state of the mocks.** Nothing about mocking ships. imp leaves the
  folder out of the build, and the app cannot see a difference.
- An edit to a mock file reloads the browser like any other change. imp reports a file that fails to
  build, with its line, and the rest of the app continues to run.

The service worker sends imp **every** request that the page makes, so the mocks cover all of them.
This includes `fetch`, XHR and a third-party SDK, not only the requests that imp issues.
`imp preview` and the e2e server are the same dev server, so the same files apply there. See
[start](start.md), [preview](preview.md) and [testing](testing.md).
