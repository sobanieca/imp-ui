# Event-propagated named state

## Context

Components need to share state without threading it through every function call, apps need values
computed from several states (a status line from a list, a full name from two fields), and
long-lived screen-swapping apps must not leak subscriptions when DOM is removed. The previously
planned answer was a Solid-style fine-grained signal graph (dependency tracking, effects, computed
values, owner-tree disposal) — substantial machinery to learn and to maintain, at odds with imp's
simplicity-first principle. The same risk exists on the composition side: combining states invites
an RxJS-style operator library. With components mounting as connected custom elements
(`web-component-lifecycle.md`), state code runs with a live ancestor chain and a defined owner,
which this decision builds on.

## Decision

Shared state is **named, explicit, and scoped by the DOM**. A component initializes state with
`initState(name, initialValue)` inside its `onMount`; components mounted in its subtree obtain it
with `useState(name)`. Both return the same helper:

- `get()` — current value.
- `set(next)` — explicitly replaces the value. A function `next` is the updater form: it is called
  with the current value and its result stored (`set((current) => ({ ...current, name: 'x' }))` —
  the get-then-set idiom in one call, React's `setState` dispatch). A `set` resolving to an
  identical value (`Object.is`) notifies nobody. The dispatch means a function can never be a state
  value — accepted deliberately: state holds plain data (objects, arrays, primitives), which the
  structural comparisons in keyed `each` and consumer rebinding assume anyway.
- `on(fn)` — runs `fn(value)` now and after every `set`; returns an unsubscribe function.
- `text(select?)` — returns a live `Text` node showing (a selection of) the value.
- `view(render)` — returns a live region re-rendered from `render(value)` on every `set`, anchored
  by comment nodes so surrounding siblings are untouched; the general fragment binding, covering
  conditionals (`render` may return `null`/`false` to render nothing).
- `each(renderItem, getKey?)` — `view`'s specialization for array state, rendering
  `renderItem(item, index)` per item. Without a key the region rebuilds whole like `view`; with a
  key function, items structurally unchanged (the `component-moves-rebind.md` comparison) keep their
  DOM, changed items re-render individually, removed items dispose their nested bindings, and
  reorders move the existing nodes (`moveBefore` where available, plain reinsertion — a same-task
  move — elsewhere). Duplicate keys and non-array values are reported and rendered defensively
  (independent items, empty region); `null`/`undefined` count as an empty array.

There is no dependency tracking, no effect graph, and no batching — a `set` synchronously notifies
subscribers, and subscribers surgically update the DOM they own. Batching was considered and
**rejected**: values that must change together belong in one state set in one call, and coalescing
several independent states at an expensive display edge is a documented user-land pattern (a
headless component deriving a display state once per microtask), not an API. Two guards keep the
synchronous model safe: each subscriber is notified in its own fault guard — a throwing subscriber
is logged and skipped while the rest run (`error-boundaries.md`) — and a notification-depth limit
cuts off a cycle of states setting each other after 100 nested updates, with that error alone
propagating to the setter.

**Resolution bubbles up the real tree.** The provider listens for a `StateSubscription`
`CustomEvent` on its own host element; `useState` dispatches that event (bubbling and composed, so
it crosses the shadow roots every component now renders into, `shadow-dom-isolation.md`) from the
asking component's host, and the nearest ancestor providing the name answers synchronously through
`event.detail.subscribe(state, provider)`, stopping propagation. Called outside any component mount,
both sides use `document` — the page-wide scope. Consequently a component may **shadow** an
ancestor's (or the page's) state by initializing the same name; only re-initializing a name within
the same scope warns and reuses the existing state. Inside a mount, `useState` returns a consumer
helper wrapping the resolved provider; when its component moves, the helper rebinds to the provider
at the new position (`component-moves-rebind.md`).

**State lifetime follows its scope.** Component-scoped state is released when its component unmounts
(the host listener is removed with the mount's cleanups) and a remount reinitializes it; sibling
instances own independent states under one name. Module-scope state lives for the page.

**Mounts are the only place subscriptions exist.** `on`, `text`, `view`, and `each` require an
active mount scope (`web-component-lifecycle.md`): they register their unsubscriber with it and are
unsubscribed deterministically on unmount, and called without one — module scope, an event handler,
after an `await` in an async `onMount` — they throw. `initState`/`useState` cannot throw there
(no-scope calls are the legitimate page-wide form), so the post-`await` hazard is caught statically
instead: the `imp/state-setup-before-await` lint rule flags them after an `await` in an async
`onMount`. A `view`/`each` render function re-enters a scope of its own (with the owning component's
host), so bindings nested in the render work on every re-render; they are owned by the region and
unsubscribed when it next re-renders or when the component unmounts, whichever comes first. There is
no fallback disposal path and no manually managed subscription. `get` and `set` remain free to call
anywhere; `on` returns its unsubscriber only for stopping early within a mounted period.

**Composition is one combinator.** `computed(states, compute)` returns a read-only state
(`get`/`on`/`text`/`view`/`each`; `set` throws) whose value is `compute(...sourceValues)`. It
notifies only when the computed outcome changes (`Object.is`), which also makes single-source
computed states the way to watch one part of a bigger state. It is built solely on the public
`get`/`on` of its sources, so computed states compose and work across separately bundled islands.
This is intentionally the entire composition story — no operators, no async, no schedulers; users
are expected to design their source states well and compute display-ready outcomes at the edge.

**State names must be namespaced** — at least two non-empty dot-separated segments (`myapp.user`).
Both helpers throw on non-conforming names at runtime, and the `imp/state-name-namespace` lint rule
flags literal names statically.

## Consequences

- The whole model is six small helpers plus one combinator; nothing to learn about tracking scopes,
  effect timing, or disposal graphs — the DOM tree is the scope tree.
- Because the handshake travels through the DOM, provider and consumer only need to share the tree,
  not a module instance — separately bundled islands on one page interoperate.
- Scoping falls out of bubbling: independent per-instance states, shadowing, and automatic release
  on unmount all come from where the provider listens, not from extra machinery.
- Resolution happens at mount and re-runs on move: a moved component's `useState` helpers rebind to
  the providers at its new position (`component-moves-rebind.md`), so the nearest-provider rule
  holds wherever a mounted component currently sits.
- Every subscription has exactly one owner and one deterministic end. The cost is that an async
  `onMount` must finish its state setup before its first `await` — enforced by the same throw.
- A computed state recomputes per subscriber and per source change, and a `compute` returning a
  fresh object re-notifies on every source change since `Object.is` never matches — acceptable for
  display-edge computed states, which is what the single combinator is for.
- `view` and unkeyed `each` rebuild their whole region on any change — disposing the previous
  render's nested bindings first. A keyed `each` reconciles by key only: it decides per item whether
  to keep or re-render whole, never diffing inside an item, consistent with "no diffing"
  (`real-dom-no-virtual-dom.md`). The cost is that a changed item is rebuilt entirely, and a kept
  item's `renderItem` is not re-run when only its index changed — item DOM must derive from the
  item, not its position.
