# Error boundaries: fallback components, event-routed failures, fault-isolated teardown

## Context

A component that threw during its mount logged the error and left its placeholder in place. The
throw could be synchronous, or it could be a rejection of an async `build`. An ancestor had no way
to respond, so a broken subtree stayed on the page as skeleton UI. A long-lived app that swaps whole
screens, and later a route module that loads lazily, needs a declared place where a failing subtree
becomes meaningful UI, while the rest of the page continues to work. That place must not need a
wrapper element, and it must not need machinery in a render phase. The same gap in robustness
existed elsewhere. One cleanup that threw, or one `teardown` that threw, stopped the rest of a
teardown, and that turned a swap of screens into a leak. One state subscriber that threw stopped the
remaining notifications, and threw again at whatever call site had called `set`.

## Decision

**An error boundary is a component with a `fallback(error, ...args)` entry in its definition, and
imp finds it by event bubbling.** That is the same resolution through the DOM tree as in
`event-propagated-state.md`:

- A mount failure dispatches a `ComponentError` event from the failing host. The event bubbles, it
  is composed, and you can cancel it. A mount failure is a synchronous throw, or an async rejection
  while the component is still mounted and current. The nearest component with a `fallback` handles
  the event. That is the failing component itself first, and then an ancestor. When nothing handles
  the event, imp falls back to the previous behaviour: it logs the error, and keeps the placeholder.
- The boundary that handles the event renders `fallback(error, ...args)` in place of its children.
  The failed subtree, and its healthy siblings, unmount through the normal path. Their subscriptions
  end, and their `teardown` runs. The boundary itself stays mounted, and `fallback` runs in the
  mount scope of the boundary. So the fallback can bind a state.
- A boundary handles **one error per mounted period**, and imp resets the flag on unmount. After the
  fallback is up, a further error goes to the next boundary out. To retry, mount the boundary again.
  A new mount brings a new error budget. imp logs a `fallback` that throws, and leaves the children
  as they are. It does not cascade.
- **A teardown and a notification are isolated against a fault. imp does not route them to a
  boundary.** Each mount cleanup, and each `teardown`, runs in its own guard. imp logs a throw, and
  the rest of the teardown still runs. A state `set` notifies each subscriber in its own guard. So
  imp logs one subscriber that throws, and skips it, and the other subscribers run, and the setter
  returns normally. Only the error of the update cycle, see `event-propagated-state.md`, carries a
  marker and reaches the setter. A keyed `each` isolates a render error per item. imp skips that
  item and logs it, and the rest of the list renders. So a runtime error appears where it happens.
  It does not tear down UI that already mounted correctly.

## Consequences

- A failing subtree becomes declared UI. An async page whose fetch rejects shows the fallback of the
  boundary, and the rest of the page continues to work. That is the mount-failure story for a route
  module that loads lazily, where the root of the route is the natural boundary.
- There is no new concept of a tree. The resolution to the nearest boundary is bubbling on the real
  tree. So two islands that you bundled separately work together, and a component with a `fallback`
  guards itself with no extra work.
- A boundary is a contract at **mount time**. imp does not route an error from an event handler, or
  from a subscriber, to a boundary. It isolates such an error and logs it where it happens. That
  keeps `set` synchronous and local, and it avoids a replacement of DOM that starts from any call
  stack.
- One error per mount makes a loop of fallbacks impossible, and imp tracks no source of an error.
  The cost is that a second independent failure inside one mounted period passes the boundary.
- The isolation of a cleanup guarantees that a swap of screens always releases everything that imp
  can release, also with a faulty `teardown`. A module that loads lazily depends on that property
  when a route changes.
