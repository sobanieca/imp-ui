# imp-ui - Routing

imp gives a single-page app client-side routing. It maps a URL to a screen, changes the screen on a
navigation, and loads a section that people rarely visit on demand. There is no build step, no
compiler that scans routes, and no config file. You describe your app once, as an **application
map**, and you hand the map to a router that you drop into your layout. The same map drives the nav
of the `shell` frame and the breadcrumb trail. See **[Standard components](std-components.md)**.

`appMap` comes from **`imp`**, because the shell reads the map too. Everything else about routing
comes from **`imp/router`**. See **[Imports](imports.md)** for the full map:

```js
import { appMap } from 'imp'
import { area, guard, navigate, router, useRoute, wait } from 'imp/router'
```

## The whole idea in two files

```js
// app-map.js
import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', description: 'The welcome page' },
  todos: { $id: 'One todo, on its own page' },
  about: 'Who made this, and why',
})
```

```js
// main.js
import { component, mount } from 'imp'
import { div, h1 } from 'imp/html'
import { router } from 'imp/router'
import { app } from './app-map.js'

const home = component('app-home', { setup: () => h1('Welcome') })
const todo = component('app-todo', { setup: (_self, id) => h1(`Todo ${id}`) })

mount(
  '#app',
  div(
    router({
      map: app,
      screens: {
        [app.home]: () => home(),
        [app.todos.$id]: ({ params }) => todo(params.id),
      },
      notFound: () => h1('Not found'),
    }),
  ),
)
```

That is a complete routed app. The map says which pages exist, at which paths. The `router()` is the
slot where the matched screen renders. Its `screens` bind a factory to a node of the map. The
`about` node has no screen yet, so it renders a placeholder that says "About". `navigate(...)`
changes the URL with no full page reload.

## The mental model

- **The map is the feature list of the app.** It is a plain object. You read it top to bottom, and
  you write it before a line of screen code exists. It says what a feature is: its name, a sentence
  about it, and who it is for. It holds no component, no icon, no state name and no function. A tool
  can print it, and a test can walk it.
- **Everything else is a binding, keyed by a handle.** `screens` and `options` at the router, and
  `icons` and `tags` at the shell, say how a node is served and shown. Each binding lives where its
  code lives, in the composition root or in the file of a section. Nothing writes into the map.
- **The router changes the screen on a navigation.** `router()` watches the current URL. When you
  navigate to a different node, it puts the DOM of the matched screen in, and takes the old screen
  out. imp unmounts the screen that you leave. Its state, its subscriptions and its timers are
  released automatically.
- **A screen is what its factory returns.** It is usually a component, so it gets the full
  lifecycle: loading content, its own scoped state, an error boundary and clean cleanup. A screen
  renders **immediately**. Only an **area**, a whole section of the app, loads on demand.
- **You navigate with `navigate()`.** Call `navigate(app.todos.$id.href({ id }))` from any event
  handler. For a real anchor, use the `link` component from `imp/std` with the same `href`. `link`
  calls `navigate` on a plain left-click. It leaves a middle-click, a modifier key and an off-site
  URL to the browser.

## The application map

`appMap(nodes)` takes one object. Every key of that object is a node, and every node can hold nodes
of its own. A node's value is a sentence that describes it, an object with its props and its
children, or another map. See _A map in parts_ below.

```js
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
  admin: {
    access: 'admin',
    users: 'Everyone with a login',
    createApiKey: 'Mint a key for a service',
  },
  login: { nav: false },
})
```

The rules are few:

- **The name is the path.** `createApiKey` serves `/admin/create-api-key`. Every path is relative to
  its parent. `path` overrides the segment. `path: '/'` marks the index of the app. Only one
  top-level node can carry it. The children of the index node hang from the root. So `home.reports`
  serves `/reports`. An app with one section writes its map this way, with every page under the
  index node. Then the nav has one section, and the shell draws the column with no top bar.
- **The name is the label.** `createApiKey` shows as "Create api key" in the nav and in the trail.
  `label` overrides it.
- **A `$name` key is a param.** `$projectId` is the segment `:projectId`. Its value reaches the
  screen as `params.projectId`.
- **A string is a description.** `users: 'Everyone with a login'` is a node with a sentence about
  it. Write `{}` for a node with nothing to say yet.
- **A key from the set of props below is a prop.** Any other key with an object or a string value is
  a child. A key with any other value, such as `lable: 3`, is an error when the map is built. A
  mistyped prop with a string value, such as `lable: 'Admin'`, becomes a child at `/lable`, and
  `imp map` shows it.
- **The order of the keys is the order of the nav.** The router matches a static path before a param
  path on its own. You never order the keys for priority.

### Node props

| Prop          | Values                                      | Meaning                                                                                                        |
| ------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `description` | string                                      | The `<meta name="description">` of the page, shown by the placeholder of an unbound node, printed by `imp map` |
| `access`      | any value                                   | Who can see the node. The `access` guard of the router decides.                                                |
| `path`        | one segment, or `'/'`                       | Overrides the segment derived from the name                                                                    |
| `label`       | string, or `({ params, option }) => string` | Overrides the label derived from the name                                                                      |
| `nav`         | `false`                                     | Hides a static node from the nav; the route stays                                                              |
| `group`       | string                                      | The sidebar groups consecutive rows under this title                                                           |

That is the whole set. A prop describes what a feature is. How a feature is served, and how the nav
shows it, is a binding elsewhere. Examples are a screen or a redirect in `screens`, the choices of a
param in `options`, and an icon or a pill in the `navbar` of the shell. Each binding is keyed by the
handle of the node.

A `label` function receives the current `params`. On a param node, it also receives the matching
`option`. So a crumb inside a repository reads `({ params }) => params.repo`.

A translation is not a prop of the map. Your translation files name a node by its id, under
`appMap`. `appMap.admin.users.label` translates the label of `app.admin.users`,
`appMap.admin.users.group` its group title, and `appMap.admin.users.description` its description. A
message wins over the prop and over the name. The nav, the trail, the document title and the
placeholder of an unbound node follow the language. Put these keys in the translations of the app,
not of an area. A section row shows before the code of its area loads. See **[i18n](i18n.md)**.

### A map in parts

A large app splits its map into files. A map that another map holds is written with `appMap()` too,
with the props of the node that it hangs from as the first argument:

```js
// admin/map.js
export const admin = appMap(
  { access: 'admin', description: 'The back office' },
  {
    users: 'Everyone with a login',
    createApiKey: 'Mint a key for a service',
  },
)
```

```js
// app-map.js
import { admin } from './admin/map.js'

export const app = appMap({ home: { path: '/' }, admin })
```

The key gives the part its place, so `admin.users` and `app.admin.users` are the same handle, and
both print `/admin/users` once the part is in the whole. A file of a section imports the part and
keys its screens by it. A part goes into one map only. `imp map admin/map.js` prints a part on its
own, with its paths relative to where it will hang.

### Handles

`appMap()` returns a tree of **handles**, one per node. `app.admin.createApiKey` is a frozen object
that stands for that node everywhere:

| Access                              | Gives                                                                |
| ----------------------------------- | -------------------------------------------------------------------- |
| `${handle}` or `handle.toString()`  | the pattern, `/admin/create-api-key`, so a handle keys an object     |
| `handle.href({ projectId: '42' })`  | the URL, with the params filled in and the base path applied         |
| `handle.href(params, { query })`    | the same URL with a query string, such as `/search?q=milk`           |
| `handle.href(params, { absolute })` | with `absolute: true`, the whole URL, origin included                |
| `handle.spec`                       | the node data: `name`, `pattern`, `label`, `description`, `children` |

`href()` takes a missing param from the current route. On `/projects/42/builds`, the call
`app.projects.$projectId.settings.href()` gives `/projects/42/settings`. A param that neither the
argument nor the route supplies is an error.

The second argument adds to the URL. `query` is a plain object. imp skips a `null` or `undefined`
value, repeats the key for an array, and encodes every value. `absolute: true` gives the URL with
its origin, for a link that you send in an email or paste in a chat:

```js
navigate(app.checks.new.href({}, { query: { teamId } }))
const invite = app.join.$key.href({ key }, { absolute: true }) // https://example.com/join/k3y
```

| `({ node }) => ...` in a factory | the handle of the matched node, so a screen reads its own
`spec` |

A mistyped handle is `undefined`. As a key it becomes the string `"undefined"`, and the router
refuses it with a message that says so. So a typo fails at startup, not on a click.

## The router

```js
router({ map, screens, options, access, scope, title, loading, error, notFound })
```

Drop the router where the current screen must appear. Everything around it stays in place across a
navigation. That covers a header, a sidebar and a footer. Only the contents of the router change.
Its map and the current URL decide what it renders. It takes these options, and only `map` is
necessary:

- **`map`** is the application map.
- **`screens`** binds a node to a screen factory, to an area, or to a `redirect()`. The keys are
  handles.
- **`options`** binds a param node to its choices: the name of a state that holds
  `[{ value, label }]`, or such an array. The crumb of the param becomes a picker, and the label of
  the crumb is the label of the matching choice.
- **`access`** is the one guard that decides the `access` values of the map, see _Access_.
- **`scope`** is the param node that the app lives under, for a multi-tenant app, see _A tenant in
  the URL_.
- **`title`** is a function of `{ crumbs, node, params }` that returns the title of the document.
  imp calls it on every navigation. Without it, imp leaves `document.title` alone.

The router also writes the `description` of the matched node to `<meta name="description">` on every
navigation, with no option. A search engine and a link preview read that tag. When the node has no
description, or the URL is off the map, the router puts back the description that your HTML page
declares. When the page declares none, the router removes the tag. Translate a description with the
`appMap.<id>.description` key, as described above. imp sets no other meta tag.

- **`loading`** is what the router shows while the code of an **area** downloads (see _Areas_), or
  while a guard waits for the state that it reads (see _Access_). imp calls it with the
  `{ params, query, searchParams, node }` of the route.
- **`error`** is an **error boundary** at route level. It renders in place of the matched screen
  when that screen, or any component that it renders, throws during the mount and does not handle
  the error itself. That includes an area whose `import()` does not download. A screen, or any
  nested component, that defines its own `error` catches the failure first. Anything that it does
  not handle goes up to the router. imp calls the router `error` with
  `(self, error, { params, query, searchParams, node })`. `self` belongs to the host that wraps the
  screen. imp logs the failure in both cases.
- **`notFound`** is the one screen that imp shows for a URL that matches no node of the map.

A screen factory receives one argument, `{ params, query, searchParams, node }`:

- **`params`** holds the values of the `$name` segments, URL-decoded. For `/todos/42`,
  `params.id === '42'`.
- **`query`** is the query string of the URL, parsed into an object **at the moment when the person
  enters the screen**. For `/search?q=imp&page=2`, `query.q === 'imp'`. A query value is always a
  string. When the query repeats a key, as in `?tag=a&tag=b`, `query` keeps the first value. When
  the query can change while the screen stays mounted, described below, read it live from
  `useRoute()` instead.
- **`searchParams`** is the same query as a native `URLSearchParams`. Read a repeated key with
  `searchParams.getAll('tag')`, which gives `['a', 'b']`.
- **`node`** is the handle of the matched node. Its `spec.label` and `spec.description` are what the
  map says about the page, so a screen heading can read them instead of repeating them.

**A screen factory builds its screen immediately.** It returns DOM, and imp renders it. It is not
the place to `await` anything. Do not fetch the data of a screen there. Load it in the async `setup`
of the screen component, so the wait shows the `loading` of the screen. Do not call `import()` there
either. Code that must load on demand goes behind an **area**, described below.

### A node with no screen still renders

Every node of the map answers its URL from the first run:

- A node with a screen renders it.
- A node bound to `redirect(app.reports.weekly)` forwards there, with the params of the route filled
  in. `redirect('/somewhere')` takes a path.
- A node with static children and no screen forwards to its first child. So `/admin` opens
  `/admin/users` until you bind a screen to `admin`.
- A node whose children are all params, and which has no `description`, is a prefix. It is not a
  page. So `/join` of `join: { $key: {} }` renders the not-found page, and its crumb in the trail is
  plain text. Give the node a `description` when it is a page that you still have to build.
- Any other node renders a placeholder with its label and its `description`.

So you write the map first, run the app, and see every page as a placeholder, with the nav and the
trail in place. Then you bind screens one by one. When the router mounts, it logs the nodes that
still render a placeholder.

### A navigation is a clean start, except a change of the query

A navigation to a **different screen**, which is a different node or a different param, mounts that
screen from the start, and unmounts the screen that you left. A navigation that changes **only the
query string** keeps the current screen mounted. So a search page or a filter page at
`/search?q=...` keeps its input focus, its scroll position and its state in progress, even when a
query param changes. Such a screen reads the live query from `useRoute()`:

```js
const results = component('app-results', {
  setup: () => {
    const location = useRoute()
    return div(location.view((current) => resultList(current.query.q ?? '')))
  },
})
```

### Each screen is a page view

When your app registers an analytics sink, the router records each screen that it shows as a `page`
record when the screen is ready. The record carries the route pattern of the node, such as
`/invoices/:id`. You write no code per route. A change of the query only is no page view, because
the screen stays mounted. A redirect is no page view. See **[Analytics](analytics.md)**.

### A tenant in the URL

A multi-tenant app puts the tenant in the URL, as in `/organizations/acme/projects`. The map holds
that shape, because a handle must print the real pattern. The router says what it means:

```js
export const app = appMap({
  organizations: {
    $org: {
      projects: { $projectId: {} },
      admin: { access: 'admin' },
    },
  },
  userSettings: { nav: false, me: 'Profile and password' },
  login: { nav: false },
})

router({
  map: app,
  scope: app.organizations.$org,
  screens,
  options: { [app.organizations.$org]: 'acme.orgs' },
})
```

Inside the scope, the sections of the nav are the static children of `$org`. The trail starts with
the organization, with a picker when `options` binds it. Outside the scope, on `/user-settings/me`
or `/login`, the sections are the top-level nodes. A link inside the organization writes
`app.organizations.$org.admin.href()`. `href()` takes the current slug from the route.

### The label of a param crumb

The crumb of a param, such as `$teamId`, shows the value from the URL until something names it. A
screen names it with `crumbLabel(self, label)` from `imp/router`, after it loads its data:

```js
const teamScreen = component('my-app-team', {
  setup: async (self, { teamId }) => {
    const team = initState(self, 'myapp.team', await api.get(`/teams/${teamId}`))
    crumbLabel(
      self,
      computed([team], (current) => current.name),
    )
    return teamView(team)
  },
})
```

The trail and the document title then show the name. A state as the label keeps the crumb current
after a rename. imp keeps the label for that value of the param, so a child page such as
`/teams/t1/settings` shows it too. Use `options` when the crumb needs a picker of all the teams. A
screen does not have to add itself to that list to get its label.

### Not found (404)

Declare your not-found screen in one place, with the `notFound` option of the router:

```js
router({ map: app, screens, notFound: () => notFoundPage() })
```

It renders whenever the current URL matches no node of the map. A URL with a broken percent encoding
in a param, such as `/todos/%zz` from an external link, also renders it. It is a factory. It has no
node, because it is not a page. It is the one page for every URL that matches nothing in the map.

## Areas: how to load a section on demand

The nodes of a section are in the map from the start. Which of them load lazily is a decision you
make in `screens`. An **area** binds a node to a loader, and the module that the loader imports
binds the screens of that subtree. So the nav of the section renders before its code arrives, and
only the screens arrive later:

```js
router({
  map: app,
  screens: {
    [app.home]: () => home(),
    [app.login]: () => login(),
    [app.admin]: area(() => import('./admin/area.js')), // a lazily-loaded area
  },
})
```

That module declares the section with `area()`. It binds only the node the area hangs from and the
nodes under it, and optionally the translations that the section needs. See
**[Translations](i18n.md)**:

```js
// admin/area.js
import { area } from 'imp/router'
import { app } from '../app-map.js'

export default area({
  screens: {
    [app.admin]: () => adminHome(), //          /admin
    [app.admin.users]: () => usersList(), //    /admin/users
    [app.admin.createApiKey]: () => createApiKey(),
  },
  translations: {
    en: () => import('./locales/en.js'),
    pl: () => import('./locales/pl.js'),
  },
})
```

A visit to `/admin/users` matches the `admin` node. imp loads the module of the section the first
time, and renders its screen for `users`. The code of the section ships as one on-demand module.

**An area is always lazy, and it is the only lazy thing.** `area(() => import('./...'))` is the only
way to point at one. Its code loads the first time when somebody enters the section. It never ships
to a user who never enters. There is no eager form and no lazy-screen form. A binding is either a
screen factory, which renders immediately, or an `area()`, which loads on demand. So the question
"does this URL cost a download?" has a one-word answer that you read off the bindings.

`area()` is one name that does both halves of the job. Which half you get depends on what you hand
it. **A function** is the pointer that you put in `screens`. **An object** is the definition of the
area, in its own file. The two never appear in the same place. So there is one name to remember, and
the argument says which half it is.

While the module downloads there is no screen. So the `loading` of the router shows. Set `loading`,
and every area gets a loader during the download. Leave it out, and the router is blank until the
code arrives. When the user navigates away before a slow chunk arrives, imp discards the chunk. A
section that arrives late never replaces a newer screen. After the screen of the section mounts, its
own async `setup`, when it has one, shows the `loading` of the **screen** while the data loads.

A deploy can remove the chunk of an area while a tab still runs the previous build. When the chunk
does not download, imp fetches the current page. If the page names a newer build, imp loads the
current URL again, so the tab runs the new build on the same screen. It does this at most once for
each build. Otherwise the `error` of the router shows. See
[A deploy and the open tabs](deploy.md#a-deploy-and-the-open-tabs).

An area binds only its own nodes. A binding for a node outside its subtree is an error when the area
loads, and the message names both. A node inside the area that the area does not bind renders the
same placeholder as anywhere else.

### A root component for the whole section

An area can name a `root`. That is a component that every screen in the section renders inside:

```js
// admin/area.js
const frame = component('admin-frame', {
  setup: () => div(adminNav(), router()),
})

export default area({
  root: () => frame(),
  screens: {
    [app.admin]: () => adminHome(),
    [app.admin.users]: () => usersList(),
  },
})
```

A `router()` with no map is the slot where the screens of the section render. It renders the
bindings of the area. It inherits the `loading`, the `error` and the `notFound` of the parent
router. You can override each one for the section alone, as in
`router({ notFound: () => adminNotFound() })`.

A root, against wrapping each screen by hand as `() => frame(usersList())`, gives you a
**lifetime**. The root stays mounted while the user moves between the screens of the section. It
unmounts when they leave the section. Use it for whatever the whole section shares, and nothing
outside it needs to see. Examples are a state scoped to the section, an [HTTP client](http.md) for
its backend, and a layout that keeps its scroll position. imp does not rebuild any of that on a
navigation inside the section.

The root receives the same `{ params, query, searchParams, node }` as a screen factory. So a prefix
param is there for the frame too, as in `root: ({ params }) => orgFrame(params.orgId)`. A prefix
param that changes remounts the area, and the root with it.

A `router()` with no map finds its area when it mounts, from its own position in the DOM. It does
not care where in `setup` you call it. An **async** root can build the slot after its `await`. A
`router()` with no map outside an area fails at mount. imp logs the error, and the message tells you
to pass a map.

When you do not want to split the code, bind the screens of the section in the top-level `screens`,
like any other screen. Use an area exactly when you want the code of that section to load on demand.
A single screen that people rarely visit is worth an area of its own. An area with one binding is an
ordinary area.

### Organize your files as you want

imp has **no opinion about where any of this lives.** It only ever sees the module that an
`import()` resolves to. There is no folder convention, no `areas/` directory that a tool scans for,
and no file whose name means something to the framework. The paths above are examples. Point each
`import()` at the real location of the module.

An area is a routing concept, not a directory. Group your code by feature, by domain, or by
architectural layer, as your project prefers. A **Feature-Sliced Design** codebase works as it is,
with an imp area mapping naturally onto an FSD page or view. The composition root binds the node of
each page with `area(() => import(...))`. The widgets, features and entities that the page uses stay
in their own layers, and its screens import them as usual. A flat `screens/` folder also works. The
map is the contract. The file layout is yours.

A navigation **inside** an area keeps the section mounted, and only changes its inner screen. The
same rule keeps a screen mounted across a change of the query only. A prefix param that changes,
such as `/org/1` to `/org/2`, remounts the section. An area nests to any depth. The screens of an
area can bind a deeper node to another `area()`.

> **A note on memory.** Leaving an area releases its DOM, state, subscriptions and timers, as usual.
> It does **not** unload the JavaScript that the browser already downloaded for it. No browser
> offers an API to unload a loaded module, so this is true for every framework, not only for imp. A
> lazy area saves you from loading code that nobody visits. It does not free the code of a section
> that somebody already visited. Think of an area as code organization and code splitting, not as a
> way to free loaded code. The same holds for the `translations` of an area: leaving it unregisters
> the translation keys, but the module that holds them stays loaded. See
> **[Translations](i18n.md)**.

## Access: how to keep a screen behind a condition

A node says who can see it, with `access`. One guard on the router decides what each value means.
The guard is a plain function of the state that it reads. It runs before imp builds the screen:

```js
import { guard, wait } from 'imp/router'

const access = guard(['myapp.session'], (session, { need, path }) => {
  if (session === undefined) return wait
  if (!session) return `/login?next=${encodeURIComponent(path)}`
  return session.roles.includes(need) || '/forbidden'
})

router({ map: app, access, screens })
```

The redirect to `/login` carries the requested path in `next`. The login screen reads it from the
query and navigates there after the sign-in, so a deep link works for a signed-out visitor too.

Anyone can write a link to your login page with any `next` value. So pass the value through
`safeNext(value, fallback)` before you navigate. It returns the value only when it is a path of your
app. For any other value, such as `//evil.example` or `javascript:...`, it returns `fallback`:

```js
import { navigate, safeNext, useRoute } from 'imp/router'

const next = safeNext(useRoute().get().query.next, app.todos.href())
navigate(next, { replace: true })
```

Read that from the inside out. `['myapp.session']` declares **which states this guard reads**. The
router looks them up for you, and passes their values in, in the same order. After the values comes
`{ need, params, query, searchParams, path }`, where `need` is the `access` value of the node. The
function returns one of four answers:

| Return              | Means                                                      |
| ------------------- | ---------------------------------------------------------- |
| `true` (or nothing) | allow - render the screen                                  |
| `wait`              | "I can't decide yet" - keep the loader up and ask me again |
| `'/login'`          | redirect there, replacing the current history entry        |
| `false`             | render the `notFound` page, as if the route did not exist  |

### `access` is data, and the guard gives it meaning

`access` takes any value. Write `access: 'admin'`, `access: ['billing', 'owner']` or
`access: { role: 'admin', plan: 'business' }`. Your one guard reads `need` and decides. Every
`access` on the path from the root to the matched node runs, root first, and the first answer that
is not an allow wins. So `settings` under a `projects` node with `access: 'user'` needs the person
to be a user and, with its own `access: 'admin'`, an admin as well.

**A node with no `access` is open.** So `/login` never loops, and there is no default to exclude a
page from. A map with an `access` and a router with no `access` guard is an error at startup. Pass
the login node to `shell` as `signIn`, and the frame shows that page without the navbar. See
**[Standard components](std-components.md)**.

The same guard decides what the nav shows. A section or a row appears only when the guard allows it.
While the guard waits, the row stays hidden, and it appears when the state arrives. So the nav and
the route never disagree.

### `wait` is what makes a synchronous guard possible

Nearly every real condition depends on something that the app loads after it starts. The session
comes from your backend. So when imp matches the first URL, the answer is truly not known yet. An
async guard would mean a request per navigation, and error handling in every guard. Instead, imp
lets a guard say **`wait`**.

When a guard returns `wait`, the router subscribes to the states that the guard declared, and
pauses. Every time when one of them changes, the guard runs again. It is the same function with the
same inputs, only later and with more data. imp acts on the first answer that is not `wait`. The
guard itself stays a simple synchronous function that you can call in a unit test with plain values.
The waiting is the job of the router.

**A state that has not loaded yet is `undefined`.** `initState(self, 'myapp.session')` with no
initial value starts there. imp has no separate loading concept. So `undefined` means whatever your
app decides that it means, and the guard is the one place that decides. That is why you write a
signed-out session as `null`. `undefined` means "I do not know yet". `null` means "I know, and there
is nobody".

### The loader that you already have

While a guard waits, the router shows its `loading`. That is the same loader as the one that the
download of an area shows:

```js
router({
  map: app,
  access,
  screens,
  loading: () => div(loader({ label: 'Loading' }), 'Loading...'),
})
```

You write no loading branch and no spinner state. After the session has loaded, a guard that can
answer immediately renders its screen in the same tick. So no loader appears at all when you
navigate between screens later.

### A guard keeps watching

A guard does not run once. imp watches the states that it declared for as long as the screen shows.
So a sign-out on a protected screen redirects immediately:

```js
button('Sign out', {
  events: {
    click: async () => {
      await api.post('/logout')
      session.set(null) // the guard re-runs and redirects to /login
    },
  },
})
```

Set `null`. Do not clear the value back to `undefined`. `null` is an answer that a guard can act on.
`undefined` only makes the guard wait, and imp ignores a `wait` for a screen that is already on the
page. After you are in, only a redirect takes you out. A background refresh of the session must not
tear down the screen you work in. That would lose your scroll position, your focus, and anything you
typed.

A redirect from a guard waits for one microtask. A `navigate` in the same task wins over it. So a
screen that signs the person in can set the session and then go where the person goes next:

```js
session.set(user) // the guard of this public page now wants to redirect
navigate(app.checks.$checkId.href({ checkId }), { replace: true }) // this navigation wins
```

A guard that allows again before its redirect runs also keeps the screen. To send a signed-in person
away from a public page, return that path from the guard. Do not watch the session in the screen.

### A guard and a lazily loaded section

An `access` on the node that an area binds covers the whole section. That is its `root` and every
screen under it. It decides **before the import runs**. So a person who is not an administrator
never downloads the admin code. A node inside the area can carry its own `access` for a narrower
rule, and the router inside the area checks it.

A guard is a UI concern. It decides what to render, not what a visitor can have. Your backend still
authorizes every request. A determined visitor can always fetch the JavaScript.

### When something goes wrong

A guard fails closed. No failure path lets a screen through:

- A guard that throws, or that returns something other than the four answers, renders the `error`
  view of the router. In the nav, the node stays hidden and imp logs the error.
- A guard that declares a state that no component above the router provides fails the router, with
  the same error as `useState`.
- A guard that stays on `wait` for more than five seconds logs a warning. The warning names the
  route and the states that the guard waits for. Usually one of those states is a state that nothing
  sets.

## How to navigate

### From code

`navigate` is the one primitive. Everything else builds on it. A handle gives the path, so app code
writes no path string:

```js
navigate(app.todos.$id.href({ id: '42' }))
navigate(app.login.href(), { replace: true }) // replace the current history entry
```

`navigate` works anywhere: in an event handler, in a timer, and after an `await`:

```js
button('Save', {
  events: {
    click: async () => {
      const todo = await save(draft)
      navigate(app.todos.$id.href({ id: todo.id }))
    },
  },
})
```

Use `{ replace: true }` when you do not want the current page in the history of the back button. An
example is a redirect after a login. A navigation to the URL that you are already on does nothing.
It does not add a duplicate history entry.

`navigate` stays on the origin of your app. A URL of another site, such as `https://example.com` or
`//example.com`, makes it throw an error. This stops an attacker who controls a URL value from
sending your visitors to a different site. To leave the app on purpose, pass `{ external: true }`:

```js
navigate('https://billing.example.com/checkout', { external: true })
```

`navigate` leaves the app only for an `http` or `https` URL, with or without `external`. A
`javascript:` URL or a `data:` URL always makes it throw an error. So a value from the URL cannot
run code in your page.

The `href` of an item in a standard component, such as a nav row, a list row, a timeline entry or a
breadcrumb, works the same way. It can be a path of your app or an `http` or `https` URL. It can
also be a `mailto:` or a `tel:` URL, which imp gives to the browser. Any other scheme throws an
error when the item is clicked.

### Navigation controls

The `shell` frame draws the nav from the map, see **[Standard components](std-components.md)**. For
a link in a page, use `link` with the `href` of a handle:

```js
link({ href: app.todos.$id.href({ id: todo.id }) }, todo.title)
```

### Unsaved work: ask before the person leaves

A screen with unsaved work can stop a navigation. Call `beforeLeave` in its `setup`, with a check.
The check returns `false` to stay on the screen. Any other value lets the navigation go on:

```js
import { beforeLeave } from 'imp/router'

const editScreen = component('edit-screen', {
  setup: (self) => {
    const dirty = initState(self, 'edit.dirty', false)
    beforeLeave(self, () => !dirty.get() || confirm(t('edit.discard')))
    return form() /* ... */
  },
})
```

The check can also return a promise. So it can open your own dialog and wait for the answer. The
screen stays as it is while the check waits.

imp asks the check in these cases:

- A click on a `link`, or on any other control that calls `navigate`.
- A `navigate` call from your code, such as a Cancel button.
- The back and forward buttons of the browser. imp puts the current URL back while it asks, and goes
  on when the check allows.

imp does not ask when only the fragment of the URL changes, or when a guard redirects. The check
ends when its component unmounts, so you never remove it yourself. If the check throws, imp keeps
the screen and logs the error.

A reload, a closed tab, and a link to another site unload the whole page. Only the browser can ask
then, with its own prompt. Add a `beforeunload` listener for that case:

```js
globalThis.addEventListener(
  'beforeunload',
  (event) => {
    if (dirty.get()) event.preventDefault()
  },
  { signal: self.abortSignal },
)
```

A `dialog` and a `drawer` take the same kind of check, as their `beforeClose` prop. See
**[Standard components](std-components.md)**.

## How to read the current route

`useRoute()` returns a read-only handle on the live route, which is `{ path, query, searchParams }`.
Any component can watch it, including a component outside the router, such as a nav bar. It has the
same shape as any imp state, with `get`, `watch`, `text`, `view` and `each`. It has no `set`,
because you change the route by navigating, not by writing to it.

```js
useRoute().watch(self, (current) => (searchInput.value = current.query.q ?? '')) // in a component
const { path, query } = useRoute().get() // read once, imperatively
```

## Loading and errors

A screen is a component. So its loading and its error handling are the component lifecycle that you
already know:

```js
const todoDetail = component('app-todo-detail', {
  loading: () => div({ class: 'skeleton' }, 'Loading...'),
  setup: async (self, id) => {
    const todo = initState(self, 'app.todo', await fetchTodo(id))
    return article(h1(todo.text((t) => t.title)))
  },
  error: (_self, error) => div({ class: 'error' }, `Couldn't load this todo: ${error.message}`),
})

// screens: { [app.todos.$id]: ({ params }) => todoDetail(params.id) }
```

- **The data loading lives in the `setup` of the screen.** Fetch, `await`, and build. The `loading`
  shows until the promise resolves. There is no separate loader, and no data-fetching API to learn.
- **A wait on a guard uses the same `loading`**, see _Access_. The visitor sees one loader, whether
  the wait is a download, a guard, or the data of the screen.
- **Errors.** A screen that defines an `error` entry handles its own failures first. A failure it
  does not handle goes up to the **`error` of the router**, an error boundary for the whole matched
  subtree. Examples are an `import()` of an area that does not download, and a throw during the
  mount of the screen or of any component it renders.

With no `error` at either level, a failed screen renders nothing, and imp still logs the failure. It
does not stay on the loading content forever.

## A screen cleans up after itself

A navigation away from a screen unmounts it, and an unmount releases everything that imp tracks. The
URL bounds the lifetime of a screen:

- **State** that you create with `initState` inside the screen, or inside any component under it, is
  released. Put the state of a screen in the root component of that screen. Put only state that is
  truly app-wide, such as the session, the theme and the cart, in the root component of your app.
  That root component sits above the router and never unmounts.
- **Bindings** end. That covers every `text`, `view`, `each` and bound prop that you set up while
  the screen was mounted.
- **A timer, an interval, a socket, a `watch` and a global** that you used are undone in the
  `onRemove` of the screen component. Each component is responsible for its own cleanup.

```js
const dashboard = component('app-dashboard', {
  setup: (self) => {
    const metrics = initState(self, 'dashboard.metrics', []) // released when you leave the dashboard
    self.socket = openMetricsSocket((m) => metrics.set(m))
    self.refresh = setInterval(() => self.socket.send('ping'), 30_000)
    return metricsGrid()
  },
  onRemove: (self) => {
    self.socket.close() // closed on navigation away
    clearInterval(self.refresh) // imp can't track a timer you started, so you stop it
  },
})
```

You write no special cleanup for a navigation. Each screen is a component. So its `onRemove` is the
cleanup, and leaving the route runs it.

## The map in the tooling

**`imp map`** prints the map of the project, from the `map` file of `imp.json`, or from the file
that you pass. Every node shows its path, its label, its `access` and its `description`. So a
person, or an agent, sees the whole app on one screen before a line of screen code exists. See
**[CLI](cli.md)**.

**`imp init`** writes an `app-map.js` with two nodes, names it in `imp.json`, and writes a frame
that binds the one screen it ships. The second node renders a placeholder until you bind it.

**A test can walk the map.** `app.home.spec.children` lists the handles under a node. A smoke test
can loop over the tree, visit every node, and assert that something mounts.

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
write a path from the app root, such as `/todos` and not `/app/todos`. imp removes the base from the
URL before it matches, and adds it back when `navigate` and `handle.href()` build the real URL.

The same value covers your static assets. `imp build` puts the base in front of the root-absolute
URLs in your page. That covers a stylesheet, an image, the PWA manifest and the service worker. So
one setting moves the whole app under the sub-path.

The one value that imp does not adjust automatically is an `href` that you write yourself as a
string. When you render a real `<a>` with such a string, build its `href` with `url(path)`. That
call adds the base, so a middle-click and a "copy link address" stay correct. It does nothing when
`IMP_BASEPATH` is not set, and it leaves an absolute URL and an external URL as they are:

```js
a({ href: url('/todos') }, 'All todos')
```

`url()` leaves a path that already starts with the base as it is. So you can pass the result of
`handle.href()` to `navigate`, to `link` and to a plain `<a>`, and the base appears once. For the
same reason, do not give a top-level node the name of the base. Under `IMP_BASEPATH` `/app`, a node
`app` serves `/app/app`, and imp reads a link to it as a path that already has the base.

## Hash routing: when the app does not own the path

Some apps run inside a page that they do not own. Examples are a widget in a host page, and a
gallery that `imp preview --output` exports. Such an app cannot push a path, because a reload of
that path reaches a host that does not serve it. For a deployment like this, set the
**`IMP_ROUTING`** environment value to `hash`:

```json
{
  "IMP_ROUTING": "hash"
}
```

The router then keeps the route in the fragment of the address, as `#/todos/42?tab=notes`, and it
leaves the path alone. `navigate`, `handle.href()` and `url(path)` write a fragment. The router
reads the route from it, and the back and forward buttons work as before. You write nothing
differently in your code. A route pattern, a `navigate` target and an `href` stay the same paths.

A host with no history fallback is the other case for this value. Prefer the fallback of the host,
see **[Deployment](#deployment-a-deep-link-and-a-refresh)**, and use `hash` only where no such
setting exists. Under hash routing the base path does not apply, because the fragment is not a path
that the host serves.

## Accessibility: scroll and focus

- **imp manages the scroll for you.** A forward navigation scrolls to the top of the new screen. The
  back and forward buttons restore the scroll position where you left each page. imp restores the
  page scroll and the scroll of the screen region. The `shell` names its content area as that
  region. A frame of your own names its scrolling box with `screenRegion(self, element)`, from the
  component that renders the box. Without a region, imp restores the page scroll only.
- **The focus is yours to manage.** A move of the focus on a navigation is disruptive when it is not
  wanted, and correct when it is. Only your screens know which case applies. A screen that must take
  the focus can focus its own heading in `onMount`. You can also keep one live region that is hidden
  visually, and update it from `useRoute().watch(self, ...)`.
- **Usually it is better to do this once for every screen.** Give the element that your router slot
  renders into a `tabindex` of `-1` and the `region` role. Focus that element from
  `useRoute().watch(self, ...)` whenever the path changes. Compare the path, not the whole route, so
  a change of the query string never takes the focus out of the input where the reader types. Skip
  the first call, because it fires with the route that the page loaded on, where there is nothing to
  move the focus away from. Style the `:focus` of that element with `outline: none`. The focus is
  programmatic, so the browser would otherwise draw a ring around the whole screen on arrival.
- **Give the focused element a name.** A screen reader reads the name of the element that takes the
  focus. An element with no name gets its name from all of its text, so the reader hears the whole
  screen at once. Set `aria-label` to the page title before you move the focus. The reader then
  hears one short line, such as "Stats - Todo, region".

One component does this job for the whole app. It wraps the router slot, names it after the title,
and moves the focus to it. A screen reader then reads the title, and the next Tab lands on the first
control of the new screen:

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { router, useRoute } from 'imp/router'
import { shell } from 'imp/std/shell'

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

shell(
  { navbar: { label: 'Sections', map: app } },
  screenFrame(router({ map: app, screens, title: ({ crumbs }) => `${crumbs.at(-1)} - Acme` })),
)
```

The `title` option of the router writes `document.title` on every navigation. The frame reads it one
microtask later, after the router has written it. The focus moves in the same microtask, after the
router has put the new screen in place. A dialog that is still open on the old screen makes the rest
of the page inert, and an inert element cannot take the focus. The microtask lets the router remove
that screen, and its dialog, first. `preventScroll` leaves the scroll to the router, which has
already put the new screen at the top. A change of the query string keeps the path, so the frame
does not move the focus, and a search box keeps its focus while the reader types.

## Screen transitions

A change of screen can animate. The `effect` prop of the `shell` picks the animation of its content
area. `'fade'` cross-fades from the old screen to the new one, `'slide'` moves the old screen out
and the new one in, along the reading direction, and back the other way on a back navigation, and
`'zoom'` scales the new screen in. Each one takes the medium duration of the theme. The default is
`'none'`. The bar, the column and the trail stay still. Only the content area moves. The animation
is a view transition of the browser. The browser takes a picture of the old screen, the DOM changes,
and the pictures move. A click during the animation reaches nothing, because the pictures cover the
page for that time. So an app that turns an effect on accepts a short pause after each navigation,
and a test that clicks right after a navigation waits for the animation. A person who asks the
system for reduced motion gets no animation.

```js
shell({ navbar: { map: app }, effect: 'slide' }, router({ map: app, screens }))
```

A frame of your own gets the same animation from `screenRegion`. Pass the box that holds the
screens, and the effect:

```js
const frame = component('myapp-frame', {
  setup: (self) => {
    const content = main(router({ map: app, screens }))
    screenRegion(self, content, { effect: 'fade' })
    return content
  },
})
```

The call also makes the box the scroll region of the router, see
**[Accessibility: scroll and focus](#accessibility-scroll-and-focus)**.

## Deployment: a deep link and a refresh

A client router owns a URL such as `/todos/42` in the browser. But a visit to that URL, or a refresh
of it, sends a request straight to your server. The server must answer with the entry HTML of your
app, so the client router can take over. Otherwise a refresh returns 404.

`imp build` stays out of this. It produces a plain, portable bundle of the real files of your app,
with nothing specific to a host, and you upload it anywhere. To serve the entry for an unknown path
is a single setting on whatever hosts the app, and every platform has it:

| Host            | Setting                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| nginx           | `try_files $uri /index.html;` in `location /`, and `try_files $uri =404;` in `location /chunks/` |
| Netlify         | a `_redirects` file with `/chunks/*  /404.html  404` above `/*  /index.html  200`                |
| Vercel          | a `rewrites` rule in `vercel.json` from `/((?!chunks/).*)` to `/index.html`                      |
| S3 + CloudFront | a CloudFront Function that sends a path with no file extension to `/index.html`                  |
| GitHub Pages    | add a `404.html` that is a copy of your `index.html`                                             |

Keep `/chunks/` out of the fallback. A missing file there must get a `404`, never the entry HTML,
see [Deep links](deploy.md#deep-links). So do not use the error document of S3 or an error page of
CloudFront for the fallback. They answer a missing chunk with the page too. GitHub Pages sends its
`404.html` with the status `404`, so a missing chunk is a `404` there as well.

In development you need none of this. `imp start` already serves your entry HTML for a navigation
request to a path with no extension. A missing asset, such as a wrong `.js` path, still returns 404.
So a deep link and a refresh work while you build.

## API summary

| Export                                     | Returns            | What it does                                                                                                                               |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `appMap(nodes)` / `appMap(props, nodes)`   | the handle tree    | Builds the application map, or a part of one; validates every node at startup. Imported from `imp`.                                        |
| `router(options)`                          | a live router slot | Renders the matched screen; `options`: `map` (required), `screens`, `options`, `access`, `scope`, `title`, `loading`, `error`, `notFound`. |
| `redirect(to)`                             | a screen binding   | Binds a node to a forward: `to` is a handle, or a path.                                                                                    |
| `router()`                                 | a live router slot | Inside the `root` of an area, renders the screens of that area; inherits the options of the parent router.                                 |
| `area({ screens, root?, translations? })`  | an area definition | Declares the screens of a section, the component its screens render inside, and its translations, for its `export default`.                |
| `area(() => import(...))`                  | an area marker     | Binds a node to a lazily-loaded area - the one on-demand unit.                                                                             |
| `guard(states, check)`                     | a guard            | A synchronous check over the values of the states it names and the `need` of the node; returns `true`, `wait`, `false`, or a path.         |
| `wait`                                     | a verdict          | Returned by a guard that cannot decide yet - the router keeps its `loading` up and re-runs the guard when a declared state changes.        |
| `navigate(path, { replace?, external? })`  | -                  | Navigates programmatically; `replace` swaps the current history entry; `external` lets it leave for another site. Only http and https.     |
| `safeNext(value, fallback)`                | a path             | `value` when it is a path of the app, else `fallback`. Use it for a `?next=` value before you navigate.                                    |
| `useRoute()`                               | a read-only route  | The live `{ path, query, searchParams }` - `get`/`watch`/`text`/`view`/`each`, no `set`.                                                   |
| `crumbLabel(self, label)`                  | -                  | In a screen of a param node, names the crumb of that param, and so the title, with a string or a state.                                    |
| `url(path)`                                | a URL string       | An app-root path with `IMP_BASEPATH` prefixed, for an href you write as a string.                                                          |
| `screenRegion(self, element, { effect? })` | -                  | Names the box that scrolls the screens, so imp restores its scroll; `effect` animates a change of screen, see below.                       |
