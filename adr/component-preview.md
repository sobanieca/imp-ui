# Component preview — `*.preview.js` scenarios served on a synthesized page

## Context

Building a component inside a running app is a slow loop: reach the screen that renders it, get the
data into the state it should show, and resize the browser to check the layout. Component
workbenches solve this, but the usual ones bring a story DSL, a second build pipeline, and a config
surface — none of which fit imp's buildless dev server, its type-dispatched call sites
(`type-based-argument-dispatch.md`), or its "no framework-specific ceremony" stance. imp already had
the two hard pieces: a dev server with auto-injection and telemetry (`imp start`) and a
module-mocking seam in the test bundler (`two-level-testing.md`).

## Decision

`imp preview` serves each `*.preview.js` file as its own generated page, reusing the `imp start`
internals (`loadApp` / `createRequestHandler`, head injection, live reload, console and network
telemetry) instead of a second server. Discovery uses the shared file walker, so a preview file is
found the way a test file is.

- **A preview file is plain imp code; every named export is a scenario.** The export name is the
  panel label, so the name of a scenario lives only in the code. A scenario is the component built
  with its normal factory call — props, children, and text pass exactly as at a real call site — so
  there is no story format. There is no default export. An export may be an instance or a **function
  returning one**, which imp calls when it renders the panel; the function form exists for scenarios
  whose setup should run at render time. Panels are ordered by the order the exports are written in
  the file, falling back to module order for exports the scanner does not recognize.
- **Module mocking reuses the test runner's seam.** `mockModule(specifier, factory)` is imported
  from `imp/preview` and behaves as in `imp test`: the same `imp-mock` esbuild namespace, the same
  `orig`/`spy` helpers, the same rule that a specifier is a relative module or a vendored `imp.json`
  dependency. The scanning, mock generation, and resolver plugin live in one shared module
  (`cli/src/bundling.js`) used by both commands, so a developer who knows one knows the other. A
  mock is per file, not per scenario.
- **The page is one bundle, not the app's module graph.** A generated entry module imports the
  preview file and the preview chrome and is bundled by esbuild with the imp library inlined, so the
  mocked module graph is what the browser loads and there is exactly one instance of the library
  behind the component, the chrome, and any mock. Bundles are cached per file and dropped on any
  file change, which the existing watcher already reports as a reload.
- **Each scenario renders into a drag-resizable stage.** The stage is resized by dragging its right,
  bottom, or corner handle with pointer events (mouse and touch), with a live size readout and
  phone/tablet/desktop presets on top of free dragging. Resizing changes the parent box only, so the
  component re-lays-out through the real DOM path (`real-dom-no-virtual-dom.md`).
- **The state editor is best-effort static extraction with no lint rule.** imp scans the preview
  file and the relative modules it reaches for `initState` / `useState` calls, taking the state name
  from the string literal and, for `initState`, the initial value when it parses as JSON. Nothing
  constrains where state may be declared: a name the scanner misses is simply not listed. At runtime
  the editor resolves each name against the scenario's own instance through the state subscription
  event, so panels on one page are independent, and edits go through `set`, driving imp's normal
  fine-grained update path with no re-mount. Values are edited as JSON
  (`state-plain-data-values.md`); a value that is not JSON-representable is shown read-only.
- **Chrome controls drive real signals.** A theme switcher calls `applyTheme` with imp's built-in
  themes (`themable-by-default-tokens.md`), so a component is checked light and dark from one page;
  the selection is remembered in the browser. A project's own themes join the same switcher through
  `preview.themes` in `imp.json`: each listed module is imported by the generated entry and its
  default export is passed to `applyTheme` as an object, so a theme file stays an ordinary module
  with nothing preview-specific in it and needs no name registry. Project themes are listed before
  the built-ins and the first is applied by default, so a preview opens in the app's own skin. The
  same seam is where a locale switcher goes when i18n lands.
- **Routes:** `/` is the generated index of discovered previews, `/preview/<path>` renders one
  file's scenarios, `?scenario=<name>` isolates one, and `/@imp/preview/<path>` serves that file's
  bundle. A build failure is served as a module that renders the error into the page and is also
  logged to the terminal. The preview server does not fall back to the app's `index.html` for
  unknown routes.
- **`imp preview [path]`** with no path serves everything; a `*.preview.js` path, a component path
  whose sibling preview is inferred, or a folder narrows it. `--list` prints what was discovered
  (`--json` for tooling), `--port` defaults to 4517 so a preview server and `imp start` can run side
  by side, and `preview.exclude` in `imp.json` keeps folders out of discovery. A `preview.themes`
  path that resolves to no file fails the command at startup rather than degrading silently.

## Consequences

Previewing a component costs one sibling file and no configuration, and the fixtures a scenario
needs are reviewed in the same diff as the component. Because the page is real HTML served by the
real dev server, cross-cutting concerns — theming today, i18n later — are exercised rather than
approximated.

Preview pages are bundled while the rest of development stays buildless: a preview page reflects a
file change only after its bundle is rebuilt, which happens on the reload the watcher already
triggers. Because the bundle inlines the library, a preview page does not share module instances
with anything served outside it.

Scenario isolation stops at the module graph: mocks are per file, so two scenarios needing different
mocked data must differ by their arguments or live in separate preview files. Teardown between
renders is the page reload — scenarios are never unmounted and re-mounted in place, so a stub
holding timers or subscriptions cannot leak between renders.

State discovery is a convenience with no guarantee: dynamic or indirected state names do not appear
in the editor, and an initial value that is not a JSON literal is left blank until the running
component provides one. This is deliberate — the alternative was a lint rule constraining where
`initState` and `useState` may be written, which would trade a working editor row for a restriction
on every component.
