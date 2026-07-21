# State Management That Gets Out of Your Way

## imp ui: shared, reactive state with no store, no provider, and no re-renders

You've written the Redux boilerplate. You've wrapped your app in provider pyramids. You've memoized,
batched, tracked dependencies, and debugged stale closures at 2 a.m. Every framework promises that
_this time_ state will be simple — and then hands you a scheduler, an effect graph, and a mental
model the size of a textbook.

imp takes a different bet: **your DOM tree is already the perfect scope tree.** State in imp is
named, explicit, and scoped by where it lives in the page — and when it changes, it updates exactly
the DOM you bound to it. Nothing re-renders. Nothing diffs. Nothing leaks.

Here's the whole thing in one screen:

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

One component initializes a named state. Every component mounted under it picks the same state up by
name. That's it. No store configuration, no `<Provider>` element, no context plumbing, no dependency
arrays.

---

## The pitch in three sentences

- **State is named and DOM-scoped.** `initState('myapp.cart', [])` in a component makes `myapp.cart`
  visible to its whole subtree via `useState('myapp.cart')` — and releases it automatically when the
  component unmounts.
- **Updates are surgical.** A `set` doesn't re-run your component. It updates the exact text nodes,
  regions, list items, and props you bound — synchronously, on the real DOM.
- **Cleanup is automatic and total.** Every subscription has an owner and a deterministic end. Swap
  entire screens in and out; there is nothing to unhook and nothing to leak.

If you're coming from React: imagine `useState` + `useContext` + `useMemo` + `useEffect` cleanup +
`React.memo` collapsed into one helper object — with no re-render step in the middle. If you're
coming from Vue or Solid: imagine the reactivity without the dependency-tracking machinery. If
you're coming from Alpine: imagine `x-data` that scales to real applications.

---

## The whole API: six operators, one combinator

Every state — whether you created it with `initState` or picked it up with `useState` — is the same
small helper object. Learn these six entries and you know imp state completely.

### `get()` — read it

Returns the current value. Works anywhere, any time — event handlers, timers, after an `await`.

```js
const cart = useState('shop.cart')
console.log(cart.get().length)
```

### `set(next)` — change it

Replaces the whole value and notifies every subscriber, synchronously. Pass the next value, or a
function of the current one — the get-then-set idiom in a single call, exactly like React's
`setState`:

```js
cart.set([]) // next value directly
count.set((value) => value + 1) // updater form
todos.set((items) => [...items, newTodo]) // spread into a new array
```

Setting a value equal to the current one is a no-op — imp compares **by content**, field by field,
not by reference — so a poll or socket payload that came back unchanged does zero downstream work,
even though it is a brand-new object. The value you read back is **frozen**: try to mutate it and
imp throws instead of silently dropping the change, which is exactly why updates spread into a fresh
object. And because a function argument always means "compute the next value," state holds **plain
data** — objects, arrays, primitives. No class instances, no functions, no surprises when things get
compared.

### `watch(fn)` — react to it

Runs `fn(value)` immediately with the current value, then again after every `set`. This is your
general-purpose hook: sync `localStorage`, drive a chart library, fire analytics — anything.

```js
theme.watch((value) => document.body.setAttribute('data-theme', value))
```

No dependency array. No stale closure. No "why did my effect run twice."

### `text(select?)` — show it

Returns a live text node. The simplest possible binding: the text updates in place, and nothing
around it is touched.

```js
span('Items in cart: ', cart.text((items) => items.length))
```

### `view(render)` — render from it

Returns a live region that re-renders whenever the state is set. This is the general DOM binding —
conditional rendering included. Return a node, text, an array, or `null`/`false` to render nothing:

```js
div(session.view((user) => (user ? profileCard(user) : loginForm())))
div(cart.view((items) => items.length === 0 && p('Your cart is empty')))
```

That's your entire conditional-rendering story. No `v-if`, no `*ngIf`, no `<Show>` component — just
a function of the value.

### `each(renderItem, getKey?)` — list it

The list binding. Without a key, the list rebuilds on change — fine for short, display-only lists.
Add a key function and `each` gets **surgical**: unchanged items keep their exact DOM elements (text
someone typed, focus, scroll position, CSS transitions — all preserved), changed items re-render
individually, and reorders _move_ the existing elements instead of rebuilding them.

```js
ul(todos.each(
  (todo) => li(todo.title, input({ class: 'notes' })),
  (todo) => todo.id,
))
```

Items are compared **by content**, not by reference — so your everyday spread updates do exactly the
right thing: replacing an item with an equal copy re-renders nothing; changing one field re-renders
just that item.

### `computed(states, compute)` — derive from it

One combinator covers all composition. `computed` takes source states and a function, and returns a
read-only state that follows them:

```js
const fullName = computed([first, last], (f, l) => `${f} ${l}`)
span(fullName.text())

const remaining = computed([todos], (items) => items.filter((item) => !item.done))
ul(remaining.each((todo) => li(todo.title)))
```

Here's the part other frameworks make you earn the hard way: a computed state notifies only when its
**outcome actually changes, compared by content**. That `filter` builds a fresh array on every run —
and downstream still stays quiet unless the remaining todos really differ. Editing a completed todo
re-renders nothing. In React, that's a `useMemo` plus a custom equality check plus a prayer. In imp,
it's the default.

A single-source `computed` is also how you watch one slice of a bigger state without reacting to
unrelated changes:

```js
const theme = computed([user], (u) => u.theme)
theme.watch(applyTheme) // runs only when the theme changes — not on every user update
```

### Bonus: bind any prop, no new syntax

Pass a state (or a computed state) as a prop value, and that prop is live — applied now, re-applied
on every `set`:

```js
button('Save', { disabled: busy })
div({ class: computed([theme], (value) => `card card--${value}`) })
li({ 'aria-selected': isSelected })
```

No `:class`, no `[disabled]`, no curly-brace template dialect. The state itself _is_ the binding.

---

## What's deliberately not here

The features imp doesn't have are the point — each one is a class of bugs and boilerplate you stop
having.

- **No re-rendering.** Your component function runs once, at mount. There is no render loop to
  optimize, so `memo`, `useCallback`, `shouldComponentUpdate`, and "why did this re-render" tooling
  have nothing to do.
- **No virtual DOM, no diffing.** Bindings update the real nodes they own. What you see in devtools
  is what your code built.
- **No dependency tracking.** Nothing silently subscribes because you happened to read a value. You
  can see every subscription in your code, because you wrote every subscription.
- **No operator library.** `computed` is the entire composition story — no `pipe`, no `switchMap`,
  no schedulers, no async pipelines. If you're stacking computed states on computed states, that's
  your signal to restructure the source states, and imp is honest enough to tell you so.
- **No batching API.** Every `set` notifies immediately, and the browser paints only after your code
  finishes — so a half-updated frame is impossible. Values that must change together belong in one
  state, set in one call. Simple rule, no `batch()` incantation.
- **No manual cleanup.** Subscriptions made while a component mounts end when it unmounts.
  Subscriptions made inside a `view`/`each` render end when the region re-renders. There is no third
  case.

---

## Real apps, real patterns

### The e-commerce cart: one state, visible everywhere

The classic problem: the cart badge in the header, the cart page, the "add to cart" buttons on
product cards, and the checkout summary all need the same data. In React that's a context or a
store; in Angular, an injected service with an observable; in Vue, a Pinia store.

In imp, it's one line in your root component — the component that spans the app and never unmounts:

```js
const cart = initState('shop.cart', [])
```

Every component under it reaches the same state with `useState('shop.cart')` — there is no store
object to define and no separate "global" concept: app-lifetime state is just state owned by the
component with app-lifetime. The header badge is a text node that updates in place — the header
never re-renders:

```js
span({ class: 'badge' }, cart.text((items) => items.length))
```

The cart page is a keyed `each` — quantity inputs keep focus while other items change:

```js
ul(cart.each(
  (item) => cartRow(item),
  (item) => item.sku,
))
```

The checkout button disables itself, and the empty state handles itself:

```js
const isEmpty = computed([cart], (items) => items.length === 0)
button('Checkout', { disabled: isEmpty })
div(cart.view((items) => items.length === 0 && p('Your cart is empty')))
```

And adding an item, from anywhere on the page:

```js
cart.set((items) => [...items, { sku, title, qty: 1 }])
```

No actions, no reducers, no selectors, no dispatch. The data and the operations on it are just...
there.

### The SaaS dashboard: async data without the ceremony

Load orders from an API, show them keyed, and never leak a subscription when the user navigates
away. Resolve the state, `await`, build:

```js
const orderList = component('my-app-order-list', {
  placeholder: () => div('loading orders…'),
  onMount: async ({ id }) => {
    const orders = initState('myapp.orders', [])
    orders.set(await fetch(`/api/orders?user=${id}`).then((response) => response.json()))
    return ul(orders.each((order) => li(order.title), (order) => order.id))
  },
})
```

The bindings built after the `await` are inert DOM until the component mounts them — then they go
live, owned by the component that placed them, and end with it. Only the `initState` call is
position-sensitive (it has to know which component is initializing), and an ordinary closure carries
its handle across the `await`. No ambient async-context machinery needed.

When several states feed one expensive rendering edge — say a chart that redraws from both a dataset
and a filter — the documented pattern is a **headless component**: a component that renders nothing
and only reacts, coalescing bursts of changes into one display update per microtask. It's a pattern
built from the primitives you already know, not a fourth API to learn.

### The theme switcher: a headless component in five lines

Reacting to state from non-UI code — `localStorage`, `document.body`, a third-party chart — is a
component that subscribes and renders nothing:

```js
const themeWatcher = component('my-app-theme-watcher', {
  onMount: () => {
    const theme = useState('myapp.theme')
    theme.watch((value) => document.body.setAttribute('data-theme', value))
  },
})
```

Mount it once; the side effect lives exactly as long as the component does. Unmount it and the
subscription is gone — no `useEffect` return function, no `ngOnDestroy`, no `onCleanup`.

### The multi-team page: state that crosses build boundaries

Here's one no store-based framework can offer: imp's state lookup travels through the **DOM itself**
— the request bubbles up from the asking component, and the nearest ancestor providing that name
answers. Because the handshake rides the DOM rather than a JavaScript module registry, **separately
built and separately deployed widgets share state as long as they share the page.** Your team's
search widget and another team's results panel — bundled independently, shipped independently —
coordinate through `myapp.query` with zero shared code. The lookup even crosses shadow roots at any
depth, so it works inside another library's shadow DOM.

If you've fought micro-frontend state synchronization, you know what that's worth.

### The widget gallery: per-instance state for free

Scoped state means two instances of the same component each own an **independent** state under the
same name. A dashboard full of identical filter widgets needs no key juggling, no ID suffixes, no
factory functions — each widget's subtree sees its own `widget.filters`, and each is released when
its widget unmounts. And a nested component can **shadow** an ancestor's state by initializing the
same name — the same way a nested CSS rule wins over an outer one.

---

## The rules that keep you honest

imp's model is small enough that its guardrails fit in a paragraph — and most of them fire before
your code ever runs:

- **Names are namespaced.** At least two dot-separated segments (`myapp.user`, never `user`).
  Enforced at runtime and by `imp lint` as you type.
- **Init first, use after.** `useState` throws if nothing in scope provides the name — a typo fails
  loudly at the call site, not silently three components away.
- **Init once per scope.** Two independent initializers colliding on one name is an error, not a
  silent merge.
- **Every subscription has an owner.** DOM bindings go live when a component mounts them and end
  when it unmounts; a `watch` outside a mount — module scope, an event handler, after an `await` —
  throws immediately. The `imp/state-setup-before-await` lint rule catches state resolution, and a
  stranded `watch` on a state handle, after an `await` before anything runs.
- **Faults are contained.** A subscriber that throws is logged and skipped while the rest still run;
  a cycle of states setting each other is cut off with an error instead of hanging the page.

---

## The scoreboard

| You're used to...                                     | In imp...                                               |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Store setup, actions, reducers, selectors             | `initState(name, value)` — done                         |
| Provider/Context wrapper components                   | The DOM tree is the provider                            |
| Re-renders + memoization to claw performance back     | No re-renders to optimize away                          |
| `useEffect` with deps array and cleanup function      | `watch(fn)`, cleaned up with its component              |
| `v-if` / `*ngIf` / `<Show>`                           | `state.view((v) => v && node())`                        |
| `v-for` / `*ngFor` / keyed reconciliation config      | `state.each(render, getKey)`                            |
| `computed` refs / memos / selectors + equality tuning | `computed(states, fn)` with content comparison built in |
| Manual unsubscribe / `takeUntilDestroyed` / disposal  | Automatic, deterministic, total                         |
| Micro-frontend state bridges                          | Shared DOM is shared state                              |

## The bottom line

Six operators. One combinator. One prop-binding rule. That is the **entire** state management
surface of imp — small enough to hold in your head, explicit enough to debug by reading, and fast by
construction because there's no render cycle standing between your data and your DOM.

You don't manage state in imp. You just have it.

Ready to see it run? Scaffold an app with `imp` and open the todo example — the whole pattern above
is a working application away.
