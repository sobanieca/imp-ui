# imp - Testing

```
imp test <file>            run one test file
imp test --unit            run every *.test.js file, each in a page of its own, in parallel
imp test --e2e             run every *.spec.js file, each in its own process, in parallel
imp test --unit --jobs 4   cap how many files run at once (default: your CPU count)
imp test --e2e --filter x  run only tests whose name contains <text>
imp test --unit --list     print the selected files as JSON (for a CI matrix)
imp test --e2e --video vid record each e2e spec as an animated GIF into ./vid
imp test --e2e --screenshots shots  save a screenshot of each failed e2e test into ./shots
imp test --e2e --mock      answer the specs' requests from your *.mock.js files
```

`imp test` is the built-in test runner of imp. It covers two levels of testing, through one command
and one import:

- **A unit test or an integration test** lives in a file that ends in **`.test.js`**. It runs in a
  blank page of a real headless Chrome, with no server behind it. It is fast, and it needs no
  network.
- **An end-to-end test** lives in a file that ends in **`.spec.js`**. It runs against your real app,
  in a real headless Chrome. `imp test` serves your app exactly as `imp start` does, opens a browser
  page on it, and hands that page to your spec.

There is nothing to install and nothing to configure. The runner and the assertion library are part
of the `imp` binary. The only external piece is the browser, and imp finds it or fetches it for you.
See _The browser_ below.

imp isolates **each test file**. A unit file gets a fresh page, in a browser context of its own. So
no two files share the globals, the timers, the storage or the module state of a page. An e2e file
gets a server and a browser of its own. `imp test <file>` runs exactly that one file, and exits
with its result. The exit code is `0` when everything passed, and `1` otherwise.

To run a whole level, name it, and imp does the fan-out. `imp test --unit` discovers every
`*.test.js` file, and `imp test --e2e` discovers every `*.spec.js` file. imp then runs the files
**in parallel, each one in isolation**. A file that passes collapses to a single `✓ <file>` line. A file
that fails prints its full output, so you see exactly what broke. See _How to read the results_. The
command exits `1` when a file failed. imp always skips `.git`, `node_modules`, `dist` and `.imp`
during the discovery.

There is no watch mode. `imp test` runs once and exits. Run it when a piece of work is done, and
read the result. A watcher that reruns the suite on every save gives a result for a state of the
code that is not finished, and imp has no reason to report on that.

A bare `imp test` with no level, and with more than one candidate file, does not guess. It asks you
to select `--unit`, `--e2e` or a single file. It runs nothing, and it **exits with a non-zero
code**. This stops imp from running a partial or unintended subset in silence. It also makes a stray
`imp test` in CI fail the step, instead of passing green with no test run.

The flags are these:

- `--unit` and `--e2e` run every `.test.js` file, or every `.spec.js` file, each one in
  isolation. Add a path to narrow the discovery, as in `imp test --e2e checkout/`.
- `--jobs <n>` caps how many files run at the same time during a level run. The default is the CPU
  count of your machine. Each job holds one browser. Lower the number on a machine with little
  memory.
- `--filter <text>` runs only a test whose name contains the text. imp reports everything else as
  skipped.
- `--list` prints the selected test files as a JSON array, and runs nothing. Combine it with
  `--unit` or `--e2e` to feed a CI matrix. See _One job per spec in CI_.
- `--screenshots <dir>` saves a screenshot per failed e2e test into `<dir>`. Without the flag, a
  failure saves it under `.imp/screenshots/`.
- `--video <dir>` records the browser session of each e2e spec as an animated GIF, into `<dir>`. See
  _How to record a spec as a GIF_.
- `--mock` and `--no-mock` decide where an e2e spec gets its answers. `--mock` serves the
  [mock responses](cli.md#mock-responses---mockjs) of your project. `--no-mock` forces the real API.
  With neither flag, a spec follows the default in your `imp.json`.

## How to write a test

Both kinds of test file use the same imports:

```js
import { expect, test } from 'imp/test'

test('adds numbers', () => {
  expect(2 + 3).toEqual(5)
})
```

`test(name, fn, options?)` registers a test. The tests in a file run in order, one at a time.

- `test.skip(name, fn)` registers a test and does not run it.
- `test.only(name, fn)` makes imp run only the `only` tests in that file.
- `options.timeout` is the time limit of one test, in milliseconds. A test that goes past it fails.
  The default is 5 seconds for a unit test and 30 seconds for an e2e test. Raise it for a long flow:

  ```js
  test(
    'full checkout',
    async ({ page }) => {
      // ...
    },
    { timeout: 120_000 },
  )
  ```

- `options.fakeTimers` runs this test under a virtual clock, and passes the clock as `clock` in the
  test context. It works in a unit test only. See [Fake timers](#fake-timers).

The hooks run around the tests of their own file. They are `beforeAll`, `beforeEach`, `afterEach`
and `afterAll`, and they come from `imp/test`. imp awaits an async test and an async hook.

**A parameterized test is a loop.** `test()` registers in the order of the calls. So there is no
special `each` helper to learn. Generate the cases with a plain `for...of`:

```js
for (const [a, b, sum] of [
  [1, 1, 2],
  [2, 3, 5],
  [10, -4, 6],
]) {
  test(`adds ${a} + ${b}`, () => {
    expect(add(a, b)).toEqual(sum)
  })
}
```

### Assertions

`expect(value)` returns the matchers. You can invert every matcher with `.not`:

| Matcher                                  | Passes when                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `toEqual(x)`                             | equal - see below                                      |
| `toContain(x)`                           | string contains substring / iterable contains element  |
| `toMatch(pattern)`                       | string matches a RegExp or contains a substring        |
| `toBeTruthy()`                           | truthy (`.not.toBeTruthy()` for falsy)                 |
| `toBeGreaterThan(n)` / `toBeLessThan(n)` | numeric comparison (`.not` gives you `>=` and `<=`)    |
| `toThrow(message?)`                      | function throws; optionally message contains / matches |
| `toHaveAccessibleControls()`             | e2e only - every control has a role and a name         |

`toHaveAccessibleControls()` reads the accessibility tree of a page, so it works in an e2e spec
only. See [How to check what a screen reader gets](#how-to-check-what-a-screen-reader-gets) below.

That is the whole set. There is no `toBeInstanceOf`, `toBeCloseTo` and `toHaveLength`. A check of an
instance, or of a float tolerance, is an `expect.*` placeholder inside `toEqual`. A length is a
plain comparison. See [Fuzzy matching](#assertions) below.

```js
expect(node).toEqual(expect.any(HTMLElement)) // was toBeInstanceOf
expect(sum).toEqual(expect.closeTo(0.3)) // was toBeCloseTo
expect(items.length).toEqual(3) // was toHaveLength
```

`toEqual` is the one equality matcher, and it does the obvious thing for each kind of value:

- **Data** compares **by structure**. This covers a number, a string, a boolean, a plain object, an
  array, a `Map`, a `Set`, a `Date` and a `RegExp`. It works at any depth of nesting. So
  `expect(user).toEqual({ name: 'imp' })` passes when the shapes match.
- **Everything else** compares **by identity**. That covers a DOM node, a class instance and a
  function. Two different `<button>` elements are never equal, even when they look alike.
  `expect(node).toEqual(node)` passes only for the same node.

So there is no decision to make between `toBe` and `toEqual`. Use `toEqual`. For a truthiness check
use `toBeTruthy`, and `.not.toBeTruthy()` for a falsy value. Otherwise compare directly, as in
`expect(value).toEqual(null)` and `expect(user?.name).toEqual('imp')`. `toThrow` also understands an
async function. `await expect(fn).toThrow('boom')` awaits the rejection.

To check only **some** fields of an object, and to ignore the rest, compare a projection. Select the
fields that you care about, and pass them to `toEqual`:

```js
const { firstName, lastName } = user
expect({ firstName, lastName }).toEqual({ firstName: 'Adam', lastName: 'Smith' })
```

**Fuzzy matching.** Use this when you do not know an exact value, or do not care about it. Put an
`expect.*` placeholder anywhere inside the value that you pass to `toEqual` or `toContain`. A
placeholder matches a _shape_, not a literal. Placeholders nest, and they help most with
`spy.calls`:

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

A failed assertion reports what imp expected and what it received:

```
✗ wrong sum (1ms)
    expect(received).toEqual(5)
      expected: 5
      received: 4
```

## Mocking

Mocking in imp is two ideas. **`spy`** replaces a function, or a method. **`mockModule`** replaces a
whole module. There is nothing else to learn. You write the behaviour of a spy as a plain function.
What the spy recorded is a plain array, and you assert it with the matchers you already have.

### Spies - `spy`

`spy(fn?)` returns a **spy**. That is a function that records every call in `spy.calls`, and
otherwise does what you tell it to do. You tell it by passing a function. There is no
`.mockReturnValue` method to remember, because a plain function already covers every case:

```js
import { expect, spy, test } from 'imp/test'

test('calls the handler with the payload', () => {
  const onSave = spy()
  saveButton(onSave).click()
  expect(onSave.calls).toEqual([[{ id: 1 }]]) // one call, argument { id: 1 }
})
```

`spy.calls` is an array of argument lists, with one entry per call. So you assert on it with the
matchers that you already have:

```js
expect(fetchThing.calls).toEqual([['/me']]) // called exactly once, with '/me'
expect(fetchThing.calls).toContain(['/me']) // called with '/me' at least once
expect(fetchThing.calls.length).toEqual(2) // called twice
```

Whatever the spy must **do**, write it as the function that you pass:

| You want the spy to...     | Write                                      |
| -------------------------- | ------------------------------------------ |
| do nothing, return nothing | `spy()`                                    |
| return a value             | `spy(() => 42)`                            |
| resolve to a value (async) | `spy(async () => user)`                    |
| reject / throw             | `spy(() => { throw new Error('boom') })`   |
| behave differently by call | `spy(() => (count++ ? 'again' : 'first'))` |

**How to spy on a method.** Give `spy` an object and a method name. It wraps that method in place.
By default it still calls the original, and it gives you the spy:

```js
test('logs the greeting', () => {
  const info = spy(console, 'info') // real console.info still runs
  greet('imp')
  expect(info.calls).toEqual([['hello imp']])
})
```

Pass a third argument to change the behaviour as well. `spy(console, 'info', () => {})` silences the
method.

**There is no cleanup to write.** imp runs each test on its own. Between tests it clears the `calls`
of every spy, and restores every method that you wrapped. So a `spy(console, 'info')` in one test is
gone in the next test, and you reset nothing by hand.

### How to mock a module - `mockModule`

`mockModule(specifier, factory)` replaces a whole module for the file under test. Every import of
that module resolves to what your factory returns. That covers an import from your test, from the
component that you test, and from anything that **it** imports, at any depth:

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

`profile.js` reaches `http.js` through `'../http.js'`, and your test reaches it through
`'./http.js'`. The paths differ, but the **file is the same**. So one `mockModule('./http.js', ...)`
covers both. imp matches the module by the file that it resolves to, not by the spelling of the
import.

**How it works.** The factory returns the exports of the module, and it receives `{ spy, orig }`:

- Write `specifier` relative to your test file, as in `'./http.js'`. For an npm package, use the
  **dependency alias** from `imp.json`, as in `'mitt'`. imp matches both everywhere they are
  imported.
- `spy` is the same helper as above. Use it so that the mocked functions record their calls.
  `orig()` returns the **real** module, for a partial mock. See below.
- The keys of the returned object become the exports of the module. Use the `default` key to mock a
  default export:

  ```js
  import newEmitter from 'mitt'

  mockModule('mitt', ({ spy }) => ({
    default: () => ({ on: spy(), off: spy(), emit: spy() }),
  }))
  ```

- imp fills an export that you do **not** return with a fresh `spy()`. So `mockModule('./http.js')`
  with no factory turns every export of `http.js` into a spy that does nothing.

**A partial mock, with `orig`.** For an integration test, keep most of a module real, and replace
only the part that you care about. `orig()` gives you the real module. Spread it, and override:

```js
mockModule('./math.js', ({ spy, orig }) => ({
  ...orig(), // add, subtract, ... stay real
  mul: spy(() => 0), // only mul is mocked
}))
```

A mock is scoped to **one test file**. imp bundles each test file on its own. So the mock of a
module applies to every test in that file, and it never leaks to another file.

**A few rules keep this simple and fast:**

- Call it `mockModule`, and do not rename the import. Pass a **string literal** as the first
  argument. imp reads these before it runs your test, so the specifier cannot be a variable.
- The factory cannot reach the variables of your test file. It runs in the mocked module, not in
  your test. Use the injected `spy` and `orig`, not ones that you closed over.
- A mock replaces the surface of the real module. The exports that you can use are the exports of
  the real module, overridden by your factory or filled with a spy.

## Unit tests - `*.test.js`

A unit test file runs in a fresh, blank page of a headless Chrome. `document`, `window`, the
elements, the events, `localStorage` and the rest of the DOM API are the real ones. So a component
renders and behaves exactly as it does in your app, and you start no server:

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

Your whole module graph is available. A relative import, `imp`, and every vendored dependency alias
resolve exactly as they do under `imp start`. Each file gets a page of its own, in a browser context
of its own. So its storage and its cookies start empty. The tests in one file share its page, so
reset what you need in `beforeEach`. Two separate files never see the state of each other.

A component renders into a shadow root. So `document.querySelector` does not see its internals. Go
in through the `shadowRoot` of the host:

```js
const card = document.querySelector('my-app-card')
card.shadowRoot.querySelector('button').click()
```

`document`, `window` and the rest of the DOM are globals. Use them directly, as in the browser. A
unit test callback receives a context only when there is something that is _not_ global to hand
over. That is `clock`, under [fake timers](#fake-timers).

### What the real browser does on its own time

The page of a unit test is a real page, so it keeps the timing of the platform. Two rules follow:

- **The browser fires some events one task later.** The `toggle` event of a popover and the `close`
  event of a dialog arrive in a later task, and so does the work that a component does in them. An
  example is the focus that a picker moves into its panel. Await one task before you check it:
  `await new Promise((resolve) => setTimeout(resolve))`. Under fake timers, take `setTimeout` from
  `globalThis` before the test starts, because the fake clock replaces it.
- **An event that a test dispatches is not trusted.** The browser does not treat it as real input.
  So `Escape` from `dispatchEvent` does not light-dismiss a popover. Close a popover with
  `hidePopover()` in a unit test. Test the key in an e2e spec, where `page.keyboard.press('Escape')`
  is real input.
- **A dispatched `click` runs the activation behaviour of its target.** It checks a checkbox and it
  follows a link. A click on an off-site link takes the page of the test away. Cancel that click in
  a listener that runs after your check.

### Fake timers

Code that depends on time must not make your test wait in real time. That covers debouncing,
throttling, polling, a retry backoff and an animation. Add `{ fakeTimers: true }` to the options of
a unit test. imp then runs the test under a virtual clock, and gives you the clock as `clock` in the
test context. You advance the time by hand:

```js
import { expect, test } from 'imp/test'

test(
  'debounce fires once, 300ms after the last call',
  async ({ clock }) => {
    let calls = 0
    const ping = debounce(() => calls++, 300)

    ping()
    ping()
    ping()
    await clock.tick(299)
    expect(calls).toEqual(0)
    await clock.tick(1)
    expect(calls).toEqual(1)
  },
  { fakeTimers: true },
)
```

While the fake timers are on, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date`, which is
`Date.now()` and `new Date()`, and `performance.now()` all read the virtual time. Nothing fires
until you advance it. imp installs the clock before the test, and before its `beforeEach` and
`afterEach` hooks, which receive the same `clock`. imp restores the real timers afterward. So there
is nothing to clean up.

Control the clock through the `clock` handle. `tick` and `runAll` are async, so `await` them. They
also flush the awaited work between two timers. So async code sees the state that each timer
produced:

| Call                   | Does                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `await clock.tick(ms)` | advance time, running every timer that comes due, in order      |
| `await clock.runAll()` | run everything still pending                                    |
| `clock.now`            | current virtual time, in milliseconds                           |
| `clock.restore()`      | switch back to real timers before the test ends (rarely needed) |

Start the clock at a fixed instant when your code reads the wall clock. Pass `now`, which is a
number or a `Date`, in place of `true`:

```js
test(
  'renews the token on the first of the year',
  ({ clock }) => {
    expect(new Date().getFullYear()).toEqual(2030)
    // ...
  },
  { fakeTimers: { now: new Date('2030-01-01') } },
)
```

`tick` flushes the pending promise callbacks while it advances. So an async flow that awaits between
two timers works. The next timer sees the state that the awaits produced:

```js
test(
  'retries after a 1s backoff',
  async ({ clock }) => {
    const done = fetchWithRetry('/data') // awaits, then schedules a retry in 1000ms
    await clock.tick(1000)
    expect(await done).toEqual({ ok: true })
  },
  { fakeTimers: true },
)
```

Fake timers are a tool for a unit test. An e2e spec runs against a real browser, where the time
belongs to the page. Drive it through Puppeteer instead, with `page.evaluateOnNewDocument` or the
CDP clock. `fakeTimers` on a spec fails, and the message says that the option is for a unit test
only.

## E2E tests - `*.spec.js`

Every spec file gets a fresh, fully isolated instance of the app. imp does four things:

1. It serves your app, on an ephemeral port. That is the same `index.html` that `imp start` serves.
2. It launches a headless browser.
3. It opens a page on your app. The page reports no reduced-motion preference, whatever the machine
   is set to, so a test of an animation runs the same on every machine and on CI.
4. It runs your tests in order, and passes `{ page, browser, baseUrl }` to each one.

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

`page` is a [Puppeteer](https://pptr.dev) page. It has `goto`, `click`, `type`, `$eval`,
`waitForSelector`, a screenshot, and everything else that Puppeteer offers. There is one difference:
**its selectors see through a shadow root.** The page is already on your app when the first test
runs. The tests in a file share the page, so a file reads as one user session. Sign in once, in
`beforeAll` or in your first test, and then drive the flow step by step.

A component renders into a shadow root. So a plain CSS selector would normally stop at the boundary
of the component. imp searches through the boundary for you, and an ordinary selector finds an
element wherever it lives:

```js
await page.type('#draft', 'ship it')
await page.click('#add')
expect(await page.$eval('#count', (el) => el.textContent)).toEqual('1 left')
```

The search is deep. So a selector that matches in more than one component is ambiguous. Name the
path with `>>>` between the parts, to say exactly which one you mean. Each `>>>` crosses one
component boundary:

```js
await page.click('imp-submit-button >>> imp-button >>> button')
```

### How to check what a screen reader gets

A screen reader cannot use a control that has no name or no role. One matcher checks both for a
whole page, or for the part below one element:

```js
test('every control has a name and a role', async ({ page }) => {
  await expect(page).toHaveAccessibleControls()
  await expect(await page.$('#checkout')).toHaveAccessibleControls()
})
```

The matcher reads the accessibility tree of the browser and reports two kinds of problem:

- **A control with no accessible name.** This is a button, a link, a field, a checkbox, a radio, a
  switch, a slider, a tab, an option, a menu item or a tree item that a screen reader can only
  announce by its role.
- **A focusable element with no role.** This is an element that Tab reaches through a `tabindex`, or
  an editable region, which the browser exposes as a plain container. A screen reader then does not
  say what the element does.

The matcher checks only what a screen reader can reach. It skips an element that is not in the
accessibility tree: an element with `hidden`, `display: none` or `visibility: hidden`, an element in
an `inert` or an `aria-hidden="true"` subtree, and the content of a closed `<details>` or
`<dialog>`. So a closed menu or a hidden panel does not fail the check. Open it, and check it again.

The matcher returns a promise, so always `await` it. A failure lists each control, with the path of
components that holds it:

```
expect(page).toHaveAccessibleControls()
  button with no accessible name: imp-toolbar >>> imp-button >>> button
  focusable element with no role: invoice-list >>> div.card
```

The matcher is not a full audit. It does not check contrast, the order of headings, or the text of a
name. `imp lint` finds an image with no `alt`, and an icon-only button with no name, before the app
runs. See **[Linting](lint.md)**.

To check a name, a role or a state in detail, read the tree yourself. A test of accessibility reads
the accessibility tree of the browser, not the DOM. The browser computes that tree from every shadow
root at once, with the name, the role and the state of each element, in the same way that a screen
reader reads it. Ask the page for a snapshot below one element:

```js
test('the checkout form names every field', async ({ page }) => {
  const root = await page.$('#checkout')
  const tree = await page.accessibility.snapshot({ root, interestingOnly: false })
  const controls = []
  const walk = (node) => {
    if (['textbox', 'combobox', 'checkbox'].includes(node.role)) controls.push(node)
    for (const child of node.children ?? []) walk(child)
  }
  walk(tree)
  expect(controls.map((node) => node.name)).toEqual(['Email', 'Country', 'I accept the terms'])
})
```

A node carries `role`, `name`, and a state such as `checked`, `selected`, `expanded`, `disabled`,
`invalid`, `description` or `value`. So one snapshot tells you that a tab is selected, that a switch
is on, or that an invalid field describes its error. Pass `interestingOnly: false`, because the
default prunes a container such as a `tablist`, a `group`, an `alert` or a `status`. The standard
components ship with such tests, so a name, a role and a keyboard path are a guarantee of imp, and
not a habit of each app.

While a spec runs, the browser stays connected to your terminal, as it does with `imp start`.
`console.*`, an uncaught error, and every network request arrive as a `[BROWSER:*]` line and an
`[HTTP]` line. So a failing spec comes with the context that explains it. When a test fails, imp
also saves a screenshot of the page under `.imp/screenshots/`. Add `.imp/` to your `.gitignore`.

When the entry page of your app is not `index.html`, set it in `imp.json`:

```json
{
  "test": { "entry": "app.html" }
}
```

A spec runs against the same server as `imp start`. So a project with
**[mock responses](cli.md#mock-responses---mockjs)** can point a spec at a fixture in place of a
backend. `imp test --e2e --mock` makes the `*.mock.js` files answer the requests of your app during
the spec. imp starts the first test only after the mocks answer, so a request that your app sends at
page load also gets its mock answer. There is no stub, and there is no configuration in the test.
`--no-mock` forces a run against the real API. With neither flag, the suite follows the default in
your `imp.json`.

### How to record a spec as a GIF

imp can record the whole browser session of an e2e spec as an animated **GIF**. That is a short clip
of your app while imp drives it. Turn it on with `--video <dir>`:

```bash
imp test --e2e --video videos     # one GIF per spec, written into ./videos
imp test checkout.spec.js --video videos
```

Each spec file produces one GIF, named after the file, for example `videos/checkout.spec.js.gif`. It
captures the session from the moment when the page loads, to the last test in the file. You add
nothing to the spec. imp records the session automatically when the flag, or the configuration, is
on. imp always writes what it captured, also when a test throws part way through.

**Why a GIF?** A GIF embeds inline in the markdown of a GitHub pull request. A reviewer sees the
clip play there, and downloads nothing. Record the new behaviour of a frontend change, and drag the
GIF into the pull request comment box, or commit it and link to it. A reviewer can then check that
the feature works, and that it looks right, without running the branch.

A clip is a lightweight aid for a review. So imp keeps it short, downscaled, and at a modest frame
rate by default. Tune any of that under `test.video` in `imp.json`:

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

- **`enable`** records without a `--video` flag on every run. imp writes to `.imp/videos/` by
  default, so add `.imp/` to your `.gitignore`. A `--video <dir>` flag still overrides the output
  directory.
- **`fps`** is the target number of frames per second. imp thins the frames to this rate.
- **`maxDuration`** caps the length of the clip, in seconds. imp drops the capture after that point.
- **`width`** downscales the recording to this width, in pixels. The height follows the aspect
  ratio.
- **`quality`** is the capture quality, from 1 to 100. A lower value gives a smaller file.

A recording adds a little capture time and encoding time per spec. So it stays off until you ask for
it. A plain `imp test --e2e` records nothing.

### The browser

Every test runs in Chrome, and only in Chrome. imp supports the current stable version of Chrome,
Edge, Firefox and Safari, see **[Browser support](browser-support.md)**, but it drives one browser
in a test. Puppeteer drives Chrome through the DevTools protocol, and Firefox and Safari do not
speak that protocol the same way. So a test proves the behaviour in one engine. imp tests its own
components in every engine by hand, and a bug in another engine is a bug.

imp reports no coverage. A test file is bundled before it runs, so a line count of the bundle would
not point at your source. Use the test names as the record of what is covered.

A test needs a Chrome or Chromium binary. imp resolves one in this order:

1. **`test.browser` in `imp.json`**, which is an explicit path to a browser executable.
2. **The `IMP_BROWSER` environment variable**, which is the same, for CI or for a single override.
3. **An installed browser.** imp finds Chrome or Chromium on your system. On a GitHub Actions
   runner, imp uses the preinstalled Chrome, and you need no setup step.
4. **A managed download.** Otherwise imp downloads a pinned Chrome build once, and verifies its
   checksum. It stores the build in `~/.imp/browser/`, per user and never inside your project, and
   it uses that build from then on. To keep the cache somewhere else, set `IMP_CACHE_DIR`. The
   Linux build needs glibc. On Alpine or another musl distribution, install Chromium with the
   package manager of the system, for example `apk add chromium`.

### A CI with no network

A CI runner that has no network access, or that allows only some hosts, cannot download the browser.
Give it a browser in one of two ways:

- **Use a browser that the image already has.** Install Chrome or Chromium in the image of the CI.
  Set `IMP_BROWSER` to its path in the job, or `test.browser` in `imp.json` when every machine has
  the same path. imp then downloads nothing.
- **Restore the cache folder of imp.** Set `IMP_CACHE_DIR` to `.imp/cache` in the workspace. Run the
  tests once on a machine with network access, and keep that folder in the cache of your CI. imp
  finds the browser there and downloads nothing. imp already leaves `.imp/` out of every command
  that reads your project, such as `imp lint` and `imp fmt`, and the scaffold puts it in
  `.gitignore`. A relative path counts from the folder where you run imp, so set the same value for
  every step.

A unit test uses the same browser and needs no network. The dependencies of your app are in the
repository, so `imp test` never talks to a package registry.

## How to run tests in parallel

Every test file is self-contained. A unit file gets a fresh page, with its own storage and cookies. A
spec file gets its own server, port and browser. No state is shared between files. So the files can
run at the same time, and they do not interfere. `imp test --unit` and `imp test --e2e` do exactly
that. Each one names a level, and imp runs several files of that level at a time.

A unit run starts one browser per job. A job runs one file at a time in its browser, and then uses
the same browser for its next file. Each file still gets a new page and a new browser context, so a
file never sees the state of the file before it. A page that crashes fails its own file only. A new
page costs a fraction of a browser start, so a suite of many small files stays fast.

```bash
imp test --unit            # every *.test.js, in parallel across your CPU cores
imp test --e2e --jobs 2    # every *.spec.js, at most two browsers alive at once
```

`--jobs <n>` sets how many files run at the same time. It defaults to the CPU count of your machine.
Lower it for a heavy e2e spec, and raise it for a light unit file. imp summarizes a file that passes
in one line. A file that fails prints its full output.

To spread the files across **more than one machine**, use `--list`. imp on one runner cannot
schedule work on another, which is the case in a CI matrix. `--list` prints the selected files as a
JSON array, narrowed by `--unit` or `--e2e`. The matrix then hands them out, one file per job.

### One job per spec in CI

An e2e suite becomes slow because everything runs in sequence, in one browser. The answer of imp is
this. `imp test <file>.spec.js` is completely self-contained. So you can run every spec file on its
own machine, at the same time. Split your suite into one spec per user flow, such as a sign-in, a
checkout and a search. The total e2e time then becomes the time of the slowest flow. The trade is
that each spec repeats its own setup, such as a sign-in. That repetition is what makes it
independent.

`imp test --e2e --list` prints the spec files as JSON. That goes straight into a GitHub Actions
matrix, with one job per spec file, and no fixed list of files to maintain:

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

The steps assume that the `imp` binary is on the `PATH` of the runner. A fresh clone is the whole
app, because your repository holds the vendored dependencies. So there is no install step. The
preinstalled Chrome of the runner means that there is no browser setup either. A failure screenshot
arrives in `.imp/screenshots/`. Add an `actions/upload-artifact` step when you want the screenshots
attached to the run.

## How to read the results

There is no report format to configure. `imp test` writes plain text to **stdout**. For a single
file, with `imp test <file>`, it prints one line per test. `✓` is passed, `✗` is failed and `-` is
skipped. It then prints a summary of one line. A failing test prints its name and the assertion
message where it failed. So the log alone tells you what broke.

A level run, with `--unit` or `--e2e`, keeps the output focused on what matters. The files run in
parallel. imp collects the result of each file, and reports **detail for a failure only**. Every
passing file is one `✓ <file>` line. Every failing file appears with the full output that the file
would print on its own. That is the failed assertions, the messages, and any forwarded browser log.
A final line counts how many files passed and how many failed:

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

The exit code is `0` when everything passed, and `1` otherwise. That is all a CI step needs to go
red or green. The output stays easy to scan for a person, and easy to parse for an AI agent that
reads the stdout of `imp test`.

The one machine-readable surface is `--list`. It prints, as a JSON array, the files that _would_
run. It describes the selection to spread across a CI matrix. It does not describe how a run went.

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

- **`entry`** is the HTML page that imp serves to an e2e spec. The default is `index.html`.
- **`browser`** is the path to the browser executable for an e2e test. The default is the resolution
  described above.
- **`exclude`** lists the paths that imp skips during the test discovery.
- **`video`** records an e2e spec as a GIF. Set `enable` to record without the `--video` flag. Tune
  `fps`, `maxDuration`, `width` and `quality`. See
  [How to record a spec as a GIF](#how-to-record-a-spec-as-a-gif).
