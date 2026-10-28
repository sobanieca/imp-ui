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

- **A preview file is plain imp code. Every named export except two is a scenario.** The export name
  is the id of the scenario, and its label unless the export carries one, so the name of a scenario
  lives only in the code. A scenario is the component built with its normal factory call. Props,
  children, and text pass exactly as at a real call site, so there is no story format. There is no
  default export. An export can be an instance or a **function that returns one**. imp calls the
  function when it renders the panel. The function form exists for scenarios whose setup must run at
  render time. An export can also be an object `{ scenario, component }`. The `scenario` string is
  the label of the tab and of the panel, and `component` is the instance or the function. An
  identifier such as `withClickHandler` is a poor label, and the object form gives a scenario a
  sentence for a label without a second registry. The export name stays the id in the `scenario`
  query, and the code panel shows the `component` expression as the call site. Panels are ordered by
  the order of the exports in the file, which the parser reads. A module namespace lists its exports
  in alphabetical order, so the file order must come from the source.
- **`name` and `group` are metadata, not scenarios.** These two optional string exports declare a
  component's human label and its group in the catalog. They sit in the preview file itself, next to
  the scenarios that demonstrate the component. There is no manifest, no registry and no second file
  to keep in sync. A component that declares nothing still appears, labelled by its file and folder
  as before. The price is two reserved export names. That is why they are the plainest words
  available rather than a prefixed convention: a scenario worth calling `name` does not exist, and
  the obvious words keep the file readable. The same parse that orders the panels reads them, and
  each must be a string literal. imp ignores anything else, and the fallback stands. A preview page
  that fails to load because a label was computed would be a poor trade. The preview file describes
  the component nowhere. The manual is the component's `*.skill.md` (`agent-skills.md`), and the
  page shows it, see below. A description in the preview file would give an agent two sources that
  drift.
- **The agent line is the `imp skill` command, and imp derives it from the path.** Below the page
  head, the page shows the command an agent runs to learn the component, with a copy button. The
  sidecar of `todos.preview.js` is `todos.skill.md`, so the command is `imp skill ./todos.js`. When
  the sidecar is one that the binary embeds, at the same path under the library and with the same
  text, the command is `imp skill std/<name>`. The line is computed, so nothing in the preview file
  can point at the wrong manual. A component with no sidecar gets a line that says which file to
  write.
- **The code of a scenario is cut from the preview file, and a panel shows it as a call site.** imp
  parses the file with the eslint parser that the binary carries for `imp lint`, and it reads the
  scope analysis of that parse. Every scenario export gives the exact span of its value. For one
  scenario it takes the module bindings that the expression references, which are the imports and
  the top-level declarations, and repeats for every declaration it pulls in. The snippet is those
  imports, cut down to the used names, then those declarations in file order, then the expression. A
  zero-argument arrow that returns an expression is shown as the expression, so a function scenario
  reads as the same call. A function declaration is shown whole. The result is code that a person
  pastes: the imports resolve, a helper such as `wrap(...)` stands above the call that uses it, and
  nothing is hidden. The snippet is a subset of the file that rendered the panel, so it cannot drift
  from what is shown. The alternatives were rejected. A hand-written snippet in a comment or in a
  second export is untested text next to tested code, and it drifts. A rule that bans helpers makes
  the preview files worse for no gain. A marker comment that selects a region is unchecked, so a
  moved line breaks the display in silence. The scope analysis is why the parser is a real one. A
  parameter or an object key that has the name of a helper is not a reference to it, and only a
  reference pulls the helper in. The call site must stay a build-time text job, because the browser
  sees the reprint of the bundle, with normalized quotes, rewritten whitespace and inlined imports,
  and `Function.prototype.toString()` returns nothing for a value scenario. The catalog carries the
  snippet per scenario, and the panel shows it under the stage behind a _code_ button, as a
  `codeBlock` highlighted as JavaScript, with the copy button of the block, see
  `code-block-syntax-highlighting.md`. The choice to show the code is remembered, so a person who
  wants the code sees it on every panel.
- **The skill of the component is a tab on its page.** The page has two tabs, _Scenarios_ and
  _Skill_. The skill is the component's `*.skill.md`, the same file that `imp skill` prints and that
  `imp build` copies to `imp-skill.md` beside the bundle of a JS entry (`agent-skills.md`). The
  preview bundler folds it into the chunk of the preview file as `impPreviewSkill`, rendered to HTML
  at bundle time, so the runtime receives HTML and the entry module stays small. The renderer is the
  `pulldown-cmark` crate, compiled into the binary (`native-toolchain.md`). Subject links are retargeted first,
  exactly as `imp skill` prints them, so a link to a sibling skill reads `state (imp skill state)`
  on the page too. The page styles the HTML with the same `--imp-*` tokens as the rest of the
  workbench, and it renders every fenced code block as a `codeBlock`, highlighted in the language of
  its fence. A component without a sidecar gets an empty state that names the file to write.
- **Module mocking reuses the seam of the test runner.** `mockModule(specifier, factory)` is
  imported from `imp/preview` and behaves as in `imp test`. It uses the same virtual mock modules,
  the same `orig`/`spy` helpers, and the same rule that a specifier is a relative module or a
  vendored `imp.json` dependency. The scanning, the generation of a mock and the resolution live in
  the bundler that both commands use. A developer who knows one knows
  the other. A mock applies to the whole preview app, because every preview shares one module graph.
  Two files that mock the same module must agree on the factory. Otherwise imp reports both and
  leaves them out of the build.
- **The app is one split build, and every preview shares one module graph.** A generated entry
  module holds the catalog, the themes, the translations, the groups module and one dynamic
  `import()` per preview file. Each import points at a generated group module, which re-exports
  every preview file of that group as a namespace. The bundler bundles the entry and every group module
  as entry points, with code splitting. The library and the chrome land in shared chunks, and each
  group is a bundle of its own that the browser fetches on the first visit. So there is exactly one
  instance of the library behind the chrome, every component and every mock. A move to a component
  of a group that is loaded costs no fetch, and a move to a new group loads that group only. A group
  page renders every component of the group, so the group is the unit that pays off there, and the
  export publishes the same split (`preview-export.md`). The build is cached until a file changes,
  and the watcher reports that change as a reload. A preview file that fails to build is left out of
  the build and marked in the catalog. Its address shows the error, and the rest of the catalog
  stays up. An error that no preview file owns fails the whole build, and the page shows it.
- **The scenarios of a file are vertical `tabs`, one tab per export.** The strip lists the export
  names in file order, and the panel of the selected tab shows the scenario. `tabs` mounts every
  panel at once and hides the rest, so a resized stage or an edited state survives a change of tab.
  The selection is bound to the `scenario` query of the address. A click on a tab replaces the
  query, and an address with a query opens that tab. So a link to one scenario is the address of the
  page plus `?scenario=<name>`. There is no separate isolated view.
- **A scenario panel is a stage, a code panel and a state editor.** The stage is drag-resizable and
  takes the full width of the panel. The scenario `tabs` are `foldable`. On a phone, where the
  vertical strip leaves little room, the strip starts folded, and the panel gets the width of the
  screen with its head, its stage and its code panel. On a screen of `40rem` or wider the strip
  starts open. A tap on the fold button is remembered in the browser, so the choice survives a
  reload. The strip also follows the screen while the page is open. It folds when the screen gets
  narrower than `40rem`. When the screen gets wider again, it goes back to the remembered choice.
  Nothing overflows and the canvas does not scroll sideways. A width is a concern of the parent, so
  `tabs` gets no prop for it. Two icon-only toggle buttons sit in the panel head, built from
  `button` with `pressed`. The code toggle opens the call site under the stage. The state toggle
  opens the editor in a non-modal `dialog`, anchored to the toggle so it opens where the person
  looks, and the person drags it where it does not cover the specimen. The dialog and the toggle
  share one `open` state, so a close of the dialog releases the toggle. The stage is resized by
  dragging its right, bottom, or corner handle with pointer events (mouse and touch), and it has a
  live size readout. There are no viewport presets. A handle and a readout are enough to find the
  width where a component breaks. A resize changes the parent box only, so the component re-lays-out
  through the real DOM path (`real-dom-no-virtual-dom.md`).
- **A scenario that mounts a router renders in a frame, `{ scenario, frame, component }`.** A
  router owns the address and the history of its window. The preview page already routes on that
  address, so a second router on the page would move the page with each click. The `shell` takes
  its nav from the map through the router, so a `shell` scenario without a router cannot show its
  real nav. With `frame`, imp renders an `iframe` of the same preview page in the stage. The name of
  the frame window holds the file and the export. On boot, the runtime reads that name and mounts
  the one scenario in place of the workbench. The window name stays across a navigation and a
  reload of the frame, and the address of the frame belongs to the router of the scenario. `frame`
  is the start path, a handle of the map or a string. The frame copies the `style`, `dir` and `lang`
  of the root element of the page through a `MutationObserver`. So the theme, a theme draft, the
  direction and the language follow without a message protocol. The frame loads lazily, so the
  hidden panels of a file cost nothing until they show. Its media queries see the stage, so a narrow
  stage shows the phone layout. The review widget does not mount in a frame, because one widget on
  the page is enough. The frame opens no live-reload stream of its own, because the reload of the
  page reloads it. A stream per frame held one of the six connections that a browser opens to a
  host, so a sixth frame never loaded. The frame disconnects its observer when it unloads. An
  observer on the page keeps the removed frame alive. Two alternatives were rejected. A router that keeps its route in memory adds a
  second routing state to the library for one consumer. A preview that converts the map to plain
  rows shows the shape, but it does not run the path of the map that an app uses.
- **The frame is `shell`, and an application map drives it.** The runtime builds an `appMap()` from
  the catalog (`application-map.md`): one top-level node per group and one child per component,
  under the root. Group and component names become node keys and path segments through one slug function
  that the CLI shares, so the address the server prints is the address the app serves. The router
  binds the catalog view to the root, a group screen to each group node, and an `area()` per
  component that imports its chunk on demand. The group screen is a card per component. A card
  renders the first scenario of the file, inert, and links to the component. The card imports the
  bundle of its group, so a group page loads with one fetch. The sidebar lists the groups with the
  components under them. The page passes `navbar: { hidden: true }`, so the shell draws the
  sidebar-only layout (`app-shell-component.md`). Group icons and counts bind in the `nav` of the
  shell by handle. The brand
  block is its `logo`, with the imp mark as the image. The mark has a light and a dark variant, and
  `appLogo` shows the one that matches the colour scheme of the active theme. The server embeds both
  in the bundle as base64 data URIs. The icon of the page is a separate `.ico` file with the inverse
  mark on an ink tile, embedded the same way. It does not follow the theme, because the tab strip of
  a browser is painted by the browser, not by the page. So the page requests no asset for its own
  look, and a copy of it stands alone. The theme, language and direction pickers are its `extras`.
  The theme editor is in a non-modal `drawer` opened from a button beside them. So navigation
  between components is one click from anywhere, with no page load. The workbench uses imp's own
  map, router and frame on purpose: a regression in any of them shows up while you work on anything.
  The frame is pinned `dir="ltr"` on its host, so the direction control still applies to the stage
  alone.
- **The theme editor is part of the page, and `theme-editor.md` records its design.** The pickers
  choose which theme is applied. The editor is a library component that the review widget of
  `imp start` also hosts. It derives a whole theme from a few knobs, writes each change straight
  back through `applyTheme`, keeps a draft per theme name in `localStorage`, and exports a plain
  theme module. That makes the workbench the place where a theme is designed, not only the place
  where one is checked.
- **A preview is identified by `group/name`, declared in the file or derived from its path.** imp
  uses the file's `group` and `name` exports when it has them. Otherwise it uses the folder that
  holds the file and the base name of the file. A project that writes no metadata still gets a
  grouped catalog from its folders. A project that writes metadata gets a catalog organized the way
  its team talks, with groups that span folders. The same pair is what the search matches and what
  the catalog, the page head and the document title show. So what is searched is always what is
  read.
- **Groups are the entries of one project object, named in `preview.groups`, never a table in the
  CLI and never a string to match.** The sections of the sidebar need a name and an icon each. A map
  of group names to icons inside imp would know only imp's own groups, and a project's `Widgets`
  would get the fallback for ever. So `preview.groups` in `imp.json` points at an ordinary module
  that exports `groups`, an object with one key per group, each `{ name, icon }`. The icon is a
  value from `imp/icons`. A preview file imports that object and exports `group = groups.widgets`.
  So the editor completes a group, a rename refactors every preview, and a typo is a broken import
  rather than a group that silently appears twice. imp builds the catalog before the bundle runs, so
  it reads the key from the parse of the preview file, as it reads `name`. The value must be the
  plain member expression `groups.<key>` on an import of the groups module. imp resolves that import
  and reads the `name` of the key from the parse of the groups module. A read from the running
  module would cost the lazy chunks, because a value exists only once its module has been imported,
  and the sidebar must draw before any of them loads. A `group` that is a string, that is not a key,
  or that comes from another file is reported in the terminal, and the component falls back to its
  folder. The generated entry imports the module exactly like a theme or a translations file and
  hands it to the runtime for the icons. Listed groups come first, by their optional `priority`
  number, lowest first, and then in the order of the keys. A priority exists so that one group can
  lead the catalog without a move of its entry in the object, and a lower number first reads as a
  rank. A folder group follows with a folder icon. A listed group with no previews is not drawn.
  imp's own standard library is a project like any other here. `lib/src` carries an `imp.json` that
  names `std/preview-groups.js`, and the CLI ships no group table at all.
- **The catalog travels in the entry module, and imp builds it at discovery time.** To read the
  metadata of a file, the order of its scenarios and the state declarations of its graph, imp must
  open every preview file. So imp builds the catalog once when discovery runs, and the same watcher
  callback that drops the build rebuilds it. The generated entry embeds the catalog, so the runtime
  knows every component, and draws the whole sidebar, before one chunk of a component loads.
- **One page serves every address.** The server answers `/` and every GET without a file extension
  with the same HTML, and the router reads the address. `/@imp/preview/app.js` is the entry,
  `/@imp/preview/groups/<group>.js` is the bundle of one group, and `/@imp/preview/chunks/` holds
  the shared code. A project frames that page through `preview.entry`.
- **The preview page is an imp app built from `imp/std`.** Its bars, stage and state editor are
  `component()`s that read the same `--imp-*` tokens as the library
  (`themable-by-default-tokens.md`). So the theme switcher re-skins the page together with the
  specimen, and a theme that fails here fails in an app for the same reason. Two consequences follow
  from `shadow-dom-isolation.md`, and they are the reason the page has this shape. Content handed to
  a standard component moves into **that** component's shadow root, so the stylesheet of the page
  cannot reach it. So the stage and the editor are components that carry their own styles and size
  themselves through `:host`, not components sized by their parent. Direction stays the exception
  below. It is the one signal the page does not share with what it shows.
- **The state editor reads the running scenario.** After a scenario mounts, the page walks its
  rendered tree, shadow roots included, and asks each element for the states it provides. The
  question is the provider lookup event that `useState` uses, dispatched without bubbling, so an
  element answers only for the states its own `initState` calls created. A source scan would miss a
  computed name, a name behind a helper, and every state inside a component from `imp/std`. The
  running tree has none of those gaps, and it needs no lint rule that constrains where `initState`
  is written. The list is read again each time the editor opens, so a state that mounts late is
  listed. Each row is bound to the handle it found, so panels on one page are independent. Edits go
  through `set`, which drives imp's normal fine-grained update path with no re-mount. Values are
  edited as JSON (`state-plain-data-values.md`). A value that is not JSON-representable is
  read-only.
- **Chrome controls drive real signals.** A theme switcher calls `applyTheme` with imp's built-in
  themes (`themable-by-default-tokens.md`), so a component is checked light and dark from one page.
  The browser remembers the selection. A project's own themes join the same switcher through
  `preview.themes` in `imp.json`. The generated entry imports each listed module, and its default
  export is passed to `applyTheme` as an object. So a theme file stays an ordinary module with
  nothing preview-specific in it, and it needs no name registry. Project themes are listed before
  the built-ins, and the first one is applied by default, so a preview opens in the app's own skin.
  A project theme is layered over the built-in that matches its `color-scheme` token, not applied
  alone. `applyTheme` writes only the tokens a theme names, so a partial theme alone would leave the
  rest at whatever the previous selection set. The page wears the theme too, so that would be a
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
  `lang.set`, and a direction picker writes `<html dir>` (`translatable-by-default.md`). So a
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
  one file, with the names in lower case and hyphens. `?scenario=<name>` selects a scenario tab. It
  changes the query only, so the screen stays mounted. `/@imp/preview/` serves the build. A failure
  of the whole build is served as a module that renders the error into the page, and every build
  failure is logged to the terminal. The preview server never serves the app's `index.html`. An
  address off the map gets the preview page, and the router says so.
- **`imp preview [path]`** with no path serves everything. A `*.preview.js` path, a component path
  whose sibling preview is inferred, or a folder narrows it. `--list` prints what was discovered
  (`--json` for tooling). `--port` defaults to 4401, so a preview server and `imp start` can run
  side by side. `preview.exclude` in `imp.json` keeps folders out of discovery. A `preview.themes`,
  `preview.translations` or `preview.groups` path that resolves to no file fails the command at
  startup. It does not degrade in silence.

## Consequences

To preview a component costs one sibling file and no configuration. The fixtures a scenario needs
are reviewed in the same diff as the component. Because the page is real HTML served by the real dev
server, cross-cutting concerns such as theming and i18n are exercised, not approximated.

Because the page is built from `imp/std`, the workbench is a consumer of the library it exists to
develop. So a regression in `shell`, `button`, `select` or `textField` shows up while you work on
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

The two metadata exports are reserved for good. A preview file can never have a scenario called
`name` or `group`. One written anyway is taken as a label and not rendered, in silence. Nothing
warns about it, because imp cannot tell an intended label from an intended scenario. The same
nothing-happens rule covers a value that is not a string literal. So metadata is never a reason a
preview page fails to open.

The code panel reads the file with a parser, so what it cannot slice is what has no single
expression to show. A destructured export and a re-export list their names for the order, but they
show no code button, and the page still opens. A file that does not parse fails the build too, so it
is marked in the catalog. A helper that a scenario reaches only through a module-level side effect,
such as a `mockModule` call, is not in the snippet, because nothing in the expression references it.
The snippet is the call site, not the fixture setup.

The skill tab costs one Markdown renderer in the binary, and one HTML string per component in its
chunk. The renderer is shared with the site generator, so the cost is paid once.

The state editor lists a state only after the scenario mounts, because a state exists only from
`initState` on. So the toggle of a stateful scenario appears a moment after the stage, and a
scenario that never initializes a state is scanned a few times before the page stops looking.
