# `imp preview` — component preview sandbox (Storybook-style)

Let a developer render a single component in **full isolation**, fed hand-written mocks, so it can
be built and eyeballed without booting the whole app. Same dev server as `imp start` — same
auto-injection, same browser console/network telemetry — but the served page mounts one component
from a **preview file** instead of the app entry, centered in a **resizable stage** with a live
**state editor**. This shortens the loop for building a component: edit the component, drag the
stage to any viewport size, poke its state by hand, see it react.

## The stage — centered, drag-resizable

The component mounts into a stage container centered in the page, not pinned to the top-left. The
stage has drag handles (edge/corner) so the developer can **resize the parent container by mouse or
touch drag** — the component re-lays-out live at every width/height, which is the fastest way to
find responsive breakpoints and overflow bugs without opening devtools device emulation. A small
readout shows the current stage dimensions, and preset sizes (phone / tablet / desktop) are a
convenience on top of free-drag. Reuse the existing drag/resize machinery in `cli/src/resize.js`
where it fits rather than hand-rolling pointer math.

## The preview file — `*.preview.js`

A component `my-component.js` gets an optional sibling `my-component.preview.js`. The preview file
is plain imp code that imports the **original component** and re-exports it wired to whatever stubs
make a given state reproducible. The headline capability is that a preview can **mock external
modules** the component imports — the same seam `imp test` already exposes — so a component with
hard dependencies (HTTP client, third-party libs) renders standalone with no backend:

```js
import { mockModule } from 'imp/preview'
import myComponent from './my-component.js'

mockModule('./http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk', done: false }]),
}))
mockModule('mitt', ({ orig }) => orig())

export const populated = myComponent()
```

- **Module mocking mirrors the test runner.** Reuse the `mockModule(specifier, factory)` mechanism
  from `cli/src/test.js` (the `imp-mock` esbuild namespace, `orig`/`spy` helpers, the same rule that
  a specifier must be a relative module or a vendored `imp.json` dependency). Surface it through an
  `imp/preview` entry so preview files and test files share one mocking model — a developer who
  knows one knows both. This is the "mock all external modules like the test runner" requirement.
- Each **named export** becomes a labeled panel on the page — the export name is the panel label —
  so the source of truth for what a scenario is called is the code, with no separate title metadata
  to keep in sync. There is no default export: a preview is always a set of named scenarios.
- The preview builds the component with imp's normal factory call, so a scenario is nothing more
  than "the component, pre-filled" — no framework-specific story DSL to learn. Because arguments
  dispatch by type (`adr/type-based-argument-dispatch.md`), a preview passes props, children, and
  text exactly the way real call sites do.
- Mocks are just objects/functions the developer writes — imp does not generate or record them. The
  preview owns its fixtures, which keeps them co-located with the component and reviewable in the
  same PR.

### Multiple states per preview

One component usually has several states worth previewing (empty, loading, error, populated). Each
gets its own named export:

```js
export const empty = myComponent()
export const loading = myComponent()
export const withError = myComponent()
```

imp renders each named export as a labeled panel — `empty`, `loading`, `withError` — so all states
are visible at once, each under its export name. Whether a scenario is an eager instance or a
`() => instance` factory (re-invoked on reload, cheaper for heavy setup) is an open question below.

## State editor — read state from the component, edit it live

The preview inspects the component to discover the state it manages and renders a **form** beside
the stage where the developer types state values by hand and watches the component update.

- **Discovery is best-effort static extraction — no lint rule.** imp scans the component source with
  a regular expression for `initState('<name>', <initial>)` and `useState('<name>')` calls (the two
  entry points in `lib/src/state.js`) and lists every state name it finds, seeding the form with the
  literal initial value from `initState` when it can be parsed. This deliberately does **not**
  introduce a lint rule constraining where `useState` / `initState` may appear — extraction is a
  convenience that degrades gracefully: if a state name is computed dynamically or hidden behind a
  helper the regex misses, the form simply won't list it, and the developer can still add a row by
  name manually. Best-effort, never a hard requirement on how components are written.
- **Editing drives the real state signals.** Because state is plain data
  (`adr/state-plain-data-values.md`) propagated by event (`adr/event-propagated-state.md`), the form
  writes edited values into the same state the component reads, so edits flow through imp's normal
  fine-grained update path — no re-mount. Values are entered as JSON so objects/arrays are editable,
  not just primitives.
- Each scenario panel gets its own state form scoped to that instance, so `empty` and `populated`
  can be poked independently on the same page.

## Discovery — reuse the file walker

Preview files are found with the same walker `imp test` and `imp lint` already use
(`cli/src/walk.js`): every `*.preview.js` under the project (respecting the same ignore rules) is a
preview target. This gives an **index page** listing all previews for free, and mirrors the
`*.test.js` / `*.spec.js` file-name-drives-behavior convention from `adr/two-level-testing.md`.
Explicit paths preview exactly those files; no argument previews the whole tree.

## Serving — same server as `imp start`

Build on the `imp start` internals rather than a second server, exactly the way `imp test`'s e2e
mode reuses them (`adr/two-level-testing.md`):

- Reuse `loadApp` / `createRequestHandler` (`cli/src/start.js`) so dependency resolution, the import
  map, the auto-injected client script, and browser console + network telemetry all work unchanged
  in a preview.
- Instead of serving a user `index.html`, imp **synthesizes the host HTML page**: a generated shell
  that imports the selected preview, mounts each exported scenario into its own labeled, centered,
  drag-resizable stage with an adjacent state-editor form, and renders through imp's real DOM path
  (`adr/real-dom-no-virtual-dom.md`). Extend `buildHeadInjection` so the generated shell gets the
  same head treatment as a normal entry.
- The generated shell resolves preview imports through the same `imp-mock` esbuild namespace
  `imp test` uses, so `mockModule` calls in the preview file rewrite the component's imports before
  it is served.
- Routes: `/` is the preview index (list of discovered previews), `/preview/<path>` renders one
  file's scenarios, and a query/segment can deep-link a single scenario. Live reload uses the same
  client channel `imp start` already opens, so saving the component or its preview refreshes the
  page.

## Theme and i18n controls

The whole point of rendering "proper HTML" through the real server is that cross-cutting concerns
render too. As those features land, the preview chrome grows controls that drive their signals:

- **Theme** — the theming engine has shipped (`adr/themable-by-default-tokens.md`), so a theme
  switcher in the preview chrome calls `applyTheme` with each discovered theme module, so a
  component can be checked under light, dark, and any custom theme from one page. This is a headline
  reason to render real HTML rather than a static snapshot. (Direction is deferred to i18n, below.)
- **i18n** — once `todo/i18n.md` ships, a locale switcher drives the `locale` signal so the same
  preview re-localizes live (the fine-grained no-re-render path), letting a developer verify every
  locale and catch layout breakage from long translations.

Keep both behind the same seam the theme/i18n work already uses, so `imp preview` ships before them
and gains the switchers when they arrive.

## Commands

- `imp preview [path]` — start the preview server. No path serves the preview index; a
  `*.preview.js` path (or a component path whose sibling preview is inferred) opens straight to it.
  `--port` like `imp start`.
- `imp preview --list` — print discovered previews (JSON with `--json`), mirroring
  `imp test --e2e --list`, useful for tooling and for confirming discovery.

## Capabilities summary

- Render one component in full isolation — no app boot, no backend.
- Mock any external module the component imports, reusing the test runner's `mockModule` seam.
- Centered stage the developer resizes by mouse/touch drag to test responsive behavior live.
- State editor beside the stage: state names extracted from the source (best-effort regex, no lint
  rule) and edited by hand, driving the component's real signals with no re-mount.
- Multiple named states per component, shown as labeled panels side by side.
- Auto-discovered index of every preview in the project.
- Real dev server: auto-injection, live reload, browser console + network telemetry in the terminal.
- Real HTML rendering, so theme (light/dark/RTL) and i18n (locale) can be toggled live once ready.
- A preview is just the component pre-filled with stubs — reviewable, co-located, no story DSL.

## Docs

Document the `*.preview.js` convention (named scenarios, each a labeled panel), module mocking via
`imp/preview`'s `mockModule`, the resizable stage, the state editor, the `imp preview` command
family, the preview index, and the theme/i18n switchers in `docs/cli.md`. Frame it for the reader as
"preview a component in isolation" — never mention Deno or internal server functions, per the
hide-Deno and docs rules in `CLAUDE.md`.

## ADR impact

Record a `component-preview.md` ADR: `*.preview.js` sibling files whose named exports are pre-built
component instances, each rendered as a labeled, drag-resizable stage under its export name; module
mocking reusing the test runner's `imp-mock` seam; a state editor seeded by best-effort regex
extraction of `initState` / `useState` names (explicitly no lint rule constraining where state is
declared); discovery via the shared file walker; and a synthesized host page served through the
reused `imp start` internals with theme/i18n switchers. Update the ADR table in `adr/README.md`.

## Open questions

- **Eager instance vs. factory export.** Should a scenario export a live instance or a
  `() => instance` re-invoked on reload? A factory re-runs setup (and mocks) per render — cleaner
  for stateful components — but changes the preview authoring shape.
- **State extraction accuracy.** The regex reads `initState` / `useState` string-literal names and
  the `initState` initial value. How far to push parsing initial values (nested objects, references)
  before falling back to a blank JSON field the developer fills in? Deliberately capped at
  best-effort since there is no lint rule guaranteeing state is declared where the regex can see it.
- **Editing non-serializable state.** JSON covers plain data (`adr/state-plain-data-values.md`), but
  how should the editor present or skip state whose value isn't JSON-round-trippable?
- **Preview location & naming.** Strictly a `*.preview.js` sibling, or also allow a `previews/`
  folder? Confirm the walker's ignore rules treat previews like tests.
- **Bundle interaction.** Should preview files be excludable from `imp build` output the way test
  files are, and is there value in a static "export the preview index as a page" mode for design
  review?
- **Mount/unmount lifecycle.** How scenarios are torn down on live reload so stubs with timers or
  subscriptions don't leak between renders.
