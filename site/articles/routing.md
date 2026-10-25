# Routing You Can Read in One Sitting

## imp ui: a real SPA router with no build step, no file-name magic, and a map you can print

Routing is where front-end frameworks quietly get big. A router that started as "map a URL to a
component" grows a file-system convention, a build-time route manifest, nested layout files, loader
and action exports, a `<Suspense>` boundary, a `<Link prefetch>`, and a data-revalidation cache -
and somewhere in there you stopped being able to answer "what renders at `/todos/42`?" by reading
your own code.

imp takes the other bet: **your app already has a place to put the current screen - a slot in the
DOM - and a way to clean up when a screen leaves - unmounting.** So the whole router is one map you
write, one element you place, and no new ideas.

Here's a complete routed app:

```js
// app-map.js
import { appMap } from 'imp'

export const app = appMap({
  home: 'The welcome page',
  about: 'Who made this, and why',
  todos: { $id: 'One todo, on its own page' },
})
```

```js
// main.js
import { mount } from 'imp'
import { div, h1 } from 'imp/html'
import { router } from 'imp/router'
import { shell } from 'imp/std/shell'
import { app } from './app-map.js'

mount(
  '#app',
  shell(
    { navbar: { map: app } },
    router({
      map: app,
      screens: {
        [app.home]: () => h1('Welcome'),
        [app.todos.$id]: ({ params }) => todoDetail(params.id),
      },
      notFound: () => h1('Not found'),
    }),
  ),
)
```

The map says what pages exist. `router()` is the slot the current screen renders into, and its
`screens` bind a factory to a node of the map. `about` has no screen yet, so it renders a
placeholder that says "About" - the app runs before the screen exists. The `shell` reads the same
map and draws the nav. That's the app. No `routes.config.js`, no `app/` directory that means
something to a compiler, no provider to wrap everything in.

---

## The pitch in three sentences

- **The app is one plain-data map.** `todos: { $id: 'One todo' }` - an object you read top to
  bottom, that holds no component, no icon, no state name and no guard function. It says what each
  feature is, and the router, the nav and the trail derive from it. Nothing scans your filesystem;
  nothing generates a manifest; there is no build time - and no free `route()` calls scattered
  across files as import side effects.
- **The router is a live region and a screen is a component.** Navigating swaps the matched screen's
  DOM in and tears the old one out - you get loading content, error boundaries, and scoped state for
  free, because they're the component lifecycle you already use everywhere else.
- **Navigation is a clean slate.** The screen you leave unmounts, so its state, subscriptions,
  timers, and sockets are released automatically. There is no navigation cleanup code, because there
  is nothing left to clean up.

If you're coming from React Router or Next: imagine the router without the file-system convention,
the build step, the `<Outlet/>`/`<Suspense/>`/`<ErrorBoundary/>` component zoo, and the
`loader`/`action` data layer - because loading data is just an `async` component, and cleanup is
just unmounting.

---

## The whole API: one map, one element, one call, one read

### `appMap(nodes)` - the feature list

Every key is a node. The name is the path (`createApiKey` serves `/create-api-key`) and the label
("Create api key"). A `$name` key is a param. A top-level `home` serves `/`. Nest a node to nest a
path. A string, or `description`, says what the node is for, and that is the only prop:

```js
export const app = appMap({
  home: {},
  projects: {
    description: 'Everything a team works on',
    $projectId: { builds: {}, settings: {} },
  },
  admin: { users: 'Everyone with a login', createApiKey: {} },
  login: {},
})
```

`appMap()` hands back a **handle** per node. `app.admin.users` stringifies to `/admin/users`, so it
keys an object; `app.projects.$projectId.href({ projectId: '42' })` builds the URL. A mistyped
handle is `undefined`, and the router refuses the key at startup with a message that says so. Rename
a path in one line, and every link, crumb, guard and binding follows.

A big app splits the map into parts, one `appMap()` per file, and grafts each part under a key. Run
`imp map` and the whole app prints as a tree: path, label, description. Before a screen exists.

### `router({ map, screens })` - the slot and its bindings

Drop it where the screen goes. Everything around it - header, sidebar, footer - persists across
navigations; only the router changes. `screens` binds a node to the factory that renders it; the
factory receives `{ params, query, node }`:

```js
router({
  map: app,
  screens: {
    [app.home]: () => home(),
    [app.projects]: () => projectList(),
    [app.projects.$projectId]: ({ params }) => project(params.projectId),
  },
  loading: () => spinner(), //   shown while an area's code downloads
  error: (_self, error) => errorPanel(error), // a route-level error boundary for the whole screen
  notFound: () => notFound(), //   the one page for any URL off the map
})
```

Static paths always beat param paths - the router orders them itself. No precedence algorithm to
reverse-engineer, no `exact` prop, no ranking heuristic deciding whether `/todos/new` or
`/todos/:id` wins.

A node with no binding still answers its URL. A leaf renders a placeholder with its label and
description. A parent forwards to its first child. A node bound to `redirect(app.x)` forwards there.
So you write the map first, run the app, click through every page as a stub, and bind screens one by
one.

Shared layouts aren't a framework feature here - they're a function:

```js
const page = (content) => div({ class: 'page' }, toolbar(), content)

screens: {
  [app.todos]: () => page(todoList()),
  [app.todos.$id]: ({ params }) => page(todoDetail(params.id)),
}
```

No `layout.jsx` files, no nested-route indentation, no `<Outlet/>` threaded through three levels. If
you can write a function, you can share a layout.

### `navigate(path, options)` - go, from anywhere

```js
navigate(app.todos.$id.href({ id: '42' }))
navigate(app.login.href(), { replace: true })
```

Works in an event handler, a timer, after an `await` - no hook rules, no `useNavigate()` you can
only call at the top of a component:

```js
const todo = await save(draft)
navigate(app.todos.$id.href({ id: todo.id }))
```

It stays on your own origin. A crafted `?next=//evil.example` cannot send your users to another
site, and a `javascript:` URL never runs. Leave the app on purpose with `{ external: true }`, and
clean a `?next=` value with `safeNext(value, fallback)`.

### Navigation controls - the frame draws them

imp doesn't ship a `<Link>` for the nav. The `shell` reads the map and draws the bar, the sidebar of
the current section, the breadcrumb trail and the bottom bar of a phone. For a link inside a page,
`link` from `imp/std` takes the `href` of a handle:

```js
link({ href: app.todos.$id.href({ id: todo.id }) }, todo.title)
```

### `useRoute()` - read the current location, reactively

The one read. It hands back the live `{ path, query }` - the same helper object as any imp state, so
`text`, `view`, and `watch` all work - and it works **anywhere**, including a component that lives
outside the router:

```js
// pageview analytics, no wiring
useRoute().watch((current) => track('pageview', { path: current.path }))
```

No `useLocation` + `useParams` + `useSearchParams` triple, no context that only resolves inside the
router subtree.

---

## Access is data bound to a node

The router binds a `need` to a node. One guard on the router says what that means:

```js
const access = guard(['acme.session'], (session, { need }) => {
  if (session === undefined) return wait // the session hasn't loaded - keep the loader up
  if (!session) return '/login'
  return session.roles.includes(need) || '/forbidden'
})

router({
  map: app,
  access,
  need: {
    [app.projects]: 'user',
    [app.projects.$projectId.settings]: 'admin',
    [app.admin]: 'admin',
  },
  screens,
})
```

`'admin'` on the `admin` node reaches the guard as `need`. Every `need` on the path to the matched
node runs. A node with no `need` is open, so `/login` never loops. And the **same guard
decides the nav**: a row shows only when the guard allows it, and a row whose state hasn't arrived
stays hidden until it does. The nav and the route cannot disagree.

`wait` is the trick that keeps a guard synchronous. The router subscribes to the states the guard
declared, re-runs it when they change, and acts on the first real answer. A guard is a pure function
you can unit-test with plain values, and the waiting is the router's job.

---

## Whole sections, grouped: areas

The nodes of a section are in the map from the start. Which of them load lazily is a decision you
make in `screens`. Bind a node to an `area()` and that section owns its own bindings, in its own
file, loaded on demand:

```js
screens: {
  [app.home]: () => home(),
  [app.admin]: area(() => import('./admin/area.js')), // a lazily-loaded section
}
```

```js
// admin/area.js - keep this file wherever you like
import { app } from '../app-map.js'

export default area({
  screens: {
    [app.admin]: () => adminHome(), //          /admin
    [app.admin.users]: () => usersList(), //    /admin/users
    [app.admin.createApiKey]: () => createApiKey(),
  },
})
```

Visiting `/admin/users` matches the `admin` node, loads the admin module the first time, and renders
its `users` screen - its code never ships to users who never open the section. Because the nodes
were in the map all along, the sidebar of the section renders before the chunk arrives. Only the
screens arrive later. And imp dictates no folder layout for any of it - it only sees the module your
`import()` resolves to, so organize by feature, by domain, or by layer.

---

## Code splitting has exactly one unit

This is the part that usually costs a config file and a mental model, and here it costs a dynamic
`import` - in one place. A binding has two kinds of value and no third: a **screen**, which renders
immediately, and an **area**, which downloads on demand. So "what does this URL cost to reach?" is
answered by reading the bindings, not by tracing which factories happen to be async.

Still buildless - the browser loads the module itself. While it downloads, the router shows its
`loading` content; once the screen mounts, its own async `setup` shows the screen's `loading`. If
the user navigates away before a slow chunk lands, imp throws the stale chunk away so it can't flash
in over a newer page. You didn't configure a loading boundary or a race guard; you got both.

---

## Screens are self-cleaning

**Release a screen's resources** by... doing nothing. Every framework eventually teaches you the
navigation-memory-leak lesson: the interval you set, the socket you opened, the store slice you
populated, all outliving the page that made them. In imp, a screen is a component and leaving it
unmounts it:

```js
const dashboard = component('app-dashboard', {
  setup: (self) => {
    const metrics = initState(self, 'dashboard.metrics', []) // gone when you leave /dashboard
    self.socket = openMetricsSocket((m) => metrics.set(m))
    return metricsGrid()
  },
  onRemove: (self) => self.socket.close(), // closed on navigation away
})
```

The dashboard's state, its subscriptions, and its socket all end when you navigate away - because
the DOM they lived in is gone and imp tracks ownership through the DOM. App-wide things you _want_
to survive navigation - session, theme, cart - live in your app's root component _above_ the router,
which never unmounts.

---

## Navigation is a clean slate - but not a sledgehammer

Leaving a screen wipes it. But changing only the query string - `?q=imp` -> `?q=impala`, page 1 ->
page 2 - does **not** blow the screen away and rebuild it, so your search box keeps focus, your list
keeps its scroll, and your in-flight edits survive. The screen stays mounted and reads the live
query from `useRoute()`. (Navigating _within_ an area keeps the whole section mounted the same way,
swapping only its inner screen.)

---

## Loading and errors, without new components

A screen loads data the way any component does - `async setup`, with `loading` content for the wait:

```js
const todoDetail = component('app-todo-detail', {
  loading: () => div({ class: 'skeleton' }, 'Loading...'),
  setup: async (self, id) => {
    const todo = initState(self, 'app.todo', await fetchTodo(id))
    return article(h1(todo.text((t) => t.title)))
  },
  error: (_self, error) => div({ class: 'error' }, `Couldn't load: ${error.message}`),
})
```

There's no `loader` export feeding a separate data layer, no `<Await>` and `useLoaderData()`, no
revalidation cache to invalidate. The data lives where it's used. A screen that defines `error` is
its own error boundary. Anything a screen doesn't catch itself bubbles up to the router's own
`error`, so `router({ error })` is one shared route-level boundary without a new `<ErrorBoundary>`
element to wrap anything in.

---

## What's deliberately not here

- **No file-based routing.** Your app is a map you wrote, not a directory a compiler read. Rename a
  file freely; move a screen freely. The map is in one place you control - and `imp map` prints it.
- **No build step.** An area is a plain `import()`; there is no bundler splitting chunks, no route
  manifest generated at build time, nothing to keep in sync with your files.
- **No second copy of the nav.** The frame and the trail read the same map as the router, and the
  page title is one function of the crumbs. There is no nav array to keep in step with the routes,
  and no `isActive` to compute.
- **No `<Link>`/`<Outlet>`/`<Suspense>`/`<ErrorBoundary>` component set.** The router is a slot,
  loading is `loading` content, errors are a boundary - the same lifecycle every imp component has.
- **No data-layer API.** Loaders, actions, deferred data, and revalidation are replaced by "fetch in
  the component's `setup`," which you already know how to do.
- **No manual navigation cleanup.** Leaving the route _is_ the cleanup.

---

## The scoreboard

| You're used to...                                       | In imp...                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| A file-system routing convention + generated manifest   | one `appMap()` you read, top to bottom, in one file                   |
| A nav config kept in step with the routes               | the frame reads the same map                                          |
| A build step to code-split routes                       | `area(() => import('./area.js'))` - buildless, on demand              |
| `<Outlet/>` + nested layout files                       | `router()` slot + layouts that are plain functions                    |
| Per-route guard wiring                                  | a `need` per node, one guard on the router, the nav follows           |
| `<Suspense fallback>` around lazy routes                | the screen's `loading` + `router({ loading })` for downloads          |
| `<ErrorBoundary>` route element                         | the screen's `error`, or `router({ error })` for the whole subtree    |
| `loader` / `action` / `useLoaderData` data layer        | `async setup` - fetch where you render                                |
| `useLocation` + `useParams` + `useSearchParams`         | `useRoute()` and the factory's `{ params, query, node }`              |
| `useEffect` cleanup / `AbortController` on route change | unmounting the screen - automatic and total                           |
| Hand-written breadcrumbs per page                       | the trail derives from the map; a screen names its param crumb        |
| A `NotFound` route wired up in several places           | one `router({ notFound })`                                            |
| Remount-on-every-URL-change vs. update bookkeeping      | query-only changes keep the screen; path changes swap it              |
| A build that bakes in host-specific config files        | a portable bundle for any CDN; deep-link fallback is one host setting |

## The bottom line

One map - `appMap` - one element - `router` - fed the screens that bind to it, plus `navigate` and
the `useRoute` read. That's the core routing surface of imp; `area()` groups whole sections,
`access` on a node and one `guard` decide who sees what, `notFound` is the single 404, `url` and
`IMP_BASEPATH` handle a sub-path, and each screen cleans up in its own `onRemove`. Small enough to
hold in your head, explicit enough to debug by reading, and free of the build-time machinery and
cleanup bookkeeping that make routing the heaviest part of most front ends.

Your map points at a screen. Leaving the screen cleans it up. There's nothing else to learn.
