# imp-ui - Routing

imp gives a single-page app client-side routing. It maps a URL to a screen, changes the screen on a
navigation, and loads a section that people rarely visit on demand. There is no build step, no
compiler that scans routes, and no config file. You describe your routes as one plain-data table,
and you hand the table to a router that you drop into your layout.

Everything about routing comes from **`imp/router`**. See **[Imports](imports.md)** for the full
map:

```js
import { area, guard, navigate, route, router, useRoute, wait } from 'imp/router'
```

## The whole idea in one screen

```js
import { component, mount } from 'imp'
import { button, div, h1, nav } from 'imp/html'
import { navigate, router } from 'imp/router'

const home = component('app-home', { build: () => h1('Welcome') })
const about = component('app-about', { build: () => h1('About us') })

const shell = component('app-shell', {
  build: () =>
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
        notFound: () => h1('Not found'),
      }),
    ),
})

mount('#app', shell())
```

That is a complete routed app. The `router()` is the slot where the matched screen renders. Its
`routes` table declares which screen answers which URL. `navigate(...)` changes the URL with no full
page reload. Here it runs from the click handler of a button.

## The mental model

- **The route table maps a URL pattern to a factory.** A factory is a function that returns the
  screen to show. The table is a plain object that you write. There is no file-name convention, and
  nothing scans your project. The whole map lives in one place, beside the router that renders it.
  It is not spread across files.
- **The router changes the screen on a navigation.** `router()` watches the current URL. When you
  navigate to a different screen, it puts the DOM of the matched screen in, and takes the old screen
  out. imp unmounts the screen that you leave. So its state, its subscriptions and its timers are
  released automatically.
- **A screen is what its factory returns.** It is usually a component, so it gets the full
  lifecycle: a loading placeholder, its own scoped state, an error boundary and clear cleanup. A
  screen renders **immediately**. The one thing that loads on demand is an **area**, which is a
  whole section of the app. So a route table holds only two kinds of thing to tell apart.
- **You navigate with `navigate()`.** imp ships no link component. Call `navigate('/path')` from any
  event handler. It changes the screen and updates the URL, with no full page reload.

## The route table

The `routes` option is an object that maps a **pattern** to a **target**:

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

A pattern is a URL path. A segment that starts with `:` captures a value. A screen factory receives
one argument, `{ params, query }`:

- **`params`** holds the values that a `:name` segment captured, URL-decoded. For `/todos/42`,
  `params.id === '42'`.
- **`query`** is the query string of the URL, parsed into an object **at the moment when the person
  enters the screen**. For `/search?q=imp&page=2`, `query.q === 'imp'`. A query value is always a
  string. When the query can change while the screen stays mounted, described below, read it live
  from `useRoute()` instead.

**The first match wins**, in the order in which you wrote the keys. imp ignores a trailing slash, so
`/todos` and `/todos/` are the same. When a static path and a parameter path could both match, put
the more specific one first:

```js
router({
  routes: {
    '/todos/new': () => newTodo(), // list the exact path first...
    '/todos/:id': ({ params }) => todoDetail(params.id), // ...so it wins over the param
  },
})
```

The `routes` option is a plain object like this one. There is one named helper, `area({ routes })`,
but it is only for the export of the file of an **area**. See _Areas_. It is not something that you
use here.

**A screen factory builds its screen immediately.** It returns DOM, and imp renders it. It is not
the place to `await` anything. Do not fetch the data of a screen there. Load it in the async `build`
of the screen component, so the wait shows the `placeholder` of the screen. Do not call `import()`
there either. Code that must load on demand goes behind an **area**, described below. That is the
one lazy thing in a route table.

### A navigation is a clean start, except a change of the query

A navigation to a **different screen**, which is a different pattern or a different `:param`, mounts
that screen from the start, and unmounts the screen that you left. A navigation that changes **only
the query string** keeps the current screen mounted. So a search page or a filter page that lives at
`/search?q=...` does not lose the focus of its input, its scroll position, or its state in progress,
every time when a query param changes. Such a screen reads the live query from `useRoute()`:

```js
const results = component('app-results', {
  build: () => {
    const location = useRoute()
    return div(location.view((current) => resultList(current.query.q ?? '')))
  },
})
```

## The router

```js
router({ routes, placeholder, fallback, notFound })
```

Drop the router where the current screen must appear. Everything around it stays in place across a
navigation. That covers a header, a sidebar and a footer. Only the contents of the router change.
Its `routes` table and the current URL decide what it renders.

The router behaves like a regular imp component. It takes these options, and only `routes` is
necessary:

- **`routes`** is the route table, described above.
- **`placeholder`** is what the router shows while the code of an **area** downloads, see _Areas_,
  or while a guard waits for the state that it reads, see _Route guards_. imp calls it with the
  `{ params, query }` of the route.
- **`fallback`** is an **error boundary** at route level. It renders in place of the matched screen
  when that screen, or any component that it renders, throws during the mount and does not handle
  the error itself. That includes an area whose `import()` does not download. A screen, or any
  nested component, that defines its own `fallback` catches first. Anything that it does not handle
  goes up to the router. imp calls the router `fallback` with `(error, { params, query })`, and it
  logs the failure in both cases.
- **`notFound`** is the one screen that imp shows for a URL that matches no route in the table.

```js
div(
  header(appNav()),
  main(router({
    routes: appRoutes,
    placeholder: () => div({ class: 'route-loading' }, 'Loading...'),
    fallback: (error) =>
      div({ class: 'route-error' }, `This page failed to load: ${error.message}`),
    notFound: () => div({ class: 'route-404' }, 'Not found'),
  })),
  footer('(c) 2026'),
)
```

A shared layout that wraps several screens is a plain function that you call from each factory.
There is no special layout route concept. A layout that must stay mounted _across_ those screens is
the `root` of an area, described below:

```js
const withChrome = (content) => div({ class: 'page' }, breadcrumb(), content)

const appRoutes = {
  '/todos': () => withChrome(todoList()),
  '/todos/:id': ({ params }) => withChrome(todoDetail(params.id)),
}
```

### Not found (404)

Declare your not-found screen in one place, with the `notFound` option of the router:

```js
router({ routes: appRoutes, notFound: () => notFoundPage() })
```

It renders whenever no route in the table matches the current URL. It is a factory. It has no path,
because it is not a path. It is the one fallback for everything that matches nothing.

## Areas: how to group the routes of a section, and split the code

When a whole section of your app lives under a URL prefix, such as `/admin` or `/shop`, you can give
that section its own route table. You do not list every URL in one central map. An **area** is a
table entry that points a URL prefix at _another table_, and imp loads that table on demand. An area
is always lazy. You point at it with `area(() => import(...))`. This is also how you split the code.
An area is the unit of on-demand loading, and it needs no bundler, because the browser loads the
module itself.

```js
router({
  routes: {
    '/': () => home(),
    '/login': () => login(),
    '/admin': area(() => import('./admin/area.js')), // a lazily-loaded area
    '/shop': area(() => import('./shop/area.js')),
  },
  notFound: () => notFound(),
})
```

That module declares the section with `area()`. It gives its routes, written **relative** to the
prefix, and optionally the translations that the section needs. See **[Translations](i18n.md)**:

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

A visit to `/admin/users` matches the `/admin` prefix. imp loads the module of the section the first
time, and renders its `/users` screen. The code of the section ships as one on-demand module.

**An area is always lazy, and it is the only lazy thing.** `area(() => import('./...'))` is the only
way to point at one. Its code loads the first time when somebody enters the section. It never ships
to a user who never enters. There is no eager form and no lazy-screen form. A table entry is either
a screen factory, which renders immediately, or an `area()`, which loads on demand. So the question
"does this URL cost a download?" has a one-word answer that you read off the table.

`area()` is one name that does both halves of the job. Which half you get depends on what you hand
it. **A function** is the pointer that you put in the parent table. **An object** is the definition
of the area, in its own file. The two never appear in the same place. So there is one name to
remember, and the argument says which half it is.

While the module downloads there is no screen. So the `placeholder` of the router shows. Set the
placeholder, and every area gets a loader during the download. Leave it out, and the router is blank
until the code arrives. When the user navigates away before a slow chunk arrives, imp discards the
chunk. A section that arrives late never replaces a newer screen. After the screen of the section
mounts, its own async `build`, when it has one, shows the `placeholder` of the **screen** while the
data loads.

### A root component for the whole section

An area can name a `root`. That is a component that every screen in the section renders inside:

```js
// admin/area.js
const shell = component('admin-shell', {
  build: () => div(adminNav(), router()),
})

export default area({
  root: () => shell(),
  routes: {
    '/': () => adminHome(), //      /admin
    '/users': () => usersList(), // /admin/users
  },
})
```

A `router()` with no table is the slot where the screens of the section render. It matches the end
of the URL against the routes of the area. That is the same table that it would match without a
root. It inherits the `placeholder`, the `fallback` and the `notFound` of the parent router. You can
override each one for the section alone, as in `router({ notFound: () => adminNotFound() })`.

What a root gives you, against wrapping each screen by hand as `'/users': () => shell(usersList())`,
is the **lifetime**. The root stays mounted while the user moves between the screens of the section,
and it unmounts when they leave the section. So it is the place for whatever the whole section
shares, and nothing outside it must see. Examples are a state scoped to the section, an
[HTTP client](http.md) for its backend, and a layout that keeps its scroll position. imp does not
rebuild any of that on a navigation inside the section.

The root receives the same `{ params, query }` as a screen factory. So a prefix param is there for
the shell too, as in `root: ({ params }) => orgShell(params.orgId)`. A prefix param that changes
remounts the area, and the root with it.

A root that loads something before it renders needs one thing in the correct order. A `router()`
with no table finds its area through the component that mounts. `useState` and `useHttpClient` find
theirs in the same way. So in an **async** root, you must call it before the first `await`:

```js
const shell = component('admin-shell', {
  build: async () => {
    const api = useHttpClient('myapp.admin')
    const screens = router() //                    resolve the slot first...
    const settings = await api.get('/settings') // ...then await
    return div(adminNav(settings), screens)
  },
})
```

After the `await`, the call cannot see the area, and it fails with `'routes' is required`. That
message reads as if the table were missing, and not as a matter of order. The
`imp/router-setup-before-await` rule of **[Linting](lint.md)** catches this before you run the app.
A `router({ routes })` with its own table looks nothing up, and you can build it anywhere.

When you do not want to split the code, keep the routes of the section in your top-level table, like
any other screen. Use an area exactly when you want the code of that section to load on demand. A
single screen that people rarely visit is worth an area of its own. A table with one entry is an
ordinary area:

```js
'/admin-report': area(() => import('./report/area.js')),
// report/area.js: export default area({ routes: { '/': () => reportScreen() } })
```

A prefix can also capture a param, and the param flows into the screens of the section:

```js
'/org/:orgId': area(() => import('./org/area.js')),
// a screen in that table sees { params: { orgId, ...tail params } }
```

### Organize your files as you want

imp has **no opinion about where any of this lives.** It only ever sees the module that an
`import()` resolves to. There is no folder convention, no `areas/` directory that a tool scans for,
and no file whose name means something to the framework. The paths above are examples. Point each
`import()` at the real location of the module.

So an area is a routing concept, not a directory. Group your code by feature, by domain, or by
architectural layer, as your project prefers. A **Feature-Sliced Design** codebase works as it is.
An imp area maps naturally onto an FSD page, or view. The composition root connects the route table
of each page with `area(() => import(...))`. The widgets, features and entities that the page uses
stay in their own layers, and its screens import them as usual. A flat `screens/` folder works as
well. The route table is the contract, and the file layout is yours.

A navigation **inside** an area keeps the section mounted, and only changes its inner screen. That
is the same content-keyed behaviour that keeps a screen mounted across a change of the query only. A
prefix param that changes, such as `/org/1` to `/org/2`, remounts the section. An area nests to any
depth. The table of an area can itself hold an `area()` entry.

> **A note on memory.** When you leave an area, imp releases the DOM, the state, the subscriptions
> and the timers of its screens, as usual. It does **not** unload the JavaScript of the area that
> the browser already downloaded. After the browser loads a module, it keeps it for the life of the
> page, and the platform has no API to remove one. This is true of the code splitting of every
> framework, not only of imp. A lazy area saves you from loading the code of a section that nobody
> visits. It does not reclaim the code of a section that somebody already visited. An area is about
> **code organization and code splitting**, not about freeing loaded code. The same is true of the
> `translations` of an area. When you leave, imp unregisters them, so its keys stop resolving. The
> module that holds them stays loaded, like any other module. See **[Translations](i18n.md)**.

Why wrap the `import()` at all? Because a pattern that names an area matches as a **prefix**, which
is everything under it. Every other pattern matches exactly. `area()` is how you say "this prefix
loads a table, match the rest of the URL against it". That is the one thing that the router cannot
guess from a bare import.

## Route guards: how to keep a screen behind a condition

A guard decides whether the visitor can open a route. It is a plain function of the state that it
reads, and it runs before imp builds the screen:

```js
import { guard, wait } from 'imp/router'

const signedIn = guard(
  ['myapp.session'],
  (session) => session === undefined ? wait : Boolean(session) || '/login',
)
```

Read that from the inside out. `['myapp.session']` declares **which states this guard reads**. The
router looks them up for you, and passes their values in, in the same order. The function returns
one of four answers:

| Return              | Means                                                      |
| ------------------- | ---------------------------------------------------------- |
| `true` (or nothing) | allow - render the screen                                  |
| `wait`              | "I can't decide yet" - keep the loader up and ask me again |
| `'/login'`          | redirect there, replacing the current history entry        |
| `false`             | render the `notFound` page, as if the route did not exist  |

### `wait` is what makes a synchronous guard possible

Nearly every real condition depends on something that the app loads after it starts. The session
comes from your backend. So when imp matches the first URL, the answer is truly not known yet. An
async guard would mean a request per navigation, and error handling in every guard. Instead, imp
lets a guard say **`wait`**.

When a guard returns `wait`, the router subscribes to the states that the guard declared, and
pauses. Every time when one of them changes, the guard runs again. It is the same function with the
same inputs, only later and with more data. imp acts on the first answer that is not `wait`. So the
guard stays a simple synchronous function that you can call in a unit test with plain values, and
the waiting is the job of the router.

**A state that has not loaded yet is `undefined`.** `initState('myapp.session')` with no initial
value starts there. imp has no separate loading concept. So `undefined` means whatever your app
decides that it means, and the guard is the one place that decides. That is why you write a
signed-out session as `null`. `undefined` means "I do not know yet". `null` means "I know, and there
is nobody".

### The loader that you already have

While a guard waits, the router shows its `placeholder`. That is the same loader as the one that the
download of an area shows:

```js
router({
  routes: {
    '/': () => home(),
    '/todos': route({ guard: signedIn, screen: () => todoList() }),
  },
  placeholder: () => div(spinner(), 'Loading...'),
})
```

You write no loading branch and no spinner state. After the session has loaded, a guard that can
answer immediately renders its screen in the same tick. So no loader appears at all when you
navigate between screens later.

### One guard per route, written on the route

A guard attaches in exactly one place: the entry that it protects. `route({ guard, screen })` is the
third thing that a routes table accepts, beside a plain factory and an `area()`. Its `screen` is
whatever you would write there instead.

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

There is no default across the router, and there is no inheritance. A route has one guard or none,
and you see which by reading its line. Nothing above a route can add a condition that the route does
not name. So one function always answers the question "why was I redirected here?".

The cost is repetition when most of an app is protected. You write `route({ guard: signedIn, ... })`
on every entry. That is the trade. You get a repeated word that you can search for, in place of a
rule that another place applies to a route.

**You combine conditions yourself, and it is a function.** Write the shared part once as a plain
check, and build each guard from it:

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

Share the _check_, instead of stacking guards. The composition then stays in your code, where you
read it from the top down and test it with plain values.

A guard receives `{ params, query, path }` as its last argument, after the state values. So it can
check the route that it guards, and not only the session:

```js
const canEditOrg = guard(['myapp.session', 'myapp.orgs'], (session, orgs, { params }) => {
  if (session === undefined || orgs === undefined) return wait
  if (!session) return '/login'
  const org = orgs.find((candidate) => candidate.id === params.orgId)
  return org?.ownerId === session.id || '/forbidden'
})
```

### A guard keeps watching

A guard does not run once. imp watches the states that it declared for as long as the screen shows.
So a sign-out on a protected screen redirects immediately:

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

Set `null`. Do not clear the value back to `undefined`. `null` is an answer that a guard can act on.
`undefined` only makes the guard wait, and imp ignores a `wait` for a screen that is already on the
page. After you are in, only a redirect takes you out. Otherwise a background refresh of the session
would tear down the screen that you work in, and you would lose the scroll position, the focus and
anything that you typed.

### A guard and a lazily loaded section

A guard on the entry that points at an area covers the whole section. That is its `root` and every
screen under it. It decides **before the import runs**. So a person who is not an administrator
never downloads the admin code:

```js
'/admin': route({ guard: adminOnly, screen: area(() => import('./admin/area.js')) }),
```

The file of the area declares no guard of its own. A route inside it can carry one for a narrower
rule, when `/admin/billing` needs more than `/admin` does. The guard of the entry keeps watching
while the visitor is inside the section. So a lost session redirects out of the section immediately.

A guard is a UI concern. It decides what to render, not what a visitor can have. Your backend still
authorizes every request. A determined visitor can always fetch the JavaScript.

### When something goes wrong

A guard fails closed. No failure path lets a screen through:

- A guard that throws, or that returns something other than the four answers, renders the `fallback`
  of the router.
- A guard that declares a state that no component above the router provides fails the route, with
  the same error as `useState`.
- A guard that stays on `wait` for more than five seconds logs a warning. The warning names the
  route and the states that the guard waits for. Usually one of those states is a state that nothing
  sets.

## How to navigate

### From code

`navigate` is the one primitive. Everything else builds on it.

```js
navigate('/todos/42')
navigate('/login', { replace: true }) // replace the current history entry instead of adding one
```

`navigate` works anywhere: in an event handler, in a timer, and after an `await`:

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

Use `{ replace: true }` when you do not want the current page in the history of the back button. An
example is a redirect after a login. A navigation to the URL that you are already on does nothing.
It does not add a duplicate history entry.

### Navigation controls

There is no link component to learn. Put `navigate` in the click handler of a control. A nav bar is
a row of buttons:

```js
nav(
  button('Home', { events: { click: () => navigate('/') } }),
  button('Todos', { events: { click: () => navigate('/todos') } }),
)
```

## How to read the current route

`useRoute()` returns a read-only handle on the live route, which is `{ path, query }`. Any component
can watch it, including a component outside the router, such as a nav bar. It has the same shape as
any imp state, with `get`, `watch`, `text`, `view` and `each`. It has no `set`, because you change
the route by navigating, not by writing to it.

```js
useRoute().watch((current) => track('pageview', { path: current.path })) // react from non-UI code
const { path, query } = useRoute().get() // read once, imperatively
```

## Loading and errors

A screen is a component. So its loading and its error handling are the component lifecycle that you
already know:

```js
const todoDetail = component('app-todo-detail', {
  placeholder: () => div({ class: 'skeleton' }, 'Loading...'),
  build: async (_instance, id) => {
    const todo = initState('app.todo', await fetchTodo(id))
    return article(h1(todo.text((t) => t.title)))
  },
  fallback: (error) => div({ class: 'error' }, `Couldn't load this todo: ${error.message}`),
})

// routes: { '/todos/:id': ({ params }) => todoDetail(params.id) }
```

- **The data loading lives in the `build` of the screen.** Fetch, `await`, and build. The
  `placeholder` shows until the promise resolves. There is no separate loader, and no data-fetching
  API to learn.
- **A wait on a guard uses the same `placeholder`**, see _Route guards_. The visitor sees one
  loader, whether the wait is a download, a guard, or the data of the screen.
- **Errors.** A screen that defines a `fallback` handles its own failures first. A failure that it
  does not handle goes up to the **`fallback` of the router**, which is an error boundary for the
  whole matched subtree. Examples are an `import()` of an area that does not download, and a throw
  during the mount of the screen, or of any component that it renders.

With no `fallback` at either level, a failed screen renders nothing, and imp still logs the failure.
It does not stay on a placeholder forever.

## A screen cleans up after itself

A navigation away from a screen unmounts it, and an unmount releases everything that imp tracks. The
URL bounds the lifetime of a screen:

- **State** that you create with `initState` inside the screen, or inside any component under it, is
  released. Put the state of a screen in the root component of that screen. Only state that is truly
  app-wide, such as the session, the theme and the cart, belongs in the root component of your app,
  above the router, which never unmounts.
- **Subscriptions** end. That covers every `watch`, `text`, `view`, `each` and bound prop that you
  set up while the screen was mounted.
- **A timer, an interval, a socket and a global** that you used are undone in the `teardown` of the
  screen component. Each component is responsible for its own teardown.

```js
const dashboard = component('app-dashboard', {
  build: (instance) => {
    const metrics = initState('dashboard.metrics', []) // released when you leave the dashboard
    instance.socket = openMetricsSocket((m) => metrics.set(m))
    globalThis.gtag = setupAnalytics()
    return metricsGrid()
  },
  teardown: (instance) => {
    instance.socket.close() // closed on navigation away
    delete globalThis.gtag // undo the global you set - imp can't track it, so you do
  },
})
```

You write no special cleanup for a navigation. Each screen is a component. So its `teardown` is the
cleanup, and leaving the route runs it.

## Base path: how to serve under a sub-directory

When your app is served under a sub-path, such as `https://example.com/app/`, set the
**`IMP_BASEPATH`** environment value. Set it as you set any other imp environment value. See
**[Configuration](config.md)**:

```json
{
  "IMP_BASEPATH": "/app"
}
```

imp reads `IMP_BASEPATH` at startup, so there is no configuration call in your code. Continue to
write a route pattern and a `navigate` target from the app root, such as `/todos` and not
`/app/todos`. imp removes the base from the URL before it matches, and adds it back when `navigate`
builds the real URL.

The same value covers your static assets. `imp build` puts the base in front of the root-absolute
URLs in your page. That covers a stylesheet, an image, the PWA manifest and the service worker. So
one setting moves the whole app under the sub-path.

The one value that imp does not adjust automatically is an `href` that you set yourself. When you
render a real `<a>`, build its `href` with `url(path)`. That call adds the base, so a middle-click
and a "copy link address" stay correct. It does nothing when `IMP_BASEPATH` is not set, and it
leaves an absolute URL and an external URL as they are:

```js
a({ href: url('/todos') }, 'All todos')
```

## Accessibility: scroll and focus

- **imp manages the scroll for you.** A forward navigation scrolls to the top of the new screen. The
  back and forward buttons restore the scroll position where you left each page.
- **The focus is yours to manage.** A move of the focus on a navigation is disruptive when it is not
  wanted, and correct when it is. Only your screens know which case applies. A screen that must take
  the focus can focus its own heading in `instance.afterMount`. You can also keep one live region
  that is hidden visually, and update it from `useRoute().watch(...)`.
- **Usually it is better to do this once for every screen.** Give the element that your router slot
  renders into a `tabindex` of `-1`. Focus that element from `useRoute().watch(...)` whenever the
  path changes. Compare the path, not the whole route, so a change of the query string never takes
  the focus out of the input where the reader types. Skip the first call, because it fires with the
  route that the page loaded on, where there is nothing to move the focus away from. Style the
  `:focus` of that element with `outline: none`. The focus is programmatic, so the browser would
  otherwise draw a ring around the whole screen on arrival.

## Deployment: a deep link and a refresh

A client router owns a URL such as `/todos/42` in the browser. But a visit to that URL, or a refresh
of it, sends a request straight to your server. The server must answer with the entry HTML of your
app, so the client router can take over. Otherwise a refresh returns 404.

`imp build` stays out of this. It produces a plain, portable bundle of the real files of your app,
with nothing specific to a host, and you upload it anywhere. To serve the entry for an unknown path
is a single setting on whatever hosts the app, and every platform has it:

| Host                 | Setting                                                 |
| -------------------- | ------------------------------------------------------- |
| nginx                | `try_files $uri /index.html;`                           |
| Netlify / Cloudflare | a `_redirects` file with `/*  /index.html  200`         |
| Vercel               | a `rewrites` rule to `/index.html` in `vercel.json`     |
| S3 + CloudFront      | set the "error document" / 404 response to `index.html` |
| GitHub Pages         | add a `404.html` that is a copy of your `index.html`    |

In development you need none of this. `imp start` already serves your entry HTML for a navigation
request to a path with no extension. A missing asset, such as a wrong `.js` path, still returns 404.
So a deep link and a refresh work while you build.

## API summary

| Export                                   | Returns            | What it does                                                                                                                                  |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `router(options)`                        | a live router slot | Renders the matched screen; `options`: `routes` (required), `placeholder`, `fallback`, `notFound`.                                            |
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

A pattern whose target is an `area()` matches as a **prefix**, which is everything under it, and imp
matches the end of the URL against the table of that area. A URL that matches nothing renders the
`notFound` screen of the router, when you provided one.
