# components - custom elements with a build lifecycle

`component(name, definition)` comes from `imp`. It returns a factory that you call like an element
factory from [rendering](rendering.md). Each component is a real custom element. It renders into its
**own shadow root**, and its logic runs after the browser connects it to the document.

```js
import { component } from 'imp'
import { div, span } from 'imp/html'
import { useState } from 'imp/state'

export const profile = component('my-app-profile', {
  build: () => {
    const user = useState('myapp.user')
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

| Key                           | Required | What it does                                                                                         |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `build(instance, ...args)`    | yes      | Runs on connect, a parent before its children. Returns the DOM. Can be `async`.                      |
| `placeholder(...args)`        | no       | The content at rest: before mount, while an async `build` runs, and on remount. It gets no instance. |
| `teardown(instance, ...args)` | no       | The teardown that imp cannot do: a timer, a socket, a third-party widget. Can be `async`.            |
| `fallback(error, ...args)`    | no       | Makes the component an error boundary for itself and its subtree.                                    |
| `styles`                      | no       | A CSS string. imp compiles it once per component, scoped to the shadow root.                         |

`...args` are the arguments of the factory call, without a change. So `profile({ id: 42 })` gives
`build(instance, { id: 42 })`.

## The instance

| Member                    | Use                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `instance.host`           | the element of the component in the document                                                                 |
| `instance.root`           | its shadow root. Query it only **after** mount.                                                              |
| `instance.afterMount(cb)` | runs `cb` after imp places the returned DOM and the browser lays it out. Use it to focus, measure or scroll. |
| `instance.abortSignal`    | aborted on unmount and on remount. Use it for `fetch` and listeners in a component that remounts.            |
| any property you assign   | passes through to `teardown`. This is the home for a per-mount resource and a state handle.                  |

`afterMount` takes **one** callback per mount. A second call throws. Do several things inside the
one callback. A throw inside it is a mount failure, and it goes to the nearest boundary.
`afterMount` is safe against cancellation.

## Lifecycle

1. **Call.** The factory creates the host element, which holds the placeholder. Nothing else runs.
2. **Mount.** On insertion into the document, `build` runs. Its output replaces the placeholder.
3. **Unmount.** On removal, imp unsubscribes every state binding, runs `teardown` and restores the
   placeholder.
4. **Remount.** A later insertion starts a new cycle.

**A move is not an unmount.** A removal and an insertion in the **same synchronous task** is a move.
`build` does **not** run again, and the DOM and the instance survive. imp resolves again only what
came through the DOM, which is the `useState` bindings and the `useHttpClient` handles. It resolves
them against the new ancestors. An insertion in a later task is a real remount. This is also how you
force a remount.

## Rules an agent gets wrong

- **The DOM of `build` is not in the shadow root while `build` runs.** imp inserts it after `build`
  returns, and after the promise resolves for an async `build`. A query on `instance.root` there
  finds the placeholder, which is the `imp/no-root-query-in-build` lint error. Keep the node in a
  variable and change it, or use `instance.afterMount`.
- **A `placeholder` that renders content with a synchronous `build` is never visible**, and imp
  warns. Use it with an async `build`, or with a `build` that returns a promise, or remove it. A
  `placeholder` that returns `null` for the given arguments renders nothing, and imp does not warn.
- **A `placeholder` cannot bind state.** imp builds it before the component mounts. So
  `state.text()`, `state.view()`, `state.each()` and a state-bound prop render empty inside a
  placeholder, and never update. `initState` and `useState` throw there. A handle that you pass in
  as a factory argument does not throw, so imp warns once and names the component. Pass a plain
  value, and keep the bindings in `build`.
- **Resolve state, an http client and the `router()` of an area before the first `await`.**
  `initState`, `useState`, `watch`, `initHttpClient`, `useHttpClient` and a `router()` with no table
  throw after the first `await`. The rules are `imp/state-setup-before-await`,
  `imp/http-client-setup-before-await` and `imp/router-setup-before-await`, see [lint](lint.md).
  `get` and `set`, a call through a client handle, and DOM built from any of them work anywhere. The
  full rules are in [state](state.md), [http](http.md) and [routing](routing.md).
- **Never store a per-mount resource at module scope.** Use the instance. Every mount then gets its
  own resource.
- **The internals of a component are private.** `document.querySelector` and a page CSS rule stop at
  the boundary. To hold a live handle on something that a child shows, build the node in the parent
  and pass it in.
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
  placeholder: () => div({ class: 'skeleton' }, 'loading...'),
  build: async (instance, { id }) => {
    const api = useHttpClient('myapp.api') // before the first await - imp skill http
    const user = await api.get(`/users/${id}`)
    const field = input({ value: user.name })
    instance.afterMount(() => field.focus())
    return div({ class: 'card' }, field)
  },
  fallback: (error) => div({ class: 'error' }, error.message),
})
```

- CSS is isolated in both directions. The `--imp-*` custom properties of [theming](theming.md)
  inherit **into** the component. A page rule can style the host tag and win against `:host`. To
  share CSS, compose plain strings.
- An async `build` shows the placeholder until it settles. imp discards a result that arrives after
  unmount. A rejection goes to the nearest boundary. An `HttpError` from an [http](http.md) client
  arrives there like any other error.
- `fallback` catches a **mount failure** in the component and in its subtree. This includes a failed
  lazy load and a throw in `afterMount`. It renders in place of the children, and it handles **one
  error per mounted period**. It does not catch an error in an event handler or in a state
  subscriber.
- imp releases a subscription automatically on unmount. This covers `watch`, `text`, `view`, `each`
  and a bound prop. Use `teardown` only for what imp cannot see.
- **`useState` throws in `teardown`.** The host has left the page, so there is nothing to resolve
  from. To withdraw what a mount contributed, resolve in `build` and keep the handle:
  `instance.project = useState('myapp.nav.project')`, then
  `teardown: (instance) => instance.project.set(null)`. `get` and `set` on a handle work anywhere.

## Every component ships a skill file

Put `counter.skill.md` next to `counter.js`. It gives the import, the call shape, a prop table, the
events and the mistakes that the component invites. The first line is the summary, so start it with
the component name. Read one with `imp skill ./components/counter.js`. `imp build counter.js` folds
the file into the bundle as `impSkill`. An HTML build removes all skill text, see [build](build.md).
Read [skill](skill.md) to learn how to write one. Write a sidecar for every component that you
build. Give the component a `*.preview.js` sibling as well, so a person can look at it. Point the
`description` export of the preview back at the sidecar, as in
`export const description = "Run 'imp skill ./components/counter.js' before writing code with it."`
See [preview](preview.md).
