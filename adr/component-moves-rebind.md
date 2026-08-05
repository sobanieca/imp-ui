# Moves rebind: components travel, subscriptions re-resolve

## Context

State resolution binds at mount: `useState` bubbles a `StateSubscription` event and answers with the
nearest provider at that moment (`event-propagated-state.md`). When moves were invisible to the
lifecycle, a component moved into a different subtree kept the states of its original ancestors - a
card dragged to another column still followed the first column's sorting state, and a provider
unmounting left movers holding zombie states no lookup could reach. The opposite extreme, remounting
on every move, re-resolves providers automatically but destroys everything the component carries:
unsaved input text, focus, closure variables, its own states, in-flight async mounts - a drag
between columns would wipe a half-written draft. A further constraint is environmental: browsers
flush custom-element reactions after a single-call reparent completes (so `disconnectedCallback`
sees the host already connected at its new position), while the unit runner's DOM implementation
fires the callbacks mid-operation - any design reading `isConnected` only inside
`disconnectedCallback` would behave differently in unit tests and browsers.

## Decision

**The component belongs to its element and travels with it; subscriptions belong to its position and
re-resolve when it changes.** A component removed and re-inserted within the same task has been
moved: `onMount` does not re-run, and its DOM, closures, own `initState` providers with their
current values, and pending async mount all ride along. What restarts is the subscription layer:

- **Detection is the microtask guard plus a rebind path.** `disconnectedCallback` returns
  immediately when the host is already reconnected (the browser single-call reparent) and otherwise
  defers teardown one microtask; a `connectedCallback` that finds the component still mounted
  triggers rebinding instead of a mount, synchronously at insertion. `connectedMoveCallback` does
  the same, so a `moveBefore()` reparent (where the platform preserves focus and animation state)
  rebinds identically. Both environments therefore agree: same-task move = move, longer absence =
  unmount, and real removal tears down exactly as before - cleanups, `onUnmount`, placeholder, each
  step fault-isolated (`error-boundaries.md`).
- **`useState` inside a mount returns a consumer.** It has the same helper surface, but holds the
  resolved provider behind an indirection with one fan-out subscription; `get`/`set` always target
  the currently bound provider. The host keeps a rebind registry - the mount scope registers each
  consumer's rebind, and `view`/`each` render scopes register theirs per render, removed when the
  region rebuilds. Outside any mount scope `useState` still returns the page-scoped state directly;
  there is no position to rebind.
- **A rebind is a fresh lookup from the host.** Each registered rebind re-dispatches the
  subscription event from the component's own host, swaps to the provider that answers, and notifies
  the consumer's subscribers only when the newly resolved value differs from the last delivered one.
  Because two providers rarely share references, this comparison is structural: plain objects and
  arrays are compared recursively by content, value objects (Date, URL, RegExp, Temporal) by their
  value, and everything else (other class instances, functions) by `Object.is` - when equality
  cannot be established, the binding re-fires. So bindings update in place and a `view`/`each`
  region re-renders on move only when its value actually changed; a move between providers holding
  equal plain data leaves the region's DOM untouched. On a move the structural walk runs only on
  rebinds - gesture-frequency events - and is the same `valuesEqual` comparison `set` and `computed`
  use (`state-plain-data-values.md`). If nothing at the new position provides the name, an error is
  logged and the previous binding is kept.

## Consequences

- The nearest-provider rule holds by position for mounted components: a card dropped into another
  column follows that column's state in the same gesture, and zombie bindings cannot arise from
  moves.
- Moves preserve what users care about with zero wiring: input text, focus-adjacent DOM state, and
  the component's own accumulated state survive; only position-derived bindings change. DOM nested
  in a `view`/`each` region is rebuilt only when the region's bound value structurally differs at
  the new position - the region's normal re-render rule, made move-tolerant for plain data. State
  values holding non-plain objects re-render on every provider change; state is expected to be plain
  data. Cyclic values are treated as never equal - the comparison bails out instead of recursing
  forever, at worst re-firing a binding that plain data would have kept.
- Removal cleanup is deferred one microtask, so a just-removed component can observe one final `set`
  before teardown - the price of move detection that works identically in browsers and the unit
  runner. Unit tests await a settled tick before asserting unmount effects.
- Same-task remove-and-reinsert counts as a move; re-inserting in a later task is the deliberate way
  to force a fresh `onMount`.
- Consumers are one small proxy per `useState` call rather than the provider's own helper object;
  helpers are not identity-comparable across components (the name is the identity), and each mounted
  consumer costs one extra subscription hop.
- Keyed `each` (`event-propagated-state.md`) builds on the same foundation: preserved items keep
  their DOM across changes and reorders, and any component hosts among them rebind wherever they
  land - a reorder is a chain of moves, not rebuilds.
