# Client-side router

## Context

A single-page app must map the URL of the browser to a screen. It must swap a screen on a
navigation. It must do that with no build step, and with no compiler that scans routes. imp already
has the two primitives that a router needs. The first is the component lifecycle, which mounts,
shows loading content, catches an error, and tears everything down on a removal, see
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
anything can run. That place is the application map, see `application-map.md`.

## Decision

**The router is an element with the shape of a component, that you drop into your layout. You feed
it the application map, and the screens that bind to its nodes.** The public surface is `appMap`,
`router`, `area`, `guard`, `wait`, `navigate`, `beforeLeave`, `useRoute` and `url`. There is no new
lifecycle, and no scheduler. A screen cleans up through the ordinary `onRemove` of a component.

- **`router({ map, screens, access, loading, error, notFound })` renders the matched screen.** It is
  the slot where the current screen appears. Everything around it, which is the chrome of the app,
  stays across a navigation. Only its contents change. It behaves like a regular imp component. It
  takes the same lifecycle options as a component, which are `loading` and `error`, plus one
  `notFound`. A router is an element that you place. So an app can have none of them, which suits a
  plain tree of components, for example for server-side rendering. It can also have one. The
  documented shape is one router per app.

- **The route table is the map, and a screen is a binding, not a registration.** `screens` is an
  object keyed by handles of the map, as in
  `{ [app.home]: () => home(), [app.todos.$id]: ({ params }) => detail(params.id) }`. The router
  matches the current path against the whole map. It splits on `/`, and ignores an empty segment, so
  a trailing slash does not matter. At each level it tries the static children first, then the one
  param child, so a static path always shadows a param path and no order of declaration matters. imp
  decodes a param with `decodeURIComponent`. A param with a broken percent encoding, such as
  `/user/%zz` from an external link, matches nothing, so the URL renders `notFound`. The failure is
  in the URL, and not in the app, so it must not surface as an error of a mount. There is no `*`
  wildcard. The page for a URL that is off the map is `notFound`. That keeps "the 404" one named
  concept. A node on the map with no screen renders a stub, forwards to its first static child, or
  forwards where a `redirect()` binding says, see `application-map.md`. A screen factory receives
  `{ params, query, searchParams, node }`, where `node` is the handle of the matched node.
- **The query is two views of one search string.** `query` is an object of plain strings, and the
  first value of a repeated key wins. It covers the common case, a single value per key, with plain
  property access. `searchParams` is the native `URLSearchParams` of the same string. An app reads a
  repeated key with `getAll()`. imp adds no third shape, such as an object of arrays.

- **An area is a binding whose value is a loader, and it is always lazy.** A section of the app that
  loads on demand binds its node to an `area()` marker, in place of a screen factory. An example is
  `[app.admin]: area(() => import('./admin/area.js'))`. The module of that area exports
  `export default area({ screens, root, translations })`. **One name covers both halves, and imp
  dispatches on the type of the argument**, see `type-based-argument-dispatch.md`. A function is the
  pointer of the parent at a chunk. An object is the declaration of that chunk about what it binds.
  The two never appear in the same position. imp also rejects a definition of an area that somebody
  binds directly, and the message spells the wrapped form out. There is **no eager form**. An area
  exists exactly to split the code of a section behind a dynamic `import()`. So every area loads on
  demand. The `screens` of an area bind the node the area hangs from and the descendants of that
  node, and nothing else. The nodes of the section are in the map already, so the nav of the section
  renders before its chunk arrives. Which subtree loads lazily is an implementation decision, made
  in `screens`, and the map does not say it.

- **An area can declare a `root`, which is the one component that lives longer than the screens of
  the section.** `root` is a factory that returns the component that the screens of the section
  render inside. The screens of the area render into a `router()` call that you write **with no
  map**, somewhere in the tree of that component. The route page of the area provides the scope of
  the section, which is its node and its bindings, through the shared seam of a provider. That is
  the same lookup through the DOM that a state and the HTTP client use, on its own `kind`, see
  `event-propagated-state.md`. A `router()` with no map resolves the nearest one. So you write the
  slot where the layout wants it, and the area passes nothing into its own components. This is the
  only way to hold something for exactly one section. A root is keyed with the area. So it survives
  a navigation _between_ the screens of the section, and it unmounts when the user leaves the
  prefix. A layout that you wrap around each screen factory cannot do that. Such a layout remounts
  on every navigation, and it takes a state scoped to the section, or an HTTP client, with it.
  `root` is optional. Its absence is exactly the previous behaviour, where the route page of the
  area renders the nested router itself. `root` receives the same
  `{ params, query, searchParams, node }` as a screen factory. So a prefix param reaches the shell.
  A `router()` with no map, outside an area, throws, and the message names both fixes.

- **An area declares the translations that it needs, and the router owns their lifetime.** The
  `translations` key of an area definition is a map, from a language code to a loader, see
  `translatable-by-default.md`. The router loads the entry for the current language **before** it
  renders the first screen of the area. So the section never paints untranslated. The router drops
  that entry through the cleanup of the route page, when the user leaves the area. That is the same
  unmount that releases the DOM, the state and the subscriptions of the section. A navigation
  **inside** an area keeps the section mounted. So its messages load once per visit, and not once
  per screen.

- **A binding has exactly two kinds of value.** The first is a screen, which renders immediately.
  The second is an area, which loads on demand. A screen factory is a function that returns DOM
  synchronously. An area is an `area()` marker. So the split of the code has one unit, which is the
  area. The bindings then answer the question "what does this URL cost to reach?" when you read
  them. There is one rule to learn, which is that a screen is here now, and an area arrives on
  demand. Laziness is not a property of two different things. To split one screen that people rarely
  visit is an area with one binding. A screen factory that returns a thenable throws, and the
  message points at `area()`. imp does not await it. An area covers the node it binds and everything
  under that node. imp rejects any other value when it validates the bindings.

- **The current location is one state for the lifetime of the app, `imp.route`, which is
  `{ path, query, searchParams }`.** There is exactly one location per page. It lives longer than
  every screen, and longer than every router. So the router creates it once, as a detached state
  that belongs to the framework, the first time when anything touches the routing. `useRoute()`
  returns a read-only handle. That handle has `get`, `watch`, `text`, `view` and `each`, and no
  `set`. So any component anywhere can read the path and the query, and react to a navigation. That
  covers a nav bar outside a router, and a breadcrumb deep inside a screen.

- **The router keys the matched screen by the node and the params, and not by the whole URL.**
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
  on demand, the loading content, the guard against a stale navigation, and the error boundary, all
  come from. The component lifecycle already provides all four. The `setup` of `imp-route` calls the
  target factory with `{ params, query, searchParams }`, and returns the result. For a screen that
  result is a `Node`, which imp renders synchronously, with no flash of loading content. An area
  renders through the same wrapper. The factory of the area awaits the `area()` loader for the
  table, and returns a **nested `router` bound to the tail**, where imp removed the prefix of the
  parent and merged the prefix params in. So an area is "a screen that is itself a nested router".
  When the area has a `root`, it is that root component, with the same nested router that the
  `router()` call inside it builds. The async branch of the wrapper exists for that one case, and
  not for a screen. Nesting to any depth falls out of that recursion, with no special logic for a
  cascade. To unmount a parent area unmounts its nested router, and that unmounts its sub-screens.
  The counter of the mount generation is the token of the navigation. imp discards a slow chunk that
  resolves after the user navigated away, because its generation is old.

- **The options of a router travel with each screen, and nothing about a router lives in module
  state.** imp passes the `loading`, the `error` and the `notFound` of a router down to every
  `imp-route` that it mounts, as factory arguments. imp does not store them in a global at module
  level. Such a global would make the router a singleton in disguise. It would also couple the
  rendering of a nested area to whichever router somebody constructed last. A nested router of an
  area inherits the options of its parent router. So a path off the map, under an area, falls
  through to the `notFound` of the app, and the download of an area shows the `loading` of the app.
  A `router()` with no map, in the `root` of an area, inherits in the same way, and it can override
  any of the three for that section. That router is a small component of its own, `imp-area-router`.
  Its `setup` looks the enclosing area up from its own host, which sits inside the shadow root of
  the caller. So `router()` works anywhere that DOM is built, before or after an `await`, with no
  dependence on the position of the call. Outside an area it fails at mount, and the error boundary
  or the log reports it. Nothing in the implementation stops two routers on one page. That is a
  consequence of options that belong to an instance, and it is not a feature that imp promotes. The
  documented shape is one router per app.

- **`error` is an error boundary at route level. `notFound` is the one 404.** `ComponentError` is a
  bubbling, composed event, which a component that handles it cancels. So a failure in a screen, or
  in any descendant that defines no `error` of its own, rises to `imp-route`. The router then
  renders its `error` in place of the screen, and it still logs the error. imp calls the option with
  the `self` of the `imp-route` host first, like the `error` of a component. The nearest boundary
  wins, so the `error` of a screen handles the error first. `notFound` is the one screen that imp
  uses when a path is off the map. You declare it beside the other options of the router. Every
  option is optional.

- **Access control is a separate primitive, on the same wrapper, see `route-guards.md`.** The one
  `access` guard of the router runs inside `imp-route`, before the screen factory, with every
  `access` value on the chain of the matched node. Its `wait` verdict resolves through the same
  loading content that the download of an area uses. So the router gains no second path for loading,
  and the screen gains no branch for loading.

- **`navigate` is the one primitive for a navigation, and the router itself ships no link.** A
  client-side link is a plain `<a href>` whose left-click calls `navigate`. The standard library
  writes that once, in `link` and in every component that renders a destination, see
  `standard-component-library.md`. The router stays free of any anchor. A handle gives the path, as
  in `navigate(app.todos.$id.href({ id }))`, so app code writes no path string.
  **`navigate(path, { replace })`** resolves the path against the current URL, pushes or replaces a
  history entry, and brings `imp.route` into step. A target on another origin becomes a full load of
  a document. A navigation to the current URL does nothing, in place of a duplicate history entry.
  One listener on `popstate` keeps `imp.route` in step with the back and forward buttons.

- **`beforeLeave(self, check)` lets a screen with unsaved work stop a navigation.** The check has
  the contract of the `beforeClose` of an overlay, see `overlay-top-layer.md`. It returns `false`,
  or a promise of `false`, to stay. A check that throws also stays, and imp logs the error. The
  registration ends when the component of `self` unmounts. So the check lives with the state that it
  reads, and no route table names it. imp asks every check, in the order of registration, when the
  path or the query changes. A change of the fragment only asks nothing.
  - A `navigate` call asks first, and it moves only when every check allows. With no check
    registered, `navigate` stays synchronous. A redirect of a guard, and a node bound to
    `redirect()`, do not ask. The navigation that led to them already did.
  - The back and forward buttons change the URL before `popstate` fires, and the platform cannot
    cancel that in all four browsers. So each history entry carries its index. On a `popstate` that
    leaves the route, imp goes back to the entry that it came from with `history.go()`, asks, and
    goes on with a second `history.go()` when the checks allow. The screen never changes while it
    waits. An entry with no index, such as a fragment that the person typed, is not held.
  - A reload, a closed tab, and a link to another site unload the document. The platform owns that
    case with `beforeunload`, and it shows its own prompt. imp adds nothing there, because an async
    check cannot hold an unload.

- **imp manages the scroll, and leaves the focus to the app.** The router sets
  `history.scrollRestoration = 'manual'`. It marks each history entry with a key, and records the
  scroll position of the page and of the screen region when the entry is left. On a push it scrolls
  both to the top, after the new screen mounts. On a back or a forward it restores the saved
  positions for that entry. The screen region is the box that scrolls the screens. The `shell`
  claims its `<main>`, because the shell is a fixed frame whose regions scroll on their own, so the
  page scroll never moves there. A frame of an app claims its own box with
  `screenRegion(self, element)`. The claim ends when the component unmounts. The focus, and an
  announcement through a live region, are **not** a feature of the router. A screen focuses its own
  heading in `onMount`. It can also drive a shared live region from `useRoute().watch`. The app owns
  the focus.

- **A change of screen can run inside a view transition.** The router swaps the screen inside
  `document.startViewTransition` when the screen region has an effect other than `'none'`. The
  region carries `view-transition-name: imp-screen`, so only the region animates and the rest of the
  page stays still. The effects are `fade`, `slide` and `zoom`. Their keyframes live in one
  document-level stylesheet, because the `::view-transition` pseudo-elements belong to the document,
  not to a shadow root. That stylesheet sets `pointer-events: none` on `::view-transition`, which is
  the advice of the browser vendors, but a hit test during the animation still lands on the root
  element. So the page takes no click while a transition runs, and an effect is a choice of the app,
  see `app-shell-component.md`. A `slide` follows the reading direction, and turns around on a back
  navigation, which the router marks on the root element for the duration of the transition. With
  `prefers-reduced-motion: reduce`, or with the page hidden, the swap runs with no transition.
  Inside a transition the route state updates in the update callback, which the browser runs after
  it captured the old screen. So `navigate` returns before the route changed. Code that reads the
  route after a `navigate` reads it from `useRoute().watch`, not right after the call.

- **An app that is served under a sub-path sets the `IMP_BASEPATH` environment value.** There is no
  call to configure that in app code. imp removes the base from the location before it matches, and
  adds it back when `navigate` builds a URL. So you write a route pattern, and a `navigate` target,
  from the root of the app. imp exports the same prefixing as **`url(path)`**, which does nothing
  when `IMP_BASEPATH` is not set. So the link helper of an app puts its `href` through it, and a
  middle-click and a copy of the link behave correctly. `url` leaves an absolute URL, and an
  external URL, as they are.

- **A screen releases its resources through the ordinary component lifecycle, and there is no
  separate primitive for a cleanup.** To unmount a screen releases its scoped state and its bindings
  automatically. Any cleanup that you must write, such as a timer, a socket, or a global that imp
  cannot see, lives in the `onRemove` of that component. State for the lifetime of a route is an
  `initState` in the root component of the screen. State for the lifetime of the app, such as the
  session, the theme and the cart, lives in the app root, above the router, which never unmounts. An
  area frees its DOM, its state, its subscriptions, and the subscriptions of its nested router, when
  the person leaves it. The garbage collector then collects the closures of the factories of the
  sub-table. But the **JavaScript module** of an area that already loaded stays in the registry of
  the browser, for the life of the page. There is no `import.unload()`. To remove a module would
  need a realm that you can dispose of, such as a worker or an iframe, and imp does not make that
  trade for routing. So an area avoids the load of code for a section that **nobody** visits. It
  does not remove code for a section that somebody already visited.

- **An app that does not own the path sets `IMP_ROUTING` to `hash`.** The router then keeps the
  route in the fragment of the address, as `#/todos/42?tab=notes`, and it leaves the path alone.
  `navigate` pushes a history entry with the fragment, `handle.href()` and `url(path)` write a
  fragment, and the router reads the route from it. The mode is an environment value, like the base
  path, because where an app runs is a decision of its deployment and not of its code. The case that
  needs it is an imp app inside a page that it does not own: a gallery that `imp preview --output`
  exports, or a widget in a host page (`preview-export.md`). A host with no history fallback is the
  other case. Under hash routing the base path does not apply, because the fragment is not a path
  that the host serves.

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
  the loading content. An error is the error boundary. The router inherits everything that the
  lifecycle guarantees, which is a defined cleanup, the discard of a stale async result, and
  isolation against a fault.
- The public surface stayed small enough that access control needed one guard on the router and one
  prop on a node. It did not need a routing layer of its own.
- The route map is data, in one place, which is the application map. `screens` reads from the top
  down. There is no free `route()` side effect spread across modules. The screens of an area live in
  the file of the area, and the composition root names every area once.
- Hierarchical routing, a split of the code of a whole section, and a not-found screen per section,
  all fall out of one recursive primitive, which is a binding that points at more bindings. There is
  no registry of a global scope, and there is no separate API for a boundary.
- The split of the code has exactly one unit, which is the area. So the bindings answer the question
  "what does this URL cost to reach?" when you read them. A function renders now, and an `area()`
  downloads. The cost is that, to split one screen, you give it an area file with one binding.
- imp releases a screen, and an area, completely, on a navigation. A navigation that changes the
  query only keeps the screen mounted. So a page for a search, or for a filter, keeps its focus, its
  scroll position, and its state in progress.
- Unsaved work survives a click on a link and the back button with one line in the component that
  holds it. The Navigation API could cancel a traversal directly. It needs a synchronous answer and
  user activation, so it cannot wait for a confirmation dialog. The index on each history entry
  works in every browser now, and `beforeLeave` keeps its shape if the mechanism changes.
- A deep link, a refresh, and the back and forward buttons all behave. The dev server, and the
  output of the build with the host setting, serve the entry for an unknown path. imp restores the
  scroll per history entry.
