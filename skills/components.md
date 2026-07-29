# components — custom elements with an onMount lifecycle

`component(name, definition)` (from `imp`) returns a factory you call like an element factory from
[rendering](rendering.md). Each component is a real custom element rendering into its **own shadow
root**, and its logic runs after it is connected to the document.

```js
import { component } from 'imp'
import { div, span } from 'imp/html'
import { useState } from 'imp/state'

export const profile = component('my-app-profile', {
  onMount: () => {
    const user = useState('myapp.user')
    return div(span(user.text((u) => u.name)))
  },
})

div(header(), profile(), footer()) // used like any factory
```

**The name is the HTML tag**: lowercase, at least one dash (`my-app-profile`). Enforced by the
`imp/component-name` lint rule; a bad name throws at runtime. The host defaults to
`display: contents` — set `:host { display: block }` in `styles` if you want it to be a box.

## The definition object

| Key                            | Required | What it does                                                                               |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------ |
| `onMount(instance, ...args)`   | yes      | Runs on connect (parents before children); returns the DOM. May be `async`.                |
| `placeholder(...args)`         | no       | At-rest content: before mount, while an async `onMount` runs, and on remount. No instance. |
| `onUnmount(instance, ...args)` | no       | Teardown imp cannot do (timers, sockets, third-party widgets). May be `async`.             |
| `onError(error, ...args)`      | no       | Makes the component an error boundary for itself and its subtree.                          |
| `styles`                       | no       | CSS string, compiled once per component, scoped to its shadow root.                        |

`...args` are the factory-call arguments verbatim: `profile({ id: 42 })` →
`onMount(instance, { id: 42 })`.

## The instance

| Member                    | Use                                                                            |
| ------------------------- | ------------------------------------------------------------------------------ |
| `instance.host`           | the component's own element in the document                                    |
| `instance.root`           | its shadow root — safe to query only **after** mount                           |
| `instance.afterMount(cb)` | run `cb` once the returned DOM is placed and laid out (focus, measure, scroll) |
| `instance.abortSignal`    | aborted on unmount/remount; for `fetch`/listeners in remountable components    |
| any property you assign   | passed through to `onUnmount` — the right home for per-mount resources         |

`afterMount` takes **one** callback per mount (a second call throws); do several things inside it. A
throw there is a mount failure and goes to the nearest boundary. It is cancellation-safe.

## Lifecycle

1. **Call** — the factory creates the host element holding the placeholder. Nothing else runs.
2. **Mount** — on insertion into the document `onMount` runs; its output replaces the placeholder.
3. **Unmount** — on removal imp unsubscribes every state binding, runs `onUnmount`, restores the
   placeholder.
4. **Remount** — re-inserting later starts a fresh cycle.

**Move vs. unmount:** removed and re-inserted in the **same synchronous task** = a move — `onMount`
does **not** re-run, DOM and instance survive, and only `useState` bindings re-resolve against the
new ancestors. Re-inserting in a later task is a real remount (also the way to force one).

## Rules an agent gets wrong

- **`onMount`'s DOM is not in the shadow root while `onMount` runs** — imp inserts it after
  `onMount` returns (after the promise resolves, when async). Querying `instance.root` there finds
  the placeholder (`imp/no-root-query-in-mount` lint error). Keep the node in a variable and mutate
  it, or use `instance.afterMount`.
- **A `placeholder` with a synchronous `onMount` is never seen** and warns. Pair it with an async
  `onMount` (or one returning a promise), or drop it.
- **Resolve state before the first `await`.** `initState`, `useState`, and `watch` throw past it
  under the `imp/state-setup-before-await` rule of [lint](lint.md). `get`/`set` and DOM built from
  the handles work anywhere — the full rules are in [state](state.md).
- **Never store per-mount resources at module scope** — use the instance; every mount gets its own.
- **Component internals are private.** `document.querySelector` and page CSS stop at the boundary.
  For a live handle on something a child shows, build the node in the parent and pass it in.
- Inside a handler, `event.target.getRootNode().host` is the shadow-DOM replacement for
  `closest('my-app-card')`.
- **Strict content models** (`<table>`, `<select>`): render the whole structure in one component — a
  host tag between `<table>` and `<tr>` breaks the content model.
- **`label[for]` and ARIA id references cannot cross a shadow root.** A control, its label and its
  form belong in one component. Form controls inside a component do not join a `<form>` outside it.
- Defining the same name twice warns and keeps the first definition.

## Styles, errors, loading

```js
const userCard = component('my-app-user-card', {
  styles: `.card { display: flex; gap: 8px; border: 1px solid var(--imp-color-border, #cbd5e1) }`,
  placeholder: () => div({ class: 'skeleton' }, 'loading…'),
  onMount: async (instance, { id }) => {
    const user = await fetch(`/api/users/${id}`).then((r) => r.json())
    const field = input({ value: user.name })
    instance.afterMount(() => field.focus())
    return div({ class: 'card' }, field)
  },
  onError: (error) => div({ class: 'error' }, error.message),
})
```

- CSS is isolated both ways. The `--imp-*` custom properties of [theming](theming.md) inherit
  **in**; page rules can style the host tag and win over `:host`. Share CSS by composing plain
  strings.
- An async `onMount` shows the placeholder until it settles; a late result after unmount is
  discarded. A rejection goes to the nearest boundary.
- `onError` catches **mount failures** in the component and its subtree (including failed lazy loads
  and `afterMount` throws), renders in place of the children, and handles **one error per mounted
  period**. It does not catch errors in event handlers or state subscribers.
- Subscriptions are released automatically on unmount — `watch`, `text`, `view`, `each` and bound
  props alike. `onUnmount` is only for what imp cannot see.

## Every component ships a skill file

`counter.js` → `counter.skill.md` next to it: the import, the call shape, a prop table, the events,
the mistakes it invites. First line is the summary, so start it with the component name. Read one
with `imp skill ./components/counter.js`. `imp build counter.js` folds it into the bundle as
`impSkill`; an HTML build strips all skill text — see [build](build.md), and [skill](skill.md) for
how to write one. Write one for every component you build, and give it a `*.preview.js` sibling so a
person can look at it.
