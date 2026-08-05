# Fake timers - a virtual clock for unit tests

## Context

Unit tests (`*.test.js`) run in-process on Deno's real globals: the unit environment
(`two-level-testing.md`) borrows only the DOM APIs Deno lacks from happy-dom and deliberately keeps
Deno's own `setTimeout`/`setInterval`/`Date`/`performance` - happy-dom's timer reimplementation is
tied to its window lifecycle and adds nothing over the host's event-loop-integrated timers.

That leaves time-dependent code (debounce, throttle, polling, retry backoff, animations) awkward to
test: a test either waits real wall-clock time or hand-patches `globalThis.setTimeout`. The manual
patch has two sharp edges. It is easy to forget to restore, leaking into the next test; and because
the runner's own per-test timeout watchdog also calls the global `setTimeout`, patching the global
silently disables the safety timeout - a genuinely hung test would no longer fail on schedule.

## Decision

A unit test opts into virtual time with a `fakeTimers` option -
`test(name, fn, { fakeTimers: true })` - and receives a `clock` in its test context (`{ clock }`) to
advance it. The runner, not the test body, owns the clock: it installs the clock before the test
(and that test's `beforeEach`/`afterEach` hooks) run and restores real timers afterward. There is no
imperative install call and nothing to clean up. `{ fakeTimers: { now } }` seeds the starting
instant from a number or `Date`.

- **What is faked.** While a clock is installed it replaces `setTimeout`, `clearTimeout`,
  `setInterval`, `clearInterval`, `Date` (`Date.now()` and `new Date()`), `performance.now()`, and
  `requestAnimationFrame`/`cancelAnimationFrame`; time only moves when the test advances it.
- **Clock handle.** The handle is kept small: `await clock.tick(ms)` advances virtual time, firing
  every timer that comes due in order; `await clock.runAll()` drains all pending timers; `clock.now`
  reads the current virtual time; `clock.restore()` returns to real timers early. `tick`/`runAll`
  are async and flush awaited promises between timers, so a single method covers both synchronous
  and `await`-between-timers code - there is no separate `tickAsync` to choose, and no one-timer
  `next`. A runaway self-rescheduling interval is capped and throws rather than hanging.
- **Auto-restore.** The runner restores the clock after each test, before it measures the test's
  duration with the real `performance.now`, so a fake clock can neither leak across tests nor
  distort the runner's own timing.
- **Watchdog decoupling.** The runner captures the real `setTimeout`/`clearTimeout` at module load
  and its per-test timeout watchdog uses those captured references, so faking the global timers can
  never disable the safety timeout - a hung test still fails on time.
- **Where the clock lives.** The clock is an internal runner concern, created and injected by the
  runner from a small module outside the public `imp/test` surface. `imp/test` gains only the
  `fakeTimers` test option, no new export.
- **Unit-only.** The clock works because unit tests share Deno's globals. In e2e specs the code runs
  in a real browser out of reach of a Deno global swap, so `fakeTimers` on a `*.spec.js` fails with
  a message pointing at controlling time through the Puppeteer page instead.

## Consequences

- Time-dependent logic is testable deterministically and instantly, with no real waiting, no manual
  global patching, and no teardown; which tests control time is visible in each test's options.
- Fake timers are declared per test through options rather than an imperative helper, so the whole
  test body (and its hooks) runs under fake time with an unambiguous boundary. A standalone install
  helper for finer, mid-test control can be added later without changing this option.
- Fake timers are a unit-test tool only; e2e time control stays a Puppeteer/CDP concern, keeping the
  two levels' capabilities distinct as `two-level-testing.md` intends.
- The clock is a virtual-time model, not a full timer emulation: it covers the timing APIs apps
  actually schedule against and drains microtasks by yielding to the real event loop between timers,
  which is why advancing time is asynchronous.
