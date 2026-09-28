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

- **The map is a nested object of nodes.** A key whose value is a string, an object or another map
  is a child node. A string is the description of the node. A key from the reserved set of props
  (`path`, `label`, `description`, `access`, `nav`, `group`) is a prop of the node. Any other key
  with any other value is an error at startup. The name of a node is its path segment in kebab case
  and its label in sentence case, until `path` or `label` overrides one. A `$name` key is a param
  segment `:name`. `path: '/'` marks the index of the app, on one top-level node only, and the
  children of the index node hang from the root URL, so the index can be the one section of an app.
  `nav: false` hides a static node from the nav. The order of the keys is the order of the nav, and
  the router matches static siblings before param siblings on its own.

- **The map holds no binding.** The set of props is the set that describes a feature: what it is
  called, what it does, who it is for, where it sits. A screen, a redirect, the choices of a param,
  a tag and an icon are not properties of a feature. They are how the app serves and shows it, so
  they are bound outside the map, keyed by handle, at the router and at the shell. The rule keeps
  the map writable before any code exists, and readable by a CLI without a DOM. The map carries no
  `title` either. The title of the document depends on the screen, so it is a function of the
  router.

- **A map splits into parts.** `appMap(props, nodes)` builds a part: `props` are the props of the
  node that the part hangs from. A map used as the value of a key is grafted at that key. Its nodes
  are reparented, and its handles stay the same objects, so `admin.users` and `app.admin.users` are
  one handle and both print the grafted pattern. A part goes into one map only, and a part cannot be
  passed to the router or the shell as the whole. A `path: '/'` inside a part is an error.

- **`appMap()` returns the handle tree.** `app.admin.users` is a frozen handle. It stringifies to
  its pattern, so a handle keys an object. `handle.href(params)` fills the pattern through `url()`,
  and it takes a missing param from the current route, so a link inside a tenant or a project does
  not repeat the param. `handle.spec` is the frozen node data, with its children as handles. A
  mistyped handle is `undefined`, its key is the string `"undefined"`, and the router rejects that
  key with a message that names the cause.

- **A binding is a value keyed by a handle, and it lives where the implementation lives.**
  `router({ map, screens })` binds a screen factory, an `area()` loader or a `redirect()` to a node.
  `router({ options })` binds the choices of a param node: a state name, or a list. An area file
  exports `area({ screens, root, translations })`, and it binds only the node it hangs from and the
  descendants of that node. `shell({ navbar: { map, icons, tags } })` binds an icon and a pill per
  node at the root, because a section row renders before the chunk of its area loads. Nothing
  mutates the map, and nothing registers through a global.

- **A node with no screen renders a stub.** The stub is an `emptyState` with the label and the
  `description` of the node. A parent node with static children and no screen forwards to its first
  static child. A node bound to `redirect(handle)` forwards there, with the params of the route. So
  the whole map runs before one screen exists, in production too. The router logs the nodes that
  render a stub when it mounts.

- **`access` is the one door.** A node carries any `access` value, and one guard on the router,
  `router({ access })`, receives that value as `need`, beside the state values and
  `{ params, query, searchParams, path }`. Every `access` on the chain from the root to the matched
  node must allow. A node with no `access` is open, so a login page never loops. The verdicts,
  `wait`, the redirect path and `false`, keep the meaning of `route-guards.md`. There is no second
  guard form. A rule that `access` cannot express is a richer `access` value, not a different
  mechanism.

- **A translation is a message, keyed by the id of the node.** The messages of the app translate a
  node under `appMap.<id>.label`, `appMap.<id>.group` and `appMap.<id>.description`. A message wins
  over the prop and over the name. The router reads it where it derives the nav, the trail and the
  title, and the stub reads it through `lang`. So `app-map.js` never imports `t`, and `imp map`
  prints the map with no translation loaded. The keys must live in the translations of the app,
  because a section row renders before the chunk of its area arrives. A `label` function stays for a
  value that comes from the route, such as the name of a repository.

- **The nav is a pure derivation, and the shell never computes it.** The router derives the
  sections, the rows of the current context, the selected ids, the label of the context and the
  crumbs, in one `computed` over the route, the language, the guard states and the states that
  `options` names. It writes the result into two plain-data states that the map owns. The shell
  reads them through `navbar.map`, adds the icons and the tags it holds, and keeps its one row
  renderer. The shell imports the map module, and nothing from the router.
  - The sections are the top-level nodes. The sidebar shows the static children of the current
    context, which is the deepest param node on the current chain, or else the current section.
    Static grandchildren are the one collapsible level. `group` groups consecutive rows.
  - A param node is a crumb, never a row.
  - When the nav has one section and that section has rows, the shell drops the bar and draws the
    sidebar-only layout. A bar with one item offers no choice. The rule reads the derived sections,
    so a `scope` with several sections inside a tenant keeps the bar, and a viewer whose `access`
    leaves one section gets the column.
  - A crumb label is the message of the node, then its `label`, then the label of the matching
    option, then the raw param value. A crumb whose param has bound `options` gets a picker. The
    picker keeps the static tail of the path and drops what follows the next param.
  - Only an allow verdict shows a row. `wait` hides the row until the state arrives. The current
    chain stops at the first node that is not allowed, so a section is current only when the person
    is allowed inside.
  - `router({ title })` is a function of `{ crumbs, node, params }`, and the router writes its
    result to `document.title` on every navigation. Without it, the router leaves the title alone.
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
  crumbs. `breadcrumbs` stays an export of `imp/std/shell` for a frame that an app writes itself,
  and a crumb takes `options`: a disclosure button beside the crumb opens an anchored panel of
  links.

- **Authentication is outside the shell.** The frame does not know who is signed in. `userCard` owns
  both halves of that story through its own `signedIn` prop, and an app puts it in `extras`. Whether
  a signed-out visitor sees a section is the decision of `access`.

- **`imp map` prints the tree.** `imp.json` names the map file under `map`. The file imports
  `appMap` and its parts, so the CLI bundles it, runs it in the test DOM, and prints every node with
  its path, label, access and description. `imp map <file>` prints a part on its own. `imp init`
  writes `src/app-map.js`, names it in `imp.json`, and writes a frame that binds the one screen it
  ships.

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
- The map cannot express a nav row that exists only at runtime. A list of runtime destinations is
  the `options` of a param node, and it reaches the trail as a picker, not the sidebar as rows. A
  nav row for an external link is not a node either. It is a row of `sidebar.footer` or DOM in
  `extras`.
- A mistyped prop with a string value, such as `lable: 'Admin'`, is a child node, because a string
  value is a description. The map cannot tell a typo from a feature. `imp map` and the stub log at
  mount show the stray node.
- The picker on a phone is not in the folded title. The strip hides below the fold, and the sidebar
  head names the context without a picker. Both are open to extension, and neither blocks an app.
