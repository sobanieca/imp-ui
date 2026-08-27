# imp-ui - Routing

Client-side routing for single-page apps: map the URL to a screen, swap screens on navigation, and
load rarely-visited sections on demand - with no build step, no route-scanning compiler, and no
config file. You describe your routes as one plain-data table and hand it to a router you drop into
your layout.

Everything routing-related is imported from **`imp/router`** (see **[Imports](imports.md)** for the
full map):

```js
import { area, guard, navigate, route, router, useRoute, wait } from 'imp/router'
```

## The whole thing in one screen

```js
import { component, mount } from 'imp'
import { button, div, h1, nav } from 'imp/html'
import { navigate, router } from 'imp/router'

const home = component('app-home', { onMount: () => h1('Welcome') })
const about = component('app-about', { onMount: () => h1('About us') })

const shell = component('app-shell', {
  onMount: () =>
    div(
      nav(
        button('Home', { events: { click: () => navigate('/') } }),
        button('About', { events: { click: () => navigate('/about') } }),
      ),
      router({
        routes: {
          '/': () => home(),
          '/about': () => about(),
        },
        onNotFound: () => h1('Not found'),
      }),
    ),
})

mount('#app', shell())
```

That is a complete routed app. The `router()` is the slot the matched screen renders into, its
`routes` table declares which screen answers which URL, and `navigate(...)` changes the URL without
a full page reload - here from a button's click handler.

## The mental model

- **The route table maps a URL pattern to a factory** - a function that returns the screen to show.
  It's a plain object you write; there is no file-name convention and nothing scans your project.
  The whole map lives in one place, next to the router that renders it - not scattered across files.
- **The router swaps screens on navigation.** `router()` watches the current URL. When you navigate
  to a different screen, it swaps the matched screen's DOM in and tears the old screen out - the
  screen you leave is unmounted, so its state, subscriptions, and timers are released automatically.
- **A screen is just what its factory returns** - usually a component, so it gets the full
  lifecycle: a loading placeholder, its own scoped state, an error boundary, and deterministic
  cleanup. A screen renders **immediately**; the one thing that loads on demand is an **area** (a
  whole section of the app), so there are only two things in a route table to tell apart.
- **You navigate with `navigate()`.** imp ships no link component - call `navigate('/path')` from
  any event handler and it swaps the screen and updates the URL without a full page reload.

## The route table

The `routes` option is an object mapping a **pattern** to a **target**:

```js
router({
  routes: {
    '/': () => home(),
    '/todos': () => todoList(),
    '/todos/:id': ({ params }) => todoDetail(params.id),
    '/todos/:id/edit': ({ params }) => todoEditor(params.id),
  },
})
```

A pattern is a URL path; segments that start with `:` capture a value. A screen factory receives one
argument, `{ params, query }`:

- **`params`** - the values captured by `:name` segments, URL-decoded. For `/todos/42`,
  `params.id === '42'`.
- **`query`** - the URL's query string parsed into an object **at the moment the screen is
  entered**. For `/search?q=imp&page=2`, `query.q === 'imp'`. Query values are always strings. If
  the query can change while the screen stays mounted (see below), read it live from `useRoute()`
  instead.

**Matching is first-match-wins**, in the order you wrote the keys. Trailing slashes are ignored
(`/todos` and `/todos/` are the same). When a static path and a parameter path could both match, put
the more specific one first:

```js
router({
  routes: {
    '/todos/new': () => newTodo(), // list the exact path first…
    '/todos/:id': ({ params }) => todoDetail(params.id), // …so it wins over the param
  },
})
```

The `routes:` option is a plain object like this. (There's one named helper, `area({ routes })`, but
it's only for exporting an **area's** own file - see _Areas_ - not something you reach for here.)

**A screen factory builds its screen right away** - it returns DOM, and imp renders it. It isn't the
place to `await` anything: don't fetch a screen's data there (load it in the screen component's
async `onMount`, so the wait shows the screen's own `placeholder`), and don't `import()` there
either. Code that should load on demand goes behind an **area**, described below - that's the one
lazy thing in a route table.

### Navigation is a clean slate - except query changes

Navigating to a **different screen** (a different pattern, or different `:params`) mounts it fresh
and unmounts the one you left. Navigating that changes **only the query string** keeps the current
screen mounted - so a search or filter page that lives at `/search?q=…` doesn't lose its input
focus, scroll, or in-progress state every time a query param changes. Such a screen reads the live
query from `useRoute()`:

```js
const results = component('app-results', {
  onMount: () => {
    const location = useRoute()
    return div(location.view((current) => resultList(current.query.q ?? '')))
  },
})
```

## The router

```js
router({ routes, placeholder, onError, onNotFound })
```

Drop it wherever the current screen should appear. Everything around it - a header, a sidebar, a
footer - stays put across navigations; only the router's contents change. What it renders is
determined by its `routes` table and the current URL.

The router behaves like a regular imp component, and takes these options - only `routes` is
required:

- **`routes`** - the route table (see above).
- **`placeholder`** - what the router shows while an **area's** code is still downloading (see
  _Areas_) or a guard is waiting for the state it reads (see _Route guards_). It's called with the
  route's `{ params, query }`.
- **`onError`** - a route-level **error boundary**. It renders a fallback when the matched screen,
  or any component it renders, throws during mount and doesn't handle the error itself - including
  an area whose `import()` won't download. A screen (or any nested component) that defines its own
  `onError` catches first; anything it doesn't handle bubbles up to the router. It's called with
  `(error, { params, query })`, and the failure is logged either way.
- **`onNotFound`** - the single fallback screen for any URL that matches no route in the table.

```js
div(
  header(appNav()),
  main(router({
    routes: appRoutes,
    placeholder: () => div({ class: 'route-loading' }, 'Loading…'),
    onError: (error) => div({ class: 'route-error' }, `This page failed to load: ${error.message}`),
    onNotFound: () => div({ class: 'route-404' }, 'Not found'),
  })),
  footer('© 2026'),
)
```

Shared layout that wraps several screens is just a plain function you call from each factory - no
special "layout route" concept (a layout that must stay mounted _across_ those screens is an area's
`root`, below):

```js
const withChrome = (content) => div({ class: 'page' }, breadcrumb(), content)

const appRoutes = {
  '/todos': () => withChrome(todoList()),
  '/todos/:id': ({ params }) => withChrome(todoDetail(params.id)),
}
```

### Not found (404)

Declare your not-found screen in one place with the router's `onNotFound` option:

```js
router({ routes: appRoutes, onNotFound: () => notFoundPage() })
```

It renders whenever no route in the table matches the current URL. It's just a factory - no path,
because it isn't a path; it's the single fallback for everything unmatched.

## Areas: grouping routes for a section (code splitting, no bundler)

When a whole section of your app lives under a URL prefix - `/admin`, `/shop` - you can give it its
own route table instead of listing every URL in one central map. An **area** is a table entry that
points a URL prefix at _another table_, loaded on demand - an area is always lazy, pointed at with
`area(() => import(...))`. This is also how you code-split: an area is the unit of on-demand
loading, and it needs no bundler, because the browser loads the module itself.

```js
router({
  routes: {
    '/': () => home(),
    '/login': () => login(),
    '/admin': area(() => import('./admin/area.js')), // a lazily-loaded area
    '/shop': area(() => import('./shop/area.js')),
  },
  onNotFound: () => notFound(),
})
```

That module declares the section with `area()`: its routes, written **relative** to the prefix, and
optionally the translations the section needs (see **[Translations](i18n.md)**):

```js
import { area } from 'imp/router'

export default area({
  routes: {
    '/': () => adminHome(), //            /admin
    '/users': () => usersList(), //       /admin/users
    '/users/:id': ({ params }) => userDetail(params.id), // /admin/users/:id
    '/billing': () => billing(), //       /admin/billing
  },
  translations: {
    en: () => import('./locales/en.js'),
    pl: () => import('./locales/pl.js'),
  },
})
```

Visiting `/admin/users` matches the `/admin` prefix, loads the section's module the first time, and
renders its `/users` screen - its code ships as one on-demand module.

**Areas are always lazy - and they're the only lazy thing.** `area(() => import('./…'))` is the only
way to point at one: its code loads the first time someone enters the section, and never ships to
users who never do. There is no eager form and no lazy-screen form - a table entry is either a
screen factory, which renders immediately, or an `area()`, which loads on demand. So "does this URL
cost a download?" has a one-word answer you can read off the table.

`area()` is one name doing both halves of the job, and which half you get depends on what you hand
it: **a function** is the pointer you put in the parent table, **an object** is the area's own
definition in its own file. They never appear in the same place, so there is one name to remember
and the argument says which is which.

While the module downloads there is no screen yet, so the router's `placeholder` shows; set it and
every area gets a loader during download, leave it off and the router is simply blank until the code
arrives. If the user navigates away before a slow chunk lands, imp discards it - a late-arriving
section never replaces a newer screen. Once the section's screen mounts, its own async `onMount` (if
it has one) shows the **screen's** `placeholder` while data loads.

### A root component for the whole section

An area can name a `root` - a component every screen in the section renders inside:

```js
// admin/area.js
const shell = component('admin-shell', {
  onMount: () => div(adminNav(), router()),
})

export default area({
  root: () => shell(),
  routes: {
    '/': () => adminHome(), //      /admin
    '/users': () => usersList(), // /admin/users
  },
})
```

`router()` with no table is the slot the section's screens render into: it matches the tail of the
URL against the area's own routes, the same table it would match without a root. It inherits the
parent router's `placeholder`, `onError` and `onNotFound`, and any of them can be overridden for the
section alone - `router({ onNotFound: () => adminNotFound() })`.

What a root buys you over wrapping each screen by hand (`'/users': () => shell(usersList())`) is
**lifetime**: the root stays mounted while the user moves between the section's screens, and
unmounts when they leave the section. So it is the place for whatever the whole section shares and
nothing outside it should see - a state scoped to the section, an [HTTP client](http.md) for its
backend, a layout that keeps its scroll position - none of it rebuilt on every navigation inside the
section.

The root receives the same `{ params, query }` a screen factory gets, so a prefix param is there for
the shell too (`root: ({ params }) => orgShell(params.orgId)`). A prefix param that changes remounts
the area, root included.

A root that loads something before it renders needs one thing in the right order. `router()` with no
table finds its area through the component that is mounting, exactly as `useState` and
`useHttpClient` find theirs - so in an **async** root it has to be called before the first `await`:

```js
const shell = component('admin-shell', {
  onMount: async () => {
    const api = useHttpClient('myapp.admin')
    const screens = router() //                    resolve the slot first…
    const settings = await api.get('/settings') // …then await
    return div(adminNav(settings), screens)
  },
})
```

Called after the `await`, it cannot see the area any more and fails with `'routes' is required` -
which reads as if the table were missing rather than as a matter of ordering. The
`imp/router-setup-before-await` rule of **[Linting](lint.md)** catches it before you run the app. A
`router({ routes })` with its own table looks nothing up and can be built anywhere.

When you don't want to code-split, keep the section's routes in your top-level table like any other
screen; reach for an area precisely when you want that section's code loaded on demand. A single
rarely-visited screen is worth an area of its own - a one-entry table is a perfectly ordinary area:

```js
'/admin-report': area(() => import('./report/area.js')),
// report/area.js: export default area({ routes: { '/': () => reportScreen() } })
```

A prefix can capture params too, and they flow into the section's screens:

```js
'/org/:orgId': area(() => import('./org/area.js')),
// a screen in that table sees { params: { orgId, …tail params } }
```

### Organize your files however you like

imp has **no opinion on where any of this lives.** It only ever sees the module an `import()`
resolves to - there is no folder convention, no `areas/` directory a tool scans for, and no file
whose name means something to the framework. The paths above are just examples; point each
`import()` at wherever the module actually is.

That means an area is a routing concept, not a directory. Group your code by feature, by domain, or
by architectural layer as your project prefers. A **Feature-Sliced Design** codebase, for instance,
works as-is: an imp area maps naturally onto an FSD _page_ (or _view_) - the composition root wires
each page's route table in with `area(() => import(...))`, and the widgets, features, and entities
that page uses stay in their own layers, imported by its screens as usual. A flat `screens/` folder
works just as well. The route table is the contract; the file layout is entirely yours.

Navigating **within** an area keeps the section mounted and only swaps its inner screen - the same
content-keyed behavior that keeps a screen mounted across a query-only change. A prefix param
changing (`/org/1` → `/org/2`) remounts the section. Areas nest to any depth: an area's table can
itself have an `area()` entry.

> **Note on memory:** leaving an area releases its screens' DOM, state, subscriptions, and timers as
> usual. It does **not** unload the area's already-downloaded JavaScript - once the browser has
> loaded a module it keeps it for the page's lifetime, and there is no API on the platform to evict
> one (this is true of every framework's code splitting, not just imp's). Lazy areas save you from
> loading code for sections nobody visits; they don't reclaim code for sections already visited. An
> area is about **code organization and code-splitting**, not freeing loaded code. The same is true
> of an area's `translations`: leaving unregisters them, so its keys stop resolving, but the module
> holding them stays loaded like any other; see **[Translations](i18n.md)**.

Why wrap the `import()` at all? Because a pattern that names an area matches as a **prefix** -
everything under it - while every other pattern matches exactly. `area()` is how you say "this
prefix loads a table, match the rest of the URL against it," which is the one thing the router can't
guess from a bare import.

## Route guards: keeping a screen behind a condition

A guard decides whether the visitor may open a route. It is a plain function of the state it reads,
and it runs before the screen is built:

```js
import { guard, wait } from 'imp/router'

const signedIn = guard(
  ['myapp.session'],
  (session) => session === undefined ? wait : Boolean(session) || '/login',
)
```

Read that from the inside out. `['myapp.session']` declares **which states this guard reads** - the
router looks them up for you and passes their values in, in the same order. The function returns one
of four answers:

| Return              | Means                                                       |
| ------------------- | ----------------------------------------------------------- |
| `true` (or nothing) | allow - render the screen                                   |
| `wait`              | "I can't decide yet" - keep the loader up and ask me again  |
| `'/login'`          | redirect there, replacing the current history entry         |
| `false`             | render the `onNotFound` page, as if the route did not exist |

### `wait` is what makes a synchronous guard possible

Nearly every real condition depends on something the app loads after it starts - the session comes
from your backend, so when the first URL is matched the answer genuinely isn't known yet. Rather
than making guards async (which would mean a request per navigation, and error handling in every
guard), imp lets a guard say **`wait`**.

When a guard returns `wait`, the router subscribes to the states it declared and pauses. Every time
one of them changes, the guard runs again - same function, same inputs, just later and with more
data. The first answer that isn't `wait` is acted on. So the guard stays a simple synchronous
function that you can call in a unit test with plain values, and the waiting is the router's job.

**A state that hasn't loaded yet is just `undefined`** - `initState('myapp.session')` with no
initial value starts there. imp has no separate "loading" concept, so `undefined` means whatever
your app decides it means; the guard is the one place that decides. That's why a signed-out session
is best written as `null`: `undefined` is "I don't know yet", `null` is "I know, and there is
nobody".

### The loader you already have

While a guard waits, the router shows its `placeholder` - the same loader an area's download shows:

```js
router({
  routes: {
    '/': () => home(),
    '/todos': route({ guard: signedIn, screen: () => todoList() }),
  },
  placeholder: () => div(spinner(), 'Loading...'),
})
```

You write no loading branch and no spinner state. And once the session has loaded, a guard that can
answer immediately renders its screen in the same tick - no loader appears at all when navigating
between screens later.

### One guard per route, written on the route

A guard attaches in exactly one place: the entry it protects. `route({ guard, screen })` is the
third thing a routes table accepts, next to a plain factory and an `area()` - its `screen` is
whatever you would have written there instead.

```js
router({
  routes: {
    '/': () => home(), //       no guard - open
    '/login': () => login(), // no guard - open
    '/todos': route({ guard: signedIn, screen: () => todoList() }),
    '/todos/:id': route({ guard: signedIn, screen: ({ params }) => todoDetail(params.id) }),
    '/admin': route({ guard: adminOnly, screen: area(() => import('./admin/area.js')) }),
  },
})
```

There is no router-wide default and no inheritance: a route has one guard or none, and you can see
which by reading its line. Nothing above a route can add a condition it doesn't name, so "why was I
redirected here?" is always answered by one function.

The cost is repetition when most of an app is protected - `route({ guard: signedIn, ... })` on every
entry. That is the trade: a repeated word you can grep for, instead of a rule applied to a route
from somewhere else.

**Combining conditions is your job, and it's just a function.** Write the shared part once as a
plain check and build each guard from it:

```js
const requireSession = (session) => session === undefined ? wait : Boolean(session) || '/login'

const requireAdmin = (session) => {
  const allowed = requireSession(session)
  return allowed === true ? session.role === 'admin' || '/forbidden' : allowed
}

const signedIn = guard(['myapp.session'], requireSession)
const adminOnly = guard(['myapp.session'], requireAdmin)

const billingAdmin = guard(['myapp.session', 'myapp.plan'], (session, plan) => {
  const allowed = requireAdmin(session)
  if (allowed !== true) return allowed
  if (plan === undefined) return wait
  return plan.tier === 'business' || '/upgrade'
})
```

Sharing the _check_ rather than stacking guards keeps the composition in your code, where you read
it top to bottom and test it with plain values.

A guard receives `{ params, query, path }` as its last argument, after the state values - so it can
check the route it is guarding, not just the session:

```js
const canEditOrg = guard(['myapp.session', 'myapp.orgs'], (session, orgs, { params }) => {
  if (session === undefined || orgs === undefined) return wait
  if (!session) return '/login'
  const org = orgs.find((candidate) => candidate.id === params.orgId)
  return org?.ownerId === session.id || '/forbidden'
})
```

### Guards keep watching

A guard doesn't run once. The states it declared stay watched for as long as the screen is showing,
so signing out while on a protected screen redirects immediately:

```js
button('Sign out', {
  events: {
    click: async () => {
      await api.post('/logout')
      session.set(null) // the guard on this route re-runs and redirects to /login
    },
  },
})
```

Set `null` rather than clearing back to `undefined`: `null` is an answer a guard can act on, while
`undefined` only makes it wait - and a guard that returns `wait` for a screen already on the page is
ignored. Once you are in, only a redirect takes you out; otherwise a background refresh of the
session would tear down the screen you are working in, losing scroll, focus, and anything you typed.

### Guards and lazily loaded sections

A guard on the entry that points at an area covers the whole section - its `root` and every screen
under it - and it decides **before the import runs**, so a non-admin never downloads the admin code:

```js
'/admin': route({ guard: adminOnly, screen: area(() => import('./admin/area.js')) }),
```

The area's own file declares no guard of its own; a route inside it can carry one for a narrower
rule (`/admin/billing` needing more than `/admin` does). The entry's guard keeps watching while the
visitor is inside the section, so losing the session redirects out of it immediately.

Guards are a UI concern: they decide what to render, not what a visitor is allowed to have. Your
backend still authorizes every request - a determined visitor can always fetch the JavaScript.

### When something goes wrong

Guards fail closed - no failure path lets a screen through:

- A guard that throws, or returns something that isn't one of the four answers, renders the router's
  `onError`.
- A guard declaring a state that no component above the router provides fails the route with the
  same error `useState` gives you.
- A guard stuck on `wait` for more than five seconds logs a warning naming the route and the states
  it is waiting for - usually a state nothing ever sets.

## Navigating

### Programmatically

`navigate` is the one primitive; everything else is built on it.

```js
navigate('/todos/42')
navigate('/login', { replace: true }) // replace the current history entry instead of adding one
```

`navigate` works anywhere - an event handler, a timer, after an `await`:

```js
button('Save', {
  events: {
    click: async () => {
      const todo = await save(draft)
      navigate(`/todos/${todo.id}`)
    },
  },
})
```

Use `{ replace: true }` when you don't want the current page in the back-button history - for
example after a login redirect. Navigating to the URL you're already on is a no-op rather than a
duplicate history entry.

### Navigation controls

There's no link component to learn - put `navigate` in a control's click handler. A nav bar is just
a row of buttons:

```js
nav(
  button('Home', { events: { click: () => navigate('/') } }),
  button('Todos', { events: { click: () => navigate('/todos') } }),
)
```

## Reading the current route

`useRoute()` returns a read-only handle to the live route - `{ path, query }` - that any component
can watch, including one outside the router like a nav bar. It has the same shape as any imp state
(`get`, `watch`, `text`, `view`, `each`), minus `set` (you change the route by navigating, not by
writing to it).

```js
useRoute().watch((current) => track('pageview', { path: current.path })) // react from non-UI code
const { path, query } = useRoute().get() // read once, imperatively
```

## Loading and errors

Because a screen is a component, its loading and error handling are just the component lifecycle you
already know:

```js
const todoDetail = component('app-todo-detail', {
  placeholder: () => div({ class: 'skeleton' }, 'Loading…'),
  onMount: async (_instance, id) => {
    const todo = initState('app.todo', await fetchTodo(id))
    return article(h1(todo.text((t) => t.title)))
  },
  onError: (error) => div({ class: 'error' }, `Couldn't load this todo: ${error.message}`),
})

// routes: { '/todos/:id': ({ params }) => todoDetail(params.id) }
```

- **Data loading** lives in the screen's `onMount` - fetch, `await`, build. The `placeholder` shows
  until it resolves. There is no separate loader or data-fetching API to learn.
- **Waiting on a guard** uses the same `placeholder` (see _Route guards_) - the visitor sees one
  loader whether the wait is a download, a guard, or the screen's own data.
- **Errors** - a screen that defines `onError` handles its own failures first. A failure it doesn't
  handle - an area's `import()` that won't download, or the screen (or any component it renders)
  throwing during mount - bubbles up to the **router's** `onError`, which acts as an error boundary
  for the whole matched subtree.

With no `onError` at either level, a failed screen renders nothing (the failure is still logged)
rather than hanging on a placeholder forever.

## Screens clean up after themselves

Navigating away from a screen unmounts it, and unmounting releases everything imp tracks - a
screen's lifetime is bounded by the URL:

- **State** created with `initState` inside the screen (or any component under it) is released. Put
  a screen's own state in the screen's root component; only truly app-wide state (session, theme,
  cart) belongs in your app's root component above the router, which never unmounts.
- **Subscriptions** - every `watch`, `text`, `view`, `each`, and bound prop set up while the screen
  was mounted - are torn down.
- **Timers, intervals, sockets, and globals** you reached for are undone in the screen component's
  own `onUnmount` - each component is responsible for its own teardown.

```js
const dashboard = component('app-dashboard', {
  onMount: (instance) => {
    const metrics = initState('dashboard.metrics', []) // released when you leave the dashboard
    instance.socket = openMetricsSocket((m) => metrics.set(m))
    globalThis.gtag = setupAnalytics()
    return metricsGrid()
  },
  onUnmount: (instance) => {
    instance.socket.close() // closed on navigation away
    delete globalThis.gtag // undo the global you set - imp can't track it, so you do
  },
})
```

You don't write any special navigation cleanup: each screen is a component, so its `onUnmount` is
the cleanup and leaving the route runs it.

## Base path (serving under a sub-directory)

If your app is served under a sub-path (say `https://example.com/app/`), set the **`IMP_BASEPATH`**
environment value - the same way you set any other imp environment value (see
**[Configuration](config.md)**):

```json
{
  "IMP_BASEPATH": "/app"
}
```

imp reads `IMP_BASEPATH` at startup, so there's no configuration call in your code. You keep writing
route patterns and `navigate` targets from the app root (`/todos`, not `/app/todos`); imp strips the
base from the URL before matching and adds it back when `navigate` builds the real URL.

The same value covers your static assets: `imp build` prefixes the root-absolute URLs in your page -
stylesheets, images, the PWA manifest and service worker - with the base, so one setting moves the
whole app under the sub-path.

The one value that isn't adjusted automatically is an `href` you set yourself. If you render a real
`<a>`, build its `href` with `url(path)` - it prefixes the base so middle-click and "copy link
address" stay correct, and it's a no-op when `IMP_BASEPATH` is unset (leaving absolute or external
URLs untouched):

```js
a({ href: url('/todos') }, 'All todos')
```

## Accessibility: scroll and focus

- **Scroll** is managed for you: a forward navigation scrolls to the top of the new screen, and the
  back/forward buttons restore the scroll position you left each page at.
- **Focus** is left to you, because moving focus on navigation is disruptive when it isn't wanted
  and right when it is - only your screens know which. A screen that should take focus can focus its
  own heading in `instance.afterMount`, or you can maintain a shared visually-hidden live region and
  update it from `useRoute().watch(...)`.
- **Doing it once for every screen** is usually the better shape: give the element your router slot
  renders into a `tabindex` of `-1`, and focus it from `useRoute().watch(...)` whenever the path
  changes. Compare the path rather than the whole route, so a query-string change never pulls focus
  out of the input the reader is typing in, and skip the first call - it fires with the route the
  page loaded on, where there is nothing to move focus away from. Style that element's `:focus` with
  `outline: none`: the focus is programmatic, so the browser would otherwise ring the whole screen
  on arrival.

## Deploying: deep links and refresh

A client router owns URLs like `/todos/42` in the browser, but visiting or refreshing that URL sends
a request straight to your server - which must answer with your app's entry HTML so the client
router can take over. Otherwise a refresh 404s.

`imp build` stays out of this. It produces a plain, portable bundle of your app's real files -
nothing host-specific - that you upload anywhere. Serving the entry for unknown paths is a one-time
setting on whatever hosts it, and every platform has it:

| Host                 | Setting                                                 |
| -------------------- | ------------------------------------------------------- |
| nginx                | `try_files $uri /index.html;`                           |
| Netlify / Cloudflare | a `_redirects` file with `/*  /index.html  200`         |
| Vercel               | a `rewrites` rule to `/index.html` in `vercel.json`     |
| S3 + CloudFront      | set the "error document" / 404 response to `index.html` |
| GitHub Pages         | add a `404.html` that is a copy of your `index.html`    |

In development you don't need any of this: `imp start` already serves your entry HTML for a
navigation request to an extensionless path, while a genuinely missing asset (a bad `.js` path)
still 404s - so deep links and refresh just work while you build.

## API summary

| Export                                   | Returns            | What it does                                                                                                                                  |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `router(options)`                        | a live router slot | Renders the matched screen; `options`: `routes` (required), `placeholder`, `onError`, `onNotFound`.                                           |
| `router()`                               | a live router slot | Inside an area's `root`, renders the section's own routes; inherits the parent router's options.                                              |
| `area({ routes, root?, translations? })` | an area definition | Declares an area's own table, the component its screens render inside, and the translations it loads, for its `export default` (see _Areas_). |
| `route({ guard, screen })`               | a guarded entry    | A routes-table entry that renders `screen` only if its one guard allows it (see _Route guards_).                                              |
| `guard(states, check)`                   | a guard            | A synchronous check over the values of the states it names; returns `true`, `wait`, `false`, or a path to redirect to.                        |
| `wait`                                   | a verdict          | Returned by a guard that cannot decide yet - the router keeps its `placeholder` up and re-runs the guard when a declared state changes.       |
| `area(() => import(...))`                | an area marker     | Marks a prefix entry as a lazily-loaded area - the one on-demand unit.                                                                        |
| `navigate(path, { replace? })`           | -                  | Navigates programmatically; `replace` swaps the current history entry.                                                                        |
| `useRoute()`                             | a read-only route  | The live `{ path, query }` - `get`/`watch`/`text`/`view`/`each`, no `set`.                                                                    |
| `url(path)`                              | a URL string       | An app-root path with `IMP_BASEPATH` prefixed, for your anchor hrefs.                                                                         |

### Patterns

| Pattern      | Matches                         | Factory sees                      |
| ------------ | ------------------------------- | --------------------------------- |
| `/`          | the root path                   | `{ params: {}, query }`           |
| `/todos`     | exactly `/todos` (or `/todos/`) | `{ params: {}, query }`           |
| `/todos/:id` | `/todos/42`                     | `{ params: { id: '42' }, query }` |

A pattern whose target is an `area()` matches as a **prefix** - everything under it - and the tail
is matched against that area's table. Anything that matches nothing renders the router's
`onNotFound` screen (if you provided one).
