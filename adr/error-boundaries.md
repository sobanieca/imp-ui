# Error boundaries: onError components, event-routed failures, fault-isolated teardown

## Context

A component that threw during mount — synchronously or by rejecting an async `onMount` — logged the
error and left its placeholder in place; ancestors had no way to respond, so a broken subtree
lingered as skeleton UI. Long-lived apps that swap whole screens (and, later, lazily loaded route
modules) need a declared place where a failing subtree becomes meaningful UI while the rest of the
page keeps working — without a wrapper-element concept or render-phase machinery. The same
robustness gap existed elsewhere: one throwing cleanup or `onUnmount` aborted the rest of a teardown
(turning a screen swap into a leak), and one throwing state subscriber aborted the remaining
notifications and re-threw at whatever call site happened to `set`.

## Decision

**Error boundaries are components with an `onError(error, ...args)` definition entry, found by event
bubbling** — the same DOM-tree resolution as `event-propagated-state.md`:

- A mount failure (sync throw, or async rejection while still mounted and current) dispatches a
  bubbling, composed, cancelable `ComponentError` event from the failing host. The nearest component
  with `onError` handles it — the failing component itself first, then ancestors. An unhandled event
  falls back to the previous behavior: log the error, keep the placeholder.
- The handling boundary renders `onError(error, ...args)` in place of its children. The failed
  subtree and its healthy siblings unmount through the normal path — subscriptions end, `onUnmount`
  runs. The boundary itself stays mounted, and `onError` runs in the boundary's mount scope, so the
  fallback may bind state.
- A boundary handles **one error per mounted period** (flag reset on unmount): once the fallback is
  up, further errors propagate to the next boundary out. Retrying is remounting the boundary — a
  fresh mount brings a fresh error budget. A throwing `onError` is logged and leaves the children as
  they are; it does not cascade.
- **Teardown and notification are fault-isolated, not boundary-routed.** Each mount cleanup and
  `onUnmount` runs in its own guard — a throw is logged and the rest of the teardown still runs.
  State `set` notifies each subscriber in its own guard, so one throwing subscriber is logged and
  skipped while the others run and the setter returns normally; only the update-cycle error
  (`event-propagated-state.md`) carries a marker and propagates to the setter. Keyed `each` isolates
  per-item render errors: the item is skipped and logged, the rest of the list renders. Runtime
  errors therefore surface where they happen instead of tearing down UI that already mounted
  successfully.

## Consequences

- Failing subtrees degrade into declared UI: an async page whose fetch rejects shows the boundary's
  fallback while the rest of the page keeps working — the mount-failure story for future lazily
  loaded route modules, whose route root is the natural boundary.
- No new tree concept: nearest-boundary resolution is bubbling on the real tree, so separately
  bundled islands interoperate, and a component with `onError` guards itself for free.
- Boundaries are a **mount-time** contract. Event-handler and subscriber errors are not routed to
  boundaries — they are isolated and logged in place, keeping `set` synchronous and local and
  avoiding DOM replacement triggered from arbitrary call stacks.
- One-error-per-mount makes fallback loops impossible without tracking error sources; the cost is
  that a second independent failure inside one mounted period skips past the boundary.
- Cleanup isolation guarantees a screen swap always releases everything releasable, even with a
  faulty `onUnmount` — the property lazily loaded modules will rely on when routes switch.
