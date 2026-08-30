# Event-propagated named state

## Context

Components need to share state without threading it through every function call, apps need values
computed from several states (a status line from a list, a full name from two fields), and
long-lived screen-swapping apps must not leak subscriptions when DOM is removed. The previously
planned answer was a Solid-style fine-grained signal graph (dependency tracking, effects, computed
values, owner-tree disposal) - substantial machinery to learn and to maintain, at odds with imp's
simplicity-first principle. The same risk exists on the composition side: combining states invites
an RxJS-style operator library. With components mounting as connected custom elements
(`web-component-lifecycle.md`), state code runs with a live ancestor chain and a defined owner,
which this decision builds on.

## Decision

Shared state is **named, explicit, and scoped by the DOM**. A component initializes state with
`initState(name, initialValue)` inside its `build`; components mounted in its subtree obtain it with
`useState(name)`. Both return the same helper:

- `get()` - current value.
- `set(next)` - replaces the value with `next` (`set(42)`, `set({ ...user, name: 'x' })`). Pass a
  **function** instead and it is the updater form: it is called with the current value and its
  result stored (`set((current) => ({ ...current, name: 'x' }))` - the get-then-set idiom in one
  call, React's `setState` dispatch). A `set` resolving to a structurally equal value notifies
  nobody - the comparison is the same content walk keyed `each` and consumer rebinding use
  (`state-plain-data-values.md`). The dispatch means a function can never be a state value -
  accepted deliberately: state holds plain data, which those structural comparisons assume anyway.
- `watch(fn)` - runs `fn(value)` now and after every `set`; returns an unsubscribe function.
- `text(select?)` - returns a live `Text` node showing (a selection of) the value.
- `view(render)` - returns a live region re-rendered from `render(value)` on every `set`, anchored
  by comment nodes so surrounding siblings are untouched; the general fragment binding, covering
  conditionals (`render` may return `null`/`false` to render nothing).
- `each(renderItem, getKey?)` - `view`'s specialization for array state, rendering
  `renderItem(item, index)` per item. Without a key the region rebuilds whole like `view`; with a
  key function, items structurally unchanged (the `component-moves-rebind.md` comparison) keep their
  DOM, changed items re-render individually, removed items dispose their nested bindings, and
  reorders move the existing nodes (`moveBefore` where available, plain reinsertion - a same-task
  move - elsewhere). Duplicate keys and non-array values are reported and rendered defensively
  (independent items, empty region); `null`/`undefined` count as an empty array.

**A state-shaped prop value is a live binding.** Element factories extend type-based dispatch
(`type-based-argument-dispatch.md`) to prop values: a value with `get` and `watch` functions at prop
position (`div({ class: theme })`, `button({ disabled: busy })`) is bound, not assigned - applied
now and re-applied through the same class/style/property/attribute logic on every notification.
Deriving the prop's value from state is `computed`'s job, and any state-shaped object binds -
regular, computed, or user code implementing the shape. Bound `class` and `style` are applied
replace-whole (entries the new value omits are removed), which their single-owner semantics require
and which is indistinguishable from static application on the freshly built elements factories
produce. Binding rides the public `watch`, so it is a subscription with the usual owner and
lifetime. A state passed as a standalone argument - where dispatch would mistake this plain object
for a props object - is reported and skipped.

There is no dependency tracking, no effect graph, and no batching - a `set` synchronously notifies
subscribers, and subscribers surgically update the DOM they own. Batching was considered and
**rejected**: values that must change together belong in one state set in one call, and coalescing
several independent states at an expensive display edge is a documented user-land pattern (a
headless component deriving a display state once per microtask), not an API. Two guards keep the
synchronous model safe: each subscriber is notified in its own fault guard - a throwing subscriber
is logged and skipped while the rest run (`error-boundaries.md`) - and a notification-depth limit
cuts off a cycle of states setting each other after 100 nested updates, with that error alone
propagating to the setter.

**Resolution bubbles up the real tree.** The provider listens for a provider-lookup `CustomEvent` on
its own host element; `useState` dispatches that event (bubbling and composed, so it crosses the
shadow roots every component now renders into, `shadow-dom-isolation.md`) from the asking
component's host, and the nearest ancestor providing the name answers synchronously with its state,
stopping propagation. The lookup is keyed by a **kind** as well as a name, so it is the one
resolution mechanism for every DOM-scoped resource imp owns rather than state's alone - the HTTP
client (`http-client.md`) resolves through the same seam, and a future one costs a kind, not a
second mechanism. There is **no page-wide scope**: `document` never provides, and
`initState`/`useState` called outside a mounting component throw - considered and rejected as a
second concept to learn and a scope that is never released; app-lifetime state is instead ordinary
component state initialized in the app's root component, which spans the tree and never unmounts.
Consequently a component may **shadow** an ancestor's state by initializing the same name;
re-initializing a name within the same scope throws - a scope initializes each name exactly once,
and an accidental collision (two independent initializers picking one name at one scope) fails
loudly instead of silently sharing state. `useState` returns a consumer helper wrapping the resolved
provider; when its component moves, the helper rebinds to the provider at the new position
(`component-moves-rebind.md`).

**State lifetime follows its owner.** A state is released when its component unmounts (the host
listener is removed with the mount's cleanups) and a remount reinitializes it; sibling instances own
independent states under one name.

**Subscriptions activate at insertion, owned by containment.** `text`, `view`, `each`, and
state-bound props are inert descriptors when built: each registers a pending activator on its node,
and imp activates every subtree it places - a component's output into its shadow root
(`web-component-lifecycle.md`), DOM handed to `mount`, a region's render output. Activation
subscribes the binding and registers its unsubscriber with the placing scope, so the component that
mounts the DOM owns its bindings and unsubscribes them deterministically on unmount. That makes
binding construction position-free: DOM built after an `await` in an async `build` goes live when
the resolved output mounts, with no ambient context - the DOM containment relation answers "whose
binding is this?" where no runtime mechanism could attribute the constructing call. A `view`/`each`
region runs its render function in a scope of its own (with the owning component's host, so nested
`useState` resolves) and activates the nodes it inserts; nested bindings are owned by the region and
unsubscribed when it next re-renders or when the component unmounts, whichever comes first. `watch`
has no node to land on, so like `initState`/`useState` it requires an active mount scope and throws
without one - module scope, an event handler, after an `await` in an async `build`; the whole
position-sensitive surface fails loudly at runtime, and the `imp/state-setup-before-await` lint rule
flags it earlier, at write time - `initState`/`useState` calls by imported name, `watch` by tracking
handles the file assigned from `initState`/`useState`/`computed` (so unrelated third-party
`.watch()` methods are not reported). There is no fallback disposal path and no manually managed
subscription. `get` and `set` remain free to call anywhere; `watch` returns its unsubscriber only
for stopping early within a mounted period.

**Composition is one combinator.** `computed(states, compute)` returns a read-only state
(`get`/`watch`/`text`/`view`/`each`; `set` throws) whose value is `compute(...sourceValues)`. It
notifies only when the computed outcome changes - compared **structurally** (the same `valuesEqual`
keyed `each` uses), not by reference, so a `compute` that builds a fresh object or array each run
(`(items) => items.filter(...)`, `(u) => u.address`) stays quiet while its outcome is deep-equal.
Reference comparison would have made every such computed state re-notify on every source set, which
is the common case, not the corner: the whole point of the combinator is producing display-ready
values, and display-ready values are usually freshly built. That also makes single-source computed
states the way to watch one part of a bigger state, including through a whole-value replace with
equal data (a refetch). It is built solely on the public `get`/`watch` of its sources, so computed
states compose and work across separately bundled islands. This is intentionally the entire
composition story - no operators, no async, no schedulers; users are expected to design their source
states well and compute display-ready outcomes at the edge.

**A computed state subscribes to its sources once, not once per subscriber.** It keeps its own
notifier and a subscriber count: the first subscriber attaches the source subscriptions, the last
one to leave detaches them, and a source set therefore costs **one** recompute and one structural
comparison, fanned out to every subscriber. The alternative - each subscriber wiring its own
watchers, as the first implementation did - multiplied both by the subscriber count, which is the
wrong direction for the case the docs actively recommend ("computing is cheap, re-create it where
needed") and for one computed state bound at many prop positions. Because the shared subscription
outlives any single subscriber, it cannot be owned by whichever component happened to subscribe
first: `computed` attaches its sources under a scope of its own, so one component unmounting never
severs another's updates. `get()` is deliberately **not** memoized - it always recomputes, so a
computed state read during a notification pass can never hand back a value staler than its sources.
The cost of that choice is that chains recompute the whole chain per level (depth `D` costs
`D(D+1)/2` computes for one source set); the fix would be a cached, invalidated value - i.e. the
dependency graph this ADR rejects - so the documented guidance stands instead: do not stack computed
states, restructure the sources.

**Selecting part of a state is `computed`, and reaching in to write is not an API.** A read-only
projection (`computed([user], (u) => u.address.city)`) covers the read half exactly, structural
comparison included. The write half has no combinator: `set` replaces the whole value, and nested
updates spread. A writable projection was considered and **rejected** - it cannot be built from a
`compute` function (an opaque function cannot be inverted), so it would have to take a **path**
instead, and a path form is a second way to address state that earns its place only once something
consumes it. The one candidate consumer is the stdlib's control-binding contract
(`todo/stdlib-components.md`), which is unbuilt and can equally take read and write as two separate
props. Revisit it there, with the contract in hand, rather than ahead of it.

**State names must be namespaced** - at least two non-empty dot-separated segments (`myapp.user`).
Both helpers throw on non-conforming names at runtime, and the `imp/state-name-namespace` lint rule
flags literal names statically.

## Consequences

- The whole model is six small helpers plus one combinator, and one dispatch rule for props; nothing
  to learn about tracking scopes, effect timing, or disposal graphs - the DOM tree is the scope
  tree.
- Prop bindings add no API surface: consuming a state at prop position is passing the state itself,
  selection is `computed`, and the renderer detects the shape without importing the state module -
  the same duck-typing `computed` uses to validate its sources, so future state-shaped values (a
  field lens, user-made adapters) bind without renderer changes.
- Because the handshake travels through the DOM, provider and consumer only need to share the tree,
  not a module instance - separately bundled islands on one page interoperate.
- Scoping falls out of bubbling: independent per-instance states, shadowing, and automatic release
  on unmount all come from where the provider listens, not from extra machinery.
- There is one scope concept, not two: every state is owned by a component, and app-lifetime state
  is just state owned by the app's root component. Dropping the page-wide (`document`) scope costs
  app-wide state one enclosing root component instead of a bare module-scope call, and in exchange
  removes a second lifetime to learn, the never-released scope it created, and the silent
  post-`await` failure mode where a stranded `initState` used to fall back to page-wide. `initState`
  and `useState` now throw without a mounting component, so the whole resolution surface fails
  loudly and uniformly.
- Resolution happens at mount and re-runs on move: a moved component's `useState` helpers rebind to
  the providers at its new position (`component-moves-rebind.md`), so the nearest-provider rule
  holds wherever a mounted component currently sits.
- Every subscription has exactly one owner and one deterministic end, at the cost of a one-time
  activation walk over each subtree imp places. The remaining restriction is that an async `build`
  must resolve its states (`initState`/`useState`) and call `watch` before its first `await` - a
  platform gap, not a design choice: past an `await` no runtime mechanism can attribute those calls
  to the mounting component (the gap the unshipped TC39 AsyncContext proposal targets; if it lands,
  the restriction can be lifted transparently). Closures bridge it - handles resolved before the
  `await` work anywhere after it - and insertion-time activation already frees the DOM side
  entirely.
- A binding placed without imp - DOM inserted by hand rather than through a component's output or
  `mount` - stays silently inert, where eager subscription used to fail loudly at construction.
  Accepted: imp placement is the documented path, and an inert binding beats the eager alternative's
  failure mode (a subscription attached with no owner, leaking past removal).
- A computed state costs one recompute and one structural comparison of the result per source set,
  independent of how many subscribers it has - paid to keep freshly built results (the normal case)
  from re-notifying. Deep-equal outcomes are free downstream: no rebuild, no re-applied prop.
  `valuesEqual` short-circuits on reference equality and on array length, so the walk only runs in
  full for a same-shaped, freshly built result - exactly the case worth catching. A computed state
  over a large collection at a hot source is the shape to watch; the answer there is the same as
  always - restructure the sources, or coalesce at the display edge.
- The read path stays O(depth) per level: `get()` never memoizes, so a chain of computed states
  recomputes its whole tail on every level, and `useState` resolution walks the ancestor chain per
  call at mount. Both are deliberate - the first buys freedom from staleness, the second buys the
  DOM as the scope tree - and both are why the guidance is to keep chains flat and to resolve a
  state once near the top rather than in every leaf.
- Nested writes stay explicit spreads (`set((u) => ({ ...u, address: { ...u.address, city } }))`).
  The ergonomics of that are a known cost, deliberately unpaid until the stdlib's binding contract
  says what it needs.
- `view` and unkeyed `each` rebuild their whole region on any change - disposing the previous
  render's nested bindings first. A keyed `each` reconciles by key only: it decides per item whether
  to keep or re-render whole, never diffing inside an item, consistent with "no diffing"
  (`real-dom-no-virtual-dom.md`). The cost is that a changed item is rebuilt entirely, and a kept
  item's `renderItem` is not re-run when only its index changed - item DOM must derive from the
  item, not its position.
