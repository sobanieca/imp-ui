# Routing You Can Read in One Sitting

## imp ui: a real SPA router with no build step, no file-name magic, and no cleanup to forget

Routing is where front-end frameworks quietly get big. A router that started as "map a URL to a
component" grows a file-system convention, a build-time route manifest, nested layout files, loader
and action exports, a `<Suspense>` boundary, a `<Link prefetch>`, and a data-revalidation cache —
and somewhere in there you stopped being able to answer "what renders at `/todos/42`?" by reading
your own code.

imp takes the other bet: **your app already has a place to put the current screen — a slot in the
DOM — and a way to clean up when a screen leaves — unmounting.** So the whole router is one element
you place, one table you write, and no new ideas.

Here's a complete routed app:

```js
import { component, mount } from 'imp'
import { button, div, h1, nav } from 'imp/html'
import { navigate, router } from 'imp/router'

const home = component('app-home', { onMount: () => h1('Welcome') })
const about = component('app-about', { onMount: () => h1('About') })

mount(
  '#app',
  div(
    nav(
      button('Home', { events: { click: () => navigate('/') } }),
      button('About', { events: { click: () => navigate('/about') } }),
    ),
    router({
      routes: {
        '/': () => home(),
        '/about': () => about(),
        '/todos/:id': ({ params }) => todoDetail(params.id),
      },
      onNotFound: () => h1('Not found'),
    }),
  ),
)
```

`router()` is the slot the current screen renders into. Its `routes` table maps a URL to the screen
that answers it. `navigate` changes the URL without a reload — call it from any click handler.
That's the app. No `routes.config.js`, no `app/` directory that means something to a compiler, no
provider to wrap everything in.

---

## The pitch in three sentences

- **Routes are one plain-data table.** `'/todos/:id': ({ params }) => todoDetail(params.id)` — an
  object you read top to bottom, in one place, next to the router that renders it. Nothing scans
  your filesystem; nothing generates a manifest; there is no build time — and no free `route()`
  calls scattered across files as import side effects.
- **The router is a live region and a screen is a component.** Navigating swaps the matched screen's
  DOM in and tears the old one out — you get loading placeholders, error boundaries, and scoped
  state for free, because they're the component lifecycle you already use everywhere else.
- **Navigation is a clean slate.** The screen you leave unmounts, so its state, subscriptions,
  timers, and sockets are released automatically. There is no navigation cleanup code, because there
  is nothing left to clean up.

If you're coming from React Router or Next: imagine the router without the file-system convention,
the build step, the `<Outlet/>`/`<Suspense/>`/`<ErrorBoundary/>` component zoo, and the
`loader`/`action` data layer — because loading data is just an `async` component, and cleanup is
just unmounting.

---

## The whole API: one element, one table, one call, one read

### `router({ routes })` — the slot and its map

Drop it where the screen goes. Everything around it — header, sidebar, footer — persists across
navigations; only the router changes. Its `routes` table is a plain object mapping a pattern to the
factory that renders its screen; the factory receives `{ params, query }`:

```js
router({
  routes: {
    '/': () => home(),
    '/search': ({ query }) => results(query.q),
    '/todos/:id': ({ params }) => todoDetail(params.id),
  },
  placeholder: () => spinner(), //   shown while an area's code downloads
  onError: (error) => errorPanel(error), // a route-level error boundary for the whole screen
  onNotFound: () => notFound(), //   the one fallback for any unmatched URL
})
```

First match wins, in the order you wrote the keys — so a table you can scan is also the priority
order. No precedence algorithm to reverse-engineer, no `exact` prop, no ranking heuristic deciding
whether `/todos/new` or `/todos/:id` wins. You decide, by ordering.

Shared layouts aren't a framework feature here — they're a function:

```js
const page = (content) => div({ class: 'shell' }, breadcrumb(), content)

router({
  routes: {
    '/todos': () => page(todoList()),
    '/todos/:id': ({ params }) => page(todoDetail(params.id)),
  },
})
```

No `layout.jsx` files, no nested-route indentation, no `<Outlet/>` threaded through three levels. If
you can write a function, you can share a layout.

### `navigate(path, options)` — go, from anywhere

```js
navigate('/todos/42')
navigate('/login', { replace: true })
```

Works in an event handler, a timer, after an `await` — no hook rules, no `useNavigate()` you can
only call at the top of a component:

```js
const todo = await save(draft)
navigate(`/todos/${todo.id}`)
```

### Navigation controls — no link component

imp doesn't ship a `<Link>`. Put `navigate` in a click handler and a nav bar is a row of buttons:

```js
nav(
  button('Home', { events: { click: () => navigate('/') } }),
  button('Todos', { events: { click: () => navigate('/todos') } }),
)
```

### `useRoute()` — read the current location, reactively

The one read. It hands back the live `{ path, query }` — the same helper object as any imp state, so
`text`, `view`, and `watch` all work — and it works **anywhere**, including a nav bar that lives
outside the router:

```js
// highlight the active control — reacts as the route changes
button(
  { class: computed([useRoute()], (current) => current.path === '/todos' ? 'active' : '') },
  'Todos',
)

// pageview analytics, no wiring
useRoute().watch((current) => track('pageview', { path: current.path }))
```

No `useLocation` + `useParams` + `useSearchParams` triple, no context that only resolves inside the
router subtree.

---

## Whole sections, grouped: areas

When a section of your app lives under a prefix — `/admin`, `/shop` — you don't have to list every
URL in one central map. Point the prefix at _another table_ and that section owns its own routes, in
its own file, loaded on demand:

```js
router({
  routes: {
    '/': () => home(),
    '/admin': area(() => import('./admin/routes.js')), // a lazily-loaded section
  },
  onNotFound: () => notFound(),
})
```

```js
// the section's routes, relative to /admin — keep this file wherever you like
export default areaRoutes({
  '/': () => adminHome(), //     /admin
  '/users': () => usersList(), // /admin/users
  '/billing': () => billing(), // /admin/billing
})
```

Visiting `/admin/users` matches the prefix, loads the admin module the first time, and renders its
`/users` screen — its code never ships to users who never open the section. It's the same idea as
the top-level table, one level down: a route table that nests. No `route.prefix`, no scope registry,
no `<Outlet/>` threaded into a layout file — an area is just an entry whose target is a table.

And imp dictates no folder layout for any of it — it only sees the module your `import()` resolves
to, so organize by feature, by domain, or by layer. A **Feature-Sliced Design** codebase drops in
as-is: an area maps onto an FSD page/view, wired in at the composition root, with its widgets,
features, and entities living in their own layers. The route table is the contract; the file tree is
yours.

---

## Code splitting has exactly one unit

This is the part that usually costs a config file and a mental model, and here it costs a dynamic
`import` — in one place. A route table has two kinds of entry and no third: a **screen**, which
renders immediately, and an **area**, which downloads on demand. So "what does this URL cost to
reach?" is answered by reading the table, not by tracing which factories happen to be async.

```js
routes: {
  '/': () => home(), //                              here now
  '/admin': area(() => import('./admin/routes.js')), // arrives when someone goes there
}
```

Still buildless — the browser loads the module itself. While it downloads, the router shows its
`placeholder` (the screen doesn't exist yet, so there's nothing else to show); once the screen
mounts, its own async `onMount` shows the screen's placeholder. If the user navigates away before a
slow chunk lands, imp throws the stale chunk away so it can't flash in over a newer page. You didn't
configure a loading boundary or a race guard; you got both.

Splitting off a single rarely-visited screen? Give it a one-entry area — an area is a routing
concept, not a minimum size.

---

## Screens are self-cleaning

**Release a screen's resources** by… doing nothing. Every framework eventually teaches you the
navigation-memory-leak lesson: the interval you set, the socket you opened, the store slice you
populated, all outliving the page that made them. In imp, a screen is a component and leaving it
unmounts it:

```js
const dashboard = component('app-dashboard', {
  onMount: (instance) => {
    const metrics = initState('dashboard.metrics', []) // gone when you leave /dashboard
    instance.socket = openMetricsSocket((m) => metrics.set(m))
    return metricsGrid()
  },
  onUnmount: (instance) => instance.socket.close(), // closed on navigation away
})

// routes: { '/dashboard': () => dashboard() }
```

The dashboard's state, its subscriptions, and its socket all end when you navigate away — because
the DOM they lived in is gone and imp tracks ownership through the DOM. App-wide things you _want_
to survive navigation — session, theme, cart — live in your app's root component _above_ the router,
which never unmounts. The boundary between "lives for this screen" and "lives for the app" is just
_which component owns it_, and that's visible in your code.

And for the one thing imp _can't_ see — a real global you reached for, like a `window.gtag` or a
third-party widget booted once — you undo it in the screen's own `onUnmount`, right next to where
you set it:

```js
const report = component('app-report', {
  onMount: () => {
    window.gtag = setupAnalytics()
    return reportBody()
  },
  onUnmount: () => delete window.gtag, // runs when the router leaves this screen
})
```

There's no separate cleanup registry and no special API to learn: each component owns its own
teardown.

---

## Navigation is a clean slate — but not a sledgehammer

Leaving a screen wipes it. But changing only the query string — `?q=imp` → `?q=impala`, page 1 →
page 2 — does **not** blow the screen away and rebuild it, so your search box keeps focus, your list
keeps its scroll, and your in-flight edits survive. The screen stays mounted and reads the live
query from `useRoute()`. Most routers make you choose between "remount on every URL change" and a
pile of `shouldComponentUpdate`-style bookkeeping; imp keys the screen by its route, so it does the
obvious thing by default. (Navigating _within_ an area keeps the whole section mounted the same way,
swapping only its inner screen.)

---

## Loading and errors, without new components

A screen loads data the way any component does — `async onMount`, with a `placeholder` for the wait:

```js
const todoDetail = component('app-todo-detail', {
  placeholder: () => div({ class: 'skeleton' }, 'Loading…'),
  onMount: async (_instance, id) => {
    const todo = initState('app.todo', await fetchTodo(id))
    return article(h1(todo.text((t) => t.title)))
  },
  onError: (error) => div({ class: 'error' }, `Couldn't load: ${error.message}`),
})
```

There's no `loader` export feeding a separate data layer, no `<Await>` and `useLoaderData()`, no
revalidation cache to invalidate. The data lives where it's used. A screen that defines `onError` is
its own error boundary — a failed fetch renders your fallback instead of hanging on a spinner. And
anything a screen doesn't catch itself — an area's chunk that won't download, or a nested component
that throws with no `onError` — bubbles up to the router's own `onError`, so `router({ onError })`
is one shared route-level boundary without a new `<ErrorBoundary>` element to wrap anything in.

---

## What's deliberately not here

Each omission is a category of config, indirection, or footgun you stop having:

- **No file-based routing.** Your routes are a table you wrote, not a directory a compiler read.
  Rename a file freely; move a screen freely. The URL map is in one place you control.
- **No build step.** An area is a plain `import()`; there is no bundler splitting chunks, no route
  manifest generated at build time, nothing to keep in sync with your files.
- **No `<Link>`/`<Outlet>`/`<Suspense>`/`<ErrorBoundary>` component set.** The router is a slot,
  loading is a placeholder, errors are a boundary — the same lifecycle every imp component has — and
  navigation is `navigate` in a click handler, not a component to import.
- **No data-layer API.** Loaders, actions, deferred data, and revalidation are replaced by "fetch in
  the component's `onMount`," which you already know how to do.
- **No manual navigation cleanup.** No `useEffect` return function to unsubscribe on route change,
  no `AbortController` you have to remember. Leaving the route _is_ the cleanup.

---

## The scoreboard

| You're used to...                                       | In imp...                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| A file-system routing convention + generated manifest   | a `routes` table you read, top to bottom, in one place                 |
| A build step to code-split routes                       | `area(() => import('./routes.js'))` — buildless, on demand             |
| `<Outlet/>` + nested layout files                       | `router()` slot + layouts that are plain functions                     |
| Nested route trees / a route-owning "feature" module    | an area — a table entry that points at another table                   |
| `<Suspense fallback>` around lazy routes                | the screen's `placeholder` + `router({ placeholder })` for downloads   |
| `<ErrorBoundary>` route element                         | the screen's `onError`, or `router({ onError })` for the whole subtree |
| `loader` / `action` / `useLoaderData` data layer        | `async onMount` — fetch where you render                               |
| `useLocation` + `useParams` + `useSearchParams`         | `useRoute()` and the factory's `{ params, query }`                     |
| `useEffect` cleanup / `AbortController` on route change | unmounting the screen — automatic and total                            |
| A `NavLink` component + `isActive` render props         | a control whose `class` is a `computed` over `useRoute()`              |
| A `NotFound` route wired up in several places           | one `router({ onNotFound })`                                           |
| Remount-on-every-URL-change vs. update bookkeeping      | query-only changes keep the screen; path changes swap it               |
| Two ways to code-split (lazy route _and_ nested module) | one way — an area                                                      |
| A build that bakes in host-specific config files        | a portable bundle for any CDN; deep-link fallback is one host setting  |

## The bottom line

One element — `router` — fed one `routes` table, plus `navigate` and the `useRoute` read. That's the
core routing surface of imp; `areaRoutes()` and `area()` group whole sections, `onNotFound` is the
single 404, `url` and `IMP_BASEPATH` handle a sub-path, and each screen cleans up in its own
`onUnmount`. Small enough to hold in your head, explicit enough to debug by reading, and free of the
build-time machinery and cleanup bookkeeping that make routing the heaviest part of most front ends.

Your URL points at a screen. Leaving the screen cleans it up. There's nothing else to learn.
