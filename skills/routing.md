# routing — one plain-data route table, with lazily loaded areas

Everything comes from `imp/router`. `router()` is the slot the matched screen renders into; drop it
in your layout and everything around it stays put across navigations.

```js
import { component, mount } from 'imp'
import { button, div, nav } from 'imp/html'
import { area, navigate, router, useRoute } from 'imp/router'

const shell = component('app-shell', {
  onMount: () =>
    div(
      nav(button('Home', { events: { click: () => navigate('/') } })),
      router({
        routes: {
          '/': () => home(),
          '/todos/new': () => newTodo(), //        exact paths before param paths
          '/todos/:id': ({ params }) => todoDetail(params.id),
          '/admin': area(() => import('./admin/area.js')),
        },
        placeholder: () => div('Loading…'),
        onError: (error) => div(error.message),
        onNotFound: () => div('Not found'),
      }),
    ),
})

mount('#app', shell())
```

## API

| Export                                   | What it does                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `router(options)`                        | the slot; `routes` (required, except inside an area `root`), `placeholder`, `onError`, `onNotFound` |
| `area(() => import('./x.js'))`           | marks a prefix entry as a lazily loaded area — the **only** on-demand unit                          |
| `area({ routes, root?, translations? })` | an area's own definition, for its `export default`                                                  |
| `navigate(path, { replace? })`           | navigate programmatically, from anywhere                                                            |
| `useRoute()`                             | read-only live `{ path, query }` state: `get`/`watch`/`text`/`view`/`each`, no `set`                |
| `url(path)`                              | prefixes `IMP_BASEPATH`, for an `href` you write yourself                                           |

Router options: `placeholder` shows while an **area's** module downloads (called with
`{ params, query }`); `onError` is a route-level error boundary called with
`(error, { params, query })`, catching what the screen's own `onError` did not; `onNotFound` is the
single fallback for unmatched URLs.

## The route table

A pattern is a URL path; `:name` segments capture values. The target is a factory receiving one
argument, `{ params, query }` — `params` values are URL-decoded strings, `query` is the query string
parsed **at the moment the screen is entered**.

| Pattern      | Matches                         | Factory sees                      |
| ------------ | ------------------------------- | --------------------------------- |
| `/`          | the root path                   | `{ params: {}, query }`           |
| `/todos`     | exactly `/todos` (or `/todos/`) | `{ params: {}, query }`           |
| `/todos/:id` | `/todos/42`                     | `{ params: { id: '42' }, query }` |

**First match wins**, in the order the keys are written — put a static path before a param path that
would also match. Trailing slashes are ignored.

## Rules an agent gets wrong

- **A screen factory builds its screen immediately.** Never `await` in it and never `import()` in it
  — fetch data in the screen component's async `onMount` (its `placeholder` covers the wait), and
  put on-demand code behind an `area()`.
- **`area()` is the only lazy entry.** There is no lazy-screen form and no eager-area form. A
  pattern pointing at an area matches as a **prefix**; every other pattern matches exactly.
- **An area's own routes are written relative to the prefix** (`'/users'` inside `/admin` serves
  `/admin/users`).
- **A query-only change keeps the current screen mounted** — read the live query from `useRoute()`,
  not from the factory's `query`, on a screen whose query can change while it stays up. Changing the
  pattern or a `:param` mounts a fresh screen and unmounts the old one.
- **There is no link component.** Call `navigate()` from a click handler, or use `link` from
  `imp/std`. Use `{ replace: true }` after a login redirect. Navigating to the current URL is a
  no-op.
- **Shared layout is a plain function** you call from each factory — there is no layout route.
- **imp has no folder convention.** An area is a routing concept, not a directory; point each
  `import()` wherever the module actually is.
- Leaving an area releases its screens' state and DOM, but the browser keeps the downloaded module
  for the life of the page — lazy areas save the **download**, not the heap.

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
capture params (`'/org/:orgId': area(…)` — a changing prefix param remounts the section). Navigating
inside an area keeps it mounted and swaps its inner screen.

## `root` — one component around a whole section

```js
const shell = component('admin-shell', {
  onMount: () => {
    initHttpClient('myapp.admin', { baseUrl: '/admin/api' }) // section-scoped, see imp skill http
    return div(adminNav(), router()) // ← the section's screens render here
  },
})

export default area({ root: () => shell(), routes: { '/': () => adminHome() } })
```

- **`router()` with no table only works inside an area's `root`** — it renders that area's own
  routes and inherits the parent router's `placeholder`, `onError` and `onNotFound`, each
  overridable for the section. Anywhere else, `routes` is required.
- `root` is a **function** returning the component, and it receives the same `{ params, query }` a
  screen factory gets — `root: ({ params }) => orgShell(params.orgId)`.
- What it buys over wrapping each screen by hand is **lifetime**: the root stays mounted while the
  user moves between the section's screens and unmounts when they leave. So it is where a
  section-wide [http](http.md) client, a section-scoped [state](state.md), or a layout that must
  keep its scroll position belongs. A prefix param that changes remounts the area, root included.

## Lifetimes, base path, deployment

A screen is a component, so its loading is `placeholder` + async `onMount`, its errors are `onError`
(bubbling to the router's), and its cleanup is `onUnmount`. Navigating away unmounts it: state,
subscriptions and DOM go with it — put screen state in the screen's root component and only app-wide
state above the router.

Scroll is managed for you (top on forward navigation, restored on back/forward). **Focus is yours**:
focus a heading in `instance.afterMount`, or announce via a live region from `useRoute().watch(…)`.

Serving under a sub-path: set the `IMP_BASEPATH` environment value of [config](config.md) and keep
writing app-root paths (`/todos`). imp strips and re-adds it. Only an `href` you build yourself
needs `url('/todos')`.

Deep links need the host to serve your entry HTML for unknown paths (nginx `try_files`, a
`_redirects` file, a `404.html` copy, …). `imp start` already does this in development.
