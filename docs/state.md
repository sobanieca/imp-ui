# imp-ui — State

Shared, reactive state for imp apps. A component initializes a named state; every component mounted
under it picks the same state up by name. There is no store to configure, no provider element to
wrap things in, and no re-rendering — state changes update exactly the DOM you bound to them.

## Mental model

- State is **named**: every state has a dot-namespaced name like `myapp.user`. The namespace is
  mandatory (at least two dot-separated segments) — `imp lint` enforces it.
- State is **scoped to who initializes it**. `initState(name, initialValue)` inside a component's
  `onMount` ties the state to that component: its descendants reach it with `useState(name)`, and it
  lives as long as the component stays mounted. `initState` at module scope (outside any component)
  makes the state page-wide and permanent.
- Both calls return the **same helper object**. Whoever holds it can read, set, and react to the
  state.
- Reading and writing (`get`/`set`) work anywhere; **subscribing** (`watch`/`text`/`view`/`each`) is
  a component activity — it happens inside `onMount` and ends when the component unmounts.
- Setting state is **explicit**: `set(next)` replaces the whole value — pass the next value, or a
  function computing it from the current one, exactly like React's `setState`. To change one field
  of an object, spread the rest into a new object.
- State holds **plain data**: plain objects, arrays, and primitives like strings, numbers, and
  booleans. A function is never a state value — passing one to `set` always means the updater form.
- A value computed **from several states** is a computed state: `computed([a, b], fn)` returns a
  read-only state that follows its sources.

```js
import { button, component, div, initState, useState } from 'imp'

const profile = component('my-app-profile', {
  onMount: () => {
    const user = useState('myapp.user')
    return div(user.text((u) => u.name))
  },
})

export const app = component('my-app-root', {
  onMount: () => {
    const user = initState('myapp.user', { name: 'Ada', theme: 'dark' })
    return div(
      profile(),
      button('Rename', {
        events: { click: () => user.set({ ...user.get(), name: 'Grace' }) },
      }),
    )
  },
})
```

## The state helper

`initState(name, initialValue)` and `useState(name)` both return a helper with the six entries
below. `get` and `set` can be called from anywhere; `watch`, `text`, `view`, and `each` subscribe,
and subscribing happens inside a component's `onMount` — the snippets below all live there (see
_Cleanup_).

### `get()`

Returns the current value.

### `set(next)`

Replaces the value and notifies every subscriber, synchronously. `next` is either the next value
itself, or a **function** — then it is called with the current value and what it returns becomes the
next value, the get-then-set idiom in a single call:

```js
const user = useState('myapp.user')
user.set({ ...user.get(), theme: 'light' })

const count = useState('myapp.count')
count.set((value) => value + 1)

const todos = useState('myapp.todos')
todos.set((items) => [...items, newTodo])
```

Use the plain form when the next value arrives from outside — a server response, a form field, a
reset — and the updater form whenever the next value derives from the current one.

Setting a value identical to the current one (same reference, `Object.is`) is a no-op, in both forms
— which is why object and array updates spread into a **new** object or array.

Because a function argument always means "compute the next value", a function can never itself be a
state value. That is by design, not a corner case to work around: state holds **plain data** — plain
objects, arrays, and primitives. Keep functions, DOM nodes, and class instances out of state; hold
the data and derive everything else from it.

### `watch(fn)`

Reacts to the state: runs `fn(value)` immediately with the current value, then again after every
`set`. This is the general-purpose hook — use it to mutate DOM you already hold, sync
`localStorage`, drive a chart, anything:

```js
const themeWatcher = component('my-app-theme-watcher', {
  onMount: () => {
    const theme = useState('myapp.theme')
    theme.watch((value) => document.body.setAttribute('data-theme', value))
  },
})
```

A component like this — one that only subscribes and renders nothing — is a **headless component**,
and it is the pattern for reacting to state from non-UI code: syncing `localStorage`, driving a
chart library, sending analytics. Mount it once anywhere in scope and the side effect runs for as
long as it stays mounted.

Like every subscription, `watch` lives inside a component's `onMount` (see _Cleanup_ below) and ends
with the component. It returns an unsubscribe function for the rare case you want to stop reacting
while the component stays mounted. Subscribers are isolated from each other: one that throws is
logged and skipped while the rest still run, and the `set` call itself succeeds. A subscriber may
also set other states — that is how changes chain — but a loop of states endlessly setting each
other is cut off with an error instead of hanging the page.

### `text(select?)`

Returns a live text node — the simplest way to show state in the DOM. With a selector, it shows the
selected part; `null`/`undefined` render as empty text:

```js
span(user.text((u) => u.name))
span(counter.text())
```

### `view(render)`

Returns a live region: renders `render(value)` now and re-renders it whenever the state is set. This
is the general DOM binding — reach for it whenever a fragment's shape depends on the state,
conditional rendering included. `render` may return a node, text, an array, or `null`/`false` to
render nothing:

```js
const session = useState('myapp.session')

div(session.view((user) => (user ? profileCard(user) : loginForm())))

div(cart.view((items) => items.length === 0 && p('Your cart is empty')))
```

The rendered region keeps its place among surrounding siblings and is rebuilt whole on every change.
`render` may itself bind state — nest a `text()`, another `view`, or an `each` inside it; those
inner bindings are re-created on every rebuild and the previous ones unsubscribed, so nothing leaks.

One habit to build early: **don't put a free-typing input inside a region that re-renders on its
every keystroke.** The rebuild replaces the input element, and focus and the caret go with it. Let
the user type into the DOM and `set` the state when the value is committed — on click, change, or
blur; keep the input outside the region, or in a keyed `each` item that only changes on commit. For
showing a value that changes often, `text()` updates in place without rebuilding anything.

### `each(renderItem, getKey?)`

For array state: renders `renderItem(item, index)` for every item and updates the list whenever the
state is set. The rendered region keeps its place among surrounding siblings:

```js
const todos = initState('myapp.todos', [])

ul(todos.each((todo) => li(todo.title)))

todos.set([...todos.get(), { title: 'ship it' }])
```

Called like that — without a key — the whole list is rebuilt on every change. That is the simplest
mode and fine for short, display-only lists. Add a **key function** and `each` gets surgical: items
whose value did not change keep their exact DOM elements, changed items are re-rendered, removed
items are cleaned up, and reorders move the existing elements instead of rebuilding them:

```js
ul(todos.each(
  (todo) => li(todo.title, input({ class: 'notes' })),
  (todo) => todo.id,
))
```

Use a key whenever items hold anything worth preserving — text someone typed into an item's input,
focus, scroll position, a CSS transition, or a mounted component's own state. Keys must be unique
per item and stable across sets: an `id` from your data, never the array index. Two consequences of
"unchanged items keep their DOM":

- Items are compared **by content**, so the usual spread updates do the right thing: replacing an
  item with an equal copy re-renders nothing, changing one field re-renders just that item.
- With a key, derive the item's DOM from the item itself, not from the `index` argument — a kept
  item is not re-rendered when its position changes.

`renderItem` may return a node, text, an array, or `null`/`false` to skip an item — the same child
values element factories accept. `each` expects the state value to be an array (`null` and
`undefined` count as an empty one); any other value logs an error and renders nothing.

## Computed states

Sometimes a view needs one value computed from several states — a full name from two fields, a
status line from two lists. `computed(states, compute)` combines them:

```js
import { component, computed, initState, span } from 'imp'

const first = initState('myapp.first', 'Ada')
const last = initState('myapp.last', 'Lovelace')

export const nameBadge = component('my-app-name-badge', {
  onMount: () => {
    const fullName = computed([first, last], (f, l) => `${f} ${l}`)
    return span(fullName.text())
  },
})
```

The result is a **read-only state**: it has `get()`, `watch(fn)`, `text(select?)`, `view(render)`,
and `each(renderItem)`, but calling `set` on it throws — to change it, set the source states. It
notifies only when the computed outcome actually changes (`Object.is`), so computing from a single
state is also how you watch one part of a bigger state without reacting to unrelated changes:

```js
const theme = computed([user], (u) => u.theme)
theme.watch((value) => document.body.setAttribute('data-theme', value)) // runs only when the theme changes
```

Computed states compute again if you need another step, and `each` works on them too — a derived
list is one `computed` away:

```js
const todos = initState('myapp.todos', [])
const remaining = computed([todos], (items) => items.filter((item) => !item.done))

ul(remaining.each((todo) => li(todo.title)))
```

Two things to know about the balance here:

- A computed state is a **local value**, not a registered name — `useState` will not find it. Hold
  on to it, pass it around, or simply re-create it where needed; computing is cheap.
- Sources notify **one at a time**: setting two source states back to back recomputes and notifies
  the computed state twice, and the first notification sees the in-between combination. Values that
  must always change together belong in **one** state object, set in one call — compute over states
  that vary independently.
- This is deliberately the **whole composition story** — there are no operators, no async pipelines,
  no schedulers. If you find yourself stacking computed states on computed states, that is a sign to
  restructure the source states; `computed` is for computing a display-ready outcome at the edge,
  not for building a dataflow graph.

## Updating more than one state

There is no `batch()` in imp — every `set` notifies immediately. That never paints a half-updated
frame (the browser paints only after your code finishes), but between two back-to-back `set`s a
computed state or a `watch` subscriber can observe the first change without the second, and a bound
region rebuilds once per `set`. Three patterns cover this, in order of preference:

**Values that change together are one state.** If two values must stay consistent, they are one
piece of data — one object, one `set`, one notification, and no in-between combination ever exists:

```js
const list = initState('myapp.list', { items: [], selected: null })

list.set((current) => ({ ...current, items: [], selected: null }))
```

**Order the sets so every step is valid.** When two states really are independent, clear the
dependent one first (`selection.set(null)` before `items.set([])`): each intermediate snapshot is
then a legal state — the cost is a redundant recompute, never a broken one.

**Coalesce at an expensive edge with a derived state.** When several states feed one costly binding
— a large `view`, a chart redraw — introduce a display state and a headless component that reacts to
all the sources and sets it once per burst:

```js
const chartData = initState('myapp.chartData', null)

const chartFeed = component('my-app-chart-feed', {
  onMount: () => {
    const items = useState('myapp.items')
    const filter = useState('myapp.filter')
    let scheduled = false
    const refresh = () => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        chartData.set(buildChartData(items.get(), filter.get()))
      })
    }
    items.watch(refresh)
    filter.watch(refresh)
  },
})
```

Any number of synchronous `set`s collapses into a single `chartData.set` at the end of the task. The
trade is that `chartData` lags its sources by a microtask — keep the pattern at the display edge,
and reach for it only when the first two patterns don't fit.

## Cleanup

Subscriptions are cleaned up **automatically** — and that works because every subscription has an
owner. `watch(fn)`, `text()`, `view()`, and `each()` (on regular and computed states alike) only
work while a component is mounting or inside a `view`/`each` render function: called anywhere else —
module scope, an event handler, after an `await` in an async `onMount` — they throw. A subscription
made in `onMount` belongs to the component and ends when it unmounts; one made inside a
`view`/`each` render belongs to that region and ends when the region re-renders (or the component
unmounts, whichever comes first — see **[Components](components.md)**). Swap whole screens in and
out; nothing leaks and there is nothing to unhook.

Reading and writing are free: `get()` and `set(next)` work anywhere, any time — event handlers,
timers, code after an `await`. So in an async `onMount`, subscribe first and fill the data in later:

```js
const orderList = component('my-app-order-list', {
  onMount: async ({ id }) => {
    const orders = initState('myapp.orders', [])
    const view = ul(orders.each((order) => li(order.title), (order) => order.id))
    orders.set(await fetch(`/api/orders?user=${id}`).then((response) => response.json()))
    return view
  },
})
```

The `imp/state-setup-before-await` lint rule flags `initState`/`useState` calls placed after an
`await` in an async `onMount` as you write them, before anything runs (see **[Linting](lint.md)**).

## Scope and lifetime

Where you call `initState` decides who sees the state and how long it lives:

- **Inside a component's `onMount`** — the state belongs to that component. Components mounted in
  its subtree find it with `useState`; components elsewhere on the page do not. When the component
  unmounts, the state is released with it, and a later remount starts over from the initial value.
  Two instances of the same component each own an **independent** state under the same name — a
  gallery of widgets needs no name juggling.
- **At module scope** (outside any component) — the state is page-wide and lives for the page, no
  matter which components come and go.

Aim every state at the **narrowest scope that spans its readers**, and give each screen-sized piece
of your app a root component that owns the screen's states. Swapping screens — replacing one subtree
with another — then releases everything the old screen created: its states, every subscription, and
(through `onUnmount`) timers and connections. Reserve page-wide state for true app-lifetime data —
the session, the theme — because it is never released.

A component may also initialize a name an ancestor already provides: its subtree then sees the
nearer state, shadowing the ancestor's — the same way a nested CSS rule wins over an outer one.

The helper object itself is self-contained: whoever holds it can `get`, `set`, and subscribe,
regardless of where they sit in the tree. So when some DOM renders **outside** the provider's
subtree — an overlay or dialog appended to `document.body`, say — `useState` there cannot find the
name, but the owning component can simply pass its helper down as an argument, and the receiver
subscribes as usual.

## Initialization and lookup rules

- **Init first, use after.** `useState(name)` throws if nothing in scope has initialized that name.
  Order follows mounting: a parent's `onMount` runs before its children mount, so children can
  always `useState` what their ancestors initialized.
- **Init once per scope.** Calling `initState` with a name the same scope already provides throws —
  each scope initializes a name exactly once. Reach an existing state with `useState(name)` instead.
- **Position decides, even after a move.** Moving a mounted component re-resolves its `useState`
  bindings against the ancestors at its new position, while states it initialized itself travel with
  it — see _Moving components_ in **[Components](components.md)**.
- **Namespace anyway.** Scoping keeps unrelated states apart, but a clear prefix (`myapp.…`) keeps
  names honest between your own components — and page-wide names have nothing else protecting them.

Under the hood the lookup travels as a DOM event (`StateSubscription`) that bubbles up from the
component asking for the state; the nearest ancestor providing that name answers, and the document
answers for page-wide states. Because the handshake rides the DOM rather than a JavaScript registry,
independently loaded parts of a page (say, two separately built widgets) share state as long as they
share the DOM — and the event crosses shadow roots, so it passes through the shadow roots imp
components render into, at any depth, and still works for a component embedded inside another
library's shadow DOM.

## Naming rule

State names need a namespace: at least one dot, no empty segments — `myapp.user` is valid, `user`,
`.user`, and `user.` are not. Runtime calls throw on bad names, and the `imp/state-name-namespace`
lint rule catches literal names as you write them (see **[Linting](lint.md)**).
