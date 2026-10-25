# One application map drives the router, the shell and the trail

## Context

An app kept four things in step by hand: the route table of `router`, the nav tree of `shell`, the
two `selected` states of the shell, and a breadcrumb list. Each one named the same features again,
with its own ids and its own paths. A rename of a path touched every one of them. A guard lived on
one route entry, and the nav did not know about it, so a section could show a row that its guard
would refuse. A screen that a section lacked was an empty column, not a stub.

The four had one source. Every one of them is a projection of the feature tree of the app, over the
current path. So imp gives that tree one home, as plain data, and derives the rest.

Two shapes were rejected. **Registration from a screen**, where a screen file calls a free `route()`
or `contribute()`, spreads the tree across the code and hides it behind import side effects, see
`client-side-router.md`. **A tree that carries its implementation**, where a node holds its
component and its icon, cannot load before the code of that screen arrives, and a CLI cannot read it
without a DOM.

## Decision

**An app describes its features once, in `app-map.js`, with `appMap()` from `imp`. The map is plain
data, and it says only what a feature is. The router, the shell and the breadcrumb trail derive from
it. Everything about how a feature is served or shown binds to the map later, from other files, by a
handle per node.**

- **The map is a nested object of nodes, with one prop.** A string is the description of a node. An
  object holds the children of a node and an optional `description`. A map is a part. Any key other
  than `description` is a child, and a child value that is not a string, an object or a map is an
  error at startup. The name of a node is its path segment in kebab case and its label in sentence
  case. A `$name` key is a param segment `:name`. The top-level key `home` is the index of the app:
  it serves `/`, and its children hang from the root URL, so the index can be the one section of an
  app. A `home` deeper in the tree, or inside a part, is an ordinary node. The order of the keys is
  the order of the nav, and the router matches static siblings before param siblings on its own.

- **The map holds no binding.** A node says what a feature is and where it sits. Who can open it,
  whether the nav shows it, the group of its row, a screen, a redirect, a tag and an icon are how
  the app serves and shows it. So they are bound outside the map, keyed by handle, at the router and
  at the shell. The rule keeps the map writable before any code exists, and readable by a CLI
  without a DOM. A key named `label`, `access`, `nav`, `group` or `path` is a child like any other,
  so `settings.access` can be a page. When its value is not a string, an object or a map, such as
  `nav: false`, the error names the binding to use. The map carries no `title` either. The title of the document depends
  on the screen, so it is a function of the router.

- **A param name is unique on its chain.** `params` and `imp.routeLabels` key a param by its name,
  so `/orgs/:id/teams/:id` cannot hold both values. `appMap()` throws when a param repeats the name
  of a param above it, and the message names both nodes. The check runs on every `appMap()` call,
  so it also covers a part that another call grafts. Two branches can share a name, because they
  are never on one chain. The lint rule `imp/app-map-unique-params` reports the inner key of a
  repeat in one object literal, before the app runs.

- **A map splits into parts.** `appMap(props, nodes)` builds a part: `props` takes the
  `description` of the node that the part hangs from, and nothing else. A map used as the value of a
  key is grafted at that key. Its nodes are reparented, and its handles stay the same objects, so
  `admin.users` and `app.admin.users` are one handle and both print the grafted pattern. A part
  goes into one map only, and a part cannot be passed to the router or the shell as the whole.

- **`appMap()` returns the handle tree.** `app.admin.users` is a frozen handle. It stringifies to
  its pattern, so a handle keys an object. `handle.href(params)` fills the pattern through `url()`,
  and it takes a missing param from the current route, so a link inside a tenant or a project does
  not repeat the param. `handle.spec` is the frozen node data, with its children as handles. A
  mistyped handle is `undefined`, its key is the string `"undefined"`, and the router rejects that
  key with a message that names the cause.

- **A binding is a value keyed by a handle, and it lives where the implementation lives.**
  `router({ map, screens })` binds a screen factory, an `area()` loader or a `redirect()` to a node.
  `router({ need })` binds the value that the guard reads. An area file exports
  `area({ screens, root, translations })`, and it binds only the node it hangs from and the
  descendants of that node. `shell({ navbar: { map, hide, groups, icons, tags } })` hides a node,
  titles a group of rows, and binds an icon and a pill per node at the root, because a section row
  renders before the chunk of its area loads. Nothing mutates the map.

- **A node with no screen renders a stub.** The stub is an `emptyState` with the label and the
  `description` of the node. A parent node with static children and no screen forwards to its first
  static child. A node bound to `redirect(handle)` forwards there, with the params of the route. So
  the whole map runs before one screen exists, in production too. The router logs the nodes that
  render a stub when it mounts.
- **A node that holds only params, and has no `description`, is a prefix.** `join: { $key: {} }`
  exists to give `/join/:key` its first segment. Its own URL renders `notFound`, and its crumb is
  text. A `description` marks a page that is still to come, and then the node renders a stub as
  before. So an app does not bind a `redirect` only to hide a stub.
- **`handle.href(params, { query, absolute })` builds every link.** A query is a plain object that
  imp encodes, and `absolute: true` adds the origin for a link that leaves the app in an email.

- **`access` is the one door.** `router({ need })` binds any value to a node, and one guard on the
  router, `router({ access })`, receives that value as `need`, beside the state values and
  `{ params, query, searchParams, path }`. Every `need` on the chain from the root to the matched
  node must allow. A node with no `need` is open, so a login page never loops. The verdicts, `wait`,
  the redirect path and `false`, keep the meaning of `route-guards.md`. There is no second guard
  form. A rule that `need` cannot express is a richer `need` value, not a different mechanism.

- **The label of a static node is a message, then the name.** The messages of the app translate a
  static node under `appMap.<id>.label` and `appMap.<id>.description`. A default message of a
  library counts as a message, so a tool that builds a map, such as `imp preview`, names its nodes
  with `defaultMessages`. The router reads the label where it derives the nav, the trail and the
  title, and the stub reads it through `lang`. So `app-map.js` never imports `t`, and `imp map`
  prints the map with no translation loaded. The keys must live in the translations of the app,
  because a section row renders before the chunk of its area arrives.

- **The label of a param crumb is the state `imp.routeLabels`.** The router creates it, as it
  creates `imp.route`, and provides it to the whole document, so `useState` finds it from any
  component. Its value is a plain object: param name with its `$` -> label. A component writes the
  keys that it knows, and there is no helper function. A param crumb takes its entry, then the
  `loader` while the screen loads, then the raw value. One source names a param crumb. A label
  function of the map needed data that only a screen loads, so an app kept a state for it anyway.
  A list of options at the router named a crumb and gave it a picker, but a picker lists only what
  the app already loaded. A state that the screen writes covers both cases with one rule, and the
  map stays plain data.

- **The router removes the labels that the route does not use.** On each route change, before the
  new screen runs `setup`, the router removes a key whose param is not on the new route, or whose
  value changed. So the state never grows over a session, and the crumb of `t2` never shows the name
  of `t1`. The removal runs before `setup`, so it never removes a label that the new screen wrote.
  An area root stays mounted across its child screens, so it writes the param that it owns once. In
  dev, the router warns about a key that names no param of the current route.

- **The router commits the trail when the screen settles.** A screen settles when its async `setup`
  resolves and every nested pending render is done, the same signal as the `readyView` of analytics.
  An error view also settles it. Until then, a param crumb with no entry shows the `loader`, and the
  router writes no title. So a crumb never shows the raw `t2` and then changes to its name, and
  `document.title` changes once per navigation. A write after the commit updates the crumb and the
  title in place. The screen calls no "ready" function, because a missing call would leave a crumb
  loading forever. The rule for an app is to write its labels before `setup` resolves.

- **The nav is a pure derivation, and the shell never computes it.** The router derives the
  sections, the rows of the current context, the selected ids, the label of the context and the
  crumbs, in one `computed` over the route, the language, the guard states, `imp.routeLabels` and
  the settle mark. It writes the result into two plain-data states that the map owns. The shell
  reads them through `navbar.map`, drops the nodes of `hide`, titles the rows of `groups`, adds the
  icons and the tags it holds, and keeps its one row renderer. The shell imports the map module, and
  nothing from the router.
  - The sections are the top-level nodes. The sidebar shows the static children of the current
    context, which is the deepest param node on the current chain, or else the current section.
    Static grandchildren are the one collapsible level. A key of `groups` titles the consecutive
    rows that it lists, and a key that the messages hold shows as that message. A hidden row is not
    drawn, and its page marks the nearest row above it.
  - A param node is a crumb, never a row.
  - When the nav has one section and that section has rows, the shell drops the bar and draws the
    sidebar-only layout. A bar with one item offers no choice. The rule reads the derived sections,
    so a `scope` with several sections inside a tenant keeps the bar, and a viewer whose `access`
    leaves one section gets the column.
  - Only an allow verdict shows a row. `wait` hides the row until the state arrives. The current
    chain stops at the first node that is not allowed, so a section is current only when the person
    is allowed inside.
  - `router({ title })` is a function of `{ crumbs, node, params }`, and the router writes its
    result to `document.title` when the trail commits, and again when a label changes. Without it,
    the router leaves the title alone.
  - The router writes the `description` of the matched node, translated, to
    `<meta name="description">` on every navigation. A page that has no description of its own, and
    a URL off the map, get the description of the HTML page back. When the HTML page has none, the
    router removes the tag. So a description never outlives its page. The router writes no other
    meta tag, see `client-rendered-only.md`.

- **A tenant is a scope of the router.** A multi-tenant URL, `/organizations/:org/...`, is a param
  node in the map, because a handle must print the real pattern. `router({ scope })` names that
  param node. Inside it, the sections are its static children and the trail starts with its crumb.
  Outside it, the sections are the top-level nodes. The map says nothing about tenancy, because the
  shape of the URL is a fact of the map and the meaning of that shape is a decision of the router.

- **The trail is chrome of the frame.** The shell renders `breadcrumbs` above the main content when
  a map is present, and `breadcrumbs: false` turns it off. The two-line phone title is the last two
  crumbs. A crumb that waits for its label shows a small `loader`. `breadcrumbs` stays an export of
  `imp/std/shell` for a frame that an app writes itself, and there a crumb takes `options`: a
  disclosure button beside the crumb opens an anchored panel of links.

- **The sign-in page is a node of the map.** The router has no default `need`, so the node is open,
  and every private section gets its own `need`. `navbar.hide` keeps the node off the nav. The guard redirects a visitor with no session
  to the sign-in node, and the router, the nav, `imp map`, `app-analytics.json` and analytics treat
  it as an ordinary page. `shell` shows it without the chrome, see `app-shell-component.md`.
  `userCard` in `extras` displays the person.

- **`imp map` prints the tree.** `imp.json` names the map file under `map`. The file imports
  `appMap` and its parts, so the CLI bundles it, runs it in its embedded QuickJS, with no DOM, and
  prints every node with its path, its label from its name and its description. `imp map <file>` prints a part on its own. `imp init`
  writes `src/app-map.js`, names it in `imp.json`, and writes a frame that binds the one screen it
  ships. `imp build` reads the same file and writes the pattern of every node to the `pages` of
  `app-analytics.json` in the output, for an analytics store, see `product-analytics.md`.

## Consequences

- The spec file reads as the feature list of the app. One line per feature. A rename of a path is
  one line, and every link, crumb, guard and binding follows through the handle.
- An app writes no route table, no nav tree, no selected id and no breadcrumb list. The frame has no
  account prop and no signed-in flag, and a nav beside a map takes no rows of its own.
- Which subtree loads lazily is an implementation decision, made in `screens`, not in the map. So
  the sidebar of a section renders before its chunk arrives, and only the screens arrive later.
- The nav of every section is rebuilt when the tree changes, which includes a change of a param,
  because every href carries the current params. A nav tree is small, and imp accepts the cost.
- The router pulls `emptyState` into every app that routes, for the stub. That is the price of a map
  that runs before a screen exists.
- The map cannot express a nav row that exists only at runtime. A list of runtime destinations is a
  screen of the app, such as a list of projects, or an `orgSelect` beside the logo. A nav row for an
  external link is not a node either. It is a row of `sidebar.footer` or DOM in `extras`.
- A screen that writes its label after `setup` resolves shows the raw value for a moment. The rule
  to write it before `setup` resolves is a convention that the router cannot check.
- A mistyped `description`, such as `descripton: 'Admin'`, is a child node, because a string value is
  a description. The map cannot tell a typo from a feature. `imp map` and the stub log at mount show
  the stray node.
