# routing - one plain-data route table, with lazily loaded areas

Everything comes from `imp/router`. `router()` is the slot the matched screen renders into; drop it
in your layout and everything around it stays put across navigations.

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

Router options: `placeholder` shows while an **area's** module downloads (called with
`{ params, query }`); `fallback` is a route-level error boundary called with
`(error, { params, query })`, catching what the screen's own `fallback` did not; `notFound` is the
single fallback for unmatched URLs.

## The route table

A pattern is a URL path; `:name` segments capture values. The target is a factory receiving one
argument, `{ params, query }` - `params` values are URL-decoded strings, `query` is the query string
parsed **at the moment the screen is entered**.

| Pattern      | Matches                         | Factory sees                      |
| ------------ | ------------------------------- | --------------------------------- |
| `/`          | the root path                   | `{ params: {}, query }`           |
| `/todos`     | exactly `/todos` (or `/todos/`) | `{ params: {}, query }`           |
| `/todos/:id` | `/todos/42`                     | `{ params: { id: '42' }, query }` |

**First match wins**, in the order the keys are written - put a static path before a param path that
would also match. Trailing slashes are ignored.

## Rules an agent gets wrong

- **A screen factory builds its screen immediately.** Never `await` in it and never `import()` in
  it - fetch data in the screen component's async `build` (its `placeholder` covers the wait), and
  put on-demand code behind an `area()`.
- **`area()` is the only lazy entry.** There is no lazy-screen form and no eager-area form. A
  pattern pointing at an area matches as a **prefix**; every other pattern matches exactly.
- **An area's own routes are written relative to the prefix** (`'/users'` inside `/admin` serves
  `/admin/users`).
- **A table-less `router()` is position-sensitive like `useState`** - it finds its area through the
  mounting component, so in an async `root` it must be called **before the first `await`**; keep the
  slot in a variable and use it after. Past the await it throws `'routes' is required`, which reads
  as if the table were missing. Lint rule `imp/router-setup-before-await`. A `router({ routes })`
  looks nothing up and can be built anywhere.
- **A query-only change keeps the current screen mounted** - read the live query from `useRoute()`,
  not from the factory's `query`, on a screen whose query can change while it stays up. Changing the
  pattern or a `:param` mounts a fresh screen and unmounts the old one.
- **There is no link component.** Call `navigate()` from a click handler, or use `link` from
  `imp/std`. Use `{ replace: true }` after a login redirect. Navigating to the current URL is a
  no-op.
- **Shared layout is a plain function** you call from each factory - there is no layout route.
- **imp has no folder convention.** An area is a routing concept, not a directory; point each
  `import()` wherever the module actually is.
- Leaving an area releases its screens' state and DOM, but the browser keeps the downloaded module
  for the life of the page - lazy areas save the **download**, not the heap.

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

`guard(states, check)` - `states` is a non-empty array of **state names** (not handles: a table is
module scope). The router resolves them with `useState` at its own position, passes their values
**positionally**, then `{ params, query, path }` last.

| Verdict              | Effect                                                   |
| -------------------- | -------------------------------------------------------- |
| `true` / `undefined` | render the screen                                        |
| `wait`               | keep `placeholder`; re-run when a declared state changes |
| `'/path'`            | `navigate(path, { replace: true })`                      |
| `false`              | render `notFound`                                        |
| anything else        | throws, route renders `fallback`                         |

## Rules an agent gets wrong about guards

- **A route has exactly one guard, declared on the route.** There is no `router({ guard })` and no
  `area({ guard })` - both throw, pointing at `route()`. No inheritance, no stacking, no array.
  Compose by sharing a plain check function between guards, as above.
- **There is no pending state in imp.** `initState('myapp.session')` with no initial value is just
  `undefined`; the guard is the only place that decides `undefined` means "not loaded". Return
  `wait` for it explicitly - a guard that reads `undefined` without checking will deny or throw, and
  it will never wait.
- **Sign out with `set(null)`, not by clearing to `undefined`.** `null` is an answer a guard acts on
  (redirect); `undefined` only makes it wait, and **`wait` is ignored once the screen is showing** -
  only a redirect leaves a mounted screen. `false` after mount is an error for the same reason.
- **Declare every state the check reads.** Undeclared states are neither passed in nor watched, so
  the guard goes stale. Do not call `useState` inside a check - it works on entry and throws on
  re-check.
- **Guard the entry, not the area file**: `route({ guard, screen: area(() => import(...)) })` covers
  the section's root and every screen in it, and decides before the chunk downloads. A route inside
  the area may carry its own, narrower guard. Neither is authorization - the server still checks.
- **A guard is sync and pure.** No `await`, no fetch, no `navigate` inside it - return a path
  instead. It re-runs on every change of a declared state, so keep it a cheap comparison.
- **Failure is closed**: a throwing guard, an unknown verdict, or a state no ancestor provides all
  render `fallback`. A guard stuck on `wait` warns after 5s naming the states; guards that redirect
  to each other throw after 10 hops.

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

An area's `translations` are covered in [i18n](i18n.md). Areas nest to any depth, and a prefix can
capture params (`'/org/:orgId': area(...)` - a changing prefix param remounts the section).
Navigating inside an area keeps it mounted and swaps its inner screen.

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

- **`router()` with no table only works inside an area's `root`** - it renders that area's own
  routes and inherits the parent router's `placeholder`, `fallback` and `notFound`, each overridable
  for the section. Anywhere else, `routes` is required.
- `root` is a **function** returning the component, and it receives the same `{ params, query }` a
  screen factory gets - `root: ({ params }) => orgShell(params.orgId)`.
- What it buys over wrapping each screen by hand is **lifetime**: the root stays mounted while the
  user moves between the section's screens and unmounts when they leave. So it is where a
  section-wide [http](http.md) client, a section-scoped [state](state.md), or a layout that must
  keep its scroll position belongs. A prefix param that changes remounts the area, root included.

## Lifetimes, base path, deployment

A screen is a component, so its loading is `placeholder` + async `build`, its errors are `fallback`
(bubbling to the router's), and its cleanup is `teardown`. Navigating away unmounts it: state,
subscriptions and DOM go with it - put screen state in the screen's root component and only app-wide
state above the router.

Scroll is managed for you (top on forward navigation, restored on back/forward). **Focus is yours**:
focus a heading in `instance.afterMount`, or announce via a live region from
`useRoute().watch(...)`. Do it once for all screens by giving the element the router slot renders
into `tabindex: -1` and focusing it from `useRoute().watch(...)` when the **path** changes - compare
paths (a query change must not steal focus from an input), skip the first call (it fires with the
loaded route), and style that element `:focus { outline: none }` or the browser rings the whole
screen on arrival.

Serving under a sub-path: set the `IMP_BASEPATH` environment value of [config](config.md) and keep
writing app-root paths (`/todos`). imp strips and re-adds it. Only an `href` you build yourself
needs `url('/todos')`.

Deep links need the host to serve your entry HTML for unknown paths (nginx `try_files`, a
`_redirects` file, a `404.html` copy, ...). `imp start` already does this in development.
