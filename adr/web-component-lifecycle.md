# Web-component lifecycle

## Context

Element factories are eager and run leaf-first: children are built before their parent element
exists, and nothing touches the live tree until mount. Component logic therefore ran detached — it
could not reach ancestors, measure layout, or own subscriptions with a defined lifetime, and state
disposal had to rely on lazily checking node connectedness (`event-propagated-state.md`). Apps also
had no story for loading states around async data. Running component code **after it is mounted**
requires a placeholder returned at call time plus a connection signal. Alternatives considered: a
self-replacing anchor element (no disposal hook, no persistent component root), a page-wide
MutationObserver (asynchronous, always-on cost), and processing deferred bodies only inside imp's
own insertion points (silently breaks when DOM is inserted with raw APIs).

## Decision

**imp components are real web components.** `component(name, definition)` defines a custom element
named `name` and returns a factory; calling the factory creates the host element — no logic runs
until it is connected to the document. Each host attaches an open shadow root at construction, and
all component output renders into it (`shadow-dom-isolation.md`). The platform's own lifecycle
callbacks drive everything:

- **`onMount(...args)`** (required) is the component's whole logic. It runs in `connectedCallback` —
  parents before children, synchronously on insertion — receives the factory-call arguments
  verbatim, and returns the component's DOM, which fills the host's shadow root. An async `onMount`
  keeps the placeholder visible until it resolves; a mount-generation counter discards output that
  resolves after unmount or remount, and mount errors — sync throws and still-current rejections —
  route to the nearest error boundary (`error-boundaries.md`), falling back to a logged error with
  the placeholder left in place.
- **`placeholder(...args)`** (optional) renders the shadow root's initial content at factory-call
  time and is restored after unmount. Synchronous mounts replace it before paint; it is user-visible
  only during async mounts — the built-in skeleton/loading story.
- **`onUnmount(...args)`** (optional) runs on removal for resources imp cannot track.
- **`onError(error, ...args)`** (optional) makes the component an error boundary for its own and its
  subtree's mount failures (`error-boundaries.md`).
- **Removal is detected with a microtask guard**: `disconnectedCallback` defers and re-checks
  `isConnected`, so a same-task move keeps the component mounted — DOM intact, subscriptions rebound
  to the new position (`component-moves-rebind.md`) — while a real removal runs cleanup: tracked
  state unsubscriptions, then `onUnmount`.
- **A mount-scope stack** tracks the currently mounting host. State helpers register their
  unsubscribers with it (`event-propagated-state.md`), and it is what gives `initState` a host to
  scope state to.
- **`styles`** (optional) is the component's own CSS, adopted by every instance's shadow root
  (`shadow-dom-isolation.md`).
- **Hosts are invisible to layout.** Every shadow root adopts a shared default sheet with
  `:host { display: contents }`, so output participates in the parent's layout; a component's own
  `styles` may override the host display.
- **Names are lowercase with at least one dash** (`my-app-profile`) — the custom-element rules,
  doubling as an enforced namespace like state names. HTML-reserved names are rejected, the
  `imp/component-name` lint rule flags bad literals statically, and redefining a name warns and
  keeps the first definition.

Element factories stay eager; plain lowercase helper functions remain the way to compose lifeless
DOM. A component is the promotion path when a piece of UI needs time: mounting, loading, state,
cleanup.

## Consequences

- Component code runs connected: it can subscribe to scoped state, dispatch bubbling events,
  measure, and focus. Mount order is top-down, so ancestors' `initState` always precedes
  descendants' `useState`.
- Loading states cost nothing extra — `placeholder` plus an async `onMount`.
- Cleanup is deterministic: state subscriptions exist only inside a mount and end at unmount —
  outside one they throw (`event-propagated-state.md`). `onUnmount` covers timers and sockets.
- The host tag stays in the tree and its output sits behind a shadow boundary: component boundaries
  are visible in the inspector, no selector crosses them (`shadow-dom-isolation.md`), and strict
  content models (`<table>`, `<select>`) are best rendered whole by one component.
- The lifecycle is the platform's — no scheduler, no reconciliation, consistent with
  `real-dom-no-virtual-dom.md`; the whole surface is one function and four definition entries.
