# mocks - running the app without its backend, from `*.mock.js` files

Point `imp.json` at a folder and the dev server answers matching requests itself, through the
service worker it already registers. **Nothing in the app changes**: real `baseUrl`, real calls, no
stub, no import - and `imp build` never copies the folder.

```json
{ "mocks": { "folder": "mocks", "enabled": true } }
```

Both keys are required - `folder` says where the files are, `enabled` says whether they answer by
default - so a project always states which one it develops against. A malformed block fails the
command naming the key. See [config](config.md).

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

Every `*.mock.js` under the folder (nested folders included) exports a `mocks` array of
`{ match, handler, delay? }`:

| Key                | Gets                                          | Returns                                                    |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| `match(request)`   | `{ method, url, path, query, headers, body }` | `true` to answer this request                              |
| `handler(request)` | the same object                               | `{ status, headers, body }`, or a `Response`; may be async |
| `delay`            | -                                             | milliseconds of simulated latency, so spinners are visible |

`status` defaults to `200`, and a `body` that is not a string is sent as JSON. `body` on the request
arrives parsed when it was sent as JSON.

## Turning them on and off

```
imp start              # what imp.json says
imp start --mock       # this run answers from the mocks folder
imp start --no-mock    # this run goes to the real API
```

The same two flags work on `imp preview` (fixtures for previewed components) and `imp test`
(fixtures for e2e specs), so `imp test --e2e --mock` runs the suite with no backend at all. Set
`"enabled": true` while the backend does not exist yet; flip it to `false` once there is one, so a
plain `imp start` is a real run and mocking is what you ask for.

When mocks are on, the server says so as it starts, and every mocked answer is reported like any
other request, tagged with the file and entry that answered it:

```
[INFO] mocks - 2 file(s) from mocks/ serving through the browser
[HTTP] GET http://localhost:4507/api/users -> 200 802ms (mock: mocks/users.mock.js #1)
```

## Rules an agent gets wrong

- **The first match wins**, in file-path order across all files. Put the specific entry before the
  broad one.
- **An unmatched request goes to the real network** - that is how you mock the half of an API that
  does not exist yet while the rest hits your backend.
- **Throwing simulates a failed connection**, not a `500` - the request fails in the page as if the
  server were unreachable. Return `{ status: 500 }` for a server error.
- **Mock code runs in the service worker, outside the page**: there is no `document`, no access to
  app state, and nothing you import from your app's DOM layer. Plain modules and vendored
  dependencies are fine.
- **Each file is evaluated once**, so a closure is how a mock keeps state between requests (a
  counter that fails every other call, an in-memory list that remembers a `POST`).
- **Answers are real responses over the browser's network layer**, so everything downstream behaves
  normally: an [http](http.md) client retries a mocked `503`, a `delay` keeps `pending` up, and
  interceptors run.
- **Never branch your app on whether mocks are on.** Nothing about mocking ships - the folder is
  left out of the build, and the app cannot tell the difference.
- Editing a mock file reloads the browser like any other change; a file that fails to build is
  reported with its line while the rest of the app keeps running.

Because it is a service worker, mocking covers **every** request the page makes - `fetch`, XHR, a
third-party SDK - not just the ones imp issues. `imp preview` and the e2e server are the same dev
server, so the same files apply there. See [start](start.md), [preview](preview.md) and
[testing](testing.md).
