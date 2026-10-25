Make the application map plain again, and let any component name a param crumb through one state.

Today a crumb label comes from five places: a translation, a `label` function, a `label` string,
the matching `options` choice, then the name. This todo replaces all of that with one global state
`imp.routeLabels`, keyed by param name.

## The map

- `appMap()` takes only children and `description`. A string is the description of a node. An
  object holds the children and an optional `description`.
- Remove the props `label`, `access`, `nav`, `group` and `path`. Any key other than `description`
  is a child. A child value that is not a string, an object or a map throws.
- The index is the key `home`. A top-level `home` serves `/`. Its children hang from the root,
  as `path: '/'` does today.
- The label of a static node is its translation `appMap.<id>.label`, then its name in sentence
  case.
- Keep `appMap(props, nodes)` for a map part, but `props` takes only `description`.

### A param name is unique on one chain

- A key of `imp.routeLabels` names a param, so one chain must not hold two params with the same
  name. `/orgs/:id/teams/:id` is an error. Today the two values also collide in `params`.
- `appMap()` throws when a param repeats the name of a param above it. The message names both
  nodes. This check also covers a map part that `appMap(props, nodes)` grafts.
- Two branches can use the same name. `$orgId` under `orgs` and `$orgId` under `admin.orgs` are
  never on one chain.
- Add the lint rule `imp/app-map-unique-params` to the recommended set of `imp lint`. It reads
  the object literal of an `appMap()` call from `imp`, and reports a `$name` key that repeats a
  `$name` key above it in the same literal. The error is on the inner key. The runtime check
  covers a map that the rule cannot see, such as a part from another file.

## The state `imp.routeLabels`

- The router creates the global state `imp.routeLabels`, as it creates `imp.route`. Its value is
  a plain object: param name -> label, for example
  `{ $orgId: 'Moja Organizacja', $teamId: 'Druzyna A' }`.
- The key is the param name with its `$`, as in the map. `params.teamId` and `$teamId` name the
  same param.
- Any component writes only the keys that it knows:
  `useState(self, 'imp.routeLabels').set((all) => ({ ...all, $teamId: team.name }))`.
- A label of a param crumb is found in this order: the entry of `imp.routeLabels`, the shared
  `loader` while the screen loads, then the raw value.
- A static node has no entry. Its label comes from the translation, then the name.
- The same rule names a crumb and the `crumbs` of `router({ title })`.
- In dev, the router logs a warning for a key that names no param of the current route. The
  warning names the key and the route.
- No helper function. Plain state only.

### The router removes the keys that the route does not use

- The state must not grow over a session.
- On each route change, before the new screen runs `setup`, the router removes a key when:
  - its param is not on the new route, or
  - the value of its param changed.
- From `/orgs/o1/teams/t1` to `/orgs/o1/teams/t2`, `$orgId` stays and `$teamId` goes. So the
  crumb of `t2` never shows the name of `t1`.
- From `/orgs/o1/teams/t1` to `/orgs/o1/settings`, `$orgId` stays and `$teamId` goes.
- The removal runs before `setup` of the new screen, so it never removes a label that the new
  screen wrote.

### No flicker: the router waits for the screen to settle

- A crumb must not show the raw `t2` and then change to `Druzyna B`.
- The screen does not call a "ready" function. A missing call would leave the crumb loading
  forever. The router uses the signal that it already has: the screen settles when its async
  `setup` resolves and every nested pending render is done (`screenRendered`, the same signal as
  `readyView` of analytics). An error view also settles the screen.
- The rule for an app: write the labels before `setup` resolves.

```js
setup: async (self, { teamId }) => {
  const team = await useHttpClient(self, 'myapp.api').get(`/teams/${teamId}`)
  useState(self, 'imp.routeLabels').set((all) => ({ ...all, $teamId: team.name }))
  return teamView(team)
}
```

- A navigation goes in three steps:
  1. At once, the trail shows the new chain. A static crumb shows its label. A param crumb with
     no entry shows the shared `loader`, never the raw value.
  2. When the screen settles, the router commits the trail. A param crumb takes its entry, or the
     raw value when it has no entry. The router writes `document.title` once.
  3. After the commit, a write to `imp.routeLabels` updates the crumb and `document.title` in
     place. This covers a rename, and a screen that loads its data in a child after `setup`.
- An area root, such as the layout of `/orgs/:orgId`, stays mounted across its child screens. It
  writes `$orgId`, and its child screens write only their own params.

## The bindings that leave the map

- `access`: `router({ access: guard, need: { [app.checks]: 'user' } })`. The guard gets the value
  of `need` of each node on the chain, as it gets the `access` value today. A node with no `need`
  is open.
- `nav: false`: `shell({ navbar: { map, hide: [app.start, app.join] } })`.
- `group`: `shell({ navbar: { map, groups: { Manage: [app.projects.$projectId.settings] } } })`.
- Remove `router({ options })` and the picker of a crumb. Remove the `option` argument of a label
  function, and the label function. Remove the message `imp.breadcrumbs.change` if nothing uses it.

## Places to change

- `lib/src/app-map.js`: the prop set, `createNode`, `nodeLabel`, `deriveNav`, the `home` index,
  the unique param check.
- `lib/src/router.js`: `imp.routeLabels`, the removal on a route change, the commit on settle, the
  dev warning, `need`, remove `options` and `readOptions`.
- `lib/src/std/shell/` (`shell.js`, `shell-props.js`, `shell.preview.js`): `hide` and `groups`.
- `lib/src/std/shell/breadcrumbs.js`: no picker from the router, the `loader` of a crumb that
  waits for its label.
- `lib/src/analytics-aly.js`: check its use of the map.
- `cli/src/lint-rules.rs`: the rule `imp/app-map-unique-params`, with its test in
  `cli/tests/commands.rs`.
- `cli/js/map-reader.js` and `imp map`: print the path, the label from the name and the
  description. No access, hidden or group.
- Tests: `lib/test/router.test.js`, `lib/test/i18n.test.js`, `lib/test/analytics.test.js`, and the
  fixtures in `cli/tests/fixtures/map/`, `cli/tests/fixtures/build/`, `cli/tests/fixtures/build-pwa/`.
- `examples/src/app-map.js`, `examples/src/app.js`, `perf/scenarios.js`, `perf/driver.spec.js`.
- Docs: `docs/routing.md`, `docs/i18n.md`, `docs/std-components.md`, `docs/lint.md`,
  `skills/routing.md`, `skills/i18n.md`, `skills/lint.md`, the breadcrumbs and shell skill files,
  `site/articles/routing.md`. The routing skill states the rule: write the labels before `setup`
  resolves.
- ADRs: update `adr/application-map.md` (props, bindings, the label rule, the unique param names,
  the removal, the commit on settle, the reason that `crumbLabel` and `options` went away) and
  `adr/route-guards.md` (`need`).
- `imp-init` scaffold: the `src/app-map.js` that `imp init` writes.

## Check

- `imp map` on the fixtures prints every node with its description and no other prop.
- A map with `label`, `access`, `nav`, `group` or `path` throws a message that names the new place.
- A map with `$id` under `$id` throws, also when the inner one comes from a grafted part.
  `imp lint` reports the inner key of the same map as `imp/app-map-unique-params`.
- A screen with an async `setup` sets `$teamId`. During the load, the crumb shows the `loader`.
  After the settle, it shows the label. The crumb never shows the raw value.
- A screen that sets no label: after the settle, the crumb shows the raw value.
- A write after the settle updates the crumb and `document.title` without a navigation.
- `document.title` changes once per navigation for a screen that sets its label in `setup`.
- `/orgs/o1/teams/t1` -> `/orgs/o1/teams/t2`: `$orgId` stays, `$teamId` goes, and the `t2` crumb
  shows the `loader` until the new screen sets it.
- `/orgs/o1/teams/t1` -> `/orgs/o1/settings`: the state holds `$orgId` only.
- A key such as `$tamId` logs the dev warning.
- A translation `appMap.checks.label` names the `/checks` crumb and nav row.
- All tests, lint and fmt pass.

## After this todo

Breaking change. Move the apps to the new map: Readyator `poc/` (~/code/readyator) and
~/code/imp-examples. Add a todo in each repo.
