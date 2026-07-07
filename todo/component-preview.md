# `imp preview` — component preview sandbox (Storybook-style)

Let a developer render a single component in isolation, fed hand-written mocks, so its display
states can be built and eyeballed without booting the whole app. Same dev server as `imp start` —
same auto-injection, same browser console/network telemetry — but the served page mounts one
component from a **preview file** instead of the app entry. This shortens the loop for building a
component: edit the component, edit its mocks, see every state side by side.

## The preview file — `*.preview.js`

A component `my-component.js` gets an optional sibling `my-component.preview.js`. The preview file
is plain imp code that exports one or more **named scenarios** — each a fully constructed component
instance wired to whatever stubs make that state reproducible:

```js
import myComponent from './my-component.js'

const mockedApiClient = {
  fetchTodos: async () => [{ id: 1, title: 'Buy milk', done: false }],
}

export const populated = myComponent({ apiClient: mockedApiClient })
```

Each **named export** becomes a labeled panel on the page — the export name is the panel label — so
the source of truth for what a scenario is called is the code, with no separate title metadata to
keep in sync. There is no default export: a preview is always a set of named scenarios.

- The preview builds the component with imp's normal factory call, so it is nothing more than "the
  component, pre-filled" — no framework-specific story DSL to learn. Because arguments dispatch by
  type (`adr/type-based-argument-dispatch.md`), a preview passes props, children, and text exactly
  the way real call sites do.
- Mocks are just objects/functions the developer writes — imp does not generate or record them. The
  preview owns its fixtures, which keeps them co-located with the component and reviewable in the
  same PR.

### Multiple states per preview

One component usually has several states worth previewing (empty, loading, error, populated). Each
gets its own named export:

```js
export const empty = myComponent({ apiClient: emptyClient })
export const loading = myComponent({ apiClient: neverResolvingClient })
export const withError = myComponent({ apiClient: failingClient })
```

imp renders each named export as a labeled panel — `empty`, `loading`, `withError` — so all states
are visible at once, each under its export name. Whether a scenario is an eager instance or a
`() => instance` factory (re-invoked on reload, cheaper for heavy setup) is an open question below.

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
  that imports the selected preview, mounts each exported scenario into its own labeled container,
  and renders through imp's real DOM path (`adr/real-dom-no-virtual-dom.md`). Extend
  `buildHeadInjection` so the generated shell gets the same head treatment as a normal entry.
- Routes: `/` is the preview index (list of discovered previews), `/preview/<path>` renders one
  file's scenarios, and a query/segment can deep-link a single scenario. Live reload uses the same
  client channel `imp start` already opens, so saving the component or its preview refreshes the
  page.

## Theme and i18n controls

The whole point of rendering "proper HTML" through the real server is that cross-cutting concerns
render too. As those features land, the preview chrome grows controls that drive their signals:

- **Theme** — once `todo/theme-styling.md` ships, a theme/mode/direction switcher in the preview
  chrome calls `setTheme` / `setMode` / `setDirection`, so a component can be checked in light,
  dark, and RTL from one page. This is a headline reason to render real HTML rather than a static
  snapshot.
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

- Render one component in isolation with developer-authored mocks — no app boot, no backend.
- Multiple named states per component, shown as labeled panels side by side.
- Auto-discovered index of every preview in the project.
- Real dev server: auto-injection, live reload, browser console + network telemetry in the terminal.
- Real HTML rendering, so theme (light/dark/RTL) and i18n (locale) can be toggled live once ready.
- A preview is just the component pre-filled with stubs — reviewable, co-located, no story DSL.

## Docs

Document the `*.preview.js` convention (named scenarios, each a labeled panel), the `imp preview`
command family, the preview index, and the theme/i18n switchers in `docs/cli.md`. Frame it for the
reader as "preview a component in isolation" — never mention Deno or internal server functions, per
the hide-Deno and docs rules in `CLAUDE.md`.

## ADR impact

Record a `component-preview.md` ADR: `*.preview.js` sibling files whose named exports are pre-built
component instances, each rendered as a labeled panel under its export name, discovery via the
shared file walker, and a synthesized host page served through the reused `imp start` internals with
theme/i18n switchers. Update the ADR table in `adr/README.md`.

## Open questions

- **Eager instance vs. factory export.** Should a scenario export a live instance or a
  `() => instance` re-invoked on reload? A factory re-runs setup (and mocks) per render — cleaner
  for stateful components — but changes the preview authoring shape.
- **Interaction / args controls.** Storybook exposes live "controls" to tweak props from the UI. Out
  of scope initially (a preview re-edit covers it), or a lightweight knobs layer later?
- **Preview location & naming.** Strictly a `*.preview.js` sibling, or also allow a `previews/`
  folder? Confirm the walker's ignore rules treat previews like tests.
- **Bundle interaction.** Should preview files be excludable from `imp bundle` output the way test
  files are, and is there value in a static "export the preview index as a page" mode for design
  review?
- **Mount/unmount lifecycle.** How scenarios are torn down on live reload so stubs with timers or
  subscriptions don't leak between renders.
