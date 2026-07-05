# imp — Testing

```
imp test [...paths]
imp test --unit | --e2e
imp test --filter <text>
imp test --list
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

With no paths, `imp test` discovers and runs every test file in the project (directories named
`.git`, `node_modules`, and `dist` are always skipped). With paths, it runs exactly those files or
directories — `imp test login.spec.js` runs that one spec and exits with its result, which is the
building block for parallel CI (see _Parallel e2e in CI_ below). The exit code is `0` when
everything passed and `1` otherwise.

Flags:

- `--unit` / `--e2e` — run only `.test.js` files, or only `.spec.js` files.
- `--filter <text>` — run only tests whose name contains the text; everything else is reported as
  skipped.
- `--list` — print the selected test files as a JSON array instead of running them (combine with
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

## Parallel e2e in CI — one job per spec

E2E suites get slow because everything runs in sequence in one browser. imp's answer: since
`imp test <file>.spec.js` is completely self-contained — own server, own port, own browser, nothing
shared — you can run every spec file on its own machine at the same time. Splitting your suite into
one spec per user flow (login, checkout, search, …) turns total e2e time into the time of the
slowest flow. The trade-off is that each spec repeats its own setup (for example logging in), which
is exactly what makes it independent.

`imp test --e2e --list` prints the spec files as JSON, which plugs straight into a GitHub Actions
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
