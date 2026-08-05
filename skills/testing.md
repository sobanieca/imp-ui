# testing - unit tests in-process, e2e specs in a real browser

Two levels, one command, one import. Runner, assertions and simulated DOM are built into the binary.

- **`*.test.js`** - unit and integration, in-process against a simulated browser environment.
- **`*.spec.js`** - end-to-end: imp serves the app like `imp start`, launches headless Chrome and
  hands each spec a Puppeteer `page`.

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
runs nothing and exits non-zero - always name a level or a file.

## Writing tests

```js
import { beforeEach, expect, spy, test } from 'imp/test'

test('adds numbers', () => {
  expect(2 + 3).toEqual(5)
})
```

`test(name, fn, options?)` registers; tests run in file order, one at a time. `test.skip`,
`test.only`. Options: `timeout` (ms; default 5s unit, 30s e2e), `fakeTimers` (unit only). Hooks
`beforeAll`, `beforeEach`, `afterEach`, `afterAll` are file-scoped and awaited. Parameterized tests
are a plain `for…of` loop around `test()` - there is no `each` helper.

## Assertions

`expect(value)`, every matcher invertible with `.not`:

| Matcher                                  | Passes when                                              |
| ---------------------------------------- | -------------------------------------------------------- |
| `toEqual(x)`                             | data compares by structure, everything else by identity  |
| `toContain(x)`                           | substring, or iterable contains element                  |
| `toMatch(pattern)`                       | string matches a RegExp or contains a substring          |
| `toBeTruthy()`                           | truthy (`.not.toBeTruthy()` for falsy)                   |
| `toBeGreaterThan(n)` / `toBeLessThan(n)` | numeric comparison (`.not` gives `≥` and `≤`)            |
| `toThrow(message?)`                      | function throws; `await expect(fn).toThrow(…)` for async |

**That is the whole set.** There is no `toBe`, `toBeInstanceOf`, `toBeCloseTo`, `toHaveLength`,
`toHaveBeenCalled`:

```js
expect(node).toEqual(expect.any(HTMLElement))
expect(sum).toEqual(expect.closeTo(0.3))
expect(items.length).toEqual(3)
expect(value).toEqual(null)
```

`toEqual` compares numbers, strings, booleans, plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`
by structure to any depth; DOM nodes, class instances and functions by identity. To check some
fields only, compare a projection: `expect({ id, name }).toEqual({ id: 1, name: 'imp' })`.

Placeholders nest anywhere inside a `toEqual`/`toContain` value:

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

**`spy(fn?)`** records every call in `spy.calls` (an array of argument lists) and otherwise does
whatever function you pass - there are no `.mockReturnValue`-style methods:

```js
const onSave = spy() //                       records only
const load = spy(async () => user) //         resolves
const boom = spy(() => {
  throw new Error()
}) // throws
const info = spy(console, 'info') //          wraps a method in place, original still runs
const quiet = spy(console, 'info', () => {}) // …and replaces its behavior

expect(onSave.calls).toEqual([[{ id: 1 }]]) // called once with { id: 1 }
expect(load.calls.length).toEqual(2)
```

Spies are cleared and wrapped methods restored between tests - no cleanup to write.

**`mockModule(specifier, factory)`** replaces a whole module for the file under test, everywhere it
is imported, at any depth:

```js
mockModule('./http.js', ({ spy, orig }) => ({
  ...orig(), // partial mock: everything else stays real
  get: spy(() => Promise.resolve({ name: 'imp' })),
}))
```

- The specifier is relative to **your test file**, or the dependency alias from `imp.json`. imp
  matches by resolved file, so a different spelling elsewhere is still covered.
- Call it `mockModule` (do not rename the import) and pass a **string literal** - imp reads these
  before your test runs.
- The factory runs in the mocked module and **cannot see your test file's variables** - use the
  injected `spy`/`orig`.
- Exports you do not return are auto-filled with fresh spies; `default` mocks a default export.
- Mocks are scoped to one file and never leak.

**A component's HTTP calls** need neither: `spy(globalThis, 'fetch', …)` stands in for the network,
and a one-line host component owns the client (`onMount: (_instance, setup) => setup()`) since a
client is always owned by a component. `{ fakeTimers: true }` makes retries and timeouts instant -
`await clock.tick(delay)` between attempts. See [http](http.md).

## Unit tests

A fresh simulated DOM per file: `document`, `window`, elements, events, `localStorage` are globals.
Files share their DOM between tests - reset in `beforeEach`.

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

**Components render into shadow roots** - see [components](components.md) - so
`document.querySelector` does not see their internals:

```js
document.querySelector('my-app-card').shadowRoot.querySelector('button').click()
```

**Fake timers** (unit only) - `{ fakeTimers: true }` or
`{ fakeTimers: { now: new Date('2030-01-01') } }` puts `setTimeout`, `setInterval`,
`requestAnimationFrame`, `Date` and `performance.now()` on a virtual clock handed to the test as
`clock`:

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

`tick`/`runAll` are async - always `await` them. Setting `fakeTimers` on a spec fails.

## E2E specs

Each spec file gets its own server, port, browser and page; tests in a file share the page, so a
file reads as one user session. Each test receives `{ page, browser, baseUrl }`; `page` is a
Puppeteer page whose selectors pierce shadow roots.

```js
test('increments on click', async ({ page }) => {
  await page.click('#inc')
  expect(await page.$eval('#count', (el) => el.textContent)).toEqual('1')
})
```

The e2e server is the dev server, so `--mock` (or `mocks.enabled` in `imp.json`) feeds the whole
suite from your `*.mock.js` files with no stub of any kind - see [mocks](mocks.md).

**Write plain CSS selectors - they already reach inside components.** Never prefix a selector with
`>>>`; the search is deep from the page down. Use `>>>` only _between_ parts to disambiguate when a
selector would match in more than one component, one per boundary crossed:
`imp-submit-button >>> imp-button >>> button`. The page is already on your app before the first
test; browser console and network stream to the terminal, and a failing test saves a screenshot
under `.imp/screenshots/`. Set a different entry page with `test.entry` in `imp.json` (see
[config](config.md)).

The browser is resolved in order: `test.browser` in `imp.json`, `IMP_BROWSER`, an installed
Chrome/Chromium, else a pinned checksum-verified download into `~/.imp/browser/`.

`--video <dir>` records one GIF per spec (tune `test.video`: `enable`, `fps`, `maxDuration`,
`width`, `quality`) - GIFs play inline in a GitHub PR, which is how an agent shows a reviewer the
feature working.

## Output

Plain text on stdout: `✓`/`✗`/`-` per test for a single file; for a level run one `✓ <file>` line
per passing file and the full output of every failing one, then a tally. Exit code `1` if anything
failed. The only machine-readable surface is `--list` (JSON array of files, for a CI matrix - one
job per spec, since each spec is self-contained).
