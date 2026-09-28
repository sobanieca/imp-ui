# imp-ui - State

imp gives an app shared, reactive state. A component initializes a named state. Every component that
mounts under it uses the same state by name. There is no store to configure, no provider element to
wrap things in, and no re-rendering. A change of state updates only the DOM you bound to it.

## The mental model

- A state is **named**. Every state has a dot-namespaced name, such as `myapp.user`. The name needs
  two or more dot-separated segments. `imp lint` enforces this.
- A state is **owned by a component**. `initState(self, name, initialValue)` inside a component's
  `setup` ties the state to that component. Descendants reach the state with `useState(self, name)`.
  `self` is the first argument of `setup`. See [Components](components.md). The state lives as long
  as the component stays mounted. There is no global scope. State for the lifetime of the app
  belongs in your root component. A call to `initState` with anything but `self` as its first
  argument throws. The `imp/self-first-argument` lint rule catches this while you write it.
- Both calls return the **same helper object**. Whoever holds it can read the state, set it, and
  react to it.
- `get` and `set` work anywhere. You can also **build** a DOM binding anywhere. This covers `text`,
  `view`, `each` and a state-bound prop. A binding stays inert until imp mounts the DOM it belongs
  to. It goes live at that moment, and ends when the component that contains it unmounts. `watch` is
  the one subscription with no DOM, so it takes `self` to end with the component.
- A set is **explicit**. `set(next)` replaces the whole value. Pass the next value, or a function
  that computes it from the current value, the same way `setState` works in React. To change one
  field of an object, spread the rest into a new object.
- A state holds **plain data**: a plain object, an array, a date (a `Date` or any Temporal type), a
  URL, a set of URL search params, a regular expression, or a primitive such as a string, a number
  or a boolean. A function is never a state value. A function passed to `set` always means the
  updater form.
- A value computed **from several states** is a computed state. `computed([a, b], fn)` returns a
  read-only state that follows its sources.

```js
import { component } from 'imp'
import { button, div } from 'imp/html'
import { initState, useState } from 'imp/state'

const profile = component('my-app-profile', {
  setup: (self) => {
    const user = useState(self, 'myapp.user')
    return div(user.text((u) => u.name))
  },
})

export const app = component('my-app-root', {
  setup: (self) => {
    const user = initState(self, 'myapp.user', { name: 'Ada', theme: 'dark' })
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

`initState(self, name, initialValue)` and `useState(self, name)` both return the same helper, with
the six entries below. Call `get` and `set` from anywhere. `text`, `view` and `each` return live
DOM. Build that DOM wherever you want. It activates when a component, or `mount`, places it on the
page. `watch` subscribes directly. With `self` first, it ends with the component. See _Cleanup_. You
can also pass the helper itself as an element **prop value**, to keep that prop live. See _How to
bind a prop_ below.

### `get()`

Returns the current value.

### `set(next)`

Replaces the value and notifies every subscriber, immediately. `next` is either the next value
itself, or a function. imp calls the function with the current value, and its return value becomes
the next value. This is the get-then-set pattern in one call:

```js
const user = useState(self, 'myapp.user')
user.set({ ...user.get(), theme: 'light' })

const count = useState(self, 'myapp.count')
count.set((value) => value + 1)

const todos = useState(self, 'myapp.todos')
todos.set((items) => [...items, newTodo])
```

Use the plain form when the next value arrives from outside, such as a server response, a form field
or a reset. Use the updater form when the next value derives from the current one.

A set of a value that is **structurally equal** to the current value does nothing, in both forms.
imp compares the next value against the current one by content, field by field, even in a nested
object. So a set of an unchanged value notifies no subscriber and repaints nothing, even when it is
a new object. This matters most at the edges of your app: a poll payload or a socket payload that
you deserialize into a fresh object stays quiet when nothing changed, and so does a value rebuilt
from inputs that did not change. imp never tears the bound DOM down and builds it again for an
unchanged value.

Every value you read from a state is **frozen**. This covers the `get()` of a base state, the result
of a computed state, and the value imp hands to `watch`, `view` and `each`. You cannot assign to a
field. An assignment throws. This is why an update to an object or an array spreads into a **new**
object or array. imp blocks a change in place, and keeps no separate copy of the previous value, so
a change in place would be lost with no warning.

A function argument always means "compute the next value". So a function can never be a state value.
This is by design, not a limitation to work around. A state holds plain data: a plain object, an
array, a date, or a primitive. Keep a function, a DOM node and a class instance out of a state. Hold
the data, and derive everything else from it.

A few types that behave like values also count as plain data. imp compares each one by content, not
by reference: a `Date`, compared by its instant; every Temporal type, such as `Temporal.PlainDate`,
`Temporal.Instant`, `Temporal.ZonedDateTime` and `Temporal.Duration`; a `URL`, compared by its full
href; a `URLSearchParams`, compared by its serialized string; and a `RegExp`, compared by its source
and its flags. Two different `Date` objects that hold the same instant count as unchanged. Two
`URL`s with the same href do the same.

imp checks the plain-data rule. When an initial value, or a value passed to `set`, contains anything
else, such as a `Map`, a class instance or a function, imp logs an error. It also logs an error when
the value references itself in a cycle. The error names the state and the path of the problem, such
as `sessions[0].startedAt`. imp still stores the value, so the app keeps running, but such a value
compares by identity, not by content. That silently breaks the content-based change detection that
`set`, `each`, `computed` and a change of provider depend on. Treat this error as a bug to fix, not
as noise.

### `watch(self, fn)` and `watch(fn)`

`watch` reacts to the state. It runs `fn(value)` immediately with the current value, then again
after every `set`. It is the general-purpose hook. Use it to change DOM you already hold, to keep
`localStorage` in step, to drive a chart, or for anything else. Inside a component, pass `self`
first. imp then stops the subscription when the component unmounts:

```js
const themeWatcher = component('my-app-theme-watcher', {
  setup: (self) => {
    const theme = useState(self, 'myapp.theme')
    theme.watch(self, (value) => document.body.setAttribute('data-theme', value))
  },
})
```

A component like this only subscribes and renders nothing. It is a **headless component**, the
pattern for a reaction to state from code that is not UI. Examples are keeping `localStorage` in
step, driving a chart library, and sending analytics. Mount it once, anywhere in scope, and the side
effect runs for as long as it stays mounted.

`watch` differs from the DOM bindings above. It subscribes the moment you call it. Without `self`,
imp registers no cleanup for it. That form is for code outside a component, and it returns a
function that stops the reaction. A bare `watch(fn)` inside `setup` keeps running after the unmount,
and the `imp/watch-with-self` lint rule reports it. See _Cleanup_ below.

Subscribers run in isolation from each other. imp logs a subscriber that throws and skips it. The
other subscribers still run, and the `set` call itself succeeds. A subscriber can also set another
state, which is how changes chain. A loop of states that keep setting each other stops with an
error, so the page does not hang.

### `text(select?)`

`text` returns a live text node. It is the simplest way to show a state in the DOM. With a selector,
it shows the selected part. `null` and `undefined` render as empty text:

```js
span(user.text((u) => u.name))
span(counter.text())
```

### `view(render)`

`view` returns a live region. It renders `render(value)` now, and renders it again whenever you set
the state. It is the general DOM binding. Use it whenever the shape of a fragment depends on the
state, including conditional rendering. `render` can return a node, text, an array, or `null` or
`false` to render nothing:

```js
const session = useState(self, 'myapp.session')

div(session.view((user) => (user ? profileCard(user) : loginForm())))

div(cart.view((items) => items.length === 0 && p('Your cart is empty')))
```

The rendered region keeps its place among its siblings, and imp rebuilds it as a whole on every
change. `render` can bind a state itself. Nest a `text()`, another `view`, or an `each` inside it.
imp creates the inner bindings again on every rebuild and unsubscribes the previous ones, so nothing
leaks.

Build one habit early. **Do not put a free-typing input inside a region that renders again on every
keystroke.** The rebuild replaces the input element, and the focus and the caret go with it. Let the
person type into the DOM, and `set` the state when the value is committed, on a click, a change or a
blur. Keep the input outside the region, or in a keyed `each` item that only changes on a commit. To
show a value that changes often, use `text()`. It updates in place and rebuilds nothing.

### `each(renderItem, getKey?)`

`each` works on a state that holds an array. It renders `renderItem(item, index)` for every item,
and updates the list whenever you set the state. The rendered region keeps its place among its
siblings:

```js
const todos = initState(self, 'myapp.todos', [])

ul(todos.each((todo) => li(todo.title)))

todos.set([...todos.get(), { title: 'ship it' }])
```

With no key, as above, imp rebuilds the whole list on every change. This is the simplest mode, and
it suits a short list that only displays data. Add a **key function**, and `each` becomes precise.
An item whose value did not change keeps its exact DOM elements. imp renders a changed item again,
cleans up a removed item, and, when the order changes, moves the existing elements instead of
building them again. It moves only the elements that are out of order, so a swap of two items moves
two elements, and the rest of the list stays untouched:

```js
ul(todos.each(
  (todo) => li(todo.title, input({ class: 'notes' })),
  (todo) => todo.id,
))
```

Use a key whenever an item holds anything worth keeping: text someone typed into the input of an
item, the focus, a scroll position, a CSS transition, or the state of a mounted component. A key
must be unique per item, and stable across sets. Use an `id` from your data, never the array index.
Keeping an unchanged item's DOM has two consequences:

- imp compares an item **by content**, so the usual spread update does the correct thing. Replacing
  an item with an equal copy renders nothing again. Changing one field renders that item again, and
  no other.
- A changed item keeps the focus. When the focus was inside the item, imp puts it back on the
  element at the same place in the new DOM. So a "done" button in a row keeps the focus after a
  click that changes the row, and a keyboard user does not lose their place in the list.
- A removed item passes the focus on. When the focus was inside an item that goes away, imp moves it
  to the same place in the item that now holds its position, or in the last item. So a "delete"
  button in a row hands the focus to the "delete" button of the next row.
- With a key, derive the DOM of the item from the item itself, not from the `index` argument. imp
  does not render a kept item again when its position changes.

`renderItem` can return a node, text, an array, or `null` or `false` to skip an item. These are the
same child values an element factory accepts. `each` expects the state value to be an array. `null`
and `undefined` count as an empty array. imp logs an error for any other value and renders nothing.

## How to bind a prop

The entries of the helper render **content**. For an element **prop**, such as `class`, `style`, an
attribute or a property, pass a state itself as the prop value. The prop then stays live. imp
applies it when it builds the element, and again on every `set`. Pass the handle, not `get()`. A
`get()` copies the value once, and the `imp/no-get-in-binding` lint rule reports it:

```js
const busy = useState(self, 'myapp.busy')

button('Save', { disabled: busy })
```

Every prop form keeps its usual meaning, and becomes reactive. A bound `class` takes the same
string, array or object of toggles as a static `class`. imp removes a bound attribute when its value
becomes `null` or `undefined`. Other forms follow the same pattern:

```js
div({ class: theme })
li({ 'aria-selected': isSelected })
```

More often the value of the prop _derives_ from a state, instead of being a state. `computed` is for
deriving. A computed state binds the same way:

```js
const theme = useState(self, 'myapp.theme')

div({ class: computed([theme], (value) => `card card--${value}`) })

const rowClass = computed([selection], (selected) => ({ row: true, selected }))
tr({ class: rowClass }, ...cells)
```

A bound `class` or `style` **owns** that prop. Each new value replaces the previous value as a
whole, so imp removes a class name, or a style entry, that the new value no longer contains. Do not
split the `class` of one element between a binding and other code that changes `classList`. Put
everything the class depends on into the bound value.

Know two boundaries:

- A bound prop is a subscription, like a DOM binding. Build the element wherever you want. The
  binding goes live when the element mounts, and ends with the component that contains it. See
  _Cleanup_.
- The binding is strictly **one way**, from the state to the DOM. A bound `value` on an input shows
  the state, but does not write a keystroke back. Set the state from an event when the value is
  committed, and let the binding carry it the other way.

imp catches one mistake for you. The state goes in as a **prop value**, not as an argument of its
own. `div(count)` looks correct, but it means nothing. Render it with `count.text()` instead. imp
reports the mistake and skips the value, and the `imp/no-state-as-child` lint rule catches it while
you write it.

## Computed states

Sometimes a view needs one value computed from several states. Examples are a full name from two
fields, and a status line from two lists. `computed(states, compute)` combines them:

```js
import { component } from 'imp'
import { span } from 'imp/html'
import { computed, initState } from 'imp/state'

export const nameBadge = component('my-app-name-badge', {
  setup: (self) => {
    const first = initState(self, 'myapp.first', 'Ada')
    const last = initState(self, 'myapp.last', 'Lovelace')
    const fullName = computed([first, last], (f, l) => `${f} ${l}`)
    return span(fullName.text())
  },
})
```

The result is a **read-only state**. It has `get()`, `watch(fn)`, `text(select?)`, `view(render)`
and `each(renderItem)`. A call to `set` on it throws. To change it, set the source states. Write
`compute` as a pure function of the values it receives. imp calls it when a source changes, and
reuses the result in between, so anything it reads beyond its arguments can go stale. It notifies
only when the computed result changes, compared by **content**. So a `compute` that builds a fresh
object or array each time stays quiet, as long as what it built is the same. A computation from a
single state is one way to watch part of a larger state, without reacting to an unrelated change:

```js
const theme = computed([user], (u) => u.theme)
theme.watch((value) => document.body.setAttribute('data-theme', value)) // runs only when the theme changes
```

A computed state can compute again when you need another step. `each` works on a computed state too,
so a derived list is one `computed` away:

```js
const todos = initState(self, 'myapp.todos', [])
const remaining = computed([todos], (items) => items.filter((item) => !item.done))

ul(remaining.each((todo) => li(todo.title)))
```

`filter` builds a new array every time it runs. The comparison is by content, so this list reacts
only when the remaining todos really differ. Editing a done todo leaves the list as it is.

Keep three things in mind here:

- A computed state is a **local value**, not a registered name. `useState` does not find it. Hold
  it, pass it around, or create it again where you need it. Computing is cheap.
- A source notifies **on its own**. Two `set` calls one after the other recompute and notify the
  computed state twice, and the first notification sees the combination in between. Values that must
  always change together belong in **one** state object, set in one call. Compute over states that
  vary on their own.
- This is deliberately the **whole composition story**. There is no operator, no async pipeline and
  no scheduler. When you stack a computed state on a computed state, that is a sign to restructure
  the source states. `computed` produces a result that is ready to display, at the edge. It does not
  build a dataflow graph.

## How to update more than one state

imp has no `batch()`. Every `set` notifies immediately. imp never paints a half-updated frame,
because the browser paints only after your code finishes. But between two `set` calls, one after the
other, a computed state or a `watch` subscriber can see the first change without the second. A bound
region also rebuilds once per `set`. Three patterns cover this, in order of preference.

**Values that change together are one state.** When two values must stay consistent, they are one
piece of data: one object, one `set`, one notification, and no combination in between ever exists:

```js
const list = initState(self, 'myapp.list', { items: [], selected: null })

list.set((current) => ({ ...current, items: [], selected: null }))
```

**Order the sets so that every step is valid.** When two states really are independent, clear the
dependent one first. Call `selection.set(null)` before `items.set([])`. Each snapshot in between is
then a legal state. The cost is one recompute you do not need, never a broken one.

**Coalesce at an expensive point with a derived state.** When several states feed one costly
binding, such as a large `view` or a chart redraw, add a display state and a headless component. The
component reacts to all the sources, and sets the display state once per burst:

```js
const chartFeed = component('my-app-chart-feed', {
  setup: (self) => {
    const chartData = useState(self, 'myapp.chartData')
    const items = useState(self, 'myapp.items')
    const filter = useState(self, 'myapp.filter')
    let scheduled = false
    const refresh = () => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        chartData.set(buildChartData(items.get(), filter.get()))
      })
    }
    items.watch(self, refresh)
    filter.watch(self, refresh)
  },
})
```

Any number of synchronous `set` calls collapses into a single `chartData.set` at the end of the
task. The trade is that `chartData` is one microtask behind its sources. Keep this pattern at the
display edge, and use it only when the first two patterns do not fit.

## Cleanup

imp cleans a subscription up **automatically**. Every subscription has an owner, and where its DOM
lands decides the owner. `text()`, `view()`, `each()` and a state-bound prop are inert when you
build them. This holds for a regular state and for a computed state. They subscribe the moment imp
mounts the DOM they belong to, as the output of a component or through `mount(...)`. The component
that contains them owns them. A binding that lands in the output of `setup` ends when the component
unmounts. A binding rendered inside a `view` or `each` region belongs to that region, and ends when
the region renders again, or when the component unmounts, whichever comes first. See
[Components](components.md). A binding you mount with `mount(...)` ends when you call the function
`mount` returned, so you can swap whole screens in and out. Nothing leaks, and there is nothing to
disconnect. The other side of this rule: DOM you insert into the page yourself, without imp, never
activates its bindings. Let a component or `mount(...)` place it.

`watch` is the exception, because it has no DOM to land in. It subscribes immediately, so it takes
`self` to find its owner. `watch(self, fn)` ends when the component unmounts, like a binding.
`watch(fn)` without `self` registers no cleanup. It is for code outside a component, and it returns
the function that stops it. A `watch(self, fn)` inside a `view` or `each` render function ends with
the mount, not with the region, so it accumulates on every rebuild. Prefer a DOM binding wherever
one fits.

Reading and writing are free. `get()` and `set(next)` work anywhere, at any time. Resolution goes
through `self`, so it works at any point in `setup`, before or after an `await`. An async `setup`
needs no extra ceremony:

```js
const orderList = component('my-app-order-list', {
  loading: () => div('loading orders...'),
  setup: async (self, { id }) => {
    const loaded = await fetch(`/api/orders?user=${id}`).then((response) => response.json())
    const orders = initState(self, 'myapp.orders', loaded)
    return ul(orders.each((order) => li(order.title), (order) => order.id))
  },
})
```

A binding you build after the `await` goes live when the resolved DOM mounts. One case throws. When
the component unmounts while `setup` still awaits, a later `initState` or `useState` has no mount to
resolve through, and the error says the host has left the page. An async `setup` that can outlive
its host checks `self.abortSignal.aborted` after the `await`, or hands `self.abortSignal` to the
awaited call. The `imp/abort-check-after-await` lint rule reports a resolution after an `await` that
does neither.

## Scope and lifetime

Every state belongs to the component that initializes it. The component you initialize in decides
who sees the state, and how long it lives.

- The **subtree** of the state is its audience. A component that mounts under the initializing
  component finds the state with `useState(self, name)`. A component elsewhere on the page does not.
  When the component unmounts, imp releases the state with it, and a later remount starts again from
  the initial value. Two instances of the same component each own an **independent** state under the
  same name, so a gallery of widgets needs no juggling of names.
- **State for the lifetime of the app**, such as the session and the theme, belongs in your **root
  component**. That component covers the whole app and never unmounts. There is no separate global
  scope to learn, and none to leak into. One rule covers everything: `initState` without the `self`
  of a mounting component throws.

Give every state the **narrowest scope that covers its readers**. Give each screen-sized piece of
your app a root component that owns the states of that screen. Swapping screens then replaces one
subtree with another, and releases everything the old screen created: its states, every
subscription, and, through `onRemove`, its timers and connections.

A component can also initialize a name that an ancestor already provides. Its subtree then sees the
nearer state, which overrides the state of the ancestor, the same way a nested CSS rule wins over an
outer rule.

The helper object is self-contained. Whoever holds it can call `get`, `set` and subscribe, wherever
they sit in the tree. So when you mount DOM **outside** the subtree of the provider, such as a
second `mount` into another element of the page, `useState` there cannot find the name. The owning
component must pass its helper down as an argument, and the receiver binds it as usual. The overlays
of the standard library never leave their subtree. They open where they render, in the top layer.

The withdrawal of a contribution is the one lookup that happens after the mount. `onRemove` runs
after the component has left the page, so nothing above it can answer. Instead, `self` remembers
what the mount resolved. `useState(self, name)` in `onRemove` returns the handle that `setup`
resolved, and a name that `setup` never resolved throws. The `imp/on-remove-through-self` lint rule
reports such a name. See [Components](components.md).

## A state that has not loaded yet

`initState(self, name)` with no initial value starts the state at `undefined`. imp has no separate
loading phase. `undefined` is an ordinary value, and your app decides to read it as "not loaded
yet":

```js
setup: (self) => {
  const session = initState(self, 'myapp.session') // undefined - nothing known yet
  const api = initHttpClient(self, 'myapp.api', { baseUrl: env.API_URL })
  api.get('/session')
    .then((user) => session.set(user)) //       null when nobody is signed in
    .catch(() => session.set(null))
  return div(shell())
},
```

This gives you three readable answers in place of two. `undefined` means the value is still loading.
`null` means the value is loaded and nobody is signed in. A value is a value, so keep the
distinction. Much of the code after this point depends on the difference between "not known yet" and
"known, and nothing". [Route guards](routing.md) are the clearest example: a guard returns `wait`
for `undefined`, and redirects for `null`.

A binding works normally on a state that has not loaded. imp calls `view` and `text` with
`undefined`, so branch on it where the difference matters:

```js
div(session.view((user) => (user === undefined ? spinner() : user ? profile(user) : signInLink())))
```

## Rules for initialization and lookup

- **Initialize first, use after.** `useState(self, name)` throws when nothing in scope has
  initialized that name. The order follows the mount: the `setup` of a parent runs before its
  children mount, so a child can always `useState` what its ancestors initialized.
- **Initialize once per scope.** A call to `initState` with a name the same scope already provides
  throws. Each scope initializes a name exactly once. Reach an existing state with
  `useState(self,
  name)` instead.
- **The position decides, also after a move.** When you move a mounted component, imp resolves its
  `useState` bindings again, against the ancestors at its new position. A state the component
  initialized itself travels with it. See _Moving components_ in [Components](components.md).
- **Use a namespace anyway.** The scope keeps unrelated states apart. A clear prefix, such as
  `myapp....`, keeps names honest between your own components. A name in the root component covers
  the whole app, and nothing else protects it.

Inside imp, the lookup travels as a DOM event. It bubbles up from the host of the component that
asks for the state, `self.host`, and the nearest ancestor that provides that name answers. The
handshake travels through the DOM, not through a JavaScript registry. So two parts of a page that
load independently, such as two widgets built separately, share a state as long as they share the
DOM. The event also crosses a shadow root, so it passes through the shadow roots imp components
render into, at any depth. It also works for a component embedded inside the shadow DOM of another
library.

## The naming rule

A state name needs a namespace: at least one dot, and no empty segment. `myapp.user` is valid.
`user`, `.user` and `user.` are not. A runtime call throws on a bad name. The
`imp/state-name-namespace` lint rule catches a literal name while you write it. See
[Linting](lint.md).

## Debugging

Set the `IMP_LOG_LEVEL` environment value to `debug`, and imp traces state activity in the browser
console. It logs every read and every set, including a set it skipped because the value was
unchanged or structurally equal. It logs every subscription that attaches and detaches, and every
notification. See [Logging](logging.md).
