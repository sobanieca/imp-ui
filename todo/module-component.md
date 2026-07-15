# `module` component — scoped "globals" for router modules

Give modules (the units the router swaps between, `router.md`) a dedicated root component,
`module(...)`, that owns everything the module treats as global — instead of letting that land on
`document`.

## Why `document` cannot hold module globals

- Page-wide state (`initState` at module top level) attaches to `document` and lives for the page
  (`adr/event-propagated-state.md`).
- ES modules evaluate **once per page**: a lazily imported module's top-level code runs on first
  navigation and never again. The router therefore cannot "clean up" a module's page-wide state on
  switch — navigating back would reuse the cached module without re-running `initState`, and every
  `useState` in it would throw. Module-lifetime globals must come from something that re-runs on
  every entry: a component mount.
- `document` stays reserved for app-lifetime state that deliberately survives module switches
  (session, theme, cart) — the router must never touch those.

## The `module` component

- A thin root wrapper the router mounts as the module's boundary. Module-lifetime "globals" are
  `initState` calls inside its mount, so they attach to the module's host element — nearest-provider
  resolution gives every descendant the module's state before any page-wide one, and the existing
  mount cleanup releases all of it when the router swaps the module out. No new teardown machinery.
- Natural home for the module's error boundary (`adr/error-boundaries.md`) and for whatever
  module-level lifecycle the router needs (enter/leave hooks, lazy-load placeholder).

## Keeping modules honest

- **Lint**: flag module-top-level `initState` outside the app's declared entry files (rule
  infrastructure exists in `imp lint`; entries could be declared in `imp.json`).
- **Router tripwire**: page-wide registrations all pass through one code path, so the router can
  snapshot them around a lazy `import()` and `console.error` when module evaluation created
  page-wide state, pointing at the `module` component instead.

## `onRelease` — user cleanup for globals the module touched

Scoped state cleans itself up, but a module may also mutate real globals imp cannot see — a
`window.gtag` set by an analytics snippet, a third-party library initialized once, a `<link>`
appended to `head`. The `module` component must offer a hook to undo those when the router swaps the
module out.

- **Name: `onRelease`** (`onClose` was considered). "Release" is the vocabulary the state ADR
  already uses ("state is released when its component unmounts"), it does not collide with the
  component-level `onUnmount` (different granularity — see below), and it keeps `onLeave` free for a
  possible future navigation guard, which is a different concept (may cancel navigation; cleanup
  never can).
- **Registration-based and callable anywhere inside the module**, not a single teardown method on
  the module definition: `onRelease(fn)` during any mount within the module subtree registers `fn`
  with the nearest enclosing `module` boundary. The undo is written next to the mutation instead of
  collected in one far-away function that has to know everything the module touched:

  ```js
  onMount: () => {
    window.gtag = setupAnalytics()
    onRelease(() => delete window.gtag)
    ...
  }
  ```

- **Mechanics**: the same DOM handshake as state resolution — a bubbling, composed event dispatched
  from the calling component's host, answered by the nearest module host — so it crosses shadow
  roots and works across separately bundled code. Registered functions run fault-isolated
  (`adr/error-boundaries.md`) when the module unmounts, alongside the automatic state/subscription
  cleanup. Called with no `module` above, it throws — misuse surfaces immediately.
- **Why not just component `onUnmount`?** A global mutation may outlive the component that made it
  but must not outlive the module: widget A lazily initializes the third-party library, widget B
  keeps using it after A unmounts, and the library must be gone when the module is. `onRelease`
  expresses exactly that lifetime; `onUnmount` stays the right place for component-lifetime teardown
  (timers, sockets).
- The `document` proxy below would automate what `onRelease` does manually; they compose — the proxy
  shrinks how often `onRelease` is needed, and `onRelease` covers what a proxy can never see
  (globals reached without going through `document`).

## `document` proxy — TBD

Module code may also mutate `document` directly (event listeners, properties/methods it adds, `head`
elements). Idea: hand module code a proxy of `document` that records such additions and reverts them
on module unmount. Deliberately deferred — needs design around proxy identity vs the real
`document`, third-party code that captures `document` itself, and which surfaces to intercept.

## ADR impact

When implemented, record the decision (module boundary is a DOM boundary; `document` is app-lifetime
only) as a new ADR or fold it into `client-side-router.md` (planned in `router.md`).
