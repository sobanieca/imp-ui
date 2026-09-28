# state - named reactive state bound straight to the DOM

Call `initState(self, name, initialValue)` inside the `setup` of a component, see
[components](components.md). It creates a state that the component owns. `useState(self, name)`
finds the nearest state above the host. Both calls return the same helper, and both come from
`imp/state`. `self` is the first argument of `setup`. There is no store, no provider element and no
re-rendering. A `set` updates exactly the DOM that is bound to the state.

```js
import { component } from 'imp'
import { button, div } from 'imp/html'
import { initState, useState } from 'imp/state'

const profile = component('my-app-profile', {
  setup: (self) => div(useState(self, 'myapp.user').text((u) => u.name)),
})

export const app = component('my-app-root', {
  setup: (self) => {
    const user = initState(self, 'myapp.user', { name: 'Ada' })
    return div(
      profile(),
      button('Rename', {
        events: { click: () => user.set({ ...user.get(), name: 'Grace' }) },
      }),
    )
  },
})
```

## The helper

| Member                      | Returns          | Where you can call it                       |
| --------------------------- | ---------------- | ------------------------------------------- |
| `get()`                     | current value    | anywhere                                    |
| `set(next)`                 | -                | anywhere                                    |
| `watch(self, fn)`           | stop function    | in a component. imp stops it on unmount.    |
| `watch(fn)`                 | stop function    | anywhere. You call the stop yourself.       |
| `text(select?)`             | live text node   | anywhere. It goes live when its DOM mounts. |
| `view(render)`              | live region      | anywhere                                    |
| `each(renderItem, getKey?)` | live list region | anywhere                                    |
| the helper itself           | -                | as a **prop value**, to keep that prop live |

`set(next)` replaces the whole value and notifies the subscribers synchronously. Pass the next
value, or a **function** of the current value:

```js
count.set((value) => value + 1)
todos.set((items) => [...items, newTodo])
user.set({ ...user.get(), theme: 'light' })
```

## Rules an agent gets wrong

- **`self` comes first.** `initState(self, name, value)` and `useState(self, name)` need the `self`
  that imp passes to `setup`, `error`, `onMount` and `onRemove`. A call with anything else as the
  first argument throws. The lint rule is `imp/self-first-argument`. A helper that resolves a state
  takes `self` as a parameter.
- **A state name needs a namespace.** Use two or more dot-separated segments, such as `myapp.user`.
  Never write `user`. The lint rule is `imp/state-name-namespace`, and the runtime throws.
- **imp freezes a value and compares it by content.** Never change a value in place, because that
  throws. Spread the value into a new object or a new array. A `set` of a structurally equal value
  does **nothing**. There is no notification and no rebuild.
- **A state holds plain data only.** This covers an object, an array, a primitive, a `Date`, a
  Temporal value, a `URL`, a `URLSearchParams` and a `RegExp`. It excludes a function, a DOM node, a
  class instance, a `Map`, a `Set` and a cycle. imp logs an error that names the path, and the
  content comparison becomes an identity comparison in silence.
- **A function that you pass to `set` is always the updater form.** So a function can never be a
  value.
- **There is no pending phase and no loading phase.** `initState(self, name)` with no initial value
  is `undefined`, and imp calls `view` and `text` with that value. Model a load as `undefined`,
  which means unknown, then `null`, which means known to be empty, then the value. Branch where the
  difference matters. A guard in [routing](routing.md) reads exactly that convention.
- **Resolution goes through `self`, at any point in `setup`.** `initState` and `useState` work
  before and after any `await`. They throw after the component has left the page. An async `setup`
  that can outlive its host checks `self.abortSignal.aborted` after an `await`. The lint rule is
  `imp/abort-check-after-await`.
- **`useState` throws when no ancestor initialized the name.** `initState` throws when the same
  scope already provides the name. A nested `initState` of the same name shadows the ancestor for
  its subtree.
- **`useState(self, name)` in `onRemove` returns the handle that `setup` resolved.** To contribute
  to a state on mount and withdraw on unmount, resolve in `setup` and reach it again in `onRemove`:
  `setup: (self) => { useState(self, 'myapp.nav').set({ id }) ... }`, then
  `onRemove: (self) => useState(self, 'myapp.nav').set(null)`. A name that `setup` never resolved
  throws in `onRemove`. The lint rule is `imp/on-remove-through-self`.
- **Pass `self` to `watch` in a component.** `user.watch(self, paint)` stops when the component
  unmounts. `user.watch(paint)` registers no cleanup, so a bare call in `setup` outlives the mount
  and keeps running. The lint rule is `imp/watch-with-self`. Use the bare form only outside a
  component, and hold the stop function that it returns. Prefer `text`, `view`, `each` and a bound
  prop. imp releases those with the DOM.
- **Bind a prop with the state itself**, never with `state.get()`, as in
  `button('Save', { disabled: busy })`. The lint rule is `imp/no-get-in-binding`. A binding is one
  way, from the state to the DOM. A keystroke in an input does not write back. Call `set` from an
  event.
- **Never pass a state as a bare child.** imp reports `div(count)` and skips it. Use `count.text()`.
  The lint rule is `imp/no-state-as-child`.
- **Do not put a free-typing input inside a `view` that renders again on every keystroke.** The
  rebuild replaces the element, and the element loses the focus and the caret. Call `set` on commit,
  which is the change or blur event, or use `text()`.
- **A bound `class` or `style` owns that prop.** Each value replaces the whole previous value. Do
  not also change `classList` on that element.

## How to bind the DOM

```js
span(user.text((u) => u.name)) // live text node, updates in place
div(session.view((u) => (u ? profileCard(u) : loginForm()))) // rebuilt whole on every set
ul(todos.each((todo) => li(todo.title), (todo) => todo.id)) // keyed list
div({ class: theme }) // live prop
```

Call `each` on a state that holds an array. **With no key**, imp rebuilds the list on every set.
That is acceptable for a short list that only displays data. **With a key**, an unchanged item keeps
its exact DOM, which includes typed text, focus, scroll position and the state of a mounted
component. imp renders a changed item again, and moves only the elements that are out of order. When
the focus was inside a changed item, imp puts it back on the element at the same place in the new
DOM. When that item goes away, the focus goes to the same place in the item that now holds its
position. A key must be unique and stable. Use an `id` from your data, never the array index. Derive
the DOM of an item from the item, not from `index`. For a value that is not an array, imp logs an
error and renders nothing. A `null` or `undefined` value renders an empty list.

A `view` or `each` render function can nest more bindings. Each rebuild releases the previous
bindings. A `watch` inside a render function is not a binding. `watch(self, fn)` there ends with the
mount, not with the region, so it accumulates on every rebuild. Bind instead.

## computed

```js
const fullName = computed([first, last], (f, l) => `${f} ${l}`)
const rowClass = computed([selection], (selected) => ({ row: true, selected }))
```

A computed is read-only. It has `get`, `watch`, `text`, `view` and `each`, and `set` throws. Write
`compute` as a pure function of its arguments. imp runs it again only when a source changes. It
notifies only when the **content** of the result changes, so it is safe to build a fresh array every
time. To watch one field of a larger state, compute from that one state. A computed is a local
value, not a registered name. `useState` cannot find it. Pass it around, or create it again.

A source notifies on its own. So two `set` calls one after the other cause two recomputes, and the
first notification sees the combination in between. Put values that must change together in **one**
state object.

## Cleanup and scope

The component whose mounted DOM contains a binding owns that binding, and imp releases it on
unmount. A binding inside a `view` or `each` region ends when the region renders again. DOM that you
insert into the page yourself, without imp, never activates its bindings. `watch` has no DOM, so it
takes `self` to end with the mount.

A state lives as long as the component that initialized it. Two instances of the same component own
independent states under the same name. State for the lifetime of the app is state that you
initialize in your **root** component. There is no global scope. Give each state the narrowest scope
that covers its readers.

For DOM that you mount outside the subtree of the provider, such as a second `mount` into another
element of the page, `useState` cannot find the name. Pass the helper down as an argument. The
helper works anywhere.

This is the standard shape of an async mount:

```js
const orderList = component('myapp-order-list', {
  setup: async (self, { id }) => {
    const orders = initState(self, 'myapp.orders', [])
    const api = useHttpClient(self, 'myapp.api') // see imp skill http
    orders.set(await api.get('/orders', { query: { user: id } }))
    return ul(orders.each((order) => li(order.title), (order) => order.id))
  },
})
```

A backend call goes through the [http](http.md) client. `useHttpClient(self, name)` resolves it
through the DOM under the same rule as a state. It publishes its own `pending` and `lastError`
states for you to bind.

There is no `batch()`. To coalesce updates at an expensive point, use a headless component. It
watches the sources and sets one display state per microtask. Set `IMP_LOG_LEVEL=debug` to trace
every read, set, subscription and notification, see [logging](logging.md).
