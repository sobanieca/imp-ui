# imp-ui - Components

A component is how imp gives your UI a lifecycle. An imp component is a real web component. It is a
custom element with a name that you choose, and its logic runs **after imp mounts it on the page**.
Everything else builds on that one guarantee. Inside a component you can subscribe to a state,
measure the layout, focus a field, and reach an ancestor. When your code runs, the component is
already in the document.

Every component renders into its own **shadow root**. So its DOM and its CSS are fully isolated.
What happens inside a component stays inside. Everything that crosses the boundary, such as state,
an error and a theming variable, crosses through a declared channel.

This page is about how to write your own component. imp also ships ready-made components, such as a
button, a heading and text, built exactly this way. See
**[Standard components](std-components.md)**. A component of yours fits next to them when it follows
the same rules for the theme, the text direction, the wording and accessibility. See
**[Custom components](custom-components.md)**.

## Two layers

imp renders with two layers, and each one does one thing:

- **An element factory**, such as `div`, `span` and `button`, comes from `imp/html`. A factory is
  eager and single-use. It returns a plain DOM node the moment when you call it. It has no lifecycle
  and no magic. A factory is how you _build_ DOM. See **[Rendering](rendering.md)**.
- **A component** owns _time_: the mount, the loading and the unmount. You define one with
  `component(name, definition)`, which comes from `imp`. You get back a factory, and you call it
  like any other function.

```js
import { component } from 'imp'
import { div, span } from 'imp/html'
import { useState } from 'imp/state'

export const profile = component('my-app-profile', {
  setup: (self) => {
    const user = useState(self, 'myapp.user')
    return div(span(user.text((u) => u.name)))
  },
})
```

A call to it looks exactly like a call to an element factory:

```js
div(header(), profile(), footer())
```

## Naming

The name of the component **is its HTML tag**. `profile()` renders as `<my-app-profile>` in the
document, and you see it in the element inspector of the browser. A name must be lowercase, and it
must hold at least one dash. Write `my-app-profile`, not `profile`. That is what makes the name a
valid custom element name. The prefix is also the namespace of your app, exactly like a state name
such as `myapp.user`. The `imp/component-name` lint rule enforces this while you type, see
**[Linting](lint.md)**, and a bad name throws at runtime.

The host element takes no layout space of its own. Every component defaults to `display: contents`.
So the output of your component takes part in the flex, grid or flow layout of the parent, as if the
host were not there. When you _want_ the host to be a styled box, set `:host { display: block }`, or
another value, in the `styles` of the component. You can also style the tag from page CSS. A rule
from outside that targets the tag always wins for the host element itself.

## The definition object

`component(name, definition)` takes the name and an object with up to six entries. A key that
returns DOM is a noun. A key named `on*` is an effect, and imp discards what it returns.

### `setup(self, ...args)` - required

`setup` holds the whole logic of the component. Its first parameter is **`self`**, see _self_ below.
After that it receives, without a change, the arguments of the factory call. So
`profile({ id: 42 })` gives `setup(self, { id: 42 })`. It returns the DOM of the component, which is
a node, a string, an array of children, or nothing. It runs when the browser **connects the
component to the document**, and a parent runs before its children. So everything that an ancestor
set up, such as a state, is already there.

`setup` can also be `async`. See _Loading states_ below.

### `loading(...args)` - optional

`loading` returns what the component shows **whenever its real content is not there**. It is the
content of the host at rest, not a loading prop. It covers three moments in the life of the
component:

1. **Before the mount.** imp renders the loading content into the host the instant when you call the
   factory. So a component that you compose into a detached tree is never an empty box.
2. **While an async `setup` runs.** The loading content stays until the promise resolves, and the
   output of `setup` replaces it. You use this most often. It is the built-in loading skeleton.
3. **When a removed host mounts again.** When the same element is inserted again after it left the
   document, imp renders the loading content first. So the remount starts from the same content at
   rest as before, and not from the stale DOM of the previous mount. When you remove a component for
   good, imp only empties its content. It builds the loading content again only for a host that
   comes back.

`loading` receives the arguments of the factory call, but no `self`. It runs outside a live mount,
so there is no mount to give it. Keep it static: plain DOM, and no state subscription.

```js
const card = component('my-app-card', {
  loading: () => div({ class: 'skeleton' }),
  setup: async () => renderCard(await loadCard()),
})
```

A synchronous `setup` replaces the loading content before the paint. So a `loading` with a
synchronous `setup` is nearly always a mistake, because nobody can see it. The
`imp/loading-with-async-setup` lint rule reports it while you write it, and imp warns when it sees
this at runtime. A component whose `loading` rendered something, and whose `setup` returns
synchronously, logs a warning once. The warning tells you to make `setup` async, or to return a
promise, when you want the loading content to show. It also tells you that you can remove `loading`.
A `loading` that returns nothing for the arguments that it got, which is `null`, `undefined` or an
empty array, had nothing to show. So it never warns. `loading` is useful only when `setup` returns a
promise. That covers a `setup` written as `async`, and a `setup` that returns a promise, such as
`setup: () => loadCard().then(renderCard)`. Both keep the loading content up until the promise
settles, and neither one warns.

Loading content is **content at rest, not live content**. imp builds it before the component mounts.
So a reactive construct never goes live inside it. That covers `state.text()`, `state.view()`,
`state.each()` and a prop bound to a state handle. They render empty and stay empty. `initState` and
`useState` need `self`, which `loading` does not get. A handle that the parent passed in as an
argument gets past that check. So imp logs a warning once, and names the component, when it sees a
binding in the output of `loading`. Pass a plain value instead, and keep the live parts in `setup`.
The `imp/no-self-in-loading` lint rule reports a resolution and a binding inside `loading`.

### `error(self, error, ...args)` - optional

`error` makes the component an **error boundary**. It runs when its own mount fails, or when a
component anywhere in its subtree fails to mount. It receives `self`, the error, and the arguments
of the factory call. Its output replaces the content of the component. See _Error boundaries_ below.

### `onMount(self, ...args)` - optional

`onMount` runs after imp places the output of `setup` in the shadow root, and after the browser has
laid it out. So focus, measurement, `scrollIntoView` and the setup of an animation are all safe
there. See _How to run code after imp places the DOM_ below.

### `onRemove(self, ...args)` - optional

`onRemove` runs after the browser removes the component from the document, before imp empties the
shadow root. Use it for the cleanup that imp cannot do for you, such as a timer, a socket or a
third-party widget. It receives the **same `self`** as its `setup`, and then the arguments of the
factory call. So anything that `setup` stored on `self`, such as a timer handle, is there to clean
up. `onRemove` can be `async`. imp awaits it, and logs a rejection without a break in the rest of
the unmount.

There is one edge case, and it applies only when the same host can **mount again**. Sometimes
`onRemove` tears down a **shared** resource, such as a socket, a document-level listener or a global
timer. When that cleanup is async, check `self.abortSignal.aborted` after each `await`, before you
touch the resource. A remount can already have taken the resource again. See _self_ below. A
resource stored on `self` itself never needs this check, because each mount gets its own.

### `styles` - optional

`styles` is the CSS of the component, as a string. It applies inside this component only. See
_Styling_ below.

## self

`setup`, `error`, `onMount` and `onRemove` all receive **`self`** as their first argument. `self` is
what a component knows about itself during one mount. There is one `self` per mounted component, and
imp creates a new one each time when the component mounts. Name the parameter `self`. It gives you
three things:

- **`self.host`** is the element of the component. That is the `<my-app-profile>` tag in the
  document. Its shadow root, where your output renders, is `self.host.shadowRoot`. After the mount
  you can query it, measure it, or hand a node to a third-party library.
- **`self.abortSignal`** is a standard
  [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) tied to this one
  mounted lifetime. imp aborts it when the component unmounts, after `onRemove` has finished, and
  the moment when a remount replaces it. A move keeps it. Hand it to `fetch` or `addEventListener`
  in `setup`, to cancel that work when the component goes away. Or check `self.abortSignal.aborted`
  in an async `onRemove`, before you tear down a _shared_ resource that a remount can have taken
  again.
- **Any property that you assign.** `self` is a plain object that you can write to. That is the
  clean way to pass a node or a resource from `setup` to `onMount` and `onRemove`.

`self` is also the key that resolves a resource through the DOM. `initState(self, name, value)` and
`useState(self, name)` from `imp/state`, and `initHttpClient(self, name, options)` and
`useHttpClient(self, name)` from `imp/http`, all take `self` as their first argument. They dispatch
the lookup from `self.host`, and they tie the result to this one mount. So they work at any point in
`setup`, before or after any number of `await` calls. `self` remembers what a mount resolved. Keep
`self` and what it resolved on `self`, never in a module-level variable, because the module outlives
every mount. The `imp/no-self-at-module-scope` lint rule reports such an assignment.
`useState(self, name)` returns the same handle for the same name during one mount, and in `onRemove`
it returns the handle that `setup` resolved. See **[State](state.md)** and **[HTTP](http.md)**.

imp uses real DOM and no virtual DOM. So an element factory that you call, such as `div(...)`,
`span(...)` and `input(...)`, already returns a **live DOM node**. The usual way to touch your own
DOM is to keep the node in a variable and change it. `self.host.shadowRoot` is for the case where
you need the mounted subtree as a whole, and not one node that you built.

### `setup` runs _before_ imp places its DOM

One timing rule causes trouble. **While `setup` runs, the DOM that it returns is not yet in the
shadow root.** imp inserts your output _after_ `setup` returns. For an **async** `setup`, that means
after the returned promise resolves, so after every `await`. Until then, the shadow root still holds
the loading content. So this does **not** work:

```js
const card = component('my-app-card', {
  setup: async (self) => {
    const box = div(span({ class: 'label' }, 'hi'))
    await loadData()
    // wrong: the content is not placed yet - this finds the loading content (or null), not your span
    self.host.shadowRoot.querySelector('.label').textContent = 'ready'
    return box
  },
})
```

The `imp/no-root-query-in-setup` lint rule reports a query on `self.host.shadowRoot` inside `setup`,
for this reason. The imp answer is to **hold the node and change it directly**. That is always
correct, because the node that you built is a live element, whether or not it is in the document:

```js
const card = component('my-app-card', {
  setup: async () => {
    const label = span('hi')
    await loadData()
    label.textContent = 'ready' // right: it is the real node
    return div(label)
  },
})
```

A query on `self.host.shadowRoot` is also correct anywhere that runs _after_ the mount. That covers
`onMount`, an event handler, a `watch` callback and `onRemove`. When `onRemove` runs, your mounted
content is still in the shadow root, because imp empties it afterward. So `self.host.shadowRoot`
reaches the real DOM there. It is the natural place to read a final scroll position or selection
before the component goes away.

### How to run code after imp places the DOM

A change to a node covers most cases. Some things work only after the element is **on the page and
laid out**. Those are a move of the focus, a measurement of a size or a position, `scrollIntoView`,
and the start of an animation. For those, write an **`onMount`** entry. imp runs it on the next
animation frame after it places your DOM. So the element is connected, and the browser has done the
layout. You never touch a microtask, a `requestAnimationFrame` or an unmount check yourself. A node
that `setup` made travels to `onMount` as a field on `self`:

```js
export const userCard = component('my-app-user-card', {
  loading: () => div({ class: 'card' }, 'Loading...'),
  setup: async (self, { id }) => {
    const user = await fetch(`/api/users/${id}`).then((r) => r.json())
    self.field = input({ value: user.name })
    return div({ class: 'card' }, self.field)
  },
  onMount: (self) => {
    self.field.focus()
    self.field.select()
  },
})
```

The node that you want to focus often exists only after the fetch that produced its data. Here you
build the node after the `await`, store it on `self`, and return. There is no ref system, and no
element declared early only to be assigned later.

These details are worth knowing:

- **It fires after the layout, not only after the insertion.** So a measurement and `scrollIntoView`
  are safe, and not only `focus()`.
- **It is safe against cancellation.** When the component unmounts before the frame, or mounts
  again, or imp discards its async mount, `onMount` does not run. You never guard against a
  component that is torn down.
- **A throw is a mount failure.** `onMount` is the last step of the mount. So when it throws, the
  error goes to the nearest error boundary, see _Error boundaries_ below. That is the same place
  where a failed async `setup` arrives. imp does not hide the error. `onMount` does not run after
  the error view of the component itself has rendered.

`self` is a plain object that you can **write to**. That is the clean way to pass a resource from
`setup` to `onRemove`. Anything that you assign in `setup` is on the same `self` that `onRemove`
receives:

```js
const clock = component('my-app-clock', {
  setup: (self) => {
    const face = span('0s')
    const startedAt = Date.now()
    self.timer = setInterval(() => {
      face.textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`
    }, 1000)
    return span('elapsed: ', face)
  },
  onRemove: (self) => clearInterval(self.timer),
})
```

The same route is how a component **withdraws a contribution to a state** when it leaves. `onRemove`
runs after the component has left the page. So a lookup through the DOM finds nothing there.
Instead, `useState(self, name)` in `onRemove` returns the handle that `setup` resolved. A name that
`setup` never resolved throws, and the message says to resolve it in `setup`. The
`imp/on-remove-through-self` lint rule reports such a name while you write it:

```js
const projectScreen = component('my-app-project', {
  setup: (self, projectId) => {
    useState(self, 'myapp.nav.project').set({ id: projectId })
    return overview(projectId)
  },
  onRemove: (self) => useState(self, 'myapp.nav.project').set(null),
})
```

This is also the correct meaning. A component that withdraws on unmount writes to the provider that
it contributed to at mount, not to whatever sits above its old position.

### Work that repeats

For work that repeats while the component is on the page, such as a poll or a ticking clock, use
`interval(self, ms, run)` from `imp`. You write no `onRemove` for it:

```js
import { component, interval } from 'imp'

const liveCheck = component('my-app-live-check', {
  setup: async (self, id) => {
    const api = useHttpClient(self, 'myapp.api')
    const check = initState(self, 'myapp.check', await api.get(`/checks/${id}`))
    interval(self, 5000, async () => check.set(await api.get(`/checks/${id}`)))
    return checkView(check)
  },
})
```

- **It stops when the mount ends.** The timer goes with the bindings of the component, before
  `onRemove` runs.
- **It does not overlap itself.** When `run` returns a promise that has not settled, imp skips the
  next tick. A slow request never stacks up a queue of polls.
- **A failure does not stop it.** imp logs an error that `run` throws, and the next tick runs. An
  aborted http call after the unmount is not logged.
- **It returns a stop function**, for a component that stops polling before it unmounts, for example
  when a check closes.

For work that runs once after a wait, such as a hint that hides after three seconds, use
`delay(self, ms, run)` from `imp`. It works like `interval`, but it runs `run` one time:

```js
const hint = initState(self, 'myapp.hint', true)
delay(self, 3000, () => hint.set(false))
```

An unmount before the wait ends cancels the run. `delay` also returns a stop function, and it logs
an error that `run` throws.

Each mounted component gets its **own** `self`. So a list of one hundred clocks clears one hundred
timers, and nothing is shared between them. That is why `self` is the correct home for a resource of
one component. A variable at module level, or a property on the definition, would be shared across
every instance and overwritten. Name the `self` parameter only when you use it. A component that
does not use it can write `setup: () => ...`.

`self` **travels with the component**. imp does not remount a component that moves, see _How to move
a component_. So `self`, and everything that you stored on it, survives the move. Only a true
unmount ends it.

## Styling

The output of a component lives in its own shadow root. That gives you full isolation in both
directions. A page stylesheet does not reach into a component, and the CSS of a component cannot
leak out. A component carries its look in the `styles` entry:

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
  setup: (_self, user) => div({ class: 'card' }, span({ class: 'name' }, user.name)),
})
```

imp compiles the CSS once per component, not per instance, and every instance shares it. So `styles`
costs the same whether the component renders once or a thousand times. Invalid CSS fails
immediately, when you define the component.

This is what crosses the style boundary, and how:

- **A custom property inherits through the boundary.** A design token that you declare on `:root`,
  such as `--accent` and `--text`, is visible inside every component. That is the theming channel. A
  change of theme that updates the variables on `:root` restyles every component that uses them.
- **The host element belongs to the tree of the parent.** So page CSS can style the tag, as in
  `my-app-user-card { grid-area: aside }`. Such a rule wins against the `:host` rules of the
  component.
- **Nothing else crosses.** A class name, an id and an element selector are private to each
  component. Two components can both use `.card` and never collide, and no page rule needs a
  namespace.
- **A node that you pass to another component leaves your tree.** The component appends it into its
  own shadow root, and your class rules no longer match it. A layout such as `stack` or `flex` is a
  component too, so `stack({ gap: 2 }, div({ class: 'usage' }, ...))` renders the div without your
  `.usage` rule. In development, imp warns in the console when the component renders. The warning
  names your component, the rule, and the component that now holds the element. `imp build` drops
  the check, so a production bundle carries none of it. Give such a box a component of its own,
  render it with a standard component that carries its look, or set an inline `style`. A wrapper
  that stays in your tree, `div({ class: 'usage' }, stack(...))`, keeps your rule.

To share CSS between components, share a string. Use a plain JavaScript constant, and compose it
into `styles`:

```js
import { buttonStyles } from './theme.js'

export const editor = component('my-app-editor', {
  styles: `
    ${buttonStyles}
    .row { display: flex; gap: 8px }
  `,
  setup: () => div({ class: 'row' }, button('save'), button('cancel')),
})
```

Design around two platform boundaries. A form control inside a component does not join a `<form>`
outside it. A `label[for]` reference, and an ARIA id reference, cannot point across the boundary.
Keep a control, its label and its form together, inside one component.

## The lifecycle

1. **Call.** `profile({ id: 42 })` creates the `<my-app-profile>` element, which holds the loading
   content when there is one. Nothing else runs yet. The host is a cheap, inert node, so you can
   compose it freely while you build a detached tree.
2. **Mount.** `setup` runs the moment the host arrives in the document, through `mount(...)` or any
   DOM insertion. Its output replaces the loading content. A parent mounts before its children, from
   the top down. `onMount` runs on the next frame.
3. **Unmount.** The host leaves the document, and nothing inserts it again right away. imp releases
   every state binding that the mount created, calls `onRemove`, aborts `self.abortSignal`, then
   empties the shadow root.
4. **Remount.** A removed component that you insert again later starts a new cycle: the loading
   content, `setup` with a new `self`, and new bindings. Each mounted period is one clean pair of a
   mount and a cleanup.

## How to move a component

The lifecycle draws one line. **A component that leaves the document and comes back in the same
synchronous task has _moved_. A component that stays out of the document longer has unmounted.** A
move keeps the component alive. `setup` does not run again. The DOM of the component travels with
the element, including anything the person typed into it, its internal variables, and the states it
initialized itself:

```js
events: {
  drop: () => targetColumn.append(cardHost),
}
```

What a move _does_ restart is the **subscription layer**. imp resolves every state that the
component obtained with `useState`, and every client from `useHttpClient`, again, against the
ancestors at its new position. Its bindings update in place when the value there differs. Drag a
card to another column, and in the same gesture it keeps the half-written text in its input, and
switches to the sorting state of the new column. The continuity comes from the element, and the
scope comes from the position.

These details are worth knowing:

- **Drag and drop works.** Native HTML5 drag and drop reparents the element on the drop. That is one
  move. A sorting library that moves the element between containers while you drag produces a chain
  of moves. Each one only binds again, so imp rebuilds nothing along the way.
- **A `view` or `each` region renders again on a move only when its bound value changed** at the new
  position. imp compares by content for a plain object, an array, and a value type such as a date
  and a URL. So two providers that hold equal data cost no rebuild. When the value did change, the
  region rebuilds exactly as it does on any `set`.
- **A state that is missing at the new position is an error.** This happens when the component uses
  a state that nothing above its new position provides. imp logs an error and keeps the previous
  binding. Initialize that name in an ancestor that covers every place where the component can land.
- **An insertion in a later task is a remount.** Detach the host at the start of a drag, then append
  it again on the drop in a different task. That is a real unmount and a new mount, not a move. It
  is also the deliberate way to make a component run `setup` again. An item that a keyed `each`
  keeps holds its `self` across a change and a reorder. An item that an unkeyed `each` rebuilds is
  always a new mount. See **[State](state.md)**.

## Loading states

When `setup` is async, the loading content stays visible until the promise resolves. That is a
loading state with no extra machinery:

```js
export const orders = component('my-app-orders', {
  loading: () => div({ class: 'skeleton' }, 'loading orders...'),
  setup: async (_self, { customerId }) => {
    const response = await fetch(`/api/customers/${customerId}/orders`)
    const list = await response.json()
    return ul(list.map((order) => li(order.title)))
  },
})
```

When the component unmounts while the promise is pending, imp discards the late result. When the
promise rejects, the nearest error boundary shows its error view, described below. With no boundary,
imp logs the error, and the loading content stays.

When the loaded data must live in a state, initialize the state, `await` the data, and `set` it in.
The order does not matter, because `self` carries the mount across every `await`. The bindings go
live when the resolved DOM mounts. See **[State](state.md)**:

```js
export const orders = component('my-app-orders', {
  loading: () => div({ class: 'skeleton' }, 'loading orders...'),
  setup: async (self, { customerId }) => {
    const response = await fetch(`/api/customers/${customerId}/orders`)
    const orders = initState(self, 'myapp.orders', await response.json())
    return ul(
      orders.each(
        (order) => li(order.title),
        (order) => order.id,
      ),
    )
  },
})
```

## Error boundaries

Give a component an `error` entry, and it becomes an error boundary. When a component **in its
subtree**, or the boundary itself, throws during the mount, the boundary renders
`error(self, error, ...args)` in place of its children. The throw can be synchronous, or it can be a
rejection of an async `setup`. So a broken screen does not stay on the page:

```js
export const ordersPane = component('my-app-orders-pane', {
  setup: () => div(ordersList(), ordersSummary()),
  error: (_self, error) =>
    div(p('Orders are unavailable right now.'), p({ class: 'detail' }, error.message)),
})
```

This is how an error travels:

- A mount failure looks for the **nearest boundary**. That is the failing component itself when it
  has an `error` entry, and otherwise the closest ancestor component that has one. The first
  boundary wins, and imp does not disturb a boundary further out.
- When the error view renders, the previous children of the boundary unmount normally. That includes
  a component that mounted correctly. Their bindings end and their `onRemove` hooks run, exactly as
  if you had replaced them yourself. The boundary component stays mounted, and its `error` entry
  gets the same `self` as its `setup`. So the error view can bind a state, reset one, keep
  `self.abortSignal` for a retry, and store a field that `onRemove` reads.
- A boundary handles **one error per mounted period**. After the error view is up, a further error
  goes to the next boundary out, or to the console. To retry, mount the boundary again. Remove it,
  and insert it again in a later task. That starts a new mount with a new error budget.
- With no boundary anywhere, the behaviour does not change. imp logs the error, and the failing
  component keeps its loading content.

A boundary catches a **mount failure**. That includes a failed lazy load and a failed data fetch in
an async `setup`, which is the common case. It also includes a throw from `onMount`, which is the
end of the mount. A boundary does not catch an error thrown later, in an event handler or in a state
subscriber. imp isolates those and logs them where they happen. So one bad handler cannot stop the
page. See **[State](state.md)**.

Put a boundary wherever a subtree can fail on its own and the rest of the page must survive.
Examples are around the page of a route, around a widget that a third party provides, and around
each card in a dashboard.

## Automatic cleanup

imp tracks every state binding that a component owns, and releases it when the component unmounts.
That covers every `text()`, `view()`, `each()` and state-bound prop in the DOM that it mounts, on a
regular state and on a computed state. A DOM binding goes live the moment when imp places the output
of the component. So the ownership follows the containment. The component that mounts the DOM owns
its bindings. imp also tracks a binding nested inside a `view` or `each` render function, once per
rebuild. Each new render releases the bindings of the previous render before it creates the new
ones. So you can swap whole screens in and out. Nothing leaks, and there is nothing to disconnect by
hand. Two boundaries are worth knowing:

- `watch` is not a DOM binding. It takes `self` as its first argument to end with the mount, as in
  `theme.watch(self, paint)`. A bare `watch(fn)` in a component registers no cleanup, and the
  `imp/watch-with-self` lint rule reports it. Everything else is free of position. `get` and `set`
  work anywhere. `text`, `view`, `each` and a state-bound prop go live when the returned DOM mounts,
  wherever you built them. See the patterns in **[State](state.md)**.
- `onRemove` is only for a resource that imp cannot see. Examples are clearing an interval, closing
  a connection, and destroying a widget that is not an imp component. It receives the `self` of the
  component, so the resources that `setup` stored there are in reach. It can be `async` when the
  cleanup must await something, such as closing a connection or flushing a buffer. imp awaits it
  before it treats the component as fully torn down.

The unmount is also **tolerant of a fault**. imp logs and skips a cleanup step or an `onRemove` that
throws, and an async `onRemove` that rejects, and it does not stop the rest. So imp still releases
every other binding and resource, and one broken hook cannot turn a swap of screens into a leak.

## Components and state

A component is also a **state scope**. A call to `initState` inside `setup` ties the state to that
component. A descendant reaches it with `useState`, and a sibling or an outsider cannot. When the
component unmounts, imp releases the state with it, and a remount starts again from the initial
value. Two instances of the same component each own an independent state under the same name. A
component owns every state. State for the lifetime of the app lives in your root component, the one
that never unmounts. The full rules are in **[State](state.md)**.

```js
const filterButtons = component('my-app-filter-buttons', {
  setup: (self) => {
    const filter = useState(self, 'myapp.filter')
    return div(
      ['all', 'open', 'done'].map((kind) =>
        button({ events: { click: () => filter.set(kind) } }, kind),
      ),
    )
  },
})

export const taskBoard = component('my-app-task-board', {
  setup: (self) => {
    const filter = initState(self, 'myapp.filter', 'all')
    return div(filterButtons(), span('showing: ', filter.text()))
  },
})
```

## How to teach an agent to use a component - `counter.skill.md`

A component is reusable only when the person who writes the next screen knows how to call it. In an
imp project, that reader is usually an AI agent. So a component documents itself in a **skill
file**. That is a markdown file with the same name as the module, beside it.

```
components/counter.js
components/counter.skill.md
```

Write what an agent needs to call the component correctly the first time. That is the import, the
call shape, a prop table, the events that it emits, and the mistakes that it invites. Keep the page
shorter and more mechanical than a guide for a person:

````md
# counter - a self-contained increment/decrement widget

```js
import { counter } from './counter.js'

counter({ start: 0, step: 1 })
```

| Prop    | Values | Default | Notes                                 |
| ------- | ------ | ------- | ------------------------------------- |
| `start` | number | `0`     | The value it counts from              |
| `step`  | number | `1`     | How much each press adds or subtracts |

Emits a `change` event with the new value in `event.detail`.
````

The first line is the summary. So start it with the component name, and one clause that says what
the component is.

That file is the whole convention, and the components of imp follow the same one. Every standard
component has a skill file beside its implementation, and that is what `imp skill std/button`
prints. Anybody, and anything, can read yours with these commands:

```
imp skill ./components/counter.js     # or ./components/counter.skill.md
imp skill                             # lists every component in the project that has one
```

**A published component takes its skill with it. A shipped app leaves the skill behind.** When you
build a module, with `imp build counter.js`, the result is something that other developers program
against. So imp copies the skill file to `imp-skill.md` in the output folder, beside the bundle. A
JS entry with no skill file stops the build. Publish `imp-skill.md` with the bundle, next to the
entry module of your package. `imp install` copies it into the app that installs your component, and
`imp skill <alias>` prints the manual there.

When you build a page, with `imp build` on your `index.html`, the result is a finished app that
nobody writes code against. imp puts no skill text into any bundle, so no skill text reaches the
users of your app. They download your app, not your documentation.

The entry decides that split, and no configuration does. A JS entry is a component. An HTML entry is
an app.

**How to publish more than one component.** The skill that travels is the skill of the **entry
module that you build**. Its `imp-skill.md` goes into one output folder, so one folder holds one
entry. Suppose that you publish a barrel that re-exports several components:

```js
export * from './alpha.js'
export * from './beta.js'
```

Then `imp-skill.md` is a copy of `index.skill.md`, the skill file beside the barrel.
`alpha.skill.md` and `beta.skill.md` do not go into the output. So do one of two things. Write the
skill of the package beside your entry, and describe the components in it. Or publish each component
as its own entry, with `imp build alpha.js --output alpha` and `imp build beta.js --output beta`.
Each one then has its own folder and its own skill.

A `*.preview.js` file shows the states of a component to a person, see
**[the CLI](cli.md#imp-preview)**. Together with that file, a skill file is the second half of
shipping a component that somebody else can use.

## Practical notes

- **The internals of a component are private.** `document.querySelector`, like page CSS, stops at
  the boundary of the component. Sometimes a parent needs a live handle on something a child shows,
  such as a container it appends into, or a field it reads. In that case, create the node yourself,
  keep the reference, and pass it as a factory argument. The child then renders it in the correct
  place.
- **Focus a component from outside with `host.focus()`.** The element that a factory returns
  forwards the focus to the first focusable element the component renders. A parent that opened a
  dialog can put the focus back on its trigger this way, with no need to know what the trigger
  contains.
- **A component can find its own host** with `event.target.getRootNode().host`. That replaces
  `closest('my-app-card')` in shadow DOM, in a handler that needs the element of the component.
- **A strict content model needs one component.** `<table>` and `<select>` are examples. Let one
  component render the whole structure. Do not split a row or an option into its own component. A
  host tag between `<table>` and `<tr>` breaks the content model.
- **A second definition of the same name gives a warning**, and imp keeps the first definition. So
  an accidental double import stays harmless.
