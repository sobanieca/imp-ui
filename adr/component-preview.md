# Component preview - `*.preview.js` scenarios served in one app

## Context

To build a component inside a running app is a slow loop. You reach the screen that renders it, you
get the data into the state it must show, and you resize the browser to check the layout. Component
workbenches solve this, but the usual ones bring a story DSL, a second build pipeline, and a config
surface. None of those fit imp's buildless dev server, its type-dispatched call sites
(`type-based-argument-dispatch.md`), or its "no framework-specific ceremony" stance. imp already had
the two hard pieces: a dev server with auto-injection and telemetry (`imp start`), and a
module-mocking seam in the test bundler (`two-level-testing.md`).

## Decision

`imp preview` serves every `*.preview.js` file in one single-page app, built from imp's own map,
router and shell. It reuses the `imp start` internals (`loadApp` / `createRequestHandler`, head
injection, live reload, console and network telemetry) instead of a second server. Discovery uses
the shared file walker, so imp finds a preview file the way it finds a test file.

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
  the other. A mock applies to the whole preview app, because every preview shares one module graph.
  Two files that mock the same module must agree on the factory. Otherwise imp reports both and
  leaves them out of the build.
- **The app is one split build, and every preview shares one module graph.** A generated entry
  module holds the catalog, the themes, the translations, the groups module and one dynamic
  `import()` per preview file. esbuild bundles that entry and every preview file as entry points,
  with code splitting. The library and the chrome land in shared chunks, and each preview file is a
  chunk of its own that the browser fetches on the first visit. So there is exactly one instance of
  the library behind the chrome, every component and every mock, and a move between components loads
  the chunk of the next one only. The build is cached until a file changes, and the watcher reports
  that change as a reload. A preview file that fails to build is left out of the build and marked in
  the catalog. Its address shows the error, and the rest of the catalog stays up. An error that no
  preview file owns fails the whole build, and the page shows it.
- **A scenario panel is a stage and a state editor, and nothing else.** The stage is drag-resizable
  and takes the full width of the panel. The state editor opens from a button in the panel head, in
  a non-modal `dialog` that the person drags where it does not cover the specimen. The file's
  `description` sits once below the page head. There, an agent about to write a call site learns
  where the manual of the component is. A panel shows no code. The job of the workbench is to show
  what the component looks like. The answer to "what do I write to get that?" lives in the
  component's `*.skill.md` (`agent-skills.md`). That file is written for that question and cannot
  drift from the fixtures of a preview file. The stage is resized by dragging its right, bottom, or
  corner handle with pointer events (mouse and touch). It has a live size readout and
  phone/tablet/desktop presets on top of free dragging. A resize changes the parent box only, so the
  component re-lays-out through the real DOM path (`real-dom-no-virtual-dom.md`).
- **The frame is `shell`, and an application map drives it.** The runtime builds an `appMap()` from
  the catalog (`application-map.md`): one index node, one child per group and one grandchild per
  component. Group and component names become node keys and path segments through one slug function
  that the CLI shares, so the address the server prints is the address the app serves. The router
  binds the catalog view to the index node, a group screen to each group node, and an `area()` per
  component that imports its chunk on demand. The group screen is a card per component. A card
  renders the first scenario of the file, inert, and links to the component. The card imports the
  chunk of its file, so a group page loads every component of the group. The sidebar lists the
  groups with the components under them. The map has one section, so the shell draws the
  sidebar-only layout on its own (`app-shell-component.md`). Group icons and counts bind at the
  shell by handle. The brand block is its `logo`, with the imp mark as the image. The server embeds
  the mark in the bundle as a base64 data URI, and the generated page uses the same URI as its icon.
  So the page requests no asset for its own look, and a copy of it stands alone. The theme, language
  and direction pickers are its `extras`. The theme editor is in a non-modal `drawer` opened from a
  button beside them. So navigation between components is one click from anywhere, with no page
  load. The workbench uses imp's own map, router and frame on purpose: a regression in any of them
  shows up while you work on anything. The frame is pinned `dir="ltr"` on its host, so the direction
  control still applies to the stage alone.
- **The theme editor is part of the page, and `theme-editor.md` records its design.** The pickers
  choose which theme is applied. The editor derives a whole theme from a few knobs, writes each
  change straight back through `applyTheme`, keeps a draft per theme in `localStorage`, and exports
  a plain theme module. That makes the workbench the place where a theme is designed, not only the
  place where one is checked.
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
  previews is not drawn. imp's own standard library is a project like any other here. `lib/src`
  carries an `imp.json` that names `std/preview-groups.js`, and the CLI ships no group table at all.
  The match is exact and case-sensitive. A group name is a string the project already chose twice,
  in the module and in each preview file, and a lenient match would hide a typo instead of showing
  it as a folder icon.
- **The catalog travels in the entry module, and imp builds it at discovery time.** To read the
  metadata of a file, the order of its scenarios and the state declarations of its graph, imp must
  open every preview file. So imp builds the catalog once when discovery runs, and the same watcher
  callback that drops the build rebuilds it. The generated entry embeds the catalog, so the runtime
  knows every component, and draws the whole sidebar, before one chunk of a component loads.
- **One page serves every address.** The server answers `/` and every GET without a file extension
  with the same HTML, and the router reads the address. `/@imp/preview/app.js` is the entry,
  `/@imp/preview/<file>.js` is the chunk of one preview file, and `/@imp/preview/chunks/` holds the
  shared code. A project frames that page through `preview.entry`.
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
  at whatever the previous selection set. The page wears the theme too, so that would be a
  half-styled workbench, and not only a half-styled component.
- **A project can frame every preview with its own page, through `preview.entry`.** The generated
  page holds no stylesheet of the app. So a web font that the app links in `index.html` does not
  load in a preview, and the theme editor cannot show it. `preview.entry` in `imp.json` names an
  HTML file. imp serves it as the page of the catalog and of every preview. It replaces or adds the
  `<title>`, appends the catalog and the bundle script at the end of the `<body>`, and keeps
  everything else as written. imp does not read the `index.html` of the app for this, and it does
  not pick tags out of any file. A rule that copies some tags and drops others is a guess about
  which tags matter, and it is invisible when it guesses wrong. An explicit file costs one path in
  `imp.json`, and what it holds is what the page gets. It is a separate file, and not the
  `index.html` of the app, because that file starts the app from its own script tag. A path that
  resolves to no file fails the command at startup.
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
- **Routes:** `/` is the catalog of discovered previews. `/<group>/<name>` renders the scenarios of
  one file, with the names in lower case and hyphens. `?scenario=<name>` isolates one. It changes
  the query only, so the screen stays mounted and re-renders its panels. `/@imp/preview/` serves the
  build. A failure of the whole build is served as a module that renders the error into the page,
  and every build failure is logged to the terminal. The preview server never serves the app's
  `index.html`. An address off the map gets the preview page, and the router says so.
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

The preview app is bundled while the rest of development stays buildless. A change reflects after
one rebuild of the whole app, which the watcher already triggers with a reload. The build covers
every preview file at once, so a project with many previews pays for all of them on the first
request after a change. The library and the chrome are split into shared chunks, so the chunk of one
preview stays small, and a move between components costs one small fetch.

Scenario isolation stops at the module graph, and the whole app shares that graph. A mock applies to
every component that imports the module, and two scenarios that need different mocked data must
differ by their arguments. The scenarios of a file mount when its address opens and unmount when you
leave it. An export that is an instance is the same element on every visit, so a scenario that must
start fresh each time is a function export.

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
