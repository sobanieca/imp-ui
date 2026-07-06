# imp — Testing

```
imp test <file>            run one test file
imp test                   list the test files to run separately (one process each)
imp test --unit | --e2e    narrow discovery to unit / e2e files
imp test --filter <text>   run only tests whose name contains <text>
imp test --json            print the selected files as JSON
```

`imp test` is imp's built-in test runner. It covers two levels of testing through one command and
one import:

- **Unit and integration tests** — files ending in **`.test.js`** run in-process against a simulated
  browser environment: fast, no browser, no network.
- **End-to-end tests** — files ending in **`.spec.js`** run against your real app in a real,
  headless Chrome: `imp test` serves your app exactly like `imp start` does, opens a browser page on
  it, and hands that page to your spec.

There is nothing to install or configure: the runner, the assertion library, and the simulated DOM
are built into the `imp` binary. The only external piece is the e2e browser, which imp finds or
fetches for you (see _The browser_ below).

imp runs **one test file per process**, and you choose how to parallelize. `imp test <file>` runs
exactly that file and exits with its result — `0` when everything passed, `1` otherwise. That single
invocation is the building block for parallel runs (see _Running in parallel_ below). Point
`imp test` at more than one file — a bare `imp test`, a directory, or several paths — and it does
**not** run them; it prints a **run plan** instead: the discovered unit and e2e files as
ready-to-run `imp test <file>` commands, one per process, plus a shell one-liner for running them at
once. (`.git`, `node_modules`, and `dist` are always skipped during discovery.)

This is deliberate — it is the core idea behind the imp CLI. imp itself stays single-process and
never schedules concurrency for you, so the caller decides how much to run in parallel: your CI
matrix, a shell loop, or an AI coding agent reading the plan straight off stdout. One file is always
the unit of both parallelism and isolation — no two files ever share a process's globals, timers, or
module state.

Flags:

- `--unit` / `--e2e` — run only `.test.js` files, or only `.spec.js` files.
- `--filter <text>` — run only tests whose name contains the text; everything else is reported as
  skipped.
- `--json` — print the selected test files as a JSON array instead of running them (combine with
  `--e2e` to feed a CI matrix).

## Writing tests

Both kinds of test files use the same imports:

```js
import { expect, test } from 'imp/test'

test('adds numbers', () => {
  expect(2 + 3).toBe(5)
})
```

`test(name, fn, options?)` registers a test. Tests in a file run in order, one at a time.

- `test.skip(name, fn)` — register but do not run.
- `test.only(name, fn)` — when present, only `only` tests in that file run.
- `options.timeout` — per-test time limit in milliseconds. A test that exceeds it fails. The default
  is 5 seconds for unit tests and 30 seconds for e2e tests — raise it for long flows:

  ```js
  test('full checkout', async ({ page }) => {
    // …
  }, { timeout: 120_000 })
  ```

- `options.fakeTimers` — run this test under a virtual clock and pass it as `clock` in the test
  context (unit tests only). See [Fake timers](#fake-timers).

Hooks run around the tests of their own file: `beforeAll`, `beforeEach`, `afterEach`, `afterAll`
(imported from `imp/test`). An async test or hook is awaited.

### Assertions

`expect(value)` returns matchers; every matcher can be inverted with `.not`:

| Matcher                                                          | Passes when                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `toBe(x)`                                                        | same value (`Object.is`)                                 |
| `toEqual(x)`                                                     | deeply equal (objects, arrays, Map, Set, Date, RegExp)   |
| `toContain(x)`                                                   | string contains substring / iterable contains element    |
| `toMatch(pattern)`                                               | string matches a RegExp or contains a substring          |
| `toBeTruthy()` / `toBeFalsy()`                                   | truthy / falsy                                           |
| `toBeNull()` / `toBeUndefined()` / `toBeDefined()` / `toBeNaN()` | exactly that                                             |
| `toBeInstanceOf(Class)`                                          | `instanceof`                                             |
| `toBeGreaterThan(n)` / `…OrEqual(n)`                             | numeric comparison (also `toBeLessThan…`)                |
| `toBeCloseTo(n, digits?)`                                        | floating-point equality to a precision                   |
| `toHaveLength(n)`                                                | `.length === n`                                          |
| `toHaveProperty(path, value?)`                                   | property (dot path) exists, optionally deep-equals value |
| `toThrow(message?)`                                              | function throws; optionally message contains / matches   |

`toThrow` also understands async functions — `await expect(fn).toThrow('boom')` awaits the
rejection.

A failed assertion reports what was expected and what was received:

```
✗ wrong sum (1ms)
    expect(received).toBe(5)
      expected: 5
      received: 4
```

## Unit tests — `*.test.js`

Unit test files run in-process with a fresh simulated browser environment per file: `document`,
`window`, elements, events, `localStorage`, and the rest of the DOM API are there, so components
render and behave like they do in a page — without starting one:

```js
import { button, div, mount } from 'imp'
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
  expect(clicks).toBe(1)
})
```

Your whole module graph is available: relative imports, `imp`, and every vendored dependency alias
resolve exactly like they do under `imp start`. Each file gets its own DOM — tests in one file share
it (reset what you need in `beforeEach`), separate files never see each other's state.

The test callback also receives `{ window, document }` for convenience, but plain globals work just
as well, as in the browser.

### Fake timers

Time-dependent code — debouncing, throttling, polling, retry backoff, animations — shouldn't force
your tests to wait in real time. Add `{ fakeTimers: true }` to a unit test's options and imp runs it
under a virtual clock, handed to you as `clock` in the test context — you advance time by hand:

```js
import { expect, test } from 'imp/test'

test('debounce fires once, 300ms after the last call', ({ clock }) => {
  let calls = 0
  const ping = debounce(() => calls++, 300)

  ping()
  ping()
  ping()
  clock.tick(299)
  expect(calls).toBe(0)
  clock.tick(1)
  expect(calls).toBe(1)
}, { fakeTimers: true })
```

While fake timers are on, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date` (`Date.now()`
and `new Date()`), and `performance.now()` all read from virtual time — nothing fires until you
advance it. imp installs the clock before the test (and its `beforeEach`/`afterEach` hooks, which
receive the same `clock`) and restores the real timers afterward, so there is nothing to clean up.

Control the clock through the `clock` handle:

| Call                  | Does                                                       |
| --------------------- | ---------------------------------------------------------- |
| `clock.tick(ms)`      | advance time, running every timer that comes due, in order |
| `clock.tickAsync(ms)` | same, but awaits promises between timers — for async code  |
| `clock.next()`        | run only the next scheduled timer                          |
| `clock.runAll()`      | run everything still pending                               |
| `clock.now`           | current virtual time, in milliseconds                      |
| `clock.restore()`     | switch back to real timers before the test ends            |

Start the clock at a fixed instant when your code reads the wall clock — pass `now` (a number or a
`Date`) instead of `true`:

```js
test('renews the token on the first of the year', ({ clock }) => {
  expect(new Date().getFullYear()).toBe(2030)
  // …
}, { fakeTimers: { now: new Date('2030-01-01') } })
```

For async flows that `await` between timers, reach for `tickAsync`, which flushes pending promise
callbacks as it advances, so the next timer sees the state the awaits produced:

```js
test('retries after a 1s backoff', async ({ clock }) => {
  const done = fetchWithRetry('/data') // awaits, then schedules a retry in 1000ms
  await clock.tickAsync(1000)
  expect(await done).toEqual({ ok: true })
}, { fakeTimers: true })
```

Fake timers are a unit-test tool. E2E specs run against a real browser, where time belongs to the
page — drive it through Puppeteer (`page.evaluateOnNewDocument`, the CDP clock) instead; setting
`fakeTimers` on a spec fails, reporting that it is unit-only.

## E2E tests — `*.spec.js`

Every spec file gets a fresh, fully isolated app instance:

1. imp serves your app (the same `index.html` that `imp start` serves, on an ephemeral port),
2. launches a headless browser,
3. opens a page on your app,
4. and runs your tests in order, passing `{ page, browser, baseUrl }` to each.

```js
import { expect, test } from 'imp/test'

test('starts at zero', async ({ page }) => {
  expect(await page.$eval('#count', (el) => el.textContent)).toBe('0')
})

test('increments on click', async ({ page }) => {
  await page.click('#inc')
  expect(await page.$eval('#count', (el) => el.textContent)).toBe('1')
})
```

`page` is a [Puppeteer](https://pptr.dev) page — `goto`, `click`, `type`, `$eval`,
`waitForSelector`, screenshots, everything Puppeteer offers. The page is already on your app when
the first test runs; tests within a file share it, so a file reads as one user session: log in once
in `beforeAll` (or your first test), then drive the flow step by step.

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

### The browser

E2E tests need a Chrome or Chromium binary. imp resolves one in this order:

1. **`test.browser` in `imp.json`** — an explicit path to a browser executable.
2. **`IMP_BROWSER`** environment variable — same, for CI or one-off overrides.
3. **An installed browser** — Chrome or Chromium found on your system (on GitHub Actions runners,
   the preinstalled Chrome is picked up automatically — no setup step needed).
4. **A managed download** — otherwise imp downloads a pinned, checksum-verified Chrome build once
   into `~/.imp/browser/` (per user, never inside your project) and reuses it from then on.

## Running in parallel

Because every `imp test <file>` is self-contained — a unit file gets its own fresh simulated DOM, a
spec file gets its own server, port, and browser, and nothing is shared between files — you can run
as many files at once as you like. imp does not do this for you; it lists the files and leaves the
scheduling to you.

`imp test --json` prints the selected files as a JSON array (add `--unit` or `--e2e` to narrow it).
From a shell, fan that out across your cores:

```bash
imp test --json | jq -r '.[]' | xargs -P4 -n1 imp test
```

`-P4` runs four files at a time — raise or lower it to match your machine. This is the same list a
bare `imp test` prints as a ready-to-read run plan.

### One job per spec in CI

E2E suites get slow because everything runs in sequence in one browser. imp's answer: since
`imp test <file>.spec.js` is completely self-contained, you can run every spec file on its own
machine at the same time. Splitting your suite into one spec per user flow (login, checkout, search,
…) turns total e2e time into the time of the slowest flow. The trade-off is that each spec repeats
its own setup (for example logging in), which is exactly what makes it independent.

`imp test --e2e --json` prints the spec files as JSON, which plugs straight into a GitHub Actions
matrix — one job per spec file, no hardcoded file list to maintain:

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
        run: echo "specs=$(imp test --e2e --json)" >> "$GITHUB_OUTPUT"

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

(The steps assume the `imp` binary is on the runner's `PATH`.) A fresh clone is the whole app —
dependencies are vendored in your repository — so there is no install step, and the runner's
preinstalled Chrome means no browser setup either. Failure screenshots land in `.imp/screenshots/`;
add an `actions/upload-artifact` step if you want them attached to the run.

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

- **`entry`** — the HTML page served to e2e specs (default: `index.html`).
- **`browser`** — path to the browser executable for e2e tests (default: resolve as described
  above).
- **`exclude`** — paths skipped during test discovery.
