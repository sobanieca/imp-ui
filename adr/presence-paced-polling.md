# Presence: one activity signal, and a poll that slows or pauses on it

## Context

An app often loads the same data again every few seconds. A poll has no reader while the tab is
hidden. It has few readers while the user does nothing on the page. Each poll still costs a request
to the server and battery on the device. Other work has the same need: a session timeout, a live
connection, and content that animates or ticks.

The platform gives half of the signal. The Page Visibility API reports a hidden tab in all four
browsers. The other half, a user who stops using a visible page, has no cross-browser primitive.
`IdleDetector` exists only in Chromium, and it needs a permission prompt. So the idle signal is a
feature that imp writes, and not a stand-in for a platform primitive
(`browser-support-baseline`).

The HTTP client is the wrong place for this gate. A client cannot tell a background poll from a
save that the user clicked. A user action must go through while the page is idle. The code that
decides to call again is the scheduler, so the gate belongs there.

## Decision

- **`usePresence(self, { idleAfter })` from `imp` returns a read-only state.** Its value is
  `'hidden'` when the tab is hidden, `'idle'` after `idleAfter` ms without input, and `'active'`
  otherwise. `idleAfter` defaults to five minutes, because people read a page without input. The
  state ends with the mount of `self`.
- **One set of document listeners serves every consumer.** The first consumer adds them, and the
  last consumer removes them. An input event only writes the time of the last input. Each consumer
  keeps one timer that it sets again when it expires early. So a `pointermove` resets no timer.
- **The input events are `pointerdown`, `pointermove`, `keydown`, `wheel`, `touchstart` and
  `touchmove`, in the capture phase.** These events cross a shadow root. A `scroll` event does not,
  so a scroll inside a component would not reach the document.
- **A tab that shows again counts as input.** A blur of the window does not count as idle at once.
  It starts the normal countdown, so a dashboard on a second monitor keeps working.
- **`interval(self, every, run, options)` takes a period per level.** `every` is a number of ms,
  which runs at every level, or an object such as `{ active: 15_000, idle: 120_000 }`. `active` is
  required. A level without a period does not run. So one value says how fast and when to stop, and
  the API needs no word for a pause.
- **The options are `idleAfter` and `when`.** `idleAfter` sets the threshold, and it needs `every`
  as an object. `when` takes a state, and the poll runs only while the state is truthy. So
  `when: session` stops a poll for a signed-out user.
- **A change of level, or of `when`, reschedules the next run from the start of the last run.** When the new
  period has already passed, `run` runs at once. So the data is current when the user comes back.
  After a run, the next tick stays on the grid of the period, so a slow run does not cause polls
  back to back.
- **The HTTP client has no presence option.**

## Consequences

- One poll can be fast for an active user, slow for an idle user, and stopped in a hidden tab.
- A user who reads without input for longer than `idleAfter` sees older data until the next input.
  The next input runs the poll at once.
- Activity in one tab does not count for another tab. A session timeout across tabs needs a shared
  signal, which this decision does not supply.
- The browser throttles timers in a hidden tab. A slow `hidden` period can run later than it asks.
