# A scoped contribution helper over `useState`

## The situation

A screen that contributes to a shared state on mount, and withdraws on unmount, always writes the
same shape. It resolves the state in `build`. It keeps the handle on the instance. It calls `set`
for the contribution. Then it calls `set` again, in `teardown`, to withdraw. Today that shape
appears in one place. That is the nav case in `docs/std-components.md`, where a screen for a project
announces itself, so that the shell can build its rows.

## What to do, when the shape repeats

When several components contribute a piece of one state, add a helper that registers its own cleanup
through the mount scope. Examples of such a state are the nav rows, the toasts, the breadcrumbs, and
a status line. The half in `teardown` is then unnecessary:

```js
const projectScreen = component('acme-project', {
  build: (instance, projectId) => {
    contribute('acme.nav.project', { id: projectId })
    return overview(projectId)
  },
})
```

The helper keys the contribution by the contributor, which is the host, or an explicit key. It calls
`set` on the mount. The same list of cleanups that releases a subscription removes the contribution
on the unmount. Do this only when a second real case appears. One caller does not justify a second
way to write to a state.
