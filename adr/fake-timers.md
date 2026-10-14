# Fake timers - a virtual clock for unit tests

## Context

A unit test in a `*.test.js` file runs in a page of a real browser, on the globals of that page,
see `two-level-testing.md`. The page has the real `setTimeout`, `setInterval`, `Date` and
`performance`.

That leaves code which depends on time awkward to test. Examples are a debounce, a throttle, a poll, a
retry backoff and an animation. A test either waited real time on the wall clock, or patched
`globalThis.setTimeout` by hand. The manual patch has two sharp edges. It is easy to forget to
restore it, and it then leaks into the next test. The watchdog of the runner, which enforces the
timeout of each test, also calls the global `setTimeout`. So a patch of the global disabled the
safety timeout with no message, and a test that truly hung no longer failed on time.

## Decision

A unit test asks for virtual time with a `fakeTimers` option, as in
`test(name, fn, { fakeTimers: true })`. It receives a `clock` in its test context, as `{ clock }`,
and it advances the clock with that handle. The runner owns the clock, and the body of the test does
not. The runner installs the clock before the test runs, and before the `beforeEach` and `afterEach`
hooks of that test run. It restores the real timers afterward. There is no install call to write,
and there is nothing to clean up. `{ fakeTimers: { now } }` sets the starting instant, from a number
or from a `Date`.

- **What imp fakes.** While a clock is installed, it replaces `setTimeout`, `clearTimeout`,
  `setInterval`, `clearInterval`, `Date`, which covers `Date.now()` and `new Date()`,
  `performance.now()`, `requestAnimationFrame` and `cancelAnimationFrame`. Time moves only when the
  test advances it.
- **The clock handle stays small.** `await clock.tick(ms)` advances the virtual time, and fires
  every timer that comes due, in order. `await clock.runAll()` drains every pending timer.
  `clock.now` reads the current virtual time. `clock.restore()` returns to the real timers early.
  `tick` and `runAll` are async. Before and after each timer they wait a few real tasks of the
  page, so an awaited promise settles, and so does work that the browser finishes in a later task,
  such as the read of a `Response` body. So one method
  covers synchronous code, and code that awaits between two timers. There is no separate `tickAsync`
  to choose, and there is no `next` for one timer. An interval that reschedules itself without an
  end is capped, and it throws instead of hanging.
- **The runner restores the clock automatically.** It restores after each test, and before it
  measures the duration of the test with the real `performance.now`. So a fake clock cannot leak
  across two tests, and it cannot distort the timing of the runner.
- **The watchdog is separate.** The runner captures the real `setTimeout` and `clearTimeout` at
  module load. Its watchdog for the timeout of each test uses those captured references. So a fake
  of the global timers can never disable the safety timeout, and a hung test still fails on time.
- **Where the clock lives.** The clock is an internal concern of the runner. The runner creates and
  injects it, from a small module outside the public `imp/test` surface. `imp/test` gains only the
  `fakeTimers` test option, and no new export.
- **The clock is for a unit test only.** It works because a unit test shares the globals of the page
  that runs it. In an e2e spec, the app runs in a second page, out of reach of a swap of the globals
  of the runner page. So
  `fakeTimers` on a `*.spec.js` file fails, with a message that points at control of the time
  through the Puppeteer page.

## Consequences

- Logic that depends on time is testable, deterministic and instant. There is no real wait, no
  manual patch of a global, and no teardown. The options of each test show which tests control the
  time.
- A test declares fake timers through an option, and not through an imperative helper. So the whole
  body of the test, and its hooks, run under fake time, with a clear boundary. Somebody can add a
  standalone install helper later, for finer control in the middle of a test, and this option does
  not change.
- Fake timers are a tool for a unit test only. Control of time in an e2e test stays a concern of
  Puppeteer and CDP. That keeps the capabilities of the two levels separate, as
  `two-level-testing.md` intends.
- The clock is a model of virtual time, and not a full emulation of a timer. It covers the timing
  APIs that an app really schedules against. It drains a microtask by yielding to the real event
  loop between two timers, and that is why an advance of the time is asynchronous.
