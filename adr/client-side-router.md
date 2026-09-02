# Client-side router

## Context

A single-page app must map the URL of the browser to a screen. It must swap a screen on a
navigation. It must do that with no build step, and with no compiler that scans routes. imp already
has the two primitives that a router needs. The first is the component lifecycle, which mounts,
shows a loading placeholder, catches an error, and tears everything down on a removal, see
`web-component-lifecycle.md` and `error-boundaries.md`. The second is a state that the DOM scopes.
Its `view` binding swaps the DOM of a region when a state changes, and it disposes of the
subscriptions of the previous render, see `event-propagated-state.md`. The question was how much new
machinery a router adds on top. The answer had to keep the buildless model. It had to release
everything that a screen created, when a person leaves that screen. It had to load a section that
people rarely visit on demand, with no bundler. It had to keep a deep link and a refresh working. It
had to be accessible.

imp rejected two shapes. **Routing from the file system** contradicts the buildless model with no
scan, and it would need a compiler to enumerate the routes. **Registration through a global** is a
free `route(pattern, factory)` that changes a hidden list at module level, as a side effect of an
import. That spreads the route map across files. It makes the question "what renders here?"
impossible to search for. It also gives a sub-section of the app no natural boundary to own its own
routes. The route map must be **data that you declare in one place**, and not a side effect that
anything can run.

## Decision

**The router is an element with the shape of a component, that you drop into your layout. You feed
it a declarative route table, as data.** The public surface is `router`, `area`, `navigate`,
`useRoute` and `url`. There is no new lifecycle, and no scheduler. A screen cleans up through the
ordinary `teardown` of a component.

- **`router({ routes, placeholder, fallback, notFound })` renders the matched screen.** It is the
  slot where the current screen appears. Everything around it, which is the chrome of the app, stays
  across a navigation. Only its contents change. It behaves like a regular imp component. It takes
  the same lifecycle options as a component, which are `placeholder` and `fallback`, plus one
  `notFound`. A router is an element that you place. So an app can have none of them, which suits a
  plain tree of components, for example for server-side rendering. It can also have one. The
  documented shape is one router per app.

- **A route is an entry in a table, and not a registration.** `routes` is an object. It maps a
  pattern for a path to its target, as in
  `{ '/': () => home(), '/todos/:id': ({ params }) => detail(params.id) }`. A pattern is a path with
  a `:param` segment. The match splits on `/`, and ignores an empty segment, so a trailing slash
  does not matter. For a screen, the match needs an equal number of segments. imp decodes a param
  with `decodeURIComponent`. **The first match wins, in the order in which you declared the table.**
  The order of the keys of the object is the order of priority. So a static path that you list
  before a param path shadows that param path. There is no `*` wildcard. The fallback for a URL that
  matches nothing is `notFound`. That keeps "the 404" one named concept.
  `area({ routes, root, translations })` is a builder that validates. It marks a table, and carries
  the root component of the section, and its translations. It exists for one use, which is the
  `export default` of an area, from its own file, described below. You write the top-level `routes`
  option as a plain object.

- **An area is a table entry whose target is another table, and it is always lazy.** A section of
  the app that owns a group of routes, under a URL prefix such as `/admin` or `/shop`, maps that
  prefix to an `area()` marker, in place of a screen factory. An example is
  `'/admin': area(() => import('./admin/area.js'))`. The module of that area exports
  `export default area({ routes, translations })`. **One name covers both halves, and imp dispatches
  on the type of the argument**, see `type-based-argument-dispatch.md`. A function is the pointer of
  the parent at a chunk. An object is the declaration of that chunk about what it contains. The two
  never appear in the same position. So there is nothing to tell apart by eye. imp also rejects a
  definition of an area that somebody places directly in a table, and the message spells the wrapped
  form out. There is **no eager form**. The target of a prefix is never a plain nested object. An
  area exists exactly to split the code of a section behind a dynamic `import()`. So every area
  loads on demand. You write a sub-route **relative** to the prefix. A table nests. So hierarchical
  routing falls out of the same model of the data, with no registry of a global scope, and with no
  separate primitive for a boundary. Each area owns its own routing surface, in its own file, and
  the composition root names every area in one place.

- **An area can declare a `root`, which is the one component that lives longer than the screens of
  the section.** `root` is a factory that returns the component that the screens of the section
  render inside. The screens of the area render into a `router()` call that you write **with no
  table**, somewhere in the tree of that component. The route page of the area provides its table,
  the depth of the prefix that it consumed, and its prefix params, through the shared seam of a
  provider. That is the same lookup through the DOM that a state and the HTTP client use, on its own
  `kind`, see `event-propagated-state.md`. A `router()` with no table resolves the nearest one. So
  you write the slot where the layout wants it, and the area passes nothing into its own components.
  This is the only way to hold something for exactly one section. A root is keyed with the area. So
  it survives a navigation _between_ the screens of the section, and it unmounts when the user
  leaves the prefix. A layout that you wrap around each screen factory cannot do that. Such a layout
  remounts on every navigation, and it takes a state scoped to the section, or an HTTP client, with
  it. `root` is optional. Its absence is exactly the previous behaviour, where the route page of the
  area renders the nested router itself. `root` receives the same `{ params, query }` as a screen
  factory. So a prefix param reaches the shell. A `router()` with no table, outside an area, throws,
  and the message names both fixes.

- **An area declares the translations that it needs, and the router owns their lifetime.** The
  `translations` key of an area definition is a map, from a language code to a loader, see
  `translatable-by-default.md`. The router loads the entry for the current language **before** it
  renders the first screen of the area. So the section never paints untranslated. The router drops
  that entry through the cleanup of the route page, when the user leaves the area. That is the same
  unmount that releases the DOM, the state and the subscriptions of the section. A navigation
  **inside** an area keeps the section mounted. So its messages load once per visit, and not once
  per screen.

- **A table has exactly two kinds of target.** The first is a screen, which renders immediately. The
  second is an area, which loads on demand. A screen factory is a function that returns DOM
  synchronously. An area is an `area()` marker. So the split of the code has one unit, which is the
  area. A table then answers the question "what does this URL cost to reach?" when you read it.
  There is one rule to learn, which is that a screen is here now, and an area arrives on demand.
  Laziness is not a property of two different things. To split one screen that people rarely visit
  is an area with one entry. A screen factory that returns a thenable throws, and the message points
  at `area()`. imp does not await it. The `area()` marker is what makes a pattern match as a
  **prefix**, which covers everything under it. Every other pattern matches exactly. Nobody can
  infer that difference from the target itself. imp rejects any other target, including a plain
  nested object, when it validates the table.

- **The current location is one state for the lifetime of the app, `imp.route`, which is
  `{ path, query }`.** There is exactly one location per page. It lives longer than every screen,
  and longer than every router. So the router creates it once, as a detached state that belongs to
  the framework, the first time when anything touches the routing. `useRoute()` returns a read-only
  handle. That handle has `get`, `watch`, `text`, `view` and `each`, and no `set`. So any component
  anywhere can read the path and the query, and react to a navigation. That covers a nav bar outside
  a router, and a breadcrumb deep inside a screen.

- **The router keys the matched screen by the pattern and the params, and not by the whole URL.**
  Inside, the router is `computed([imp.route], key).view(renderMatched)`, where `key` is
  `{ kind, pattern, params }`. `computed` notifies only when its result changes by content. So a
  navigation that changes **the query only** keeps the current screen mounted. The screen reacts to
  the query, when it cares, through `useRoute()`. A navigation to a different pattern, or to a
  different param, swaps the screen. The `view` renders again, and disposes of the previous render.
  So the screen that the person leaves unmounts, and its state and subscriptions, which the
  component scopes, are released through the ordinary lifecycle. imp keys **an area by its prefix,
  with any param at that prefix, and not by the tail**. So a navigation _inside_ an area keeps the
  area mounted, and only its nested router swaps a sub-screen. A prefix param that changes, as in
  `/org/:orgId`, remounts the area.

- **Each matched screen mounts inside an internal `imp-route` component.** That is where the loading
  on demand, the loading placeholder, the guard against a stale navigation, and the error boundary,
  all come from. The component lifecycle already provides all four. The `build` of `imp-route` calls
  the target factory with `{ params, query }`, and returns the result. For a screen that result is a
  `Node`, which imp renders synchronously, with no flash of a placeholder. An area renders through
  the same wrapper. The factory of the area awaits the `area()` loader for the table, and returns a
  **nested `router` bound to the tail**, where imp removed the prefix of the parent and merged the
  prefix params in. So an area is "a screen that is itself a nested router". When the area has a
  `root`, it is that root component, with the same nested router that the `router()` call inside it
  builds. The async branch of the wrapper exists for that one case, and not for a screen. Nesting to
  any depth falls out of that recursion, with no special logic for a cascade. To unmount a parent
  area unmounts its nested router, and that unmounts its sub-screens. The counter of the mount
  generation is the token of the navigation. imp discards a slow chunk that resolves after the user
  navigated away, because its generation is old.

- **The options of a router travel with each screen, and nothing about a router lives in module
  state.** imp passes the `placeholder`, the `fallback` and the `notFound` of a router down to every
  `imp-route` that it mounts, as arguments of the instance. imp does not store them in a global at
  module level. Such a global would make the router a singleton in disguise. It would also couple
  the rendering of a nested area to whichever router somebody constructed last. A nested router of
  an area inherits the options of its parent router. So a tail with no match, inside an area, falls
  through to the `notFound` of the app, and the download of an area shows the `placeholder` of the
  app. A `router()` with no table, in the `root` of an area, inherits in the same way, and it can
  override any of the three for that section. Nothing in the implementation stops two routers on one
  page. That is a consequence of options that belong to an instance, and it is not a feature that
  imp promotes. The documented shape is one router per app.

- **`fallback` is an error boundary at route level. `notFound` is the one 404.** `ComponentError` is
  a bubbling, composed event, which a component that handles it cancels. So a failure in a screen,
  or in any descendant that defines no `fallback` of its own, rises to `imp-route`. The router then
  renders its `fallback` in place of the screen, and it still logs the error. The nearest boundary
  wins, so the `fallback` of a screen handles the error first. `notFound` is the one screen that imp
  uses when no pattern matches. You declare it beside the other options of the router. Every option
  is optional.

- **Access control is a separate primitive, on the same wrapper, see `route-guards.md`.** One
  `guard` that you declare on a table entry runs inside `imp-route`, before the screen factory. Its
  `wait` verdict resolves through the same placeholder that the download of an area uses. So the
  router gains no second path for loading, and the screen gains no branch for loading.

- **There is no built-in link component. `navigate` is the one primitive for a navigation.** A
  client-side link is a plain `<a href>`, and the app intercepts its left-click, to call `navigate`.
  That is a few lines that an app writes once. imp ships no `link` or `navLink`, because a useful
  link cannot be separated from the button of a project, or from the anchor of its design system. To
  wrap `navigate` is trivial, and it keeps the anchor completely the app's own.
  **`navigate(path, { replace })`** resolves the path against the current URL, pushes or replaces a
  history entry, and brings `imp.route` into step. A target on another origin becomes a full load of
  a document. A navigation to the current URL does nothing, in place of a duplicate history entry.
  One listener on `popstate` keeps `imp.route` in step with the back and forward buttons.

- **imp manages the scroll, and leaves the focus to the app.** The router sets
  `history.scrollRestoration = 'manual'`. It marks each history entry with a key, and records the
  scroll position. On a push it scrolls to the top, after the new screen mounts. On a back or a
  forward it restores the saved position for that entry. The focus, and an announcement through a
  live region, are **not** a feature of the router. A screen focuses its own heading in
  `instance.afterMount`. It can also drive a shared live region from `useRoute().watch`. The app
  owns the focus.

- **An app that is served under a sub-path sets the `IMP_BASEPATH` environment value.** There is no
  call to configure that in app code. imp removes the base from the location before it matches, and
  adds it back when `navigate` builds a URL. So you write a route pattern, and a `navigate` target,
  from the root of the app. imp exports the same prefixing as **`url(path)`**, which does nothing
  when `IMP_BASEPATH` is not set. So the link helper of an app puts its `href` through it, and a
  middle-click and a copy of the link behave correctly. `url` leaves an absolute URL, and an
  external URL, as they are.

- **A screen releases its resources through the ordinary component lifecycle, and there is no
  separate primitive for a cleanup.** To unmount a screen releases its scoped state and its
  subscriptions automatically. Any teardown that you must write, such as a timer, a socket, or a
  global that imp cannot see, lives in the `teardown` of that component. State for the lifetime of a
  route is an `initState` in the root component of the screen. State for the lifetime of the app,
  such as the session, the theme and the cart, lives in the app root, above the router, which never
  unmounts. An area frees its DOM, its state, its subscriptions, and the subscriptions of its nested
  router, when the person leaves it. The garbage collector then collects the closures of the
  factories of the sub-table. But the **JavaScript module** of an area that already loaded stays in
  the registry of the browser, for the life of the page. There is no `import.unload()`. To remove a
  module would need a realm that you can dispose of, such as a worker or an iframe, and imp does not
  make that trade for routing. So an area avoids the load of code for a section that **nobody**
  visits. It does not remove code for a section that somebody already visited.

- **A deep link and a refresh are a concern of the host, and imp keeps them out of the build.** A
  URL that the client routes, such as `/todos/42`, reaches the host on a refresh, and on a cold
  visit. The host must answer with the entry HTML. In **development**, `imp start` falls back to the
  entry, for a GET whose path has no file extension, and whose `Accept` header includes `text/html`.
  A real missing asset still returns 404. **`imp build` emits nothing that belongs to a host.** It
  emits a portable bundle that you upload to any CDN. The fallback for the history is a setting of
  one line on the host, and the documentation gives it per platform. A cold visit to a deep path of
  an area works by construction. The prefix entry of the top router matches. It loads the module of
  the area. Its nested router, fed the tail, renders the deep sub-screen on the first paint.

## Consequences

- The router adds almost no concept at runtime. It is a keyed `view`. A screen is a component. An
  area is a nested router. The token of a navigation is the generation of the mount. The loading is
  the placeholder. An error is the error boundary. The router inherits everything that the lifecycle
  guarantees, which is a defined teardown, the discard of a stale async result, and isolation
  against a fault.
- The public surface stayed small enough that a guard on a route needed one more value in a table
  later, which is `route({ guard, screen })`. It did not need a routing layer of its own.
- The route map is data, in one place. `router({ routes })` reads from the top down. There is no
  free `route()` side effect spread across modules. The routes of an area live in the file of the
  area, and the composition root names them once.
- Hierarchical routing, a split of the code of a whole section, and a not-found screen per section,
  all fall out of one recursive primitive, which is a table entry that points at another table.
  There is no registry of a global scope, and there is no separate API for a boundary.
- The split of the code has exactly one unit, which is the area. So a route table answers the
  question "what does this URL cost to reach?" when you read it. A function renders now, and an
  `area()` downloads. The cost is that, to split one screen, you give it a table for an area with
  one entry.
- imp releases a screen, and an area, completely, on a navigation. A navigation that changes the
  query only keeps the screen mounted. So a page for a search, or for a filter, keeps its focus, its
  scroll position, and its state in progress.
- A deep link, a refresh, and the back and forward buttons all behave. The dev server, and the
  output of the build with the host setting, serve the entry for an unknown path. imp restores the
  scroll per history entry.
