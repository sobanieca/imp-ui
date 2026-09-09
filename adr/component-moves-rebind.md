# Moves rebind: components travel, subscriptions re-resolve

## Context

imp binds a state at the moment of the mount. `useState(self, name)` bubbles a lookup event, and the
nearest provider at that moment answers, see `event-propagated-state.md`. While the lifecycle could
not see a move, a component that moved into a different subtree kept the states of its original
ancestors. A card that a person dragged to another column still followed the sorting state of the
first column. When a provider unmounted, a component that had moved held a dead state, and no lookup
could reach it. The opposite extreme was to remount on every move. That resolves a provider
automatically, and it destroys everything that the component carries. It destroys unsaved input
text, the focus, a closure variable, the states of the component itself, and an async mount in
flight. A drag between two columns would then delete a draft that is half written. There is a
further constraint, and it comes from the environment. A browser flushes the reactions of a custom
element after a reparent that one call performs. So `disconnectedCallback` sees the host already
connected at its new position. The DOM implementation of the unit runner fires those callbacks in
the middle of the operation. So a design that reads `isConnected` inside `disconnectedCallback` only
would behave differently in a unit test and in a browser.

## Decision

**A component belongs to its element, and it travels with the element. A subscription belongs to the
position of the component, and it resolves again when that position changes.** A component that
somebody removes and inserts again inside the same task has moved. `setup` does not run again. Its
DOM, its closures, its own `initState` providers with their current values, and its pending async
mount, all travel with it. What restarts is the subscription layer:

- **The detection is a guard on a microtask, plus a rebind path.** `disconnectedCallback` returns
  immediately when the host is already connected again, which is the reparent that a browser
  performs in one call. Otherwise it delays the unmount by one microtask. A `connectedCallback` that
  finds the component still mounted starts a rebind, and not a mount. It does that synchronously, at
  the insertion. `connectedMoveCallback` does the same. So a reparent through `moveBefore()`, where
  the platform keeps the focus and the state of an animation, rebinds in the same way. The DOM of
  the unit runner has no `moveBefore`, so the test environment fills it with `insertBefore`. A unit
  test then exercises the microtask path, and an e2e spec exercises the move callback. Both
  environments then agree. A move inside one task is a move. A longer absence is an unmount. A real
  removal tears the component down exactly as before, through the cleanups, `onRemove`. Each step is
  isolated against a fault, see `error-boundaries.md`.
- **`useState(self, name)` returns a consumer.** That consumer has the same surface as a helper. It
  holds the resolved provider behind one indirection, with one fan-out subscription. `get` and `set`
  always target the provider that is bound now. The mount scope of `self` keeps a registry of
  rebinds, and registers the rebind of each consumer. A `view` or `each` render function resolves
  through the same `self`, so its consumers rebind with the mount. The mount caches one consumer per
  name, so a region that renders again reuses the consumer that it resolved before.
- **A rebind is a new lookup from the host.** Each registered rebind dispatches the subscription
  event again, from the host of the component. It swaps to the provider that answers. It notifies
  the subscribers of the consumer only when the newly resolved value differs from the last value
  that it delivered. Two providers rarely share a reference. So this comparison is structural. imp
  compares a plain object and an array recursively, by content. It compares a value object, such as
  a `Date`, a `URL`, a `RegExp` or a Temporal value, by its value. It compares everything else, such
  as another class instance and a function, with `Object.is`. When imp cannot establish equality,
  the binding fires again. So a binding updates in place, and a `view` or `each` region renders
  again on a move only when its value really changed. A move between two providers that hold equal
  plain data leaves the DOM of the region as it is. On a move, the structural walk runs on the
  rebinds only, and those happen at the frequency of a gesture. It is the same `valuesEqual`
  comparison that `set` and `computed` use, see `state-plain-data-values.md`. When nothing at the
  new position provides the name, imp logs an error and keeps the previous binding.

## Consequences

- The rule of the nearest provider holds by position, for a mounted component. A card that a person
  drops into another column follows the state of that column, in the same gesture. A move cannot
  create a dead binding.
- A move keeps what a user cares about, and nobody connects anything. The input text survives. The
  DOM state next to the focus survives. The state that the component accumulated survives. Only a
  binding that comes from the position changes. imp rebuilds DOM nested in a `view` or `each` region
  only when the bound value of the region differs structurally at the new position. That is the
  normal rule for a new render of the region, and it tolerates a move for plain data. A state value
  that holds an object that is not plain renders again on every change of provider. A state is
  expected to hold plain data. imp treats a cyclic value as never equal. The comparison stops
  instead of recursing forever. In the worst case it fires a binding again that plain data would
  have kept.
- imp delays the cleanup of a removal by one microtask. So a component that imp just removed can see
  one final `set` before its removal. That is the price of a detection of a move that works in the
  same way in a browser and in the unit runner. A unit test awaits a settled tick before it asserts
  an effect of an unmount.
- A removal and an insertion inside the same task count as a move. An insertion in a later task is
  the deliberate way to force a new `setup`.
- A consumer is one small proxy per `useState` call, and not the helper object of the provider. Two
  helpers are not comparable by identity across two components, because the name is the identity.
  Each mounted consumer costs one extra hop of a subscription.
- A keyed `each`, see `event-propagated-state.md`, builds on the same foundation. imp keeps the DOM
  of a preserved item across a change and across a reorder. Any component host among those items
  rebinds wherever it lands. A reorder is a chain of moves, and not a chain of rebuilds.
