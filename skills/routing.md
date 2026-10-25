# routing - one application map drives the router, the shell and the trail

`appMap()` comes from `imp`, because the shell reads the map too. The rest comes from `imp/router`.
The app describes itself once, in `src/app-map.js`, with `appMap()`. The map says what a feature is.
Everything else is a binding keyed by a handle: `screens` and `need` at the router, `hide`,
`groups`, `icons` and `tags` at the shell. `router()` is the slot where the matched screen renders. Put it in your layout.
The `shell` frame reads the same map for its nav, see [std](std.md).

```js
// src/app-map.js - the feature list of the app; imports appMap and nothing else
import { appMap } from 'imp'
import { admin } from './admin/map.js'

export const app = appMap({
  home: 'Counts and recent activity',
  projects: {
    description: 'Everything a team works on',
    $projectId: {
      builds: { $buildId: 'One build, with its log' },
      settings: {},
    },
  },
  admin,
  login: {},
})
```

```js
// src/admin/map.js - a part of the map; the first argument is the props of the node it hangs from
import { appMap } from 'imp'

export const admin = appMap(
  { description: 'The back office' },
  {
    users: 'Everyone with a login',
    createApiKey: 'Mint a key for a service',
  },
)
```

```js
// src/main.js - the bindings
import { mount } from 'imp'
import { area, guard, redirect, router, wait } from 'imp/router'
import { shell } from 'imp/std/shell'
import { luFolder, luShield } from 'imp/icons'
import { app } from './app-map.js'

const access = guard(['acme.session'], (session, { need, path }) => {
  if (session === undefined) return wait
  if (!session) return `/login?next=${encodeURIComponent(path)}`
  return session.roles.includes(need) || '/forbidden'
})

mount(
  '#app',
  shell(
    {
      navbar: {
        map: app,
        hide: [app.login],
        groups: { Manage: [app.projects.$projectId.settings] },
        icons: { [app.projects]: luFolder, [app.admin]: luShield },
      },
      signIn: app.login,
    },
    router({
      map: app,
      access,
      need: {
        [app.projects]: 'user',
        [app.projects.$projectId.settings]: 'admin',
        [app.admin]: 'admin',
      },
      screens: {
        [app.home]: redirect(app.projects),
        [app.login]: () => login(),
        [app.projects]: () => projectList(),
        [app.projects.$projectId]: ({ params }) => project(params.projectId),
        [app.admin]: area(() => import('./admin/area.js')),
      },
      title: ({ crumbs }) => `${crumbs.at(-1)} - Acme`,
      loading: () => div('Loading...'),
      notFound: () => div('Not found'),
    }),
  ),
)
```

## API

| Export                                    | What it does                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `appMap(nodes)`, `appMap(props, nodes)`   | the map, from `imp`; returns the handle tree; with `props`, a part that another map holds                                               |
| `router(options)`                         | the slot; `map` (required, except inside an area `root`), `screens`, `access`, `need`, `scope`, `title`, `loading`, `error`, `notFound` |
| `redirect(handle \| '/path')`             | a `screens` binding: the node forwards there, with the params of the route filled in                                                    |
| `area(() => import('./x.js'))`            | binds a node to a lazily loaded area - the **only** on-demand unit                                                                      |
| `area({ screens, root?, translations? })` | an area's own definition, for its `export default`                                                                                      |
| `guard(states, check)`                    | the one `access` guard: `(...values, { need, params, query, searchParams, path }) => true \| wait \| false \| '/path'`                  |
| `wait`                                    | the verdict for "cannot decide yet" - the router keeps `loading` up and re-runs the guard                                               |
| `navigate(path, { replace?, external? })` | navigate programmatically, from anywhere; give it `handle.href(params)`; `external: true` to leave for another site                     |
| `safeNext(value, fallback)`               | `value` when it is a path of the app, else `fallback`; wrap every `?next=` value in it                                                  |
| `beforeLeave(self, check)`                | in `setup`: `check()` returns `false`, or a Promise of `false`, to stay; asked before the route changes                                 |
| `useRoute()`                              | read-only live `{ path, query, searchParams }` state: `get`/`watch`/`text`/`view`/`each`, no `set`                                      |
| `url(path)`                               | prefixes `IMP_BASEPATH`, for an `href` you write as a string                                                                            |

`loading` shows while the module of an **area** downloads or a guard waits. `error` is an error
boundary at route level, called with `(self, error, { params, query, searchParams, node })`.
`notFound` is the one page for a URL that is off the map, or with a broken percent encoding. A
screen factory receives `{ params, query, searchParams, node }`.

| Router option | Shape                                  | Meaning                                                                    |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `need`        | `{ [handle]: any value }`              | passed to the `access` guard as `need`; a node with no `need` is open      |
| `scope`       | a param handle                         | the tenant node the app lives under; its static children are the sections  |
| `title`       | `({ crumbs, node, params }) => string` | written to `document.title` once the screen settles; without it, untouched |

## The map

| Rule                      | Detail                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| a key is a child          | when its value is a string, an object or a map; `createApiKey` serves `/create-api-key`          |
| a string is a description | `users: 'Everyone with a login'`; write `{}` for a node with nothing to say                      |
| `description` is the prop | the one prop of a node: `{ description: '...', child: {} }`; any other key is a child            |
| a map is a part           | `admin: adminMap` grafts it; `adminMap.users` and `app.admin.users` are one handle               |
| `$name` is a param        | segment `:name`, value in `params.name`, handle `app.x.$name`                                    |
| a param name is unique    | one chain holds each `$name` once; `/orgs/:id/teams/:id` throws, two branches can share a name   |
| the name is the label     | `createApiKey` shows "Create api key"; a message `appMap.<id>.label` translates it               |
| a top-level `home` is `/` | its children hang from the root, so `app.home.reports` is `/reports`; a deeper `home` is `/home` |
| key order is nav order    | the router matches static siblings before the param sibling on its own                           |
| a value of another type   | throws, also `true`; write a string or `{}`                                                      |

There is no `label`, `access`, `nav`, `group`, `path`, `title`, `redirect`, `tag`, `href` or `icon`
in the map. A key with one of those names is a child: `settings: { access: {} }` is `/settings/access`.
`nav: false` or another value that is not a node throws, and the message names the binding to use:

| Binding                    | Where                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| who can open a node        | `router({ access, need: { [app.admin]: 'admin' } })`               |
| a node off the nav         | `shell({ navbar: { map, hide: [app.login] } })`                    |
| a sidebar group of rows    | `shell({ navbar: { map, groups: { Manage: [app.x.settings] } } })` |
| the label of a static node | the message `appMap.<id>.label`, then the name in sentence case    |
| the label of a param crumb | the state `imp.routeLabels`, then the raw value                    |
| a redirect                 | `redirect()` in `screens`                                          |
| a pill, an icon            | `navbar.tags`, `navbar.icons` of the shell                         |
| an external link           | a `sidebar.footer` row                                             |

The messages of the app translate a static node by its id: `appMap.admin.users.label` and
`appMap.admin.users.description`, see [i18n](i18n.md). The nav, the trail, the title and the stub
follow the language.

```js
// locales/pl.js
export default { appMap: { admin: { label: 'Administracja', users: { label: 'Uzytkownicy' } } } }
```

## Crumb labels - `imp.routeLabels`

The router creates the global state `imp.routeLabels`. Its value is a plain object: param name with
its `$` -> label. Any component writes the keys that it knows. There is no helper function.

```js
setup: async (self, { teamId }) => {
  const team = await useHttpClient(self, 'myapp.api').get(`/teams/${teamId}`)
  useState(self, 'imp.routeLabels').set((all) => ({ ...all, $teamId: team.name }))
  return teamView(team)
}
```

- **Write the labels before `setup` resolves.** The router commits the trail when the screen
  settles: its async `setup` resolved and every nested pending render is done. An error view also
  settles it. Until then, a param crumb with no entry shows the `loader`, never the raw value.
- **A crumb label is the entry, then the `loader` while the screen loads, then the raw value.** A
  screen that writes no label gets the raw value after the settle.
- **A write after the settle updates the crumb and `document.title` in place.** Use it for a rename,
  and for data that a child loads after `setup`.
- **Write the key with its `$`.** `params.teamId` and `$teamId` name the same param. In dev, a key
  that names no param of the route logs a warning.
- **Never clear the state yourself.** On each route change, before the new screen runs `setup`, the
  router removes a key whose param left the route or changed its value. From `/orgs/o1/teams/t1` to
  `/orgs/o1/teams/t2`, `$orgId` stays and `$teamId` goes.
- **An area root writes the param it owns.** The root of `/orgs/:orgId` stays mounted across its
  child screens. It writes `$orgId`. Each child screen writes only its own params.
- **`router({ title })` reads the same labels**, so `crumbs` holds the committed labels. The router
  writes `document.title` once per navigation.

## Handles

| Access                                              | Gives                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `${app.admin.users}`                                | `/admin/users` - so `[app.admin.users]` keys `screens` and `icons`                            |
| `app.projects.$projectId.href({ projectId: '42' })` | `/projects/42`, through `url()`; a missing param comes from the current route, else it throws |
| `app.search.href({}, { query: { q: 'milk' } })`     | `/search?q=milk`; `null` and `undefined` values are skipped, an array repeats the key         |
| `app.join.$key.href({ key }, { absolute: true })`   | `https://host/join/abc`, for a link that leaves the app in an email or a chat                 |
| `app.admin.spec`                                    | frozen `{ name, param, segment, pattern, label, description, children }`                      |
| `({ node }) =>` in a factory                        | the handle of the matched node                                                                |

## Rules an agent gets wrong

- **Keep `app-map.js` plain.** No component, no icon, no state name, no guard function, no `t()` in
  it. It imports `appMap` and its parts. `imp map` prints it, from the `map` key of `imp.json`.
- **Translate a static node with a message.** The key is `appMap.` plus the id of the node plus
  `.label` or `.description`. Put these keys in the translations of the app, not of an area. A
  section row shows before the chunk of its area loads.
- **A mistyped prop with a string value is a node.** `lable: 'Admin'` is a child at `/lable`,
  because a string is a description. `imp map` and the stub log show it. `lable: 3` throws. A
  mistyped handle is `undefined`, its key is `"undefined"`, and `router()` throws and says so.
- **A part takes its props first.** `appMap({ description: 'Back office' }, { users: {} })` is a
  part, and `description` is its only prop. Pass the whole map, never a part, to `router()` and
  `shell()`. A part goes into one map only. A `home` in a part is a plain node at `.../home`.
- **Name each param of a chain apart.** Write `$orgId` and `$teamId`, not `$id` twice. `appMap()`
  throws on a repeat, also through a grafted part, and `imp lint` reports it as
  `imp/app-map-unique-params`.
- **Bind, never mutate.** `screens`, `need`, `hide`, `groups`, `icons` and `tags` are keyed by
  handles. Nothing writes into the map.
- **Give every public page a `description`.** The router writes it to `<meta name="description">` on
  each navigation. A node with none gets the description of `index.html` back. Never set that meta
  tag yourself.
- **Every node renders from the first run.** Unbound leaf: a stub with the label and `description`.
  Unbound parent with static children: forwards to the first child. `redirect(handle)` in `screens`:
  forwards there. The router logs the stub nodes when it mounts. Write the map first, then bind
  screens.
- **A node with only a param child and no `description` is a prefix, not a page.** `join: { $key: {...} }`
  serves `/join/:key`. An unbound `/join` renders `notFound`, and its crumb is text, not a link. Do
  not bind it to a `redirect` to hide the stub.
- **A screen factory builds its screen immediately.** Never `await` in it, and never `import()` in
  it. Fetch in the async `setup` of the screen component. Put on-demand code behind `area()`.
- **`area()` is the only lazy binding.** The nodes of the section stay in the map, so its nav shows
  before its chunk loads. The area file binds only the node it hangs from and the nodes under it.
- **A `router()` with no map renders the screens of the area around it.** It works only inside the
  `root` of an area. Elsewhere pass `router({ map, screens })`.
- **A change of the query only keeps the current screen mounted.** Read a live query from
  `useRoute()`, not from the `query` of the factory.
- **`query` keeps the first value of a repeated key.** For `?tag=a&tag=b`, read
  `searchParams.getAll('tag')`. `searchParams` is a native `URLSearchParams`. Never mutate it.
- **A broken percent encoding in a param, such as `/todos/%zz`, renders `notFound`.** A screen never
  sees a param that failed to decode.
- **Navigate with a handle.** `navigate(app.projects.$projectId.href({ projectId }))`, and
  `link({ href: app.x.href() }, ...)` from `imp/std`. Do not write a path string. Pass a query as
  `href(params, { query })`, never as a string that you join to the path. Use
  `{ replace: true }` after a login redirect. Inside a param, `app.x.$id.y.href()` fills `id` from
  the route.
- **`navigate` throws on another origin.** `//x.com` and `https://x.com` throw unless you pass
  `{ external: true }`. Pass it only for a URL that the app itself chose.
- **`navigate` leaves the app only for http and https.** `javascript:` and `data:` throw, also with
  `external: true`.
- **An item `href` of a standard component also takes `mailto:` and `tel:`.** A nav, list, timeline
  or breadcrumb item gives those to the browser. Any other non-web scheme throws on click.
- **A tenant is `scope`, not a map prop.** Put `$org` in the map where the URL has it, and pass
  `router({ scope: app.organizations.$org })`. Inside, the sections are the children of `$org` and
  the trail starts at its crumb. Outside, on `/login`, the sections are the top-level nodes.
- **A one-section app puts every page under the index node.**
  `home: { dashboard: {}, reports: {} }` serves `/dashboard` and `/reports`. The nav then has one
  section with rows, and the shell drops the bar and draws the column alone, see [std](std.md).
- **Guard unsaved work with `beforeLeave(self, check)`, in the `setup` of the component that holds
  it.** `beforeLeave(self, () => !dirty.get() || confirm(t('edit.discard')))`. Return `false` to
  stay. A Promise works, so the check can await your own dialog. imp asks on `navigate`, on a `link`
  click, and on the back and forward buttons. It does not ask on a guard redirect or a fragment-only
  change. The check ends when the component unmounts. Never remove it by hand.
- **`beforeLeave` does not cover a reload, a closed tab or another site.** Add
  `globalThis.addEventListener('beforeunload', (event) => dirty.get() && event.preventDefault(), { signal: self.abortSignal })`.
  The browser shows its own prompt there.
- **The title is a router function.** `title: ({ crumbs, node, params }) => ...`. Without it, imp
  never writes `document.title`. The router calls it when the screen settles, and again when a
  label changes.

## Access

`need` binds a value to a node, and the one `access` guard of the router gives it meaning. The value
can be anything: `'admin'`, `['billing', 'owner']` or `{ role: 'admin' }`. The same guard decides
the nav: a row shows only on an allow verdict, and `wait` hides it until the state arrives.

| Verdict              | Effect                                               |
| -------------------- | ---------------------------------------------------- |
| `true` / `undefined` | render the screen, show the row                      |
| `wait`               | keep `loading`; re-run when a declared state changes |
| `'/path'`            | `navigate(path, { replace: true })`; hide the row    |
| `false`              | render `notFound`; hide the row                      |
| anything else        | throws, route renders `error`; row hidden and logged |

- **Every `need` on the chain runs, root first.** `settings` under `projects` needs both. A node
  with no `need` is open, so `/login` never loops. A `need` with no `router({ access })` throws at
  startup. An area inherits the `need` of the router, so an area file binds no access.
- **Put the requested path in the login redirect.** Return `/login?next=<path>`. After the sign-in,
  call `navigate(safeNext(useRoute().get().query.next, app.home.href()), { replace: true })`. Never
  pass a raw `next` to `navigate`. Pass the node as `shell({ signIn: app.login })`, so the frame
  shows it without the chrome.
- **imp has no pending state.** `initState(self, 'myapp.session')` with no initial value is
  `undefined`. Return `wait` for it explicitly. A guard that reads `undefined` without a check
  denies the route or throws, and it never waits.
- **Sign out with `set(null)`. Do not clear the value to `undefined`.** imp ignores `wait` after the
  screen is showing. Only a redirect removes a mounted screen. `false` after mount is an error.
- **Declare every state that the check reads.** A check has no `self`, so it cannot resolve a state
  itself. A declared state that nothing provides fails the router.
- **A `need` on an area node decides before the chunk downloads**, and it keeps watching inside.
  Neither guard is authorization. The server must still check.
- **A guard is synchronous and pure.** Do not `await`, fetch or call `navigate` in it. Return a path
  instead. It runs on every change of a declared state and once per node in the nav, so keep it
  cheap.
- **A redirect waits one microtask, and a `navigate` in the same task wins over it.** So a screen
  can `session.set(user)` and then `navigate(...)` to where the person goes next. The guard of the
  screen that it leaves does not send the person anywhere else. A guard that allows again before
  its redirect runs also keeps the screen.
- **Send a signed-in person away from a public page with the guard**, not with a `watch` in the
  screen. Return the path from the guard, for example by `need === 'guest'`.

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
  unmounts when the user leaves. It receives `{ params, query, searchParams, node }`. A prefix param
  that changes remounts the area.
- A `router()` inside the root inherits `loading`, `error` and `notFound`, and can override each.
- [i18n](i18n.md) covers `translations`. A navigation inside an area keeps it mounted. The browser
  keeps a downloaded module for the life of the page, so an area saves the **download**, not the
  heap.

## Lifetimes, base path, tooling, deployment

A screen is a component. Its loading is `loading` and an async `setup`, its errors go to its `error`
and then to the `error` of the router, and its cleanup is `onRemove`. Put the state of a screen in
the root component of that screen. Put only app-wide state above the router.

With an analytics sink registered, the router records each screen as a `page` record keyed by the
route pattern. Never send a page view from a `useRoute().watch`. See [analytics](analytics.md).

imp manages the scroll: to the top on a forward navigation, back to the saved place on a back or a
forward button. It scrolls the page and the screen region. `shell` names its content area as the
region. A frame of your own calls `screenRegion(self, box, { effect })` from the component that
renders the scrolling box. `effect` is `'none'`, `'fade'`, `'slide'` or `'zoom'`, and animates a
change of screen with a view transition. **The focus is yours to manage.** Focus a heading in
`onMount`, or wrap the router slot once, for every screen: a `div` with `tabindex: '-1'`,
`role: 'region'` and `:focus { outline: none }`. From `useRoute().watch(self, ...)`, one microtask
later, set its `aria-label` to `document.title`, then focus it when the **path** changed. Never
focus on a query change or on the first call. Pass `title` to `router` so that there is a title to
read.

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

`imp map` prints every node with its path, label and description, from the `map` file of
`imp.json`; `imp map src/admin/map.js` prints a part, see [cli](cli.md). `imp init` writes
`src/app-map.js`, names it in `imp.json`, and writes a frame that binds one screen, see
[init](init.md). A smoke test walks `handle.spec.children`.

To serve the app under a sub-path, set the `IMP_BASEPATH` environment value of [config](config.md).
`navigate` and `handle.href()` add the prefix. Only an `href` that you write as a string needs
`url('/todos')`. `url()` leaves a path that already starts with the base as it is. So the result of
`handle.href()` is correct in `navigate`, in `link` and in a plain `a`. Do not give a top-level node
the name of the base, such as a node `app` under `IMP_BASEPATH` `/app`: imp reads `/app/...` as a
path that already has the base.

For an app inside a page that it does not own, set the `IMP_ROUTING` environment value to `hash`.
The route then lives in the fragment, `#/todos/42?tab=notes`, and the path stays. Code changes
nothing. The base path does not apply under hash routing.

A deep link needs the host to serve your entry HTML for an unknown path. Use `try_files` in nginx, a
`_redirects` file, a copy named `404.html`, or the equivalent on your host. Keep `/chunks/` out of
that fallback: a missing chunk must get a `404`. `imp start` already does this in development.

When the chunk of an area does not download, imp fetches the page. If the page names a newer build,
imp loads the current URL again, once per build. Otherwise the `error` of the router shows. The
loaders of `translations` do the same. See [build](build.md).
