# components - custom elements with a setup lifecycle

`component(name, definition)` comes from `imp`. It returns a factory that you call like an element
factory from [rendering](rendering.md). Each component is a real custom element. It renders into its
**own shadow root**, and its logic runs after the browser connects it to the document.

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

div(header(), profile(), footer()) // used like any factory
```

**The name is the HTML tag.** It is lowercase and holds at least one dash, such as `my-app-profile`.
The `imp/component-name` lint rule enforces this, and a bad name throws at runtime. The default
display of the host is `display: contents`. To make the host a box, set `:host { display: block }`
in `styles`.

## The definition object

| Key                           | Returns | Runs                                                                                 |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `loading(...args)`            | DOM     | before mount, while an async `setup` runs, and on remount. It gets no `self`.        |
| `setup(self, ...args)`        | DOM     | on connect, a parent before its children, before imp places the DOM. Can be `async`. |
| `error(self, error, ...args)` | DOM     | when `setup` or a descendant fails. Makes the component an error boundary.           |
| `onMount(self, ...args)`      | nothing | after imp places the DOM and the browser lays it out. Focus, measure, scroll here.   |
| `onRemove(self, ...args)`     | nothing | on removal, before imp empties the shadow root. Can be `async`.                      |
| `styles`                      | -       | a CSS string. imp compiles it once per component, scoped to the shadow root.         |

A key that returns DOM is a noun. A key named `on*` is an effect, and imp discards its return value.
`...args` are the arguments of the factory call, without a change. So `profile({ id: 42 })` gives
`setup(self, { id: 42 })`. Only `setup` is required.

## self

`self` is what a component knows about itself during one mount. imp creates a new one per mount and
passes it first to `setup`, `error`, `onMount` and `onRemove`. Name the parameter `self`.

| Member                  | Use                                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| `self.host`             | the custom element. Its shadow root is `self.host.shadowRoot`.            |
| `self.abortSignal`      | aborted when the mount ends. A move keeps it. Hand it to `fetch`.         |
| any property you assign | reaches `onMount`, `error` and `onRemove`. Store a node, a timer, a stop. |

`self` is also the key that resolves a resource through the DOM. `initState(self, name, value)` and
`useState(self, name)` from `imp/state`, and `initHttpClient(self, name, options)` and
`useHttpClient(self, name)` from `imp/http`, all take `self` first, see [state](state.md) and
[http](http.md). Every resolution works at any point in `setup`, before or after any number of
`await` calls. `useState(self, name)` returns the same handle for the same name during one mount. In
`onRemove` it returns the handle that `setup` resolved. A name that `setup` never resolved throws
there.

## Lifecycle

1. **Call.** The factory creates the host element, which holds the `loading` content. Nothing else
   runs.
2. **Mount.** On insertion into the document, `setup` runs. Its output replaces the loading content.
   `onMount` runs on the next frame.
3. **Unmount.** On removal, imp releases every state binding, runs `onRemove`, aborts
   `self.abortSignal`, and empties the shadow root.
4. **Remount.** A later insertion renders `loading` again and starts a new cycle with a new `self`.

**A move is not an unmount.** A removal and an insertion in the **same synchronous task** is a move.
`setup` does **not** run again, and the DOM, `self` and `self.abortSignal` survive. imp resolves
again only what came through the DOM, which is the `useState` handles and the `useHttpClient`
handles. It resolves them against the new ancestors. An insertion in a later task is a real remount.
This is also how you force a remount.

## Rules an agent gets wrong

- **The DOM of `setup` is not in the shadow root while `setup` runs.** imp inserts it after `setup`
  returns, and after the promise resolves for an async `setup`. A query on `self.host.shadowRoot`
  there finds the loading content, which is the `imp/no-root-query-in-setup` lint error. Keep the
  node in a variable, or store it on `self` and use it in `onMount`.
- **`onMount` is a definition key, not a call.** To reach a node that `setup` made after a fetch,
  write `self.field = input(...)` in `setup` and `self.field.focus()` in `onMount`. A throw in
  `onMount` is a mount failure. `onMount` does not run after `error`.
- **`loading` with a synchronous `setup` is never visible**, and imp warns. The lint rule is
  `imp/loading-with-async-setup`. Use it with an async `setup`, or with a `setup` that returns a
  promise, or remove it. A `loading` that returns `null` for the given arguments renders nothing,
  and imp does not warn.
- **`loading` cannot bind state.** imp builds it before the component mounts, and it gets no `self`.
  So `state.text()`, `state.view()`, `state.each()` and a state-bound prop render empty inside it,
  and never update. A handle that you pass in as a factory argument does not throw, so imp warns
  once and names the component. Pass a plain value, and keep the bindings in `setup`. The lint rule
  is `imp/no-self-in-loading`.
- **Pass `self` to `watch`.** `theme.watch(self, paint)` stops when the mount ends. A bare
  `theme.watch(paint)` in a component registers no cleanup and keeps running after the unmount,
  which the `imp/watch-with-self` lint rule reports. `text`, `view`, `each` and a bound prop need
  nothing. imp releases them with the DOM.
- **Resolve in `setup`, reach again in `onRemove`.** `useState(self, name)` in `onRemove` returns
  the handle that `setup` resolved, so a component withdraws what it contributed with
  `onRemove: (self) => useState(self, 'myapp.nav').set(null)`. A name that `setup` never resolved
  throws there, because the host has left the page. The lint rule is `imp/on-remove-through-self`.
- **A resolution after the component left the page throws.** An async `setup` that awaits past an
  unmount cannot call `useState` or `useHttpClient` after the `await`. Check
  `self.abortSignal.aborted` when that can happen. The lint rule is `imp/abort-check-after-await`.
- **Never store a per-mount resource at module scope.** Use `self`. Every mount then gets its own
  resource. The lint rule is `imp/no-self-at-module-scope`.
- **The internals of a component are private.** `document.querySelector` and a page CSS rule stop at
  the boundary. To hold a live handle on something that a child shows, build the node in the parent
  and pass it in.
- **Your `styles` do not reach a node you pass to another component.** The component appends it into
  its own shadow root, and a layout such as `stack` or `flex` is a component too. So
  `stack({}, div({ class: 'usage' }))` renders the div without your `.usage` rule. In development,
  imp logs a warning that names your component, the rule and the component that holds the element.
  `imp build` drops the check. Give the box its own component, use a standard component such as
  `card` or `text`, or set an inline `style`. `div({ class: 'usage' }, stack(...))` is fine, because
  the div stays in your tree.
- **`host.focus()` works from outside.** The host of a component forwards the focus to the first
  focusable element that it renders. Keep the return value of the factory and focus that value.
  Never reach into the `shadowRoot` of another component to focus its control.
- Inside a handler, `event.target.getRootNode().host` replaces `closest('my-app-card')` in shadow
  DOM.
- **A strict content model needs one component.** `<table>` and `<select>` are examples. Render the
  whole structure in one component. A host tag between `<table>` and `<tr>` breaks the content
  model.
- **`label[for]` and an ARIA id reference cannot cross a shadow root.** A control, its label and its
  form belong in one component. A form control inside a component does not join a `<form>` outside
  it.
- When you define the same name twice, imp warns and keeps the first definition.

## Styles, errors, loading

```js
const userCard = component('my-app-user-card', {
  styles: `.card { display: flex; gap: 8px; border: 1px solid var(--imp-color-border, #cbd5e1) }`,
  loading: () => div({ class: 'skeleton' }, 'loading...'),
  setup: async (self, { id }) => {
    const user = await useHttpClient(self, 'myapp.api').get(`/users/${id}`)
    self.field = input({ value: user.name })
    return div({ class: 'card' }, self.field)
  },
  onMount: (self) => self.field.focus(),
  onRemove: (self) => useState(self, 'myapp.nav').set(null),
  error: (self, error) => div({ class: 'error' }, error.message),
})
```

- CSS is isolated in both directions. The `--imp-*` custom properties of [theming](theming.md)
  inherit **into** the component. A page rule can style the host tag and win against `:host`. To
  share CSS, compose plain strings.
- An async `setup` shows the loading content until it settles. imp discards a result that arrives
  after unmount. A rejection goes to the nearest boundary. An `HttpError` from an [http](http.md)
  client arrives there like any other error.
- `error` catches a **mount failure** in the component and in its subtree. This includes a failed
  lazy load and a throw in `onMount`. It renders in place of the children, and it handles **one
  error per mounted period**. It gets the same `self`, so it can bind a state or keep
  `self.abortSignal` for a retry. It does not catch an error in an event handler or in a state
  subscriber.
- imp releases a binding automatically on unmount. This covers `text`, `view`, `each`, a bound prop
  and a `watch(self, fn)`. Use `onRemove` for what imp cannot see: a timer, a socket, a third-party
  widget. `onRemove` can be `async`. A remount aborts `self.abortSignal` while an async `onRemove`
  still runs, so check `self.abortSignal.aborted` before you touch a shared resource there.

## Every component ships a skill file

Put `counter.skill.md` next to `counter.js`. It gives the import, the call shape, a prop table, the
events and the mistakes that the component invites. The first line is the summary, so start it with
the component name. Read one with `imp skill ./components/counter.js`. `imp build counter.js` copies
the file to `imp-skill.md` beside the bundle. imp puts no skill text into a bundle, see
[build](build.md). Read [skill](skill.md) to learn how to write one. Write a sidecar for every
component that you build. Give the component a `*.preview.js` sibling as well, so a person can look
at it. The preview page shows the sidecar as its Skill tab, and it shows the `imp skill` command of
the component. See [preview](preview.md). The rules that make the component fit next to a standard
one, for the theme, the direction, the wording and accessibility, are in
[custom-components](custom-components.md).
