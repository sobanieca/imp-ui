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
- **Each scenario is a two-tab panel: Preview and Code.** Preview holds a drag-resizable stage with
  the state editor beside it; Code holds the call that built the scenario. The stage is resized by
  dragging its right, bottom, or corner handle with pointer events (mouse and touch), with a live
  size readout and phone/tablet/desktop presets on top of free dragging. Resizing changes the parent
  box only, so the component re-lays-out through the real DOM path (`real-dom-no-virtual-dom.md`).
- **The code shown is sliced out of the preview file at bundle time, not described by hand.** The
  same balanced, comment- and string-aware scanner that orders the exports also records each
  export's initializer and the file's import statements, and both travel to the browser in the
  generated entry's metadata alongside the scenario order and state declarations. A scenario's
  snippet is therefore the code that ran, and the reload that rebuilds a bundle rebuilds it. Only
  `export const name = …` forms carry a slice; a name arriving through `export { … }` is listed
  without one and its tab says so.
- **The snippet is highlighted by a JavaScript tokenizer imp ships itself, painted in theme
  tokens.** A preview only ever shows JavaScript, so a small hand-written tokenizer covering
  comments, strings and template interpolations, regular expressions, numbers, keywords and
  punctuation buys the whole feature without pulling a highlighting library into the binary and into
  every preview bundle. Its spans are coloured from `--imp-color-primary`, `--imp-color-danger` and
  `--imp-color-secondary` rather than a fixed palette, so highlighting inherits every theme's
  contrast guarantees instead of making its own, and keyword weight and comment italics carry the
  same distinctions where colour is forced away.
- **The preview page is an imp app built from `imp/std`.** Its toolbar, tabs, stage, state editor
  and code panel are `component()`s reading the same `--imp-*` tokens as the library
  (`themable-by-default-tokens.md`), so the theme switcher re-skins the page along with the specimen
  and any theme that fails here fails in an app for the same reason. Two consequences fall out of
  `shadow-dom-isolation.md` and are the reason the page is shaped this way: content handed to a
  standard component is moved into **that** component's shadow root, so the page's stylesheet cannot
  reach it — the stage, editor and code panel are therefore components carrying their own styles,
  sizing themselves through `:host` rather than being sized by their parent. Direction stays the
  exception below: it is the one signal the page does not share with what it shows.
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
  the built-ins and the first is applied by default, so a preview opens in the app's own skin. A
  project theme is layered over the built-in matching its `colorScheme` rather than applied alone,
  because `applyTheme` writes only the tokens a theme names: a partial theme would otherwise leave
  the rest at whatever the previous selection set, and now that the page wears the theme too, that
  showed up as a half-styled workbench rather than only a half-styled component.
- **Language and direction are chrome controls on the same seam.** A language picker calls `setLang`
  and a direction picker writes `<html dir>` (`translatable-by-default.md`), so a component is
  checked in another language, and right to left, without editing code; both selections are
  remembered like the theme. The languages offered are the ones the project lists in
  `preview.translations` — a code-to-file map, imported by the generated entry and handed to `init`
  as loaders, so a translations file stays an ordinary module; a project that lists none gets no
  language picker, since imp has no languages of its own to offer (`translatable-by-default.md`).
  The direction picker offers `auto`, which re-derives from the language, alongside `ltr` and `rtl`,
  which pin it: pinning is how a right-to-left layout is checked while still reading English. **The
  chrome itself is pinned `ltr` and the direction is applied to the stage element**, so the toolbar
  and panels never mirror underneath the person using them — the preview page is the one place where
  imp's own UI and the previewed component need different directions at once.
- **Routes:** `/` is the generated index of discovered previews, `/preview/<path>` renders one
  file's scenarios, `?scenario=<name>` isolates one, and `/@imp/preview/<path>` serves that file's
  bundle. A build failure is served as a module that renders the error into the page and is also
  logged to the terminal. The preview server does not fall back to the app's `index.html` for
  unknown routes.
- **`imp preview [path]`** with no path serves everything; a `*.preview.js` path, a component path
  whose sibling preview is inferred, or a folder narrows it. `--list` prints what was discovered
  (`--json` for tooling), `--port` defaults to 4517 so a preview server and `imp start` can run side
  by side, and `preview.exclude` in `imp.json` keeps folders out of discovery. A `preview.themes` or
  `preview.translations` path that resolves to no file fails the command at startup rather than
  degrading silently.

## Consequences

Previewing a component costs one sibling file and no configuration, and the fixtures a scenario
needs are reviewed in the same diff as the component. Because the page is real HTML served by the
real dev server, cross-cutting concerns — theming today, i18n later — are exercised rather than
approximated.

Building the page from `imp/std` makes the workbench a consumer of the library it exists to develop,
so a regression in `button`, `select`, `textArea` or `tabs` shows up while working on anything. The
cost is the circularity: a broken standard component can break the page used to diagnose it. The
build-failure path stays raw DOM for that reason, so an error always renders.

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
