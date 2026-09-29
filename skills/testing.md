# testing - unit tests in-process, e2e specs in a real browser

There are two levels, one command and one import. The runner, the assertions and the simulated DOM
are part of the binary.

- **`*.test.js`** holds a unit test or an integration test. It runs in process, against a simulated
  browser environment.
- **`*.spec.js`** holds an end-to-end test. imp serves the app as `imp start` does, launches
  headless Chrome, and gives each spec a Puppeteer `page`.

```
imp test <file>              run one file (exit 0/1)
imp test --unit | --e2e      run every file of that level, one process each, in parallel
imp test --unit --jobs 4     cap concurrency (default: CPU count)
imp test --e2e --filter x    only tests whose name contains x
imp test --unit --list       print the selected files as JSON (for a CI matrix)
imp test --e2e --video vid   record each spec as an animated GIF into ./vid
imp test --e2e --mock        answer the app's requests from the *.mock.js files (--no-mock forces real)
```

One test file per process is the unit of isolation. A bare `imp test` with several candidate files
runs nothing and exits with a non-zero code. Always name a level or a file.

## How to write a test

```js
import { beforeEach, expect, spy, test } from 'imp/test'

test('adds numbers', () => {
  expect(2 + 3).toEqual(5)
})
```

`test(name, fn, options?)` registers a test. Tests run in file order, one at a time. There are also
`test.skip` and `test.only`. The options are `timeout` in milliseconds, which defaults to 5s for a
unit test and 30s for an e2e test, and `fakeTimers`, which works in a unit test only. The hooks
`beforeAll`, `beforeEach`, `afterEach` and `afterAll` are scoped to the file, and imp awaits them.
For a parameterized test, write a plain `for...of` loop around `test()`. There is no `each` helper.

## Assertions

Call `expect(value)`. You can invert every matcher with `.not`:

| Matcher                                  | Passes when                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `toEqual(x)`                             | data compares by structure, everything else by identity            |
| `toContain(x)`                           | substring, or iterable contains element                            |
| `toMatch(pattern)`                       | string matches a RegExp or contains a substring                    |
| `toBeTruthy()`                           | truthy (`.not.toBeTruthy()` for falsy)                             |
| `toBeGreaterThan(n)` / `toBeLessThan(n)` | numeric comparison (`.not` gives `>=` and `<=`)                    |
| `toThrow(message?)`                      | function throws; `await expect(fn).toThrow(...)` for async         |
| `toHaveAccessibleControls()`             | e2e only: every control of a page or element has a role and a name |

**That is the whole set.** There is no `toBe`, `toBeInstanceOf`, `toBeCloseTo`, `toHaveLength` or
`toHaveBeenCalled`:

```js
expect(node).toEqual(expect.any(HTMLElement))
expect(sum).toEqual(expect.closeTo(0.3))
expect(items.length).toEqual(3)
expect(value).toEqual(null)
```

`toEqual` compares a number, a string, a boolean, a plain object, an array, a `Map`, a `Set`, a
`Date` and a `RegExp` by structure, to any depth. It compares a DOM node, a class instance and a
function by identity. To check a few fields only, compare a projection:
`expect({ id, name }).toEqual({ id: 1, name: 'imp' })`.

A placeholder can nest anywhere inside a `toEqual` or `toContain` value:

| Placeholder                    | Matches                                   |
| ------------------------------ | ----------------------------------------- |
| `expect.anything()`            | anything except `null`/`undefined`        |
| `expect.any(Ctor)`             | a value of that type                      |
| `expect.stringContaining(s)`   | a string containing `s`                   |
| `expect.stringMatching(re)`    | a string matching a RegExp                |
| `expect.arrayContaining(xs)`   | an array containing at least each of `xs` |
| `expect.objectContaining(obj)` | an object with at least those properties  |
| `expect.closeTo(n, digits?)`   | a number within floating-point tolerance  |

## Mocking

**`spy(fn?)`** records every call in `spy.calls`, which is an array of argument lists. Otherwise it
does whatever the function that you pass does. There is no `.mockReturnValue` method or anything
like it:

```js
const onSave = spy() //                       records only
const load = spy(async () => user) //         resolves
const boom = spy(() => {
  throw new Error()
}) // throws
const info = spy(console, 'info') //          wraps a method in place, original still runs
const quiet = spy(console, 'info', () => {}) // ...and replaces its behavior

expect(onSave.calls).toEqual([[{ id: 1 }]]) // called once with { id: 1 }
expect(load.calls.length).toEqual(2)
```

imp clears the spies and restores a wrapped method between tests. You write no cleanup.

**`mockModule(specifier, factory)`** replaces a whole module for the file under test. It replaces
the module everywhere it is imported, at any depth:

```js
mockModule('./http.js', ({ spy, orig }) => ({
  ...orig(), // partial mock: everything else stays real
  get: spy(() => Promise.resolve({ name: 'imp' })),
}))
```

- The specifier is relative to **your test file**, or it is the dependency alias from `imp.json`.
  imp matches by the resolved file. So a different spelling somewhere else is still covered.
- Call it `mockModule`. Do not rename the import. Pass a **string literal**, because imp reads these
  before your test runs.
- The factory runs in the mocked module. It **cannot see the variables of your test file**. Use the
  injected `spy` and `orig`.
- imp fills an export that you do not return with a fresh spy. `default` mocks a default export.
- A mock is scoped to one file, and it never leaks.

**The HTTP calls of a component** need neither of those. `spy(globalThis, 'fetch', ...)` replaces
the network. A host component of one line owns the client, as in
`setup: (self, prepare) => prepare(self)`, because a component always owns a client.
`{ fakeTimers: true }` makes a retry and a timeout instant. Call `await clock.tick(delay)` between
attempts. See [http](http.md).

## Unit tests

Each file gets a fresh simulated DOM. `document`, `window`, the elements, the events and
`localStorage` are globals. Tests in one file share the DOM, so reset it in `beforeEach`.

```js
import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'

beforeEach(() => document.body.replaceChildren())

test('reacts to clicks', () => {
  mount(document.body, counter)
  document.querySelector('#inc').click()
  expect(clicks).toEqual(1)
})
```

**A component renders into a shadow root**, see [components](components.md). So
`document.querySelector` does not see its internals:

```js
document.querySelector('my-app-card').shadowRoot.querySelector('button').click()
```

**Fake timers work in a unit test only.** Pass `{ fakeTimers: true }`, or
`{ fakeTimers: { now: new Date('2030-01-01') } }`. imp then puts `setTimeout`, `setInterval`,
`requestAnimationFrame`, `Date` and `performance.now()` on a virtual clock. The test receives that
clock as `clock`:

| Call                   | Does                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `await clock.tick(ms)` | advance, running due timers in order, flushing awaits between |
| `await clock.runAll()` | run everything pending                                        |
| `clock.now`            | current virtual time in ms                                    |
| `clock.restore()`      | back to real timers (rarely needed)                           |

```js
test('debounce fires once', async ({ clock }) => {
  ping(), ping()
  await clock.tick(299)
  expect(calls).toEqual(0)
  await clock.tick(1)
  expect(calls).toEqual(1)
}, { fakeTimers: true })
```

`tick` and `runAll` are async. Always `await` them. `fakeTimers` on a spec fails.

## E2E specs

Each spec file gets its own server, port, browser and page. The tests in one file share the page, so
a file reads as one user session. Each test receives `{ page, browser, baseUrl }`. `page` is a
Puppeteer page, and its selectors go through a shadow root.

```js
test('increments on click', async ({ page }) => {
  await page.click('#inc')
  expect(await page.$eval('#count', (el) => el.textContent)).toEqual('1')
})
```

The e2e server is the dev server. So `--mock`, or `mocks.enabled` in `imp.json`, feeds the whole
suite from your `*.mock.js` files. You need no stub of any kind. See [mocks](mocks.md).

**Write a plain CSS selector. It already reaches inside a component.** Never put `>>>` at the front
of a selector, because the search goes deep from the page down. Use `>>>` only _between_ parts, when
a selector would match in more than one component. Write one `>>>` per boundary that you cross:
`imp-submit-button >>> imp-button >>> button`. The page is already on your app before the first
test. The browser console and the network stream to the terminal. A failing test saves a screenshot
under `.imp/screenshots/`. To use a different entry page, set `test.entry` in `imp.json`, see
[config](config.md).

**Check every control of a page with one matcher.** It reports a control with no accessible name,
and a focusable element with no role. It returns a promise, so always `await` it. It takes the page,
or an element from `page.$()`. It is not a full audit: it does not check contrast or headings. It
skips an element outside the accessibility tree: `hidden`, `display: none`, `visibility: hidden`,
inside `inert` or `aria-hidden="true"`, or in a closed `<details>` or `<dialog>`. Open a hidden
panel before you check it.

```js
await expect(page).toHaveAccessibleControls()
await expect(await page.$('#checkout')).toHaveAccessibleControls()
```

**To assert a name, a role or a state in detail, read the accessibility tree, not the DOM.** The
tree is flat across every shadow root, and the browser computes the names, the roles and the states
in it:

```js
const root = await page.$('#checkout')
const tree = await page.accessibility.snapshot({ root, interestingOnly: false })
```

A node has `role`, `name`, and a state such as `checked`, `selected`, `expanded`, `disabled`,
`invalid`, `description` or `value`. Text shows as `StaticText`. Keep `interestingOnly: false`,
because the default prunes a container such as a `tablist`, a `group`, an `alert` or a `status`.

imp resolves the browser in this order: `test.browser` in `imp.json`, then `IMP_BROWSER`, then an
installed Chrome or Chromium, then a pinned download into `~/.imp/browser/` that imp verifies
against its checksum. `IMP_CACHE_DIR` moves that cache folder. For a CI with no network, set
`IMP_BROWSER` to a browser in the image, or restore an `IMP_CACHE_DIR` folder that already holds the
browser. Put that folder at `.imp/cache` in the workspace, never at a new folder name: imp skips
`.imp/` in lint, fmt and every project walk, and git ignores it. imp has no download mirror.

`--video <dir>` records one GIF per spec. Tune it with `test.video`, which has `enable`, `fps`,
`maxDuration`, `width` and `quality`. A GIF plays inside a GitHub pull request. That is how an agent
shows a reviewer that the feature works.

## Output

imp prints plain text on stdout. For a single file it prints `✓`, `✗` or `-` per test. For a level
run it prints one `✓ <file>` line per passing file, then the full output of every failing file, then
a tally. The exit code is `1` when anything failed. The only machine-readable surface is `--list`.
It prints a JSON array of files for a CI matrix, with one job per spec, because each spec is
self-contained.
