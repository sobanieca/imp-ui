# Component preview - `*.preview.js` scenarios served on a synthesized page

## Context

To build a component inside a running app is a slow loop. You reach the screen that renders it, you
get the data into the state it must show, and you resize the browser to check the layout. Component
workbenches solve this, but the usual ones bring a story DSL, a second build pipeline, and a config
surface. None of those fit imp's buildless dev server, its type-dispatched call sites
(`type-based-argument-dispatch.md`), or its "no framework-specific ceremony" stance. imp already had
the two hard pieces: a dev server with auto-injection and telemetry (`imp start`), and a
module-mocking seam in the test bundler (`two-level-testing.md`).

## Decision

`imp preview` serves each `*.preview.js` file as its own generated page. It reuses the `imp start`
internals (`loadApp` / `createRequestHandler`, head injection, live reload, console and network
telemetry) instead of a second server. Discovery uses the shared file walker, so imp finds a preview
file the way it finds a test file.

- **A preview file is plain imp code. Every named export except three is a scenario.** The export
  name is the panel label, so the name of a scenario lives only in the code. A scenario is the
  component built with its normal factory call. Props, children, and text pass exactly as at a real
  call site, so there is no story format. There is no default export. An export can be an instance
  or a **function that returns one**. imp calls the function when it renders the panel. The function
  form exists for scenarios whose setup must run at render time. Panels are ordered by the order of
  the exports in the file. Exports the scanner does not recognize fall back to module order.
- **`name`, `group` and `description` are metadata, not scenarios.** These three optional string
  exports declare a component's human label, its group in the catalog, and the line an agent must
  read before it writes code with the component. They sit in the preview file itself, next to the
  scenarios that demonstrate the component. There is no manifest, no registry and no second file to
  keep in sync. A component that declares nothing still appears, labelled by its file and folder as
  before. The price is three reserved export names. That is why they are the plainest words
  available rather than a prefixed convention: a scenario worth calling `name` does not exist, and
  the obvious words keep the file readable. The same export scanner that orders the panels reads
  them, and each must be a string literal. imp ignores anything else, and the fallback stands. A
  preview page that fails to load because a label was computed would be a poor trade. `description`
  is on purpose an **instruction to run `imp skill`**, not a summary of the component. The manual
  already exists in the component's `*.skill.md` (`agent-skills.md`). A copy in the preview file
  would give an agent two sources that drift.
- **Module mocking reuses the seam of the test runner.** `mockModule(specifier, factory)` is
  imported from `imp/preview` and behaves as in `imp test`. It uses the same `imp-mock` esbuild
  namespace, the same `orig`/`spy` helpers, and the same rule that a specifier is a relative module
  or a vendored `imp.json` dependency. The scanning, mock generation, and resolver plugin live in
  one shared module (`cli/src/bundling.js`) that both commands use. A developer who knows one knows
  the other. A mock is per file, not per scenario.
- **The page is one bundle, not the module graph of the app.** A generated entry module imports the
  preview file and the preview chrome. esbuild bundles it with the imp library inlined. So the
  browser loads the mocked module graph, and there is exactly one instance of the library behind the
  component, the chrome, and any mock. Bundles are cached per file. Any file change drops them, and
  the existing watcher already reports that change as a reload.
- **A scenario panel is a stage and a state editor, and nothing else.** The stage is drag-resizable,
  with the editor beside it. The file's `description` sits once below the page head. There, an agent
  about to write a call site learns where the manual of the component is. A panel shows no code. The
  job of the workbench is to show what the component looks like. The answer to "what do I write to
  get that?" lives in the component's `*.skill.md` (`agent-skills.md`). That file is written for
  that question and cannot drift from the fixtures of a preview file. The stage is resized by
  dragging its right, bottom, or corner handle with pointer events (mouse and touch). It has a live
  size readout and phone/tablet/desktop presets on top of free dragging. A resize changes the parent
  box only, so the component re-lays-out through the real DOM path (`real-dom-no-virtual-dom.md`).
- **Every page wears the same frame, and the frame is `shell`.** `/` and each `/preview/<path>`
  render one `shell`. The brand block is its `logo`. The catalog is its `sidebar` data, with one
  section per group. The theme, language and direction pickers are its `extras`. The theme editor is
  in a non-modal `drawer` opened from a button beside them. The page itself is its content. So
  navigation between components is one click from anywhere. The workbench uses imp's own frame on
  purpose: a regression in the frame shows up while you work on anything. The frame is pinned
  `dir="ltr"` on its host, so the direction control still applies to the stage alone.
- **The theme editor edits the applied theme, token by token.** The pickers choose which theme is
  applied. The editor lists every token the applied theme wrote, grouped by kind. It writes each
  change straight back through `applyTheme`, so the page and the specimen re-skin as you type the
  value. Edits are kept per theme in `localStorage` and layered back over the theme on reload. The
  editor offers the result as a theme module to paste into a project. That makes the workbench the
  place where a theme is designed, not only the place where one is checked. It reads the token names
  from the custom properties the applied theme left on the document element, not from a list of its
  own. So a token added to a theme shows up in the editor with no second registry to update.
- **A preview is identified by `group/name`, declared in the file or derived from its path.** imp
  uses the file's `group` and `name` exports when it has them. Otherwise it uses the folder that
  holds the file and the base name of the file. A project that writes no metadata still gets a
  grouped catalog from its folders. A project that writes metadata gets a catalog organized the way
  its team talks, with groups that span folders. The same pair is what the search matches and what
  the catalog, the page head and the document title show. So what is searched is always what is
  read.
- **Group icons and order come from a project module named in `preview.groups`, never from a table
  in the CLI.** The sections of the sidebar need an icon each. A map of group names to icons inside
  imp would know only imp's own groups, and a project's `Widgets` would get the fallback for ever.
  So `preview.groups` in `imp.json` points at an ordinary module that exports `groups`, an array of
  `{ name, icon }`. The icon is a value from `imp/icons`. The generated entry imports the module
  exactly like a theme or a translations file and hands it to the runtime. Listed groups come first,
  in the order written. A group the module omits follows with a folder icon. A listed group with no
  previews is not drawn. imp's own standard library is a project like any other here. `lib/src/std`
  carries an `imp.json` that names its `preview_groups.js`, and the CLI ships no group table at all.
  The match is exact and case-sensitive. A group name is a string the project already chose twice,
  in the module and in each preview file, and a lenient match would hide a typo instead of showing
  it as a folder icon.
- **The catalog travels in the page, not in the bundle, and imp builds it at discovery time.** Every
  preview document carries a `<script type="application/json">` that lists the discovered previews.
  Each entry has its file, identity and description, and the list says which one is current. The
  runtime reads it before it mounts, because `mount` replaces the body. To read the metadata, imp
  must open every preview file. So imp builds the catalog once when discovery runs, and the same
  watcher callback that clears the bundle cache rebuilds it. It is never built per request. Bundles
  stay per file and cacheable. A new preview file changes only the HTML, and a bundle never has to
  be rebuilt because a sibling appeared.
- **The index is the same bundle path as a preview page, with no scenarios.** `/` serves a generated
  entry whose scenarios are `null`. So one runtime renders both the catalog view and the scenarios
  of a file, and two page builders cannot diverge. Its bundle is cached under its own key and served
  from `/@imp/preview-index.js`.
- **The preview page is an imp app built from `imp/std`.** Its bars, stage and state editor are
  `component()`s that read the same `--imp-*` tokens as the library
  (`themable-by-default-tokens.md`). So the theme switcher re-skins the page together with the
  specimen, and a theme that fails here fails in an app for the same reason. Two consequences follow
  from `shadow-dom-isolation.md`, and they are the reason the page has this shape. Content handed to
  a standard component moves into **that** component's shadow root, so the stylesheet of the page
  cannot reach it. So the stage and the editor are components that carry their own styles and size
  themselves through `:host`, not components sized by their parent. Direction stays the exception
  below. It is the one signal the page does not share with what it shows.
- **The state editor is best-effort static extraction, with no lint rule.** imp scans the preview
  file and the relative modules it reaches for `initState` / `useState` calls. It takes the state
  name from the string literal, which is the argument after `self`. For `initState`, it also takes
  the initial value when that value parses as JSON. Nothing constrains where state can be declared.
  A name the scanner misses is not listed. At runtime, the editor resolves each name against the
  scenario's own instance through the state subscription event, so panels on one page are
  independent. Edits go through `set`, which drives imp's normal fine-grained update path with no
  re-mount. Values are edited as JSON (`state-plain-data-values.md`). A value that is not
  JSON-representable is read-only.
- **Chrome controls drive real signals.** A theme switcher calls `applyTheme` with imp's built-in
  themes (`themable-by-default-tokens.md`), so a component is checked light and dark from one page.
  The browser remembers the selection. A project's own themes join the same switcher through
  `preview.themes` in `imp.json`. The generated entry imports each listed module, and its default
  export is passed to `applyTheme` as an object. So a theme file stays an ordinary module with
  nothing preview-specific in it, and it needs no name registry. Project themes are listed before
  the built-ins, and the first one is applied by default, so a preview opens in the app's own skin.
  A project theme is layered over the built-in that matches its `colorScheme`, not applied alone.
  `applyTheme` writes only the tokens a theme names, so a partial theme alone would leave the rest
  at whatever the previous selection set. Now that the page wears the theme too, that showed up as a
  half-styled workbench rather than only a half-styled component.
- **Language and direction are chrome controls on the same seam.** A language picker calls
  `setLang`, and a direction picker writes `<html dir>` (`translatable-by-default.md`). So a
  component is checked in another language, and right to left, without a code edit. Both selections
  are remembered like the theme. The languages offered are the ones the project lists in
  `preview.translations`, a map of code to file. The generated entry imports them and hands them to
  `init` as loaders, so a translations file stays an ordinary module. A project that lists none gets
  no language picker, because imp has no languages of its own to offer
  (`translatable-by-default.md`). The direction picker offers `auto`, which re-derives from the
  language, and `ltr` and `rtl`, which pin it. Pinning is how you check a right-to-left layout while
  you still read English. **The chrome itself is pinned `ltr`, and the direction is applied to the
  stage element.** So the frame and the panels never mirror under the person who uses them. The
  preview page is the one place where imp's own UI and the previewed component need different
  directions at once.
- **Routes:** `/` is the generated catalog of discovered previews. `/preview/<path>` renders the
  scenarios of one file. `?scenario=<name>` isolates one. `/@imp/preview/<path>` serves the bundle
  of that file, and `/@imp/preview-index.js` serves the bundle of the catalog. A build failure is
  served as a module that renders the error into the page, and it is also logged to the terminal.
  The preview server does not fall back to the app's `index.html` for unknown routes.
- **`imp preview [path]`** with no path serves everything. A `*.preview.js` path, a component path
  whose sibling preview is inferred, or a folder narrows it. `--list` prints what was discovered
  (`--json` for tooling). `--port` defaults to 4517, so a preview server and `imp start` can run
  side by side. `preview.exclude` in `imp.json` keeps folders out of discovery. A `preview.themes`,
  `preview.translations` or `preview.groups` path that resolves to no file fails the command at
  startup. It does not degrade in silence.

## Consequences

To preview a component costs one sibling file and no configuration. The fixtures a scenario needs
are reviewed in the same diff as the component. Because the page is real HTML served by the real dev
server, cross-cutting concerns such as theming and i18n are exercised, not approximated.

Because the page is built from `imp/std`, the workbench is a consumer of the library it exists to
develop. So a regression in `shell`, `button`, `select` or `textArea` shows up while you work on
anything. The cost is the circularity: a broken standard component can break the page used to
diagnose it. So the build-failure path stays raw DOM, and an error always renders.

Preview pages are bundled while the rest of development stays buildless. A preview page reflects a
file change only after its bundle is rebuilt, which happens on the reload the watcher already
triggers. Because the bundle inlines the library, a preview page does not share module instances
with anything served outside it.

Scenario isolation stops at the module graph. Mocks are per file, so two scenarios that need
different mocked data must differ by their arguments or live in separate preview files. Teardown
between renders is the page reload. Scenarios are never unmounted and re-mounted in place, so a stub
that holds timers or subscriptions cannot leak between renders.

The three metadata exports are reserved for good. A preview file can never have a scenario called
`name`, `group` or `description`. One written anyway is taken as a label and not rendered, in
silence. Nothing warns about it, because the scanner cannot tell an intended label from an intended
scenario. The same nothing-happens rule covers a value that is not a string literal. So metadata is
never a reason a preview page fails to open.

State discovery is a convenience with no guarantee. Dynamic or indirect state names do not appear in
the editor. An initial value that is not a JSON literal is left blank until the running component
provides one. This is deliberate. The alternative was a lint rule that constrains where `initState`
and `useState` can be written, which would trade a working editor row for a restriction on every
component.
