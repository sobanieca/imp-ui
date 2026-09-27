# routing - one application map drives the router, the shell and the trail

`appMap()` comes from `imp`, because the shell reads the map too. The rest comes from `imp/router`.
The app describes itself once, in `src/app-map.js`, with `appMap()`. The map says what a feature is.
Everything else is a binding keyed by a handle: `screens` and `options` at the router, `icons` and
`tags` at the shell. `router()` is the slot where the matched screen renders. Put it in your layout.
The `shell` frame reads the same map for its nav, see [std](std.md).

```js
// src/app-map.js - the feature list of the app; imports appMap and nothing else
import { appMap } from 'imp'
import { admin } from './admin/map.js'

export const app = appMap({
  home: { path: '/', description: 'Counts and recent activity' },
  projects: {
    description: 'Everything a team works on',
    access: 'user',
    $projectId: {
      builds: { $buildId: 'One build, with its log' },
      settings: { access: 'admin', group: 'Manage' },
    },
  },
  admin,
  login: { nav: false },
})
```

```js
// src/admin/map.js - a part of the map; the first argument is the props of the node it hangs from
import { appMap } from 'imp'

export const admin = appMap({ access: 'admin' }, {
  users: 'Everyone with a login',
  createApiKey: 'Mint a key for a service',
})
```

```js
// src/main.js - the bindings
import { mount } from 'imp'
import { area, guard, redirect, router, wait } from 'imp/router'
import { shell } from 'imp/std/shell'
import { luFolder, luShield } from 'imp/icons'
import { app } from './app-map.js'

const access = guard(['acme.session'], (session, { need }) => {
  if (session === undefined) return wait
  if (!session) return '/login'
  return session.roles.includes(need) || '/forbidden'
})

mount(
  '#app',
  shell(
    { navbar: { map: app, icons: { [app.projects]: luFolder, [app.admin]: luShield } } },
    router({
      map: app,
      access,
      screens: {
        [app.home]: redirect(app.projects),
        [app.login]: () => login(),
        [app.projects]: () => projectList(),
        [app.projects.$projectId]: ({ params }) => project(params.projectId),
        [app.admin]: area(() => import('./admin/area.js')),
      },
      options: { [app.projects.$projectId]: 'acme.projects' },
      title: ({ crumbs }) => `${crumbs.at(-1)} - Acme`,
      loading: () => div('Loading...'),
      notFound: () => div('Not found'),
    }),
  ),
)
```

## API

| Export                                    | What it does                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `appMap(nodes)`, `appMap(props, nodes)`   | the map, from `imp`; returns the handle tree; with `props`, a part that another map holds                                                  |
| `router(options)`                         | the slot; `map` (required, except inside an area `root`), `screens`, `options`, `access`, `scope`, `title`, `loading`, `error`, `notFound` |
| `redirect(handle \| '/path')`             | a `screens` binding: the node forwards there, with the params of the route filled in                                                       |
| `area(() => import('./x.js'))`            | binds a node to a lazily loaded area - the **only** on-demand unit                                                                         |
| `area({ screens, root?, translations? })` | an area's own definition, for its `export default`                                                                                         |
| `guard(states, check)`                    | the one `access` guard: `(...values, { need, params, query, path }) => true \| wait \| false \| '/path'`                                   |
| `wait`                                    | the verdict for "cannot decide yet" - the router keeps `loading` up and re-runs the guard                                                  |
| `navigate(path, { replace? })`            | navigate programmatically, from anywhere; give it `handle.href(params)`                                                                    |
| `beforeLeave(self, check)`                | in `setup`: `check()` returns `false`, or a Promise of `false`, to stay; asked before the route changes                                    |
| `useRoute()`                              | read-only live `{ path, query }` state: `get`/`watch`/`text`/`view`/`each`, no `set`                                                       |
| `url(path)`                               | prefixes `IMP_BASEPATH`, for an `href` you write as a string                                                                               |

`loading` shows while the module of an **area** downloads or a guard waits. `error` is an error
boundary at route level, called with `(self, error, { params, query, node })`. `notFound` is the one
page for a URL that is off the map. A screen factory receives `{ params, query, node }`.

| Router option | Shape                                                   | Meaning                                                                      |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `options`     | `{ [paramHandle]: 'state.name' \| [{ value, label }] }` | the choices of a param: its crumb gets a picker, and the label of the choice |
| `scope`       | a param handle                                          | the tenant node the app lives under; its static children are the sections    |
| `title`       | `({ crumbs, node, params }) => string`                  | written to `document.title` on every navigation; without it, untouched       |

## The map

| Rule                      | Detail                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| a key is a child          | when its value is a string, an object or a map; `createApiKey` serves `/create-api-key`          |
| a string is a description | `users: 'Everyone with a login'`; write `{}` for a node with nothing to say                      |
| a key is a prop           | when it is one of the props below; any other key with another value throws                       |
| a map is a part           | `admin: adminMap` grafts it; `adminMap.users` and `app.admin.users` are one handle               |
| `$name` is a param        | segment `:name`, value in `params.name`, handle `app.x.$name`                                    |
| the name is the label     | `createApiKey` shows "Create api key"; `label` overrides                                         |
| `path: '/'` is the index  | on one top-level node only; its children hang from the root, so `app.home.reports` is `/reports` |
| key order is nav order    | the router matches static siblings before the param sibling on its own                           |

| Prop          | Values                                      | Meaning                                                         |
| ------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `description` | string                                      | shown by the stub, printed by `imp map`                         |
| `access`      | any value                                   | passed to the `access` guard as `need`; no `access` = open      |
| `path`        | one segment, or `'/'`                       | overrides the segment                                           |
| `label`       | string, or `({ params, option }) => string` | overrides the label; a translation is a message, not a function |
| `nav`         | `false`                                     | hides a static node from the nav; the route stays               |
| `group`       | string                                      | sidebar group title for consecutive rows                        |

That is the whole set. There is no `title`, `redirect`, `options`, `tag`, `href` or `icon` in the
map. A translation is not in the map either. The messages of the app translate a node by its id:
`appMap.admin.users.label`, `appMap.admin.users.group` and `appMap.admin.users.description`, see
[i18n](i18n.md). A message wins over the prop and over the name. The nav, the trail, the title and
the stub follow the language.

```js
// locales/pl.js
export default { appMap: { admin: { label: 'Administracja', users: { label: 'Uzytkownicy' } } } }
```

A redirect is `redirect()` in `screens`. Choices are `router({ options })`. A pill is `navbar.tags`
and an icon is `navbar.icons` of the shell. An external link is a `sidebar.footer` row.

## Handles

| Access                                              | Gives                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `${app.admin.users}`                                | `/admin/users` - so `[app.admin.users]` keys `screens` and `icons`                            |
| `app.projects.$projectId.href({ projectId: '42' })` | `/projects/42`, through `url()`; a missing param comes from the current route, else it throws |
| `app.admin.spec`                                    | frozen `{ name, pattern, label, description, access, children, ... }`                         |
| `({ node }) =>` in a factory                        | the handle of the matched node                                                                |

## Rules an agent gets wrong

- **Keep `app-map.js` plain.** No component, no icon, no state name, no guard function, no `t()` in
  it. It imports `appMap` and its parts. `imp map` prints it, from the `map` key of `imp.json`.
- **Translate a node with a message, not with a `label` function.** The key is `appMap.` plus the id
  of the node plus `.label`, `.group` or `.description`. Put these keys in the translations of the
  app, not of an area. A section row shows before the chunk of its area loads.
- **A mistyped prop with a string value is a node.** `lable: 'Admin'` is a child at `/lable`,
  because a string is a description. `imp map` and the stub log show it. `lable: 3` throws. A
  mistyped handle is `undefined`, its key is `"undefined"`, and `router()` throws and says so.
- **A part takes its props first.** `appMap({ access: 'admin' }, { users: {} })` is a part. Pass the
  whole map, never a part, to `router()` and `shell()`. A part goes into one map only.
- **Bind, never mutate.** `screens`, `options`, `icons` and `tags` are objects keyed by handles.
  Nothing writes into the map.
- **Every node renders from the first run.** Unbound leaf: a stub with the label and `description`.
  Unbound parent with static children: forwards to the first child. `redirect(handle)` in `screens`:
  forwards there. The router logs the stub nodes when it mounts. Write the map first, then bind
  screens.
- **A screen factory builds its screen immediately.** Never `await` in it, and never `import()` in
  it. Fetch in the async `setup` of the screen component. Put on-demand code behind `area()`.
- **`area()` is the only lazy binding.** The nodes of the section stay in the map, so its nav shows
  before its chunk loads. The area file binds only the node it hangs from and the nodes under it.
- **A `router()` with no map renders the screens of the area around it.** It works only inside the
  `root` of an area. Elsewhere pass `router({ map, screens })`.
- **A change of the query only keeps the current screen mounted.** Read a live query from
  `useRoute()`, not from the `query` of the factory.
- **Navigate with a handle.** `navigate(app.projects.$projectId.href({ projectId }))`, and
  `link({ href: app.x.href() }, ...)` from `imp/std`. Do not write a path string. Use
  `{ replace: true }` after a login redirect. Inside a param, `app.x.$id.y.href()` fills `id` from
  the route.
- **`options` names a state, or lists the choices.** The router resolves the name with `useState` at
  its own position, so an ancestor must `initState` it. The state holds `[{ value, label }]` or
  strings. A screen fills it. The choices reach the trail as a picker, never the sidebar as rows.
- **A tenant is `scope`, not a map prop.** Put `$org` in the map where the URL has it, and pass
  `router({ scope: app.organizations.$org })`. Inside, the sections are the children of `$org` and
  the trail starts at its crumb. Outside, on `/login`, the sections are the top-level nodes.
- **A one-section app puts every page under the index node.**
  `app: { path: '/', dashboard: {}, reports: {} }` serves `/dashboard` and `/reports`. The nav then
  has one section with rows, and the shell drops the bar and draws the column alone, see
  [std](std.md).
- **Guard unsaved work with `beforeLeave(self, check)`, in the `setup` of the component that holds
  it.** `beforeLeave(self, () => !dirty.get() || confirm(t('edit.discard')))`. Return `false` to
  stay. A Promise works, so the check can await your own dialog. imp asks on `navigate`, on a `link`
  click, and on the back and forward buttons. It does not ask on a guard redirect or a fragment-only
  change. The check ends when the component unmounts. Never remove it by hand.
- **`beforeLeave` does not cover a reload, a closed tab or another site.** Add
  `globalThis.addEventListener('beforeunload', (event) => dirty.get() && event.preventDefault(), { signal: self.abortSignal })`.
  The browser shows its own prompt there.
- **The title is a router function.** `title: ({ crumbs, node, params }) => ...`. Without it, imp
  never writes `document.title`.

## Access

`access` on a node is data. The one `access` guard of the router gives it meaning. The same guard
decides the nav: a row shows only on an allow verdict, and `wait` hides it until the state arrives.

| Verdict              | Effect                                               |
| -------------------- | ---------------------------------------------------- |
| `true` / `undefined` | render the screen, show the row                      |
| `wait`               | keep `loading`; re-run when a declared state changes |
| `'/path'`            | `navigate(path, { replace: true })`; hide the row    |
| `false`              | render `notFound`; hide the row                      |
| anything else        | throws, route renders `error`; row hidden and logged |

- **Every `access` on the chain runs, root first.** `settings` under `projects` needs both. A node
  with no `access` is open, so `/login` never loops. A map with `access` and no `router({ access })`
  throws at startup.
- **imp has no pending state.** `initState(self, 'myapp.session')` with no initial value is
  `undefined`. Return `wait` for it explicitly. A guard that reads `undefined` without a check
  denies the route or throws, and it never waits.
- **Sign out with `set(null)`. Do not clear the value to `undefined`.** imp ignores `wait` after the
  screen is showing. Only a redirect removes a mounted screen. `false` after mount is an error.
- **Declare every state that the check reads.** A check has no `self`, so it cannot resolve a state
  itself. A declared state that nothing provides fails the router.
- **`access` on an area node decides before the chunk downloads**, and it keeps watching inside.
  Neither guard is authorization. The server must still check.
- **A guard is synchronous and pure.** Do not `await`, fetch or call `navigate` in it. Return a path
  instead. It runs on every change of a declared state and once per node in the nav, so keep it
  cheap.

## An area file

```js
import { area } from 'imp/router'
import { app } from '../app-map.js'

const frame = component('admin-frame', {
  setup: (self) => {
    initHttpClient(self, 'myapp.admin', { baseUrl: '/admin/api' }) // section-scoped, see imp skill http
    return div(adminNav(), router()) // <- the section's screens render here
  },
})

export default area({
  root: () => frame(),
  screens: {
    [app.admin]: () => adminHome(), //                       /admin
    [app.admin.users]: () => users(), //                     /admin/users
  },
  translations: { en: () => import('./locales/en.js') }, // imp skill i18n
})
```

- `root` is optional. It stays mounted while the user moves between the screens of the section, and
  unmounts when the user leaves. It receives `{ params, query, node }`. A prefix param that changes
  remounts the area.
- A `router()` inside the root inherits `loading`, `error` and `notFound`, and can override each.
- [i18n](i18n.md) covers `translations`. A navigation inside an area keeps it mounted. The browser
  keeps a downloaded module for the life of the page, so an area saves the **download**, not the
  heap.

## Lifetimes, base path, tooling, deployment

A screen is a component. Its loading is `loading` and an async `setup`, its errors go to its `error`
and then to the `error` of the router, and its cleanup is `onRemove`. Put the state of a screen in
the root component of that screen. Put only app-wide state above the router.

imp manages the scroll. **The focus is yours to manage.** Focus a heading in `onMount`, or wrap the
router slot once, for every screen: a `div` with `tabindex: '-1'`, `role: 'region'` and
`:focus { outline: none }`. From `useRoute().watch(self, ...)`, one microtask later, set its
`aria-label` to `document.title`, then focus it when the **path** changed. Never focus on a query
change or on the first call. Pass `title` to `router` so that there is a title to read.

- A focused element with no name is read with all of its text. Always set the `aria-label`.
- Focus in the microtask, not in the watch. An open dialog on the old screen makes the page inert
  until the router removes that screen.

```js
const screenFrame = component('screen-frame', {
  styles: '.frame:focus { outline: none }',
  setup: (self, slot) => {
    const frame = div({ class: 'frame', tabindex: '-1', role: 'region' }, slot)
    let lastPath = useRoute().get().path
    useRoute().watch(self, ({ path }) => {
      const moved = path !== lastPath
      lastPath = path
      queueMicrotask(() => {
        frame.setAttribute('aria-label', document.title)
        if (moved) frame.focus({ preventScroll: true })
      })
    })
    return frame
  },
})

screenFrame(router({ map: app, screens, title: ({ crumbs }) => `${crumbs.at(-1)} - Acme` }))
```

`imp map` prints every node with its path, label, access and description, from the `map` file of
`imp.json`; `imp map src/admin/map.js` prints a part, see [cli](cli.md). `imp init` writes
`src/app-map.js`, names it in `imp.json`, and writes a frame that binds one screen, see
[init](init.md). A smoke test walks `handle.spec.children`.

To serve the app under a sub-path, set the `IMP_BASEPATH` environment value of [config](config.md).
`navigate` and `handle.href()` add the prefix. Only an `href` that you write as a string needs
`url('/todos')`.

For an app inside a page that it does not own, set the `IMP_ROUTING` environment value to `hash`.
The route then lives in the fragment, `#/todos/42?tab=notes`, and the path stays. Code changes
nothing. The base path does not apply under hash routing.

A deep link needs the host to serve your entry HTML for an unknown path. Use `try_files` in nginx, a
`_redirects` file, a copy named `404.html`, or the equivalent on your host. `imp start` already does
this in development.
