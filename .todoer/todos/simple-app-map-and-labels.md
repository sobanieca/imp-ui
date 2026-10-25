Make the application map plain again, and let any component name a crumb through one state.

Today a crumb label comes from five places: a translation, a `label` function, a `label` string,
the matching `options` choice, then the name. `crumbLabel(self, label)` was removed because it
named only the innermost param, and its key did not have the parent params. This todo replaces
all of that with one global state keyed by URL path.

## The map

- `appMap()` takes only children and `description`. A string is the description of a node. An
  object holds the children and an optional `description`.
- Remove the props `label`, `access`, `nav`, `group` and `path`. Any key other than `description`
  is a child. A child value that is not a string, an object or a map throws.
- The index is the key `home`. A top-level `home` serves `/`. Its children hang from the root,
  as `path: '/'` does today.
- The label of a node is its translation `appMap.<id>.label`, then its name in sentence case.
- Keep `appMap(props, nodes)` for a map part, but `props` takes only `description`.

## The state `imp.labels`

- The router creates the global state `imp.labels`, as it creates `imp.route`. Its value is a
  plain object: URL path -> label, for example `{ '/checks/c42': 'Deploy to prod' }`.
- Any component writes to it with `useState(self, 'imp.labels')` and `set`:
  `labels.set((all) => ({ ...all, [app.checks.$checkId.href()]: check.title }))`.
- The key is the full path, so `/orgs/o1` and `/orgs/o1/projects/p1` are two keys. `/checks/c43`
  never shows the label of `/checks/c42`.
- The entries stay for the session. The router never clears them.
- A label is found in this order: the entry of `imp.labels` for the path, the translation
  `appMap.<id>.label`, the name of the node, and for a param the raw value.
- The same rule names a crumb, a nav row and the `crumbs` of `router({ title })`. A change of
  `imp.labels` updates the trail, the nav and `document.title` in place.
- No helper function. Plain state only.

## The bindings that leave the map

- `access`: `router({ access: guard, need: { [app.checks]: 'user' } })`. The guard gets the value
  of `need` of each node on the chain, as it gets the `access` value today. A node with no `need`
  is open.
- `nav: false`: `shell({ navbar: { map, hide: [app.start, app.join] } })`.
- `group`: `shell({ navbar: { map, groups: { Manage: [app.projects.$projectId.settings] } } })`.
- Remove `router({ options })` and the picker of a crumb. Remove the `option` argument of a label
  function, and the label function. Remove the message `imp.breadcrumbs.change` if nothing uses it.

## Places to change

- `lib/src/app-map.js`: the prop set, `createNode`, `nodeLabel`, `deriveNav`, the `home` index.
- `lib/src/router.js`: `imp.labels`, `need`, remove `options` and `readOptions`.
- `lib/src/std/shell/` (`shell.js`, `shell-props.js`, `shell.preview.js`): `hide` and `groups`.
- `lib/src/std/shell/breadcrumbs.js`: no picker from the router.
- `lib/src/analytics-aly.js`: check its use of the map.
- `cli/js/map-reader.js` and `imp map`: print the path, the label from the name and the
  description. No access, hidden or group.
- Tests: `lib/test/router.test.js`, `lib/test/i18n.test.js`, `lib/test/analytics.test.js`, and the
  fixtures in `cli/tests/fixtures/map/`, `cli/tests/fixtures/build/`, `cli/tests/fixtures/build-pwa/`.
- `examples/src/app-map.js`, `examples/src/app.js`, `perf/scenarios.js`, `perf/driver.spec.js`.
- Docs: `docs/routing.md`, `docs/i18n.md`, `docs/std-components.md`, `skills/routing.md`,
  `skills/i18n.md`, the breadcrumbs and shell skill files, `site/articles/routing.md`.
- ADRs: update `adr/application-map.md` (props, bindings, the label rule, the reason that
  `crumbLabel` and `options` went away) and `adr/route-guards.md` (`need`).
- `imp-init` scaffold: the `src/app-map.js` that `imp init` writes.

## Check

- `imp map` on the fixtures prints every node with its description and no other prop.
- A map with `label`, `access`, `nav`, `group` or `path` throws a message that names the new place.
- On `/checks/c42`, the crumb shows `c42`. After a screen sets `imp.labels['/checks/c42']`, the
  crumb, the nav and `document.title` show the new label without a navigation.
- On `/orgs/o1/projects/p1`, two entries give two different crumb labels.
- A translation `appMap.checks.label` names the `/checks` crumb and nav row. An `imp.labels`
  entry for `/checks` wins over it.
- All tests, lint and fmt pass.

## After this todo

Breaking change. Move the apps to the new map: Readyator `poc/` (~/code/readyator) and
~/code/imp-examples. Add a todo in each repo.
