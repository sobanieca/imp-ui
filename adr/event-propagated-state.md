# Event-propagated named state

## Context

Two components must share a state, and nobody wants to pass that state through every function call.
An app needs a value that it computes from several states, such as a status line from a list, or a
full name from two fields. A long-lived app that swaps a screen must not leak a subscription when
imp removes DOM. The answer that imp planned before was a graph of fine-grained signals, in the
style of Solid. That means dependency tracking, an effect, a computed value, and disposal through a
tree of owners. It is a lot of machinery to learn, and to maintain, and it works against the
principle of imp that simplicity comes first. The same risk exists on the side of composition. To
combine two states invites a library of operators, in the style of RxJS. A component now mounts as a
custom element that is connected, see `web-component-lifecycle.md`. So the code of a state runs with
a live chain of ancestors, and with a defined owner. This decision builds on that.

## Decision

A shared state is **named, explicit, and scoped by the DOM**. A component initializes a state with
`initState(self, name, initialValue)`, inside its `setup`. A component that mounts in its subtree
obtains that state with `useState(self, name)`. `self` is the per-mount handle of the component, see
`web-component-lifecycle.md`. Both return the same helper:

- `get()` returns the current value.
- `set(next)` replaces the value with `next`, as in `set(42)` and `set({ ...user, name: 'x' })`.
  Pass a **function** instead, and it is the updater form. imp calls that function with the current
  value, and stores its result, as in `set((current) => ({ ...current, name: 'x' }))`. That is the
  get-then-set idiom in one call, and it is the dispatch of `setState` in React. A `set` that
  resolves to a structurally equal value notifies nobody. The comparison is the same walk over the
  content that a keyed `each` uses, and that the rebinding of a consumer uses, see
  `state-plain-data-values.md`. That dispatch means that a function can never be a state value. imp
  accepts that deliberately. A state holds plain data, which those structural comparisons assume in
  any case.
- `watch(self, fn)` runs `fn(value)` now, and after every `set`, and stops when the mount of `self`
  ends. `watch(fn)` does the same with no owner, and returns the function that unsubscribes. imp
  dispatches on the type of the first argument, see `type-based-argument-dispatch.md`.
- `text(select?)` returns a live `Text` node. That node shows the value, or a selection of it.
- `view(render)` returns a live region. imp renders it again, from `render(value)`, on every `set`.
  Comment nodes anchor the region, so imp does not touch the siblings around it. It is the general
  binding for a fragment, and it covers a conditional, because `render` can return `null` or `false`
  to render nothing.
- `each(renderItem, getKey?)` is the specialization of `view` for a state that holds an array. It
  renders `renderItem(item, index)` per item. With no key, imp rebuilds the whole region, like a
  `view`. With a key function, an item that did not change structurally keeps its DOM. That is the
  comparison of `component-moves-rebind.md`. imp renders a changed item again, on its own. It
  disposes of the nested bindings of an item that somebody removed. On a reorder it moves the
  existing nodes with `moveBefore`, so the platform keeps the focus and the state of an animation.
  It moves only the items that are out of order. The items that already stand in a rising sequence
  of their previous positions, the longest such sequence, stay where they are. So a swap of two
  items moves two nodes, and not the whole list. Each move of a component host makes it resolve its
  states again, and the browser lays out every moved node again, so the count of moves is the cost
  of a reorder. A new node arrives through `insertBefore`. imp reports a duplicate key, and a value
  that is not an array, and renders defensively. A duplicate key becomes an independent item, and a
  value that is not an array becomes an empty region. `null` and `undefined` count as an empty
  array.

**A prop value with the shape of a state is a live binding.** An element factory extends the
dispatch by type, see `type-based-argument-dispatch.md`, to a prop value. A value with a `get`
function and a `watch` function, at the position of a prop, is bound, and not assigned. Examples are
`div({ class: theme })` and `button({ disabled: busy })`. imp applies the value now, and applies it
again on every notification, through the same logic for a class, a style, a property and an
attribute. To derive the value of a prop from a state is the job of `computed`. Any object with the
shape of a state binds. That covers a regular state, a computed state, and user code that implements
the shape. imp applies a bound `class` and a bound `style` as a whole. It removes an entry that the
new value does not hold. The semantics of one owner require that, and it is indistinguishable from a
static application, on the freshly built element that a factory produces. A binding rides the public
`watch`. So it is a subscription, with the usual owner and the usual lifetime. imp reports a state
that you pass as a standalone argument, and skips it, because the dispatch would treat that plain
object as a props object.

There is no dependency tracking, no graph of effects, and no batching. A `set` notifies its
subscribers synchronously, and a subscriber updates the DOM that it owns, precisely. imp considered
batching, and **rejected** it. Values that must change together belong in one state, which somebody
sets in one call. To coalesce several independent states at an expensive point of display is a
documented pattern in user code, and not an API. That pattern is a headless component that derives
one display state per microtask. Two guards keep the synchronous model safe. imp notifies each
subscriber inside its own guard against a fault. It logs a subscriber that throws, and skips it,
while the others run, see `error-boundaries.md`. imp also limits the depth of a notification. It
cuts off a cycle of states that set each other, after 100 nested updates. That error alone reaches
the setter.

**The resolution bubbles up the real tree.** The provider listens for a `CustomEvent` that looks a
provider up, on its own host element. `useState` dispatches that event from `self.host`, the host of
the component that asks. The event bubbles, and it is composed, so it crosses the shadow root that
every component renders into, see `shadow-dom-isolation.md`. The nearest ancestor that provides the
name answers synchronously, with its state, and stops the propagation. The lookup is keyed by a
**kind**, and by a name. So it is the one mechanism of resolution for every resource that the DOM
scopes in imp, and not the mechanism of the state alone. The HTTP client, see `http-client.md`,
resolves through the same seam. A future resource costs a kind, and not a second mechanism. There is
**no scope across the page**. `document` never provides. `initState` and `useState` throw when their
first argument is not the `self` of a mounted component. imp considered a page-wide scope, and
rejected it. It is a second concept to learn, and a scope that imp never releases. State for the
lifetime of the app is instead ordinary component state, initialized in the root component of the
app, which spans the tree and never unmounts. It follows that a component can **shadow** the state
of an ancestor, by initializing the same name. To initialize a name again, inside the same scope,
throws. A scope initializes each name exactly once. So an accidental collision, where two
independent initializers select one name at one scope, fails loudly, in place of sharing a state in
silence. `useState` returns a consumer helper, which wraps the resolved provider. When its component
moves, the helper binds to the provider at the new position, see `component-moves-rebind.md`.

**The lifetime of a state follows its owner.** imp releases a state when its component unmounts, and
it removes the listener on the host with the cleanups of that mount. A remount initializes the state
again. Two sibling instances own independent states, under one name.

**`self` carries the mount, so a resolution has no position rule.** The helper takes `self` as its
first argument, and looks the mount scope up through the component module. It dispatches from
`self.host`, and it registers the cleanup and the rebind of the consumer on that scope. So
`initState` and `useState` work at any point in `setup`, before and after any number of awaits.
There is no ambient stack. A helper that runs after the component has left the page throws, because
the scope has ended. In `onRemove`, `useState(self, name)` returns the handle that `setup` resolved,
from a cache on the mount that is keyed by kind and name. That is how a component withdraws a
contribution on unmount, see `web-component-lifecycle.md`. The helpers are free functions in
`imp/state`, and not methods on `self`, so that an app that renders a component without a state does
not carry the state layer, see `tree-shakeable-library.md`.

**A subscription activates at the insertion, and containment decides the owner.** `text`, `view`,
`each` and a state-bound prop are inert descriptors when you build them. Each one registers a
pending activator on its node. imp activates every subtree that it places. That covers the output of
a component into its shadow root, see `web-component-lifecycle.md`, DOM that you hand to `mount`,
and the render output of a region. The activation subscribes the binding, and registers its
unsubscribe function with the scope that placed the DOM. So the component that mounts the DOM owns
its bindings, and unsubscribes them at the unmount, in a defined way. That makes the construction of
a binding free of position. DOM that you build after an `await`, in an async `setup`, goes live when
the resolved output mounts, and it needs no ambient context. The relation of containment in the DOM
answers the question "whose binding is this?", where no mechanism at runtime could attribute the
call that built it. A `view` or `each` region collects the cleanups of its own render. The region
activates the nodes that it inserts. The region owns a nested binding, and imp unsubscribes that
binding when the region next renders again, or when the component unmounts, whichever comes first. A
nested `useState(self, name)` in a render function resolves through the same `self` as the `setup`
around it. `watch` has no node to land on, and nothing ambient can own it. So it takes `self`, and
registers its stop with the mount scope of `self`, in the same list as the bindings. `watch(fn)`
without `self` registers nothing, and returns the function that stops it. That form serves code
outside a component, such as a test or a page script. The `imp/watch-with-self` lint rule reports a
bare `watch(fn)` in `setup`, `error` or `onMount` whose result is discarded, on a handle that the
file created with `initState`, `useState`, `computed` or `useRoute`, and on `lang`, `dir` and
`theme`. `get` and `set` stay free to call anywhere.

**Composition is one combinator.** `computed(states, compute)` returns a read-only state. It has
`get`, `watch`, `text`, `view` and `each`, and `set` throws. Its value is
`compute(...sourceValues)`. It notifies only when the computed result changes. imp compares that
result **structurally**, with the same `valuesEqual` that a keyed `each` uses, and not by reference.
So a `compute` that builds a fresh object or array on each run stays quiet, while its result is
deeply equal. Examples of such a `compute` are `(items) => items.filter(...)` and
`(u) => u.address`. A comparison by reference would make every such computed state notify again, on
every set of a source. That is the common case, and not a corner. The whole point of the combinator
is to produce a value that is ready to display, and such a value is usually freshly built. That also
makes a computed state over one source the way to watch one part of a larger state, including
through a replacement of the whole value with equal data, such as a refetch. imp builds `computed`
on the public `get` and `watch` of its sources only. So a computed state composes, and it works
across two islands that somebody bundled separately. This is deliberately the entire story of
composition. There is no operator, nothing async, and no scheduler. imp expects you to design your
source states well, and to compute a result that is ready to display, at the edge.

**A computed state subscribes to its sources once, and not once per subscriber.** It keeps its own
notifier, and a count of its subscribers. The first subscriber attaches the subscriptions to the
sources. The last subscriber to leave detaches them. So a set of a source costs **one** recompute,
and one structural comparison, and imp fans the result out to every subscriber. The alternative was
that each subscriber wires its own watchers, which is what the first implementation did. That
multiplied both costs by the number of subscribers. That is the wrong direction for the case that
the documentation actively recommends, which is "computing is cheap, create it again where you need
it". It is also the wrong direction for one computed state that somebody binds at many prop
positions. The shared subscription lives longer than any single subscriber. So it cannot belong to
whichever component subscribed first. `computed` attaches its sources under a scope of its own. So
an unmount of one component never cuts the updates of another. imp deliberately does **not** memoize
`get()`. It always recomputes. So a computed state that somebody reads during a pass of
notifications can never hand back a value that is older than its sources. The cost of that choice is
that a chain recomputes the whole chain, per level. A chain of depth `D` costs `D(D+1)/2`
computations, for one set of a source. The fix would be a cached value that imp invalidates, which
is the dependency graph that this ADR rejects. So the documented guidance stands instead. Do not
stack a computed state on a computed state. Restructure the sources.

**To select part of a state is `computed`, and to reach in and write is not an API.** A read-only
projection, such as `computed([user], (u) => u.address.city)`, covers the read half exactly, with
the structural comparison. The write half has no combinator. `set` replaces the whole value, and a
nested update spreads. imp considered a writable projection, and **rejected** it. It cannot be built
from a `compute` function, because nobody can invert an opaque function. So it would have to take a
**path** instead. A form with a path is a second way to address a state, and it earns its place only
when something consumes it. The one consumer that addresses a value by a path is the binding of a
form control, see `state-driven-forms.md`. It keeps the path inside the form layer, and it reads and
writes the form state as a whole. So the kernel has no writable projection.

**A state name must carry a namespace.** It needs two or more dot-separated segments that are not
empty, such as `myapp.user`. Both helpers throw at runtime on a name that does not conform. The
`imp/state-name-namespace` lint rule reports a literal name statically. It finds the call by the
imported name, and reads the name from the second argument, after `self`.

## Consequences

- The whole model is six small helpers, one combinator, and one rule of dispatch for a prop. There
  is nothing to learn about a scope for tracking, about the timing of an effect, or about a graph
  for disposal. The DOM tree is the tree of scopes.
- A prop binding adds no API surface. To consume a state at the position of a prop is to pass the
  state itself. To select part of it is `computed`. The renderer detects the shape, and it imports
  no module of the state. That is the same detection by shape that `computed` uses to validate its
  sources. So a future value with the shape of a state, such as a lens over a field, or an adapter
  that a user writes, binds with no change to the renderer.
- The handshake travels through the DOM. So a provider and a consumer only have to share the tree,
  and not a module instance. Two islands on one page, that somebody bundled separately, work
  together.
- The scoping falls out of the bubbling. An independent state per instance, a shadow of a name, and
  an automatic release at the unmount, all come from where the provider listens. They do not come
  from extra machinery.
- There is one concept of a scope, and not two. A component owns every state. State for the lifetime
  of the app is state that the root component of the app owns. That costs app-wide state one
  enclosing root component, in place of a bare call at module scope. In exchange, there is no second
  lifetime to learn, no scope that nobody releases, and no silent failure after an `await`, where a
  stranded `initState` would fall back to the page. `initState` and `useState` throw with no `self`
  of a mounted component. So the whole surface of the resolution fails loudly, and in one way.
- imp resolves at the mount, and resolves again on a move. The `useState` helpers of a component
  that moved bind to the providers at its new position, see `component-moves-rebind.md`. So the rule
  of the nearest provider holds wherever a mounted component sits now.
- Every subscription has exactly one owner, and one defined end. The cost is one walk of activation
  over each subtree that imp places, and one `self` argument on a `watch`. A resolution has no
  position rule, because `self` carries the mount across every `await`. A `watch(self, fn)` inside a
  `view` or `each` render function ends with the mount, not with the region. So it accumulates on
  every rebuild, and the guidance is to bind there.
- A binding that somebody places without imp stays inert, and says nothing. That is DOM that
  somebody inserted by hand, in place of through the output of a component, or through `mount`. An
  eager subscription would fail loudly at construction. imp accepts the trade. Placement by imp is
  the documented path. An inert binding also beats the failure mode of the eager alternative, which
  is a subscription with no owner, that leaks past a removal.
- A computed state costs one recompute, and one structural comparison of the result, per set of a
  source. That cost does not depend on the number of subscribers. imp pays it to keep a freshly
  built result, which is the normal case, from notifying again. A result that is deeply equal is
  free downstream. There is no rebuild, and no prop that imp applies again. `valuesEqual` stops
  early on equality of a reference, and on the length of an array. So the walk runs in full only for
  a freshly built result with the same shape, which is exactly the case that is worth catching. The
  shape to watch is a computed state over a large collection, at a source that changes often. The
  answer there is the usual one. Restructure the sources, or coalesce at the edge of the display.
- The read path stays O(depth) per level. `get()` never memoizes. So a chain of computed states
  recomputes its whole tail at every level. The resolution of `useState` also walks the chain of
  ancestors, per call, at the mount. Both are deliberate. The first buys freedom from a stale value.
  The second buys the DOM as the tree of scopes. Both are why the guidance is to keep a chain flat,
  and to resolve a state once, near the top, in place of in every leaf.
- A nested write stays an explicit spread, as in
  `set((u) => ({ ...u, address: { ...u.address, city } }))`. The ergonomics of that are a known
  cost. imp deliberately does not pay it, until the binding contract of the standard library says
  what it needs.
- A `view`, and an unkeyed `each`, rebuild their whole region on any change. imp disposes of the
  nested bindings of the previous render first. A keyed `each` reconciles by the key only. It
  decides per item whether to keep the item, or to render it again as a whole. It never compares
  inside an item, which is consistent with "no diffing", see `real-dom-no-virtual-dom.md`. The cost
  is that imp rebuilds a changed item completely, and that imp does not run the `renderItem` of a
  kept item again when only its index changed. So the DOM of an item must come from the item, and
  not from its position.
