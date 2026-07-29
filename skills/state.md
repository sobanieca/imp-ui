# state — named reactive state bound straight to the DOM

`initState(name, initialValue)` inside a component's `onMount` — see [components](components.md) —
creates a state owned by that component; `useState(name)` finds the nearest one above. Both return
the same helper. No store, no provider element, no re-rendering — a `set` updates exactly the DOM
bound to it.

```js
import { component } from 'imp'
import { button, div } from 'imp/html'
import { initState, useState } from 'imp/state'

const profile = component('my-app-profile', {
  onMount: () => div(useState('myapp.user').text((u) => u.name)),
})

export const app = component('my-app-root', {
  onMount: () => {
    const user = initState('myapp.user', { name: 'Ada' })
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

| Member                      | Returns          | Where it may be called                                                  |
| --------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `get()`                     | current value    | anywhere                                                                |
| `set(next)`                 | —                | anywhere                                                                |
| `watch(fn)`                 | unsubscribe fn   | in `onMount` **before the first `await`**, or in a `view`/`each` render |
| `text(select?)`             | live text node   | built anywhere; goes live when its DOM mounts                           |
| `view(render)`              | live region      | built anywhere                                                          |
| `each(renderItem, getKey?)` | live list region | built anywhere                                                          |
| the helper itself           | —                | as a **prop value**, to keep that prop live                             |

`set(next)` replaces the whole value, synchronously notifying subscribers. Pass the next value, or a
**function** of the current one:

```js
count.set((value) => value + 1)
todos.set((items) => [...items, newTodo])
user.set({ ...user.get(), theme: 'light' })
```

## Rules an agent gets wrong

- **State names need a namespace** — at least two dot-separated segments (`myapp.user`, never
  `user`). Lint rule `imp/state-name-namespace`; runtime throws.
- **Values are frozen and compared by content.** Never mutate a value in place (it throws); spread
  into a new object or array. Setting a structurally equal value is a **no-op** — no notification,
  no rebuild.
- **State holds plain data only**: objects, arrays, primitives, `Date`/Temporal, `URL`, `RegExp`. No
  functions, DOM nodes, class instances, `Map`/`Set`, or cycles — imp logs an error naming the path
  and content comparison silently degrades to identity.
- **A function passed to `set` always means the updater form**, so a function can never be a value.
- **Resolution is position-sensitive, everything else is not.** `initState`/`useState`/`watch` throw
  after the first `await` of an async `onMount` (`imp/state-setup-before-await`) and outside a
  mounting component. Resolve first, `await`, then `set` and build DOM.
- **`useState` throws if no ancestor initialized the name**; `initState` throws if the same scope
  already provides it. A nested `initState` of the same name shadows the ancestor's for its subtree.
- **Bind props with the state itself**, never `state.get()` — `button('Save', { disabled: busy })`.
  Binding is one-way (state → DOM): an input's keystrokes do not write back; `set` from an event.
- **Never pass a state as a bare child** — `div(count)` is reported and skipped; use `count.text()`.
- **Don't put a free-typing input inside a `view` that re-renders per keystroke** — the rebuild
  replaces the element and loses focus and caret. `set` on commit (change/blur), or use `text()`.
- **A bound `class`/`style` owns that prop** — each value replaces the previous whole. Don't also
  mutate `classList` on that element.

## Binding the DOM

```js
span(user.text((u) => u.name)) // live text node, updates in place
div(session.view((u) => (u ? profileCard(u) : loginForm()))) // rebuilt whole on every set
ul(todos.each((todo) => li(todo.title), (todo) => todo.id)) // keyed list
div({ class: theme }) // live prop
```

`each` on an array state. **Without a key** the list is rebuilt on every set — fine for short,
display-only lists. **With a key** unchanged items keep their exact DOM (typed text, focus, scroll,
mounted component state), changed items re-render, reorders move elements. Keys must be unique and
stable — an `id` from your data, never the array index; derive the item's DOM from the item, not
from `index`. A non-array value logs an error and renders nothing (`null`/`undefined` = empty).

`view`/`each` render functions may nest further bindings; each rebuild unsubscribes the previous
ones.

## computed

```js
const fullName = computed([first, last], (f, l) => `${f} ${l}`)
const rowClass = computed([selection], (selected) => ({ row: true, selected }))
```

Read-only (`get`, `watch`, `text`, `view`, `each`; `set` throws). Write `compute` as a pure function
of its arguments — it is only re-run when a source changes. It notifies only when the **content** of
its result changes, so building a fresh array each time is fine. Computing from one state is how you
watch one field of a bigger state. A computed is a local value, not a registered name — `useState`
cannot find it; pass it around or re-create it.

Sources notify one at a time: two back-to-back `set`s recompute twice and the first notification
sees the in-between combination. Values that must change together belong in **one** state object.

## Cleanup and scope

Every binding is owned by the component whose mounted DOM contains it and is released on unmount;
bindings inside a `view`/`each` region end when the region re-renders. `watch` has no DOM, so it
needs a mounting component to own it. DOM you insert into the page yourself, without imp, never
activates its bindings.

A state lives as long as the component that initialized it. Two instances of the same component own
independent states under the same name. App-lifetime state is state initialized in your **root**
component — there is no global scope. Aim each state at the narrowest scope spanning its readers.

For DOM rendered outside the provider's subtree (an overlay appended to `document.body`), `useState`
cannot find the name — pass the helper down as an argument instead; it works anywhere.

Async mount, the canonical shape:

```js
onMount: ;
;(async (instance, { id }) => {
  const orders = initState('myapp.orders', []) // resolve first
  orders.set(await fetch(`/api/orders?user=${id}`).then((r) => r.json()))
  return ul(orders.each((order) => li(order.title), (order) => order.id))
})
```

There is no `batch()`. Coalesce at an expensive edge with a headless component that watches the
sources and sets one display state per microtask. Set `IMP_LOG_LEVEL=debug` to trace every read,
set, subscription and notification — see [logging](logging.md).
