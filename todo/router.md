# Router — client-side SPA routing

Give imp a small, buildless SPA router: explicit route registration, a reactive outlet, History-API
navigation, and an accessible in-app link. A working draft is `prev/experiment/imp/router.js`.

## Explicit registration, no file-based routing

File-based routing was considered and **rejected** — it contradicts the buildless, no-scan model
(see `prev/review.md`). Routes are registered explicitly:

```js
route('/', () => homePage())
route('/todos/:id', ({ params }) => todoPage(params.id))
route('*', () => notFound())
route('/admin', () => import('./pages/admin.js')) // lazy, still buildless — uses module default
mount('#app', () => div([nav(), router()]))
```

A factory receives `{ params, query }` and returns a Node — or a Promise of a Node / component
function / module with a default export (dynamic `import()` for lazy routes). The outlet is empty
while a lazy chunk loads.

## Pieces (port from the draft)

- `route(pattern, factory)` — registers a pattern; `:param` segments and a `*` wildcard fallback.
- `currentRoute` — an app-lifetime state of `{ path, query }`, initialized by the outlet in its
  `onMount` (the outlet is the app-wide root that owns routing; there is no module scope to hold it,
  `adr/event-propagated-state.md`). The outlet keeps the handle and re-renders when it changes.
- `navigate(path, { replace })` — `pushState`/`replaceState` + `set`s the state through the handle
  the outlet closes over (`get`/`set` work anywhere); `popstate` keeps it in sync with back/forward.
- `router()` — the **outlet**, naturally an imp component (`adr/web-component-lifecycle.md`): it
  subscribes to `currentRoute` in `onMount` and swaps the matched factory's output in. Because route
  pages are components too, swapping the DOM unmounts the old page — its scoped state and
  subscriptions are torn down automatically; `placeholder` covers lazy-chunk loading, and a nav
  token guards a slow chunk from clobbering a newer route.
- **Route modules must leave nothing behind.** Everything a route creates has to be released when
  the route is swapped out, which the component lifecycle already guarantees — provided the module
  plays by scope rules: every route-lifetime state is an `initState` in the route's **root
  component** (state is owned by its component — a mounting-component `initState` is the only form
  there is, so route state is released when the route root unmounts), subscriptions live in mounts
  (enforced), and timers/sockets go through `onUnmount` (teardown is fault-isolated per
  `error-boundaries.md`, so one bad hook cannot leak the rest). The planned `module` component
  (`module-component.md`) makes that root boundary a first-class piece and adds enforcement (lint +
  import tripwire). The docs' screen-scoping guidance (`docs/state.md`, _Scope and lifetime_) is
  written to match; the router docs should restate it for route modules specifically.
- **The outlet (or route root) is the error boundary.** A failed dynamic `import()` or a route page
  whose async `onMount` rejects routes to the nearest `onError` (`error-boundaries.md`) — the outlet
  should either define a default `onError` fallback or document that each route root should bring
  one, so a broken lazy chunk degrades to declared UI instead of a stuck placeholder.
- `link(...)` — a **real `<a href>`** (middle-click, copy-link, and SEO all work) that intercepts
  plain left-clicks and navigates client-side; modifier/target/external/`mailto:` clicks fall
  through to the browser.

## Dependencies

Builds directly on the component lifecycle (`adr/web-component-lifecycle.md`) and scoped state
(`adr/event-propagated-state.md`) — both landed. The `prev/` draft predates them (it imports the
rejected signal-graph modules), so porting means re-expressing the outlet on components, not
copying.

## ADR impact

New ADR `client-side-router.md` recording: explicit registration (file-based routing rejected and
why), the current location as app-lifetime state owned by the outlet, the outlet as a component,
lazy routes via dynamic `import()` with no build step, and real-anchor `link`. Update the ADR table;
document usage in `docs/`.

## Open questions

- **Nested / layout routes.** The draft is flat — decide whether nested outlets and shared layouts
  are in scope for v1 or a later addition.
- **Scroll restoration & focus management.** Reset scroll and move focus on navigation for
  accessibility; not in the draft.
- **Route-level data / async guards.** Whether to offer a loader/guard hook or leave data fetching
  entirely inside the page factory.
- **`console.error` paths.** Route lazy-load failures through the built-in logger
  (`todo/logger.md`).
