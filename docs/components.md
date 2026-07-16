# imp-ui — Components

Components are how imp gives your UI a lifecycle. An imp component is a real web component — a
custom element with a name you choose — whose logic runs **after it is mounted on the page**. That
one guarantee is what everything else builds on: inside a component you can subscribe to state,
measure layout, focus fields, and reach ancestors, because by the time your code runs the component
is actually in the document.

Every component renders into its own **shadow root**, so its DOM and CSS are fully isolated: what
happens inside a component stays inside, and everything that crosses the boundary — state, errors,
theming variables — does so through an explicit channel.

## Two layers

imp renders with two layers, each doing one thing:

- **Element factories** (`div`, `span`, `button`, …) are eager, single-use functions that return
  plain DOM nodes the moment you call them. No lifecycle, no magic — they are how you _build_ DOM
  (see **[Rendering](rendering.md)**).
- **Components** own _time_: mounting, loading, unmounting. You define one with
  `component(name, definition)` and get back a factory you call like any other function.

```js
import { component, div, span, useState } from 'imp'

export const profile = component('my-app-profile', {
  onMount: () => {
    const user = useState('myapp.user')
    return div(span(user.text((u) => u.name)))
  },
})
```

Using it looks exactly like using an element factory:

```js
div(header(), profile(), footer())
```

## Naming

The component's name **is its HTML tag**: `profile()` renders as `<my-app-profile>` in the document,
visible in the browser's element inspector. Names must be lowercase with at least one dash
(`my-app-profile`, not `profile`) — that is what makes them valid custom element names, and the
prefix doubles as your app's namespace, exactly like state names (`myapp.user`). The
`imp/component-name` lint rule enforces this as you type (see **[Linting](lint.md)**), and a bad
name throws at runtime.

The host element takes no layout space of its own — every component defaults to `display: contents`,
so your component's output participates in the parent's flex, grid, or flow layout as if the host
were not there. If you _want_ the host to be a styled box, set `:host { display: block }` (or
anything else) in the component's `styles`, or style the tag from page CSS — rules targeting the tag
from outside always win for the host element itself.

## The definition object

`component(name, definition)` takes the name and an object with up to five entries:

### `onMount(...args)` — required

The component's whole logic. It receives, verbatim, whatever arguments the factory call was given
(`profile({ id: 42 })` → `onMount({ id: 42 })`) and returns the component's DOM — a node, a string,
an array of children, or nothing. It runs when the component is **connected to the document**,
parents before children, so everything an ancestor set up (like state) is already there.

`onMount` may also be `async` — see _Loading states_ below.

### `placeholder(...args)` — optional

Returns what the component shows **before its real content exists**: it is rendered into the host
immediately when you call the factory, and stays there until `onMount`'s output replaces it. For a
synchronous `onMount` the swap happens before the browser paints, so the placeholder is never seen —
it only becomes visible when `onMount` is async and takes real time. That makes it the natural home
for a loading skeleton:

```js
const card = component('my-app-card', {
  placeholder: () => div({ class: 'skeleton' }),
  onMount: async () => renderCard(await loadCard()),
})
```

Keep placeholders static — plain DOM, no state subscriptions.

### `onUnmount(...args)` — optional

Runs after the component is removed from the document, for teardown imp cannot do for you: timers,
sockets, third-party widgets. You rarely need it — state subscriptions are cleaned up automatically
(see _Automatic cleanup_ below).

### `onError(error, ...args)` — optional

Makes the component an **error boundary**: when its own mount fails, or a component anywhere in its
subtree fails to mount, `onError` runs with the error (and the factory-call arguments) and its
output replaces the component's content — see _Error boundaries_ below.

### `styles` — optional

The component's own CSS, as a string. It applies only inside this component — see _Styling_ below.

## Styling

A component's output lives in its own shadow root, which gives you full two-way isolation: page
stylesheets do not reach into a component, and a component's CSS cannot leak out. A component
carries its look in the `styles` entry:

```js
export const userCard = component('my-app-user-card', {
  styles: `
    .card {
      display: flex;
      gap: 8px;
      border: 1px solid var(--border);
    }
    .name { font-weight: 600 }
  `,
  onMount: (user) => div({ class: 'card' }, span({ class: 'name' }, user.name)),
})
```

The CSS is compiled once per component — not per instance — and shared by every instance, so
`styles` costs the same whether the component renders once or a thousand times. Invalid CSS fails
fast, when the component is defined.

What crosses the style boundary, and how:

- **Custom properties inherit through.** Design tokens declared on `body` (`--accent`, `--text`, …)
  are visible inside every component — that is the theming channel. A theme switch that updates
  variables on `body` restyles every component consuming them.
- **The host element itself** belongs to the parent's tree: page CSS can style the tag
  (`my-app-user-card { grid-area: aside }`), and such rules win over the component's own `:host`
  rules.
- **Nothing else.** Class names, IDs, and element selectors are private to each component — two
  components can both use `.card` without ever colliding, and no page rule needs a namespace.

To share CSS between components, share strings — plain JS constants composed into `styles`:

```js
import { buttonStyles } from './theme.js'

export const editor = component('my-app-editor', {
  styles: `
    ${buttonStyles}
    .row { display: flex; gap: 8px }
  `,
  onMount: () => div({ class: 'row' }, button('save'), button('cancel')),
})
```

Two platform boundaries to design around: form controls inside a component do not participate in a
`<form>` outside it, and `label[for]` / ARIA id references cannot point across the boundary — keep a
control, its label, and its form together inside one component.

## The lifecycle

1. **Call** — `profile({ id: 42 })` creates the `<my-app-profile>` element containing the
   placeholder (if any). Nothing else runs; the host is a cheap, inert node you can compose freely
   while building a detached tree.
2. **Mount** — the moment the host lands in the document (via `mount(...)`, or any DOM insertion),
   `onMount` runs and its output replaces the placeholder. Parents mount before children, top-down.
3. **Unmount** — when the host leaves the document (and is not re-inserted in the same breath), imp
   unsubscribes every state subscription the mount created, then calls `onUnmount`.
4. **Remount** — a removed component that is later re-inserted starts a fresh cycle: placeholder,
   `onMount`, new subscriptions. Each mounted period is one clean mount/cleanup pair.

## Moving components

The lifecycle draws one line: **a component removed and re-inserted within the same synchronous task
has been _moved_; one that stays out of the document longer has been unmounted.** A move keeps the
component alive — `onMount` does not run again, and its DOM (including anything the user typed into
it), its internal variables, and the states it initialized itself all travel with the element:

```js
events: {
  drop: () => targetColumn.append(cardHost),
}
```

What a move _does_ restart is the **subscription layer**: every state the component obtained with
`useState` is re-resolved against the ancestors at its new position, and its bindings update in
place when the value there differs. A card dragged to another column keeps its half-written input
text and switches to the new column's sorting state in the same gesture — continuity comes from the
element, scoping comes from the position.

Details worth knowing:

- **Drag & drop just works.** Native HTML5 drag-and-drop reparents the element on drop — one move.
  Sorting libraries that live-move the element between containers while dragging produce a chain of
  moves; each one only rebinds, so nothing is rebuilt along the way.
- **`view`/`each` regions re-render on a move only if their bound value changed** at the new
  position — compared by content for plain objects and arrays, so two providers holding equal data
  do not cost a rebuild; when the value did change, the region rebuilds exactly as it would on any
  `set`.
- **A missing state at the new position is an error.** If the component uses a state that nothing
  above its new position provides, imp logs an error and keeps the previous binding — initialize
  that name in an ancestor that spans every place the component can land.
- **A later-task re-insert is a remount.** Detaching on drag start and re-appending on drop in a
  different task is a real unmount followed by a fresh mount — which is also the deliberate way to
  force a component to run `onMount` again. Items a keyed `each` preserves keep their instances
  across changes and reorders; items rebuilt by an unkeyed `each` are new instances mounting fresh,
  as always (see **[State](state.md)**).

## Loading states

When `onMount` is async, the placeholder stays visible until the promise resolves — a loading state
with no extra machinery:

```js
export const orders = component('my-app-orders', {
  placeholder: () => div({ class: 'skeleton' }, 'loading orders…'),
  onMount: async ({ customerId }) => {
    const response = await fetch(`/api/customers/${customerId}/orders`)
    const list = await response.json()
    return ul(list.map((order) => li(order.title)))
  },
})
```

If the component is unmounted while the promise is pending, the late result is discarded. If the
promise rejects, the nearest error boundary shows its fallback (below) — without one, the error is
logged and the placeholder stays.

## Error boundaries

Give a component an `onError` entry and it becomes an error boundary: when a component **in its
subtree** (or the boundary itself) throws during mount — synchronously, or by rejecting an async
`onMount` — the boundary renders `onError(error, ...args)` in place of its children instead of
letting a broken screen linger:

```js
export const ordersPane = component('my-app-orders-pane', {
  onMount: () => div(ordersList(), ordersSummary()),
  onError: (error) =>
    div(
      p('Orders are unavailable right now.'),
      p({ class: 'detail' }, error.message),
    ),
})
```

How errors travel:

- A mount failure looks for the **nearest boundary**: the failing component itself if it has
  `onError`, otherwise the closest ancestor component that does. The first boundary wins; boundaries
  further out are not disturbed.
- When the fallback renders, the boundary's previous children — including components that mounted
  fine — unmount normally: their subscriptions end and their `onUnmount` hooks run, exactly as if
  you had swapped them out yourself. The boundary component itself stays mounted, so its own state
  and subscriptions keep working inside the fallback.
- A boundary handles **one error per mounted period** — after the fallback is up, further errors
  pass to the next boundary out (or the console). To retry, remount the boundary (remove it and
  re-insert it in a later task); that starts a fresh mount with a fresh error budget.
- With no boundary anywhere, the behavior is unchanged: the error is logged and the failing
  component keeps its placeholder.

Boundaries catch **mount failures** — which includes failed lazy loads and data fetches in async
`onMount`, the common case. They do not catch errors thrown later in event handlers or state
subscribers; those are isolated and logged where they happen, so one bad handler cannot take down
the page (see **[State](state.md)**).

Put a boundary wherever a subtree can fail independently and the rest of the page should survive it:
around a route's page, a third-party-backed widget, each card in a dashboard.

## Automatic cleanup

Every state subscription created during `onMount` — `watch(fn)`, `text()`, `view()`, `each()`, and
state-bound props, on regular and computed states alike — is tracked and unsubscribed when the
component unmounts. Bindings nested inside a `view`/`each` render function are tracked too, per
rebuild: each re-render unsubscribes the previous render's bindings before creating the new ones.
Swap whole screens in and out; nothing leaks and there is nothing to unhook by hand. Two boundaries
worth knowing:

- State setup happens **before the first `await`** of an async `onMount`. Past it, the mount scope
  is gone: `watch`/`text`/`view`/`each` and state-bound props throw, and an `initState` creates
  page-wide state instead of component-scoped state. Initialize, subscribe, and bind first; then
  `await` your data and `set` it in — `set` and `get` work anywhere (see the pattern in
  **[State](state.md)**). The `imp/state-setup-before-await` lint rule flags setup placed after an
  `await` as you write it.
- `onUnmount` is only for resources imp cannot see — clearing intervals, closing connections,
  destroying non-imp widgets.

Teardown is also **fault-tolerant**: a cleanup step or `onUnmount` that throws is logged and skipped
without stopping the rest — every other subscription and resource is still released, so one broken
hook cannot turn a screen swap into a leak.

## Components and state

Components are also **state scopes**. `initState` called inside `onMount` ties the state to that
component: descendants reach it with `useState`, siblings and outsiders cannot, and when the
component unmounts the state is released with it — remounting starts over from the initial value.
Two instances of the same component each own an independent state under the same name. State
initialized at module scope (outside any component) is page-wide and lives forever instead. The full
rules live in **[State](state.md)**.

```js
const filterButtons = component('my-app-filter-buttons', {
  onMount: () => {
    const filter = useState('myapp.filter')
    return div(
      ['all', 'open', 'done'].map((kind) =>
        button({ events: { click: () => filter.set(kind) } }, kind)
      ),
    )
  },
})

export const taskBoard = component('my-app-task-board', {
  onMount: () => {
    const filter = initState('myapp.filter', 'all')
    return div(filterButtons(), span('showing: ', filter.text()))
  },
})
```

## Practical notes

- **Component internals are private.** `document.querySelector` — like page CSS — stops at the
  component boundary. When a parent needs a live handle on something a child shows — a container it
  appends into, a field it reads — create that node yourself, keep the reference, and pass it as a
  factory argument; the child renders it where it belongs.
- **A component can find its own host** with `event.target.getRootNode().host` — the shadow-DOM
  replacement for `closest('my-app-card')` in handlers that need the component element.
- **Strict content models** (`<table>`, `<select>`): let one component render the whole structure
  rather than splitting rows or options into their own components — a host tag between `<table>` and
  `<tr>` breaks the content model.
- **Defining the same name twice** warns and keeps the first definition, so accidental double
  imports stay harmless.
