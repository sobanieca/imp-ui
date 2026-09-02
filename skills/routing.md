# routing - one plain-data route table, with lazily loaded areas

Everything comes from `imp/router`. `router()` is the slot where the matched screen renders. Put it
in your layout. Everything around it stays in place across a navigation.

```js
import { component, mount } from 'imp'
import { button, div, nav } from 'imp/html'
import { area, guard, navigate, route, router, useRoute, wait } from 'imp/router'

const shell = component('app-shell', {
  build: () =>
    div(
      nav(button('Home', { events: { click: () => navigate('/') } })),
      router({
        routes: {
          '/': () => home(),
          '/todos/new': () => newTodo(), //        exact paths before param paths
          '/todos/:id': ({ params }) => todoDetail(params.id),
          '/admin': area(() => import('./admin/area.js')),
        },
        placeholder: () => div('Loading...'),
        fallback: (error) => div(error.message),
        notFound: () => div('Not found'),
      }),
    ),
})

mount('#app', shell())
```

## API

| Export                                   | What it does                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `router(options)`                        | the slot; `routes` (required, except inside an area `root`), `placeholder`, `fallback`, `notFound` |
| `area(() => import('./x.js'))`           | marks a prefix entry as a lazily loaded area - the **only** on-demand unit                         |
| `area({ routes, root?, translations? })` | an area's own definition, for its `export default`                                                 |
| `route({ guard, screen })`               | a guarded routes-table entry - one guard; `screen` is the factory or `area()` it maps to           |
| `guard(states, check)`                   | a synchronous check over the states it names: `true` \| `wait` \| `false` \| `'/path'`             |
| `wait`                                   | the verdict for "cannot decide yet" - the router keeps `placeholder` up and re-runs the guard      |
| `navigate(path, { replace? })`           | navigate programmatically, from anywhere                                                           |
| `useRoute()`                             | read-only live `{ path, query }` state: `get`/`watch`/`text`/`view`/`each`, no `set`               |
| `url(path)`                              | prefixes `IMP_BASEPATH`, for an `href` you write yourself                                          |

These are the router options. `placeholder` shows while the module of an **area** downloads, and imp
calls it with `{ params, query }`. `fallback` is an error boundary at route level, and imp calls it
with `(error, { params, query })`. It catches what the `fallback` of the screen did not catch.
`notFound` is the one fallback for a URL that matches nothing.

## The route table

A pattern is a URL path. A `:name` segment captures a value. The target is a factory that receives
one argument, `{ params, query }`. A `params` value is a URL-decoded string. `query` is the query
string, parsed **at the moment when the user enters the screen**.

| Pattern      | Matches                         | Factory sees                      |
| ------------ | ------------------------------- | --------------------------------- |
| `/`          | the root path                   | `{ params: {}, query }`           |
| `/todos`     | exactly `/todos` (or `/todos/`) | `{ params: {}, query }`           |
| `/todos/:id` | `/todos/42`                     | `{ params: { id: '42' }, query }` |

**The first match wins**, in the order in which you write the keys. Put a static path before a param
path that would also match. imp ignores a trailing slash.

## Rules an agent gets wrong

- **A screen factory builds its screen immediately.** Never `await` in it, and never `import()` in
  it. Fetch the data in the async `build` of the screen component, where its `placeholder` covers
  the wait. Put on-demand code behind an `area()`.
- **`area()` is the only lazy entry.** There is no lazy screen form, and no eager area form. A
  pattern that points at an area matches as a **prefix**. Every other pattern matches exactly.
- **Write the routes of an area relative to the prefix.** So `'/users'` inside `/admin` serves
  `/admin/users`.
- **A `router()` with no table depends on its position, like `useState`.** It finds its area through
  the component that mounts. So in an async `root` you must call it **before the first `await`**.
  Keep the slot in a variable and use it later. After the await it throws `'routes' is required`,
  which reads as if the table were missing. The lint rule is `imp/router-setup-before-await`. A
  `router({ routes })` looks nothing up, so you can build it anywhere.
- **A change of the query only keeps the current screen mounted.** On a screen whose query can
  change while the screen stays up, read the live query from `useRoute()`, not from the `query` of
  the factory. A change of the pattern or of a `:param` mounts a new screen and unmounts the old
  one.
- **There is no link component.** Call `navigate()` from a click handler, or use `link` from
  `imp/std`. Use `{ replace: true }` after a login redirect. A navigation to the current URL does
  nothing.
- **A shared layout is a plain function** that you call from each factory. There is no layout route.
- **imp has no folder convention.** An area is a routing concept, not a directory. Point each
  `import()` at the real location of the module.
- When the user leaves an area, imp releases the state and the DOM of its screens. The browser keeps
  the downloaded module for the life of the page. So a lazy area saves the **download**, not the
  heap.

## Guards

```js
import { guard, route, router, wait } from 'imp/router'

const requireSession = (session) => session === undefined ? wait : Boolean(session) || '/login'

const requireAdmin = (session) => {
  const allowed = requireSession(session)
  return allowed === true ? session.role === 'admin' || '/forbidden' : allowed
}

const signedIn = guard(['myapp.session'], requireSession)
const adminOnly = guard(['myapp.session'], requireAdmin)

router({
  routes: {
    '/': () => home(), //                                        open
    '/login': () => login(), //                                  open
    '/todos': route({ guard: signedIn, screen: () => todos() }),
    '/admin': route({ guard: adminOnly, screen: area(() => import('./admin/area.js')) }),
  },
  placeholder: () => div('Loading...'), //                       shown while a guard waits
})
```

In `guard(states, check)`, `states` is a non-empty array of **state names**, not handles, because a
table is at module scope. The router resolves the names with `useState` at its own position. It
passes the values **by position**, and passes `{ params, query, path }` last.

| Verdict              | Effect                                                   |
| -------------------- | -------------------------------------------------------- |
| `true` / `undefined` | render the screen                                        |
| `wait`               | keep `placeholder`; re-run when a declared state changes |
| `'/path'`            | `navigate(path, { replace: true })`                      |
| `false`              | render `notFound`                                        |
| anything else        | throws, route renders `fallback`                         |

## Rules an agent gets wrong about guards

- **A route has exactly one guard, and you declare it on the route.** There is no
  `router({ guard })` and no `area({ guard })`. Both throw and point at `route()`. There is no
  inheritance, no stacking and no array. To compose, share a plain check function between two
  guards, as above.
- **imp has no pending state.** `initState('myapp.session')` with no initial value is `undefined`.
  The guard is the only place that decides that `undefined` means "not loaded". Return `wait` for it
  explicitly. A guard that reads `undefined` without a check denies the route or throws, and it
  never waits.
- **Sign out with `set(null)`. Do not clear the value to `undefined`.** `null` is an answer that a
  guard acts on, and it redirects. `undefined` only makes the guard wait, and **imp ignores `wait`
  after the screen is showing**. Only a redirect removes a mounted screen. `false` after mount is an
  error for the same reason.
- **Declare every state that the check reads.** imp does not pass in or watch an undeclared state,
  so the guard becomes stale. Do not call `useState` inside a check. It works on entry and throws on
  a re-check.
- **Guard the entry, not the area file.** `route({ guard, screen: area(() => import(...)) })` covers
  the root of the section and every screen in it, and it decides before the chunk downloads. A route
  inside the area can carry its own, narrower guard. Neither guard is authorization. The server must
  still check.
- **A guard is synchronous and pure.** Do not `await` in it, do not fetch in it, and do not call
  `navigate` in it. Return a path instead. It runs again on every change of a declared state, so
  keep it a cheap comparison.
- **A failure closes the route.** A guard that throws, an unknown verdict, and a state that no
  ancestor provides all render `fallback`. A guard that stays on `wait` gives a warning after 5s
  that names the states. Two guards that redirect to each other throw after 10 hops.

## An area file

```js
import { area } from 'imp/router'

export default area({
  routes: {
    '/': () => adminHome(), //                       /admin
    '/users/:id': ({ params }) => userDetail(params.id), // /admin/users/:id
  },
  translations: { en: () => import('./locales/en.js') }, // imp skill i18n
})
```

[i18n](i18n.md) covers the `translations` of an area. An area nests to any depth, and a prefix can
capture a param, as in `'/org/:orgId': area(...)`. A prefix param that changes remounts the section.
A navigation inside an area keeps the area mounted and swaps its inner screen.

## `root` - one component around a whole section

```js
const shell = component('admin-shell', {
  build: () => {
    initHttpClient('myapp.admin', { baseUrl: '/admin/api' }) // section-scoped, see imp skill http
    return div(adminNav(), router()) // <- the section's screens render here
  },
})

export default area({ root: () => shell(), routes: { '/': () => adminHome() } })
```

- **A `router()` with no table works only inside the `root` of an area.** It renders the routes of
  that area. It inherits the `placeholder`, the `fallback` and the `notFound` of the parent router,
  and you can override each one for the section. Everywhere else, `routes` is necessary.
- `root` is a **function** that returns the component. It receives the same `{ params, query }` as a
  screen factory, as in `root: ({ params }) => orgShell(params.orgId)`.
- The gain over wrapping each screen by hand is the **lifetime**. The root stays mounted while the
  user moves between the screens of the section, and it unmounts when the user leaves. So the root
  is the place for a section-wide [http](http.md) client, a section-scoped [state](state.md), or a
  layout that must keep its scroll position. A prefix param that changes remounts the area, and the
  root with it.

## Lifetimes, base path, deployment

A screen is a component. So its loading is a `placeholder` and an async `build`, its errors go to
its `fallback` and then to the `fallback` of the router, and its cleanup is `teardown`. A navigation
away unmounts the screen, with its state, its subscriptions and its DOM. Put the state of a screen
in the root component of that screen. Put only app-wide state above the router.

imp manages the scroll for you. It goes to the top on a forward navigation, and it restores the
position on a back or forward navigation. **The focus is yours to manage.** Focus a heading in
`instance.afterMount`, or announce the change through a live region from `useRoute().watch(...)`. To
do this once for every screen, give the element that the router slot renders into `tabindex: -1`.
Focus that element from `useRoute().watch(...)` when the **path** changes. Compare the paths,
because a query change must not take the focus from an input. Skip the first call, because it fires
with the loaded route. Style that element with `:focus { outline: none }`, or the browser draws a
ring around the whole screen on arrival.

To serve the app under a sub-path, set the `IMP_BASEPATH` environment value of [config](config.md).
Continue to write a path from the app root, such as `/todos`. imp removes and adds the prefix. Only
an `href` that you build yourself needs `url('/todos')`.

A deep link needs the host to serve your entry HTML for an unknown path. Use `try_files` in nginx, a
`_redirects` file, a copy named `404.html`, or the equivalent on your host. `imp start` already does
this in development.
