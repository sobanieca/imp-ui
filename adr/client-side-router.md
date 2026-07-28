# Client-side router

## Context

A single-page app needs to map the browser's URL to a screen, swap screens on navigation, and do it
without a build step or a route-scanning compiler. imp already has the two primitives a router
needs: the component lifecycle, which mounts, shows a loading placeholder, catches errors, and tears
everything down on removal (`web-component-lifecycle.md`, `error-boundaries.md`); and DOM-scoped
state, whose `view` binding swaps a region's DOM when a state changes and disposes the previous
render's subscriptions (`event-propagated-state.md`). The question was how much new machinery a
router adds on top — and the answer had to preserve the buildless model, release everything a screen
created when the screen is left, load rarely-visited sections on demand without a bundler, keep deep
links and refresh working, and be accessible.

Two shapes were rejected. **File-based routing** contradicts the no-scan, buildless model and would
require a compiler to enumerate routes. **Ambient global registration** — a free
`route(pattern,
factory)` that mutates a hidden module-level list as an import side effect —
scatters the route map across files, makes "what renders here?" un-greppable, and provides no
natural boundary for a sub-section of the app to own its own routes. The route map should be **data
declared in one place**, not a side effect executed from anywhere.

## Decision

**The router is a component-shaped element you drop into your layout, fed a declarative route table
as data.** The public surface is `router`, `area`, `navigate`, `useRoute`, and `url` — no new
lifecycle or scheduler; a screen cleans up through the ordinary component `onUnmount`.

- **`router({ routes, placeholder, onError, onNotFound })` renders the matched screen.** It is the
  slot the current screen appears in — everything around it (header, sidebar, footer) persists
  across navigations; only its contents change. It behaves like a regular imp component and takes
  the same lifecycle options a component does (`placeholder`, `onError`), plus a single
  `onNotFound`. Because a router is just an element you place, an app can have none (a plain
  component tree, e.g. for SSR) or one — the documented shape is one router per app.

- **Routes are a table, not registrations.** `routes` is an object mapping a path pattern to its
  target: `{ '/': () => home(), '/todos/:id': ({ params }) => detail(params.id) }`. A pattern is a
  path with `:param` segments; matching splits on `/`, ignores empty segments (trailing slashes
  don't matter), requires an equal segment count for a screen, and `decodeURIComponent`-decodes
  params. **First match wins, in the table's declaration order** — object key order is the priority
  order, so a static path listed before a param path shadows it. There is no `*` wildcard; the
  fallback for unmatched URLs is `onNotFound`, keeping "the 404" a single named concept.
  `area({ routes, root, translations })` is a validating builder that brands a table and carries the
  section's root component and translations; it exists for one use — an area's `export default` from
  its own file (below). The top-level `routes:` option is written as a plain object.

- **An area is a table entry whose target is another table, and it is always lazy.** A section of
  the app that owns a group of routes under a URL prefix (`/admin`, `/shop`) is expressed by mapping
  the prefix to an `area()` marker rather than a screen factory
  (`'/admin': area(() => import('./admin/area.js'))`), whose module exports
  `export default area({ routes, translations })`. **One name covers both halves, dispatched by
  argument type** (`type-based-argument-dispatch.md`): a function is the parent's pointer at a
  chunk, an object is that chunk's own declaration of what it contains. The two never appear in the
  same position, so there is nothing to disambiguate by eye — and an area definition placed directly
  in a table is rejected with the wrapped form spelled out. There is **no eager form** — a prefix's
  target is never a plain nested object; an area exists precisely to code-split a section behind a
  dynamic `import()`, so every area loads on demand. Sub-routes are written **relative** to the
  prefix. Because a table nests, hierarchical routing falls out of the same data model with no
  global scope registry and no separate boundary primitive — each area owns its routing surface in
  its own file, and the composition root names every area in one place.

- **An area may declare a `root`, the one component that outlives the section's screens.** `root` is
  a factory returning the component the section's screens render inside; the area's screens render
  into a `router()` call written **without a table** somewhere in that component's tree. The area's
  route page provides its table, its consumed prefix depth and its prefix params through the shared
  provider seam (`event-propagated-state.md`, the same DOM lookup state and the HTTP client use, on
  its own `kind`), and a table-less `router()` resolves the nearest one — so the slot is written
  where the layout wants it, without the area threading anything into its own components. This is
  the only way to hold something for exactly one section: a root is keyed with the area, so it
  survives navigation _between_ the section's screens and unmounts when the user leaves the prefix,
  which a layout wrapped around each screen factory cannot do (it remounts on every navigation, and
  a section-scoped state or HTTP client with it). `root` is optional and its absence is the previous
  behaviour exactly — the area's route page renders the nested router itself. It receives the same
  `{ params, query }` a screen factory does, so a prefix param reaches the shell, and a table-less
  `router()` outside an area throws with both fixes named.

- **An area declares the translations it needs, and the router owns their lifetime.** `translations`
  on an area definition is a map of language code to loader (`translatable-by-default.md`). The
  router loads the entry for the current language **before** rendering the area's first screen, so
  the section never paints untranslated, and drops it through the route page's own cleanup when the
  user leaves the area — the same unmount that releases the section's DOM, state and subscriptions.
  Navigating **within** an area keeps the section mounted, so its messages load once per visit, not
  once per screen.

- **A table has exactly two kinds of target: a screen that renders immediately, or an area that
  loads on demand.** A screen factory is a function returning DOM synchronously; an area is an
  `area()` marker. Code splitting therefore has a single unit — the area — so a table answers "what
  does this URL cost to reach?" by being read, with one rule to learn ("a screen is here now, an
  area arrives on demand") rather than laziness being a property of two different things. Splitting
  a single rarely-visited screen is a one-entry area. A screen factory that returns a thenable
  throws, with a message pointing at `area()`, rather than being awaited. The `area()` marker is
  what makes a pattern match as a **prefix** — everything under it — while every other pattern
  matches exactly; that distinction is not inferable from the target itself. Any other target —
  including a plain nested object — is rejected at table-validation time.

- **The current location is a single app-lifetime state, `imp.route` (`{ path, query }`).** There is
  exactly one location per page and it outlives every screen and every router, so the router creates
  it once as a framework-internal detached state the first time anything touches routing.
  `useRoute()` returns a read-only handle (`get`/`watch`/`text`/`view`/`each`, no `set`) so any
  component anywhere — a nav bar outside a router, a breadcrumb deep inside a screen — can read the
  path/query and react to navigation.

- **The router keys the matched screen by pattern + params, not by the whole URL.** Internally the
  router is `computed([imp.route], key).view(renderMatched)`, where `key` is
  `{ kind, pattern,
  params }`. Because `computed` notifies only when its outcome changes by
  content, a **query-only** navigation keeps the current screen mounted; the screen reacts to the
  query, if it cares, through `useRoute()`. Navigating to a different pattern or different params
  swaps the screen: the `view` re-renders, disposing the previous render, so the leaving screen
  unmounts and its component-scoped state and subscriptions are released through the ordinary
  lifecycle. An **area is keyed by its prefix (plus any prefix-level params), not the tail** — so
  navigating _within_ an area keeps the area mounted and only its nested router swaps sub-screens; a
  prefix param changing (`/org/:orgId`) remounts the area.

- **Each matched screen mounts inside an internal `imp-route` component**, which is where on-demand
  loading, the loading placeholder, the stale-navigation guard, and the error boundary come from —
  all already provided by the component lifecycle. Its `onMount` calls the target factory with
  `{ params, query }` and returns the result: for a screen that is a `Node`, rendered synchronously
  with no placeholder flash. An area renders through the same wrapper: the area's factory awaits its
  `area()` loader for the table and returns a **nested `router` bound to the tail** (the parent
  prefix stripped, prefix params merged in), so an area is simply "a screen that is itself a nested
  router" — or, when the area has a `root`, that root component with the same nested router built by
  the `router()` call inside it. The async branch of the wrapper exists for that one case, not for
  screens. Nesting to any depth falls out of this recursion with no special cascade logic —
  unmounting a parent area unmounts its nested router, which unmounts its sub-screens. The
  mount-generation counter is the navigation token: a slow chunk that resolves after the user has
  navigated away is discarded because its generation is stale.

- **Per-router options travel with each screen; nothing about a router lives in module state.** The
  `placeholder`, `onError`, and `onNotFound` a router is given are passed down to every `imp-route`
  it mounts (as instance arguments), not stored in a module-level global — a module-level global
  would make the router a singleton in disguise and couple a nested area's rendering to whichever
  router was constructed last. A nested area router inherits its parent router's options, so an
  unmatched tail inside an area falls through to the app's `onNotFound` and an area's download shows
  the app's `placeholder`; a table-less `router()` in an area's `root` inherits the same way and may
  override any of the three for that section. Nothing in the implementation prevents two routers
  coexisting on a page, but that is a consequence of instance-scoped options rather than a promoted
  feature; the documented shape is one router per app.

- **`onError` is a route-level error boundary; `onNotFound` is the single 404.** Because
  `ComponentError` is a bubbling, composed event a handling component cancels, a failure in a screen
  or any descendant that defines no `onError` of its own rises to `imp-route`, and the router
  renders its `onError` fallback (still logged); nearest boundary wins, so a screen's own `onError`
  handles first. `onNotFound` is the one fallback used when no pattern matches, declared alongside
  the router's other options. All options are optional.

- **No built-in link component; `navigate` is the single navigation primitive.** A client-side link
  is a plain `<a href>` whose left-click the app intercepts to call `navigate` — a few lines an app
  writes once. imp does not ship a `link`/`navLink` because a useful link is inseparable from a
  project's own button or design-system anchor; wrapping `navigate` is trivial and keeps the anchor
  fully the app's own. **`navigate(path, { replace })`** resolves the path against the current URL,
  pushes/replaces history, and syncs `imp.route`; a cross-origin target becomes a full document
  load, and navigating to the current URL is a no-op instead of a duplicate history entry. A single
  `popstate` listener keeps `imp.route` in sync with back/forward.

- **Scroll is managed; focus is left to the app.** The router sets
  `history.scrollRestoration = 'manual'`, stamps each history entry with a key, and records scroll
  positions; on a push it scrolls to the top once the new screen mounts, and on back/forward it
  restores the saved position for that entry. Focus and live-region announcements are **not** a
  router feature: a screen focuses its own heading in `instance.afterMount` (or drives a shared live
  region from `useRoute().watch`). The app owns focus.

- **Apps served under a sub-path** set the **`IMP_BASEPATH`** environment value; there is no
  configuration call in app code. The base is stripped from the location before matching and added
  back when `navigate` builds URLs, so route patterns and `navigate` targets stay written from the
  app root. The same base-prefixing is exported as **`url(path)`** — a no-op when `IMP_BASEPATH` is
  unset — so an app's own link helper prefixes its `href` through it for correct middle-click and
  copy-link behavior; it leaves absolute and external URLs untouched.

- **A screen releases its resources through the ordinary component lifecycle — no separate cleanup
  primitive.** Unmounting the screen releases its scoped state and subscriptions automatically, and
  any imperative teardown (a timer, a socket, a global imp cannot see) lives in that component's own
  `onUnmount`. Route-lifetime state is an `initState` in the screen's own root; app-lifetime state
  (session, theme, cart) lives in the app root above the router, which never unmounts. An area frees
  its DOM, state, subscriptions, and its nested router's subscriptions on leave, and the sub-table's
  factory closures are GC'd — but an area's already-loaded **JavaScript module** stays in the
  browser's registry for the page's lifetime (there is no `import.unload()`, and evicting a module
  would require a disposable realm such as a worker or iframe, which is not a trade imp makes for
  routing), so areas avoid loading code for sections **never** visited rather than evicting code for
  sections already visited.

- **Deep links and refresh are a hosting concern, kept out of the build.** A client-routed URL like
  `/todos/42` reaches the host on refresh or a cold visit, and the host must answer with the entry
  HTML. In **development** `imp start` falls back to the entry for a GET whose path has no file
  extension and whose `Accept` includes `text/html` (a real missing asset still 404s).
  **`imp build`, by contrast, emits nothing host-specific** — a portable bundle that uploads to any
  CDN; the history fallback is a one-line host setting, documented per platform. A cold visit to a
  deep area path works by construction: the top router's prefix entry matches, loads the area
  module, and its nested router — fed the tail — renders the deep sub-screen on first paint.

## Consequences

- The router adds almost no runtime concepts: it is a keyed `view`, a screen is a component, an area
  is a nested router, the navigation token is the mount generation, loading is the placeholder, and
  errors are the error boundary. Everything the lifecycle guarantees — deterministic teardown,
  stale-async discard, fault isolation — the router inherits.
- The route map is data in one place. `router({ routes })` reads top-to-bottom; there are no free
  `route()` side effects scattered across modules, and an area's routes live in the area's own file,
  named once at the composition root.
- Hierarchical routing, code-splitting of whole sections, and per-section not-found all fall out of
  one recursive primitive — a table entry that points at another table — with no global scope
  registry and no separate boundary API.
- Code splitting has exactly one unit, the area, so a route table answers "what does this URL cost
  to reach?" by reading it: a function renders now, an `area()` downloads. The cost is that
  splitting a single screen means giving it a one-entry area table.
- Screens (and areas) are released completely on navigation; query-only navigation keeps the screen
  mounted so search/filter pages keep focus, scroll, and in-progress state.
- Deep links, refresh, and back/forward all behave: the dev server and the opt-in build output serve
  the entry for unknown paths, and scroll is restored per history entry.
