# imp - Testing

```
imp test <file>            run one test file in this process
imp test --unit            run every *.test.js file, each in its own process, in parallel
imp test --e2e             run every *.spec.js file, each in its own process, in parallel
imp test --unit --jobs 4   cap how many files run at once (default: your CPU count)
imp test --e2e --filter x  run only tests whose name contains <text>
imp test --unit --list     print the selected files as JSON (for a CI matrix)
imp test --e2e --video vid record each e2e spec as an animated GIF into ./vid
imp test --e2e --mock      answer the specs' requests from your *.mock.js files
```

`imp test` is imp's built-in test runner. It covers two levels of testing through one command and
one import:

- **Unit and integration tests** - files ending in **`.test.js`** run in-process against a simulated
  browser environment: fast, no browser, no network.
- **End-to-end tests** - files ending in **`.spec.js`** run against your real app in a real,
  headless Chrome: `imp test` serves your app exactly like `imp start` does, opens a browser page on
  it, and hands that page to your spec.

There is nothing to install or configure: the runner, the assertion library, and the simulated DOM
are built into the `imp` binary. The only external piece is the e2e browser, which imp finds or
fetches for you (see _The browser_ below).

imp runs **one test file per process** - that is the unit of isolation, so no two files ever share a
process's globals, timers, module state, or (for e2e) server and browser. `imp test <file>` runs
exactly that one file in the current process and exits with its result - `0` when everything passed,
`1` otherwise.

To run a whole level, name it and imp does the fan-out for you: `imp test --unit` discovers every
`*.test.js` file and `imp test --e2e` every `*.spec.js` file, then runs each one in **its own
process, in parallel**. Passing files collapse to a single `✓ <file>` line; a failing file prints
its full output so you see exactly what broke (see _Reading results_). The command exits `1` if any
file failed. (`.git`, `node_modules`, `dist`, and `.imp` are always skipped during discovery.)

A bare `imp test` with no level and more than one candidate file won't guess - it asks you to pick
`--unit`, `--e2e`, or a single file, runs nothing, and **exits non-zero**. This keeps imp from ever
silently running a partial or unintended subset, and makes a stray `imp test` in CI fail the step
instead of passing green having run no tests.

Flags:

- `--unit` / `--e2e` - run every `.test.js` file, or every `.spec.js` file, each in its own process.
  Add a path to narrow discovery: `imp test --e2e checkout/`.
- `--jobs <n>` - cap how many files run at once during a level run. The default is your machine's
  CPU count; lower it when each file is heavy (e2e specs each launch a browser) or raise it for
  light unit files.
- `--filter <text>` - run only tests whose name contains the text; everything else is reported as
  skipped.
- `--list` - print the selected test files as a JSON array instead of running them (combine with
  `--unit`/`--e2e` to feed a CI matrix - see _One job per spec in CI_).
- `--video <dir>` - record each e2e spec's browser session as an animated GIF into `<dir>` (see
  _Recording a spec as a GIF_).
- `--mock` / `--no-mock` - serve your project's [mock responses](cli.md#mock-responses--mockjs) to
  e2e specs, or force them at the real API. Without either flag, specs follow the default in your
  `imp.json`.

## Writing tests

Both kinds of test files use the same imports:

```js
import { expect, test } from 'imp/test'

test('adds numbers', () => {
  expect(2 + 3).toEqual(5)
})
```

`test(name, fn, options?)` registers a test. Tests in a file run in order, one at a time.

- `test.skip(name, fn)` - register but do not run.
- `test.only(name, fn)` - when present, only `only` tests in that file run.
- `options.timeout` - per-test time limit in milliseconds. A test that exceeds it fails. The default
  is 5 seconds for unit tests and 30 seconds for e2e tests - raise it for long flows:

  ```js
  test('full checkout', async ({ page }) => {
    // ...
  }, { timeout: 120_000 })
  ```

- `options.fakeTimers` - run this test under a virtual clock and pass it as `clock` in the test
  context (unit tests only). See [Fake timers](#fake-timers).

Hooks run around the tests of their own file: `beforeAll`, `beforeEach`, `afterEach`, `afterAll`
(imported from `imp/test`). An async test or hook is awaited.

**Parameterized tests are just a loop.** `test()` registers in call order, so there's no special
`each` helper to learn - generate cases with a plain `for...of`:

```js
for (const [a, b, sum] of [[1, 1, 2], [2, 3, 5], [10, -4, 6]]) {
  test(`adds ${a} + ${b}`, () => {
    expect(add(a, b)).toEqual(sum)
  })
}
```

### Assertions

`expect(value)` returns matchers; every matcher can be inverted with `.not`:

| Matcher                                  | Passes when                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `toEqual(x)`                             | equal - see below                                      |
| `toContain(x)`                           | string contains substring / iterable contains element  |
| `toMatch(pattern)`                       | string matches a RegExp or contains a substring        |
| `toBeTruthy()`                           | truthy (`.not.toBeTruthy()` for falsy)                 |
| `toBeGreaterThan(n)` / `toBeLessThan(n)` | numeric comparison (`.not` gives you `>=` and `<=`)    |
| `toThrow(message?)`                      | function throws; optionally message contains / matches |

That's the whole set. There's no `toBeInstanceOf`, `toBeCloseTo`, or `toHaveLength`: an instance or
float-tolerance check is an `expect.*` placeholder inside `toEqual`, and a length is a plain
comparison - see [Fuzzy matching](#assertions) below.

```js
expect(node).toEqual(expect.any(HTMLElement)) // was toBeInstanceOf
expect(sum).toEqual(expect.closeTo(0.3)) // was toBeCloseTo
expect(items.length).toEqual(3) // was toHaveLength
```

`toEqual` is the one equality matcher, and it does the obvious thing for each kind of value:

- **data** - numbers, strings, booleans, and plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`
  (nested to any depth) - compares **by structure**, so `expect(user).toEqual({ name: 'imp' })`
  passes when the shapes match.
- **everything else** - DOM nodes, class instances, functions - compares **by identity**, so two
  different `<button>` elements are never equal even though they look alike;
  `expect(node).toEqual(node)` passes only for the same node.

So there is no `toBe`/`toEqual` decision to make: use `toEqual`. For a truthiness check use
`toBeTruthy` (and `.not.toBeTruthy()` for falsy); otherwise compare directly -
`expect(value).toEqual(null)`, `expect(user?.name).toEqual('imp')`. `toThrow` also understands async
functions - `await expect(fn).toThrow('boom')` awaits the rejection.

To check only **some** of an object's fields (and ignore the rest), compare a projection - pick the
fields you care about and `toEqual` those:

```js
const { firstName, lastName } = user
expect({ firstName, lastName }).toEqual({ firstName: 'Adam', lastName: 'Smith' })
```

**Fuzzy matching.** When you don't know (or don't care about) an exact value, drop an `expect.*`
placeholder anywhere inside the value you pass to `toEqual` (or `toContain`) - it matches a _shape_
rather than a literal. They nest, and they're especially handy for `spy.calls`:

```js
expect(user).toEqual({ id: expect.any(Number), name: expect.stringContaining('mp') })
expect(save.calls).toEqual([[expect.objectContaining({ id: 1 })]])
```

| Placeholder                    | Matches                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `expect.anything()`            | anything except `null` / `undefined`                          |
| `expect.any(Ctor)`             | a value of that type (`String`, `Number`, `Date`, a class...) |
| `expect.stringContaining(s)`   | a string containing `s`                                       |
| `expect.stringMatching(re)`    | a string matching a RegExp (or containing text)               |
| `expect.arrayContaining(xs)`   | an array containing at least each of `xs`                     |
| `expect.objectContaining(obj)` | an object with at least those properties                      |
| `expect.closeTo(n, digits?)`   | a number within a floating-point tolerance of `n`             |

A failed assertion reports what was expected and what was received:

```
✗ wrong sum (1ms)
    expect(received).toEqual(5)
      expected: 5
      received: 4
```

## Mocking

Mocking in imp is two ideas: **`spy`** replaces a function (or a method), and **`mockModule`**
replaces a whole module. There is nothing else to learn - a spy's behavior is just a function you
write, and what it recorded is a plain array you assert with the matchers you already have.

### Spies - `spy`

`spy(fn?)` returns a **spy**: a function that records every call in `spy.calls` and otherwise does
whatever you tell it to. You tell it by passing a function - there are no `.mockReturnValue`-style
methods to remember, because a plain function already covers every case:

```js
import { expect, spy, test } from 'imp/test'

test('calls the handler with the payload', () => {
  const onSave = spy()
  saveButton(onSave).click()
  expect(onSave.calls).toEqual([[{ id: 1 }]]) // one call, argument { id: 1 }
})
```

`spy.calls` is an array of argument lists - one entry per call - so you assert on it with the
matchers you already have:

```js
expect(fetchThing.calls).toEqual([['/me']]) // called exactly once, with '/me'
expect(fetchThing.calls).toContain(['/me']) // called with '/me' at least once
expect(fetchThing.calls.length).toEqual(2) // called twice
```

Whatever the spy should **do**, write it as the function you pass:

| You want the spy to...     | Write                                      |
| -------------------------- | ------------------------------------------ |
| do nothing, return nothing | `spy()`                                    |
| return a value             | `spy(() => 42)`                            |
| resolve to a value (async) | `spy(async () => user)`                    |
| reject / throw             | `spy(() => { throw new Error('boom') })`   |
| behave differently by call | `spy(() => (count++ ? 'again' : 'first'))` |

**Spying on a method.** Give `spy` an object and a method name and it wraps that method in place,
still calling the original by default, and hands you the spy:

```js
test('logs the greeting', () => {
  const info = spy(console, 'info') // real console.info still runs
  greet('imp')
  expect(info.calls).toEqual([['hello imp']])
})
```

Pass a third argument to change the behavior too: `spy(console, 'info', () => {})` silences it.

**No cleanup to write.** imp runs each test on its own, and between tests it clears every spy's
`calls` and restores every method you wrapped - so a `spy(console, 'info')` in one test is gone by
the next, and there is nothing to reset by hand.

### Mocking modules - `mockModule`

`mockModule(specifier, factory)` replaces a whole module for the file under test. Every import of
that module - from your test, from the component you're testing, and from anything **it** imports,
at any depth - resolves to what your factory returns:

```js
import { expect, mockModule, spy, test } from 'imp/test'
import { loadProfile } from './widgets/profile.js' // imports '../http.js' internally
import { get } from './http.js'

mockModule('./http.js', ({ spy }) => ({
  get: spy(() => Promise.resolve({ name: 'imp' })),
}))

test('renders the profile without touching the network', async () => {
  expect(await loadProfile()).toEqual('USER: IMP')
  expect(get.calls).toEqual([['/me']])
})
```

`profile.js` reaches `http.js` through `'../http.js'` and your test through `'./http.js'` -
different paths, **same file**, so one `mockModule('./http.js', ...)` covers both. imp matches the
module by the file it resolves to, not by how the import is spelled.

**How it works.** The factory returns the module's exports and receives `{ spy, orig }`:

- `specifier` is written relative to your test file (`'./http.js'`), or is the **dependency alias**
  from `imp.json` for an npm/jsr package (`'mitt'`). Both are matched everywhere they're imported.
- `spy` is the same helper as above (use it so the mocked functions record their calls); `orig()`
  returns the **real** module, for partial mocks (see below).
- The returned object's keys become the module's exports. Use the `default` key to mock a default
  export:

  ```js
  import newEmitter from 'mitt'

  mockModule('mitt', ({ spy }) => ({
    default: () => ({ on: spy(), off: spy(), emit: spy() }),
  }))
  ```

- Any export you **don't** return is auto-filled with a fresh `spy()`, so `mockModule('./http.js')`
  with no factory turns every export of `http.js` into a no-op spy.

**Partial mocks - `orig`.** For integration tests, keep most of a module real and replace only the
part you care about. `orig()` gives you the real module; spread it and override:

```js
mockModule('./math.js', ({ spy, orig }) => ({
  ...orig(), // add, subtract, ... stay real
  mul: spy(() => 0), // only mul is mocked
}))
```

Mocking is scoped to **one test file**: since imp runs each test file in its own process, a module's
mock applies to every test in that file and never leaks to another file.

**A few rules to keep it simple and fast:**

- Call it `mockModule` (don't rename the import), and pass a **string literal** as the first
  argument - imp reads these before running your test, so the specifier can't be a variable.
- The factory can't reach your test file's variables - it runs in the mocked module, not in your
  test. Use the injected `spy` / `orig`, not ones you closed over.
- A mock replaces the surface of the real module: the exports you can use are the real module's
  exports (overridden by your factory, or auto-spied).

## Unit tests - `*.test.js`

Unit test files run in-process with a fresh simulated browser environment per file: `document`,
`window`, elements, events, `localStorage`, and the rest of the DOM API are there, so components
render and behave like they do in a page - without starting one:

```js
import { mount } from 'imp'
import { button, div } from 'imp/html'
import { beforeEach, expect, test } from 'imp/test'

let clicks = 0
const counter = () => div(button({ id: 'inc', events: { click: () => clicks++ } }, 'add'))

beforeEach(() => {
  clicks = 0
  document.body.replaceChildren()
})

test('reacts to clicks', () => {
  mount(document.body, counter)
  document.querySelector('#inc').click()
  expect(clicks).toEqual(1)
})
```

Your whole module graph is available: relative imports, `imp`, and every vendored dependency alias
resolve exactly like they do under `imp start`. Each file gets its own DOM - tests in one file share
it (reset what you need in `beforeEach`), separate files never see each other's state.

Components render into shadow roots, so `document.querySelector` does not see their internals -
reach in through the host's `shadowRoot`:

```js
const card = document.querySelector('my-app-card')
card.shadowRoot.querySelector('button').click()
```

`document`, `window`, and the rest of the DOM are globals, so use them directly - just like in the
browser. Unit test callbacks receive a context only when there's something that _isn't_ global to
hand over, namely `clock` under [fake timers](#fake-timers).

### Fake timers

Time-dependent code - debouncing, throttling, polling, retry backoff, animations - shouldn't force
your tests to wait in real time. Add `{ fakeTimers: true }` to a unit test's options and imp runs it
under a virtual clock, handed to you as `clock` in the test context - you advance time by hand:

```js
import { expect, test } from 'imp/test'

test('debounce fires once, 300ms after the last call', async ({ clock }) => {
  let calls = 0
  const ping = debounce(() => calls++, 300)

  ping()
  ping()
  ping()
  await clock.tick(299)
  expect(calls).toEqual(0)
  await clock.tick(1)
  expect(calls).toEqual(1)
}, { fakeTimers: true })
```

While fake timers are on, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date` (`Date.now()`
and `new Date()`), and `performance.now()` all read from virtual time - nothing fires until you
advance it. imp installs the clock before the test (and its `beforeEach`/`afterEach` hooks, which
receive the same `clock`) and restores the real timers afterward, so there is nothing to clean up.

Control the clock through the `clock` handle - `tick` and `runAll` are async (`await` them) and
flush awaited work between timers, so async code sees the state each timer produced:

| Call                   | Does                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `await clock.tick(ms)` | advance time, running every timer that comes due, in order      |
| `await clock.runAll()` | run everything still pending                                    |
| `clock.now`            | current virtual time, in milliseconds                           |
| `clock.restore()`      | switch back to real timers before the test ends (rarely needed) |

Start the clock at a fixed instant when your code reads the wall clock - pass `now` (a number or a
`Date`) instead of `true`:

```js
test('renews the token on the first of the year', ({ clock }) => {
  expect(new Date().getFullYear()).toEqual(2030)
  // ...
}, { fakeTimers: { now: new Date('2030-01-01') } })
```

Because `tick` flushes pending promise callbacks as it advances, async flows that `await` between
timers just work - the next timer sees the state the awaits produced:

```js
test('retries after a 1s backoff', async ({ clock }) => {
  const done = fetchWithRetry('/data') // awaits, then schedules a retry in 1000ms
  await clock.tick(1000)
  expect(await done).toEqual({ ok: true })
}, { fakeTimers: true })
```

Fake timers are a unit-test tool. E2E specs run against a real browser, where time belongs to the
page - drive it through Puppeteer (`page.evaluateOnNewDocument`, the CDP clock) instead; setting
`fakeTimers` on a spec fails, reporting that it is unit-only.

## E2E tests - `*.spec.js`

Every spec file gets a fresh, fully isolated app instance:

1. imp serves your app (the same `index.html` that `imp start` serves, on an ephemeral port),
2. launches a headless browser,
3. opens a page on your app,
4. and runs your tests in order, passing `{ page, browser, baseUrl }` to each.

```js
import { expect, test } from 'imp/test'

test('starts at zero', async ({ page }) => {
  expect(await page.$eval('#count', (el) => el.textContent)).toEqual('0')
})

test('increments on click', async ({ page }) => {
  await page.click('#inc')
  expect(await page.$eval('#count', (el) => el.textContent)).toEqual('1')
})
```

`page` is a [Puppeteer](https://pptr.dev) page - `goto`, `click`, `type`, `$eval`,
`waitForSelector`, screenshots, everything Puppeteer offers - with one difference: **its selectors
see through shadow roots.** The page is already on your app when the first test runs; tests within a
file share it, so a file reads as one user session: log in once in `beforeAll` (or your first test),
then drive the flow step by step.

Components render into shadow roots, so a plain CSS selector would normally stop at the component
boundary. imp searches through them for you, and an ordinary selector finds an element wherever it
lives:

```js
await page.type('#draft', 'ship it')
await page.click('#add')
expect(await page.$eval('#count', (el) => el.textContent)).toEqual('1 left')
```

The search is deep, so a selector that matches in more than one component is ambiguous. Name the
path with `>>>` between the parts to say exactly which one you mean - each `>>>` crosses one
component boundary:

```js
await page.click('imp-submit-button >>> imp-button >>> button')
```

While specs run, the browser stays connected to your terminal the same way `imp start` is:
`console.*`, uncaught errors, and every network request stream in as `[browser:*]` and `[net]`
lines, so a failing spec comes with the context that explains it. When a test fails, imp also saves
a screenshot of the page under `.imp/screenshots/` (add `.imp/` to your `.gitignore`).

If your app's entry page is not `index.html`, set it in `imp.json`:

```json
{
  "test": { "entry": "app.html" }
}
```

Specs run against the same server `imp start` runs, so a project with
**[mock responses](cli.md#mock-responses--mockjs)** can point them at fixtures instead of a backend:
`imp test --e2e --mock` makes the `*.mock.js` files answer your app's requests during the spec, with
no stub and no configuration in the test. `--no-mock` forces a run against the real API, and with
neither flag the suite follows the default in your `imp.json`.

### Recording a spec as a GIF

imp can record an e2e spec's whole browser session as an animated **GIF** - a short clip of your app
actually being driven. Turn it on with `--video <dir>`:

```bash
imp test --e2e --video videos     # one GIF per spec, written into ./videos
imp test checkout.spec.js --video videos
```

Each spec file produces one GIF named after it (for example `videos/checkout.spec.js.gif`),
capturing the session from the moment the page loads through the last test in the file. There's
nothing to add to the spec - recording the session is automatic when the flag (or config) is on, and
imp always writes whatever it captured even if a test throws partway through.

**Why a GIF?** It embeds inline in a GitHub pull request's markdown, so a reviewer sees the clip
play without downloading anything. That's the point of the feature: an AI agent (or anyone) building
a frontend change can record the new behaviour and drop the GIF straight into the PR, letting a
human reviewer double-check that the feature actually works and that its look and feel are right - a
moving picture the written description can't convey. Just drag the file into the PR comment box, or
commit it and reference it, and it plays in the thread.

Clips are meant to be lightweight review aids, so imp keeps them short, downscaled, and modest-fps
by default. Tune any of that under `test.video` in `imp.json`:

```json
{
  "test": {
    "video": {
      "enable": true,
      "fps": 10,
      "maxDuration": 30,
      "width": 800,
      "quality": 80
    }
  }
}
```

- **`enable`** - record without passing `--video` on every run (writes to `.imp/videos/` by default;
  add `.imp/` to your `.gitignore`). A `--video <dir>` flag still overrides the output directory.
- **`fps`** - target frames per second (frames are thinned to this rate).
- **`maxDuration`** - cap the clip length in seconds; capture past this point is dropped.
- **`width`** - downscale the recording to this width in pixels (height follows the aspect ratio).
- **`quality`** - capture quality from 1-100; lower means smaller files.

Recording adds a little capture and encoding time per spec, so it stays off unless you ask for it -
a plain `imp test --e2e` records nothing.

### The browser

E2E tests need a Chrome or Chromium binary. imp resolves one in this order:

1. **`test.browser` in `imp.json`** - an explicit path to a browser executable.
2. **`IMP_BROWSER`** environment variable - same, for CI or one-off overrides.
3. **An installed browser** - Chrome or Chromium found on your system (on GitHub Actions runners,
   the preinstalled Chrome is picked up automatically - no setup step needed).
4. **A managed download** - otherwise imp downloads a pinned, checksum-verified Chrome build once
   into `~/.imp/browser/` (per user, never inside your project) and reuses it from then on.

## Running in parallel

Because every `imp test <file>` is self-contained - a unit file gets its own fresh simulated DOM, a
spec file gets its own server, port, and browser, and nothing is shared between files - files can
run at the same time without interfering. `imp test --unit` and `imp test --e2e` do exactly that:
each names a level, and imp runs every file of that level in its own process, several at a time.

```bash
imp test --unit            # every *.test.js, in parallel across your CPU cores
imp test --e2e --jobs 2    # every *.spec.js, at most two browsers alive at once
```

`--jobs <n>` sets how many files run concurrently. It defaults to your machine's CPU count; drop it
for heavy e2e specs, raise it for light unit files. Files that pass are summarized in one line;
files that fail print their full output.

When you want to spread files across **more than one machine** - a CI matrix, where imp on one
runner can't schedule work on another - use `--list` instead. It prints the selected files as a JSON
array (narrowed by `--unit`/`--e2e`) for the matrix to hand out, one file per job:

### One job per spec in CI

E2E suites get slow because everything runs in sequence in one browser. imp's answer: since
`imp test <file>.spec.js` is completely self-contained, you can run every spec file on its own
machine at the same time. Splitting your suite into one spec per user flow (login, checkout, search,
...) turns total e2e time into the time of the slowest flow. The trade-off is that each spec repeats
its own setup (for example logging in), which is exactly what makes it independent.

`imp test --e2e --list` prints the spec files as JSON, which plugs straight into a GitHub Actions
matrix - one job per spec file, no hardcoded file list to maintain:

```yaml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: imp test --unit

  discover:
    runs-on: ubuntu-latest
    outputs:
      specs: ${{ steps.list.outputs.specs }}
    steps:
      - uses: actions/checkout@v4
      - id: list
        run: echo "specs=$(imp test --e2e --list)" >> "$GITHUB_OUTPUT"

  e2e:
    needs: discover
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        spec: ${{ fromJson(needs.discover.outputs.specs) }}
    steps:
      - uses: actions/checkout@v4
      - run: imp test ${{ matrix.spec }}
```

(The steps assume the `imp` binary is on the runner's `PATH`.) A fresh clone is the whole app -
dependencies are vendored in your repository - so there is no install step, and the runner's
preinstalled Chrome means no browser setup either. Failure screenshots land in `.imp/screenshots/`;
add an `actions/upload-artifact` step if you want them attached to the run.

## Reading results

There is no report format to configure - `imp test` writes plain text to **stdout**. For a single
file (`imp test <file>`) it prints a line per test (`✓` passed, `✗` failed, `-` skipped) and a
one-line summary; a failing test prints its name and the assertion message right where it failed, so
the log alone tells you what broke.

A level run (`--unit` / `--e2e`) keeps that output focused on what matters. Since files run in
parallel, imp collects each file's result and reports **failure-only detail**: every passing file is
one `✓ <file>` line, and every failing file is reproduced with the full output that single file
would have printed on its own - the failed assertions, messages, and any forwarded browser logs. A
final line tallies how many files passed and failed:

```
imp test: running 12 files in parallel

✓ cart.test.js
✗ checkout.test.js
    checkout.test.js
      ✗ applies the discount (2ms)
          expect(received).toEqual(90)
            expected: 90
            received: 100
    imp test: 3 passed, 1 failed (1 file)
✓ search.test.js

imp test: 11 passed, 1 failed (12 files)
```

The exit code is `0` when everything passed and `1` otherwise, which is all a CI step needs to go
red or green. This keeps the output easy to read directly - whether by a person scanning the log or
an AI agent driving `imp test` and reading its stdout.

The one machine-readable surface is `--list`, which prints the files that _would_ run as a JSON
array - it describes the selection to fan out across a CI matrix, not how a run went.

## Configuration

Everything is optional, under `test` in `imp.json`:

```json
{
  "test": {
    "entry": "index.html",
    "browser": "/usr/bin/chromium",
    "exclude": ["drafts/"]
  }
}
```

- **`entry`** - the HTML page served to e2e specs (default: `index.html`).
- **`browser`** - path to the browser executable for e2e tests (default: resolve as described
  above).
- **`exclude`** - paths skipped during test discovery.
- **`video`** - record e2e specs as GIFs; set `enable` to record without the `--video` flag, and
  tune `fps`, `maxDuration`, `width`, and `quality` (see
  [Recording a spec as a GIF](#recording-a-spec-as-a-gif)).
