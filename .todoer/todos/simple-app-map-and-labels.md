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
- A label is found in this order: the entry of `imp.labels` for the path, the translation
  `appMap.<id>.label`, the name of the node, and for a param the raw value.
- The same rule names a crumb, a nav row and the `crumbs` of `router({ title })`.
- No helper function. Plain state only.

### The state holds only the current chain

- The state must not grow over a session. When the router commits a trail (see below), it writes
  `imp.labels` again with only the entries whose key is a path on the current chain.
- So the state never holds more entries than the current URL has segments.
- From `/orgs/o1/projects/p1` to `/orgs/o1/settings`, the entry `/orgs/o1` stays and
  `/orgs/o1/projects/p1` goes.
- An entry for a path off the chain shows nowhere. The next commit removes it.

### No flicker: the router waits for the screen to settle

- A crumb must not show the raw `c42` and then change to `Deploy to prod`.
- The screen does not call a "ready" function. A missing call would leave the crumb loading
  forever. The router uses the signal that it already has: the screen settles when its async
  `setup` resolves and every nested pending render is done (`screenRendered`, the same signal as
  `readyView` of analytics). An error view also settles the screen.
- The rule for an app: write the labels before `setup` resolves.

```js
setup: async (self) => {
  const check = await http.get(`/api/checks/${params.checkId}`)
  useState(self, 'imp.labels').set((all) => ({
    ...all,
    [app.checks.$checkId.href(params)]: check.title,
  }))
  return checkView(check)
}
```

- A navigation goes in three steps:
  1. At once, the trail shows the new chain. A static crumb shows its label. A param crumb with
     no entry in `imp.labels` shows the shared `loader`, never the raw value.
  2. When the screen settles, the router commits the trail. A param crumb takes its entry, or the
     raw value when it has no entry. The router writes `document.title` once, and prunes
     `imp.labels` to the chain.
  3. After the commit, a write to `imp.labels` for a path on the chain updates the crumb, the nav
     and `document.title` in place. This covers a screen that loads its data in a child, after
     `setup`.
- An area root, such as the layout of `/orgs/:orgId`, stays mounted across its child screens. It
  writes the label of its own param, and that entry stays while the chain holds it.

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
- `lib/src/router.js`: `imp.labels`, the commit on settle, the prune, `need`, remove `options` and
  `readOptions`.
- `lib/src/std/shell/` (`shell.js`, `shell-props.js`, `shell.preview.js`): `hide` and `groups`.
- `lib/src/std/shell/breadcrumbs.js`: no picker from the router, the `loader` of a crumb that
  waits for its label.
- `lib/src/analytics-aly.js`: check its use of the map.
- `cli/js/map-reader.js` and `imp map`: print the path, the label from the name and the
  description. No access, hidden or group.
- Tests: `lib/test/router.test.js`, `lib/test/i18n.test.js`, `lib/test/analytics.test.js`, and the
  fixtures in `cli/tests/fixtures/map/`, `cli/tests/fixtures/build/`, `cli/tests/fixtures/build-pwa/`.
- `examples/src/app-map.js`, `examples/src/app.js`, `perf/scenarios.js`, `perf/driver.spec.js`.
- Docs: `docs/routing.md`, `docs/i18n.md`, `docs/std-components.md`, `skills/routing.md`,
  `skills/i18n.md`, the breadcrumbs and shell skill files, `site/articles/routing.md`. The skill
  states the rule: write the labels before `setup` resolves.
- ADRs: update `adr/application-map.md` (props, bindings, the label rule, the commit on settle,
  the prune, the reason that `crumbLabel` and `options` went away) and `adr/route-guards.md`
  (`need`).
- `imp-init` scaffold: the `src/app-map.js` that `imp init` writes.

## Check

- `imp map` on the fixtures prints every node with its description and no other prop.
- A map with `label`, `access`, `nav`, `group` or `path` throws a message that names the new place.
- A screen with an async `setup` sets `imp.labels['/checks/c42']`. During the load, the crumb
  shows the `loader`. After the settle, it shows the label. The crumb never shows `c42`.
- A screen that sets no label: after the settle, the crumb shows `c42`.
- A write after the settle updates the crumb, the nav and `document.title` without a navigation.
- `document.title` changes once per navigation for a screen that sets its label in `setup`.
- On `/orgs/o1/projects/p1`, two entries give two different crumb labels.
- After `/orgs/o1/projects/p1` -> `/orgs/o1/settings`, `imp.labels` holds `/orgs/o1` only. After
  ten navigations, it holds no more entries than the chain has segments.
- A translation `appMap.checks.label` names the `/checks` crumb and nav row. An `imp.labels`
  entry for `/checks` wins over it.
- All tests, lint and fmt pass.

## After this todo

Breaking change. Move the apps to the new map: Readyator `poc/` (~/code/readyator) and
~/code/imp-examples. Add a todo in each repo.
