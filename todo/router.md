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
- `currentRoute` — a signal of `{ path, query }`; the outlet re-renders when it changes.
- `navigate(path, { replace })` — `pushState`/`replaceState` + updates the signal; `popstate` keeps
  it in sync with back/forward.
- `router()` — a **marker-slot outlet** built exactly like the `when`/`each` structural primitives
  (`todo/reactivity-signals.md`): it runs the matched factory in a fresh child scope and disposes the
  previous one on every navigation, so a route's listeners/effects/fetches are torn down
  automatically. Lazy loads are guarded by a nav token so a slow chunk can't clobber a newer route.
- `link(...)` — a **real `<a href>`** (middle-click, copy-link, and SEO all work) that intercepts
  plain left-clicks and navigates client-side; modifier/target/external/`mailto:` clicks fall
  through to the browser. Listener is bound with the scope's `scopeSignal()` so it auto-detaches.

## Dependencies

Builds directly on the signal graph, scope/disposal, and the marker-slot pattern from
`todo/reactivity-signals.md` (the draft imports `signal`/`effect`/`untrack`, the scope module, and
the `a` factory). Land reactivity first.

## ADR impact

New ADR `client-side-router.md` recording: explicit registration (file-based routing rejected and
why), the current location as a signal, the outlet as a scoped marker-slot primitive, lazy routes
via dynamic `import()` with no build step, and real-anchor `link`. Update the ADR table; document
usage in `docs/`.

## Open questions

- **Nested / layout routes.** The draft is flat — decide whether nested outlets and shared layouts
  are in scope for v1 or a later addition.
- **Scroll restoration & focus management.** Reset scroll and move focus on navigation for
  accessibility; not in the draft.
- **Route-level data / async guards.** Whether to offer a loader/guard hook or leave data fetching
  entirely inside the page factory.
- **`console.error` paths.** Route lazy-load failures through the built-in logger
  (`todo/logger.md`).
