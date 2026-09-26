# CLAUDE.md

## imp is unreleased - do not preserve backward compatibility

Until imp ships a `1.` version or higher, **treat it as never released**. There are no existing
users, no installed apps, and nothing outside this repo to break. When a better design shows up,
take it in full. Rename or remove an export, change a config key, change what a command prints, or
change the shape of anything.

- **Never add a compatibility shim, a deprecated alias, a fallback path, or a migration note.** Fix
  every call site in this repo. Update the docs and skills so they describe only the new design.
  Delete the old design.
- **Never let the old design survive in prose.** Docs, skills and ADRs describe what imp does now.
  They are not a changelog. They must not say what a key or an export used to be called.
- **Do not narrate a previous implementation.** A sentence such as "imp used to poll the server" or
  "the widget once read the log through a route" is history with no reader. Delete it. Mention a
  previous approach only when its outcome is the reason for the current decision, and then state the
  outcome: "a server round-trip per line made the list lag behind the click". A record of what
  changed is the git history, not a doc or an ADR.
- Reconsider this rule only when the version reaches `1.0.0`. From then on, a breaking change has a
  real cost.

## Hide Deno from the user

imp uses Deno as its runtime and toolchain. **Deno must stay an implementation detail.** A user must
not need to know that Deno is involved. Keep every user-facing surface imp-branded:

- **Config** lives in `imp.json`, never in a user-authored `deno.json`. The CLI reads `imp.json`
  in-process and applies its settings directly. It writes no derived `deno.json` to disk. Users edit
  only `imp.json`.
- **No lock file.** imp writes no lock file into a project. The committed `dependencies/` folder is
  the frozen state (`adr/vendored-dependencies.md`). Never tell a user about `deno.lock`.
- **Commands and docs** speak in terms of `imp` (`imp start`, `imp lint`, ...), not `deno`. They
  shell out to Deno underneath, but they do not say so.

The one exception is imp's own repo manifest, `deno.json` at the project root. It is imp's internal
build file, and the compiled binary contains it. End users never see it. When you add a feature that
needs new Deno tooling, route it through this same translation layer. Do not ask users to touch
Deno.

## ADRs (`adr/`)

ADRs record accepted architectural decisions, one decision per file. Conventions:

- **Presence means accepted.** There is no status field and no numbering. Every ADR in `adr/` is the
  current, accepted state of that decision.
- **File names are descriptive slugs** (`real-dom-no-virtual-dom.md`), not numbers.
- **Format per record:** Context / Decision / Consequences.
- **When a decision changes**, replace the old ADR with a new one that describes the new decision.
  If the decision is dropped, delete the ADR. Do not keep superseded records. Do not add status
  markers.
- **Keep ADRs in sync with the code.** An ADR must not describe a feature that is not implemented.
  Planned work belongs in `todo/`. When you add, rename or remove an ADR, update the table in
  `adr/README.md`. When one ADR refers to another, use the file-name slug.

## TODOs (`todo/`)

Planned work lives in `todo/`, one item per file. File names are descriptive slugs
(`version-manager.md`), the same convention as ADRs. When an item is implemented, delete its file.
If the item introduced an architectural decision, record that decision as an ADR.

## Docs (`docs/`)

`docs/` is public documentation for an external reader: a software developer who wants to learn
imp's features and what they make possible. This reader never reads imp's source code. The docs will
be published on a public site, so:

- Explain everything in terms of what the reader writes and what imp does for them. Never point at
  source files, internal function names, or repo paths.
- Do not refer to `adr/` or `todo/` from docs. When a design rationale helps the reader, summarize
  it inline in plain language.
- Do not put maintainer notes or TODO markers in docs. Planned work belongs in `todo/`.

Docs are for a person. The agent-facing text for the same subject lives in `skills/` (see below).

## Agent skills (`skills/` and `*.skill.md`)

`skills/` is the corpus that `imp skill <subject>` prints for an AI agent (`adr/agent-skills.md`).
It is the **only** documentation compiled into the binary. `docs/` is the source of the public site,
and nothing reads it at runtime. There is one page per subject, named after the subject
(`skills/state.md` is `imp skill state`). Each page is registered in `cli/src/skill.js` with its
summary, group and aliases. A test asserts that the folder and the registry match exactly.

The two corpora are **independent**. They serve different readers through different channels, so
neither dictates the structure of the other. A subject can be one skills page and part of a docs
page, or the reverse. An agent-only page with no docs counterpart is fine. Page names line up today,
but nothing enforces that.

A skill page has the same subject as its docs page, but a different reader: an agent that must write
correct code now and pays for every token it reads. So a skill page is short and mechanical. It
holds the imports, the call shapes, API/prop/option tables, **the rules an agent gets wrong**, and
one worked example. It drops the narrative, the rationale, and the reassurance that a person reads a
guide for. An agent reads it as plain text in a terminal, so keep it self-contained. A link to a
sibling page (`[state](state.md)`) prints as `state (imp skill state)`, and every link target is
listed again on a `Related:` line at the foot of the page. The rewrite adds parentheses of its own,
so never wrap a link in yours. Write `see [state](state.md)`, not `([state](state.md))`, which
prints as the doubled `(state (imp skill state))`.

Every component also ships an agent-facing manual next to it: `button.js` -> `button.skill.md`. A
standard component registers nothing. When an `imp/std` barrel exports the component,
`imp skill std/button` finds the sidecar, and a test enforces that every barrel export has one. The
first line of the sidecar is its summary, so start it with the component name. `imp build` folds the
same file into a JS-entry bundle as `impSkill`, so the sidecar is the only place a component's skill
is written.

**When you change a feature, update both audiences in the same change**: its `docs/` page for the
reader, and its `skills/` page (and any component's `*.skill.md`) for the agent. No test can check
this, because a page can be present and stale. The person who makes the change is responsible.

## Standard component groups - one folder, one name

**The folder of a standard component is its group, and that one name is used everywhere.** A
component in `lib/src/std/<group>/` is exported from the barrel `imp/std/<group>`, its preview
declares `groups.<group>`, and `std/preview-groups.js` has a key `<group>`. The one root barrel is
`imp/std`, which exports the `general` folder. A CLI test checks all three against the folders, so a
component in one folder that shows in another group fails the tests.

- **Never register a group that has no folder, and never make a folder that has no group.** A group
  needs enough components to earn a sidebar entry. Do not add a group for two components. Put them
  in the group that fits.
- **To move a component, move its files.** The component, its `*.preview.js`, its `*.skill.md` and
  its test move together into the new folder. Then update the barrel, the preview group, every
  import site, `docs/`, `skills/` and the ADRs in the same change.
- A shell part belongs in `shell`, a box that places children in `layout`, a read-only surface in
  `display`, a form control in `inputs`, a message to the reader in `feedback`, and a component that
  shows many records in `data`.

## Everything runs the compiled binary

**Every command that invokes imp runs the compiled `./imp`, never `cli/src/main.js`.** There is one
imp, the same one users get. There is no second "from source" mode that could behave differently.

`tools/imp.js` is the only way to run it. `deno run -A tools/imp.js <args>` runs `tools/compile.js`
at the repo root, then `./imp <args>` in the current folder. `compile.js` rebuilds only when the
binary is older than a git-visible file. So an edit to `cli/src` or `lib/src` forces a rebuild
before the command runs, and a green test run is never about stale code. An unchanged tree costs one
`git ls-files`, and the script prints that it skipped. Pass `--force` to `compile.js` to rebuild
anyway.

**Never invoke `./imp` by hand** (for example `../../imp test` from `lib/test`). A bare `./imp`
skips the freshness check and runs whatever was compiled last.

## Tasks and tools

`deno.json` holds four tasks. Each one is the daily command for one job:

| Task                | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `deno task preview` | serves the component previews from `lib/src` on <http://localhost:4517/> |
| `deno task site`    | builds the home page into `site/dist/` and serves that folder with `rfm` |
| `deno task test`    | runs the library unit tests, the library e2e tests, then the CLI tests   |
| `deno task check`   | runs `deno lint`, `deno fmt`, then `imp lint` on `lib/src`               |

`deno task test --update` rewrites the CLI snapshots. `rfm` is a static file server installed on the
machine, not part of the repo.

Every other maintainer job is a script, run directly with `deno run -A`:

| Script                                             | What it does                                            |
| -------------------------------------------------- | ------------------------------------------------------- |
| `tools/imp.js <args>`                              | compiles if needed, then runs `./imp <args>` here       |
| `tools/compile.js`                                 | compiles `./imp` when a git-visible file is newer       |
| `tools/build-site.js`                              | writes `site/dist/`, gallery included; CI runs this     |
| `tools/check-binary-size.js`                       | fails when `./imp` is over `binary-size-limit.json`     |
| `tools/update-dependencies.js`                     | updates the Deno dependencies and the formatter plugins |
| `tools/vendor-lucide.js` (with `--no-lock`)        | regenerates `lib/src/icons/lucide-icons.js`             |
| `tools/vendor-natural-earth.js` (with `--no-lock`) | regenerates the world data of `map`                     |
| `perf/run.js`                                      | builds the perf apps and runs the scenarios             |

## Previewing the standard components

`deno task preview` serves every `*.preview.js` under `lib/src` on <http://localhost:4517/>. This is
the working surface for the development of a standard component. The task runs `imp preview` from
`lib/src`. The `imp.json` there points `preview.groups` at `std/preview-groups.js`. That module
holds the sidebar's groups, their order and their icons. The CLI holds none of them. The same
`imp.json` points `preview.entry` at `preview.html`, which links the Sora, IBM Plex Sans and IBM
Plex Mono fonts from `lib/src/public/fonts/`, and `preview.themes` at the two theme files in `std/`.
Those themes take their tokens from `std/preview-look.js`. That module maps the imp design system
(`adr/imp-design-system.md`) to theme tokens: the colours, the three fonts, the type scale, the
radii and the shadows. The ground of the page is `background-app`, and a raised surface is
`color-surface`.

The page itself adds four layers in `cli/src/preview-shell.js`. The geometry, the brand bars and the
prose styles come from `cli/src/design-chrome.js`, which the home page shares. The geometry is the
corner mark of the design system, in the lower end corner of the canvas, under the content. It has a
fading line grid and six squares, and it is smaller on a phone. Its ink follows `color-text`, and
its three brand colours are constants. A panel paints the sidebar in the surface colour. A square of
8px starts every component row, and the square of the current row takes the first brand colour. On a
phone, the three brand bars stand at the end edge of the top bar. The main region is a transparent
scroll box, so the content sits on the ground. The page has no navbar. The themes are named
`imp-light` and `imp-dark`, so they replace those two built-in themes in the menu, and a remembered
choice keeps the look. All three fonts are licensed under the SIL Open Font License 1.1, so this use
is permitted. The font files are not changed. A changed IBM Plex file must not use the name "Plex".
The compiled binary does not contain `lib/src/public/`.

The task serves from `lib/src`, so the session log is `lib/src/.imp/dev.log`. To print it, run
`deno run -A ../../tools/imp.js logs` from `lib/src`, with `-n` or `-f` as needed. An `imp logs` at
the repo root finds no log there, and its message points at `lib/src`.

**An edit to a component during a session does not reach the page. Restart the task.** The dev
server reloads on save and rebuilds the preview page. But a preview imports `button` from `imp/std`,
and that import resolves to the library embedded in the running binary. So the page comes back
byte-identical. Preview files are read from disk, so an edit to a `*.preview.js` does live-reload.
The loop for a component edit is Ctrl-C, then `deno task preview` again. The task recompiles first.

## The home page of imp

`site/` is the home page: static HTML pages, Overview, Components and Docs, under one navbar.
`tools/build-site.js` writes the whole site into `site/dist/`. It renders `docs/*.md` and
`site/content/overview.md` with the vendored `marked`, highlights every code block at build time
with the tokenizer of `codeBlock`, and writes one `index.html` per page with its content, its title
and its description. There is no imp app on the site and no client-side router. A navbar link is a
plain link, and a click loads the next page. The only JavaScript is a small script for the theme
toggle, and the `imp-preview` element on the Components page, which is the export of `imp preview`.

The site takes its look from the same source as the preview page. `site.css` holds the tokens of
`std/preview-look.js` over the built-in themes as `--imp-*` custom properties, one set per colour
scheme, and the styles of `cli/src/design-styles.js`: the corner geometry and the Markdown prose. So
the site matches the imp theme without an imp runtime. An inline script reads the remembered scheme
before the first paint, so a dark page never flashes light. The build copies `lib/src/public/fonts/`
to `/fonts/`, so the pages and the gallery load the same font files from the site. The site sends no
request to another origin.

`deno run -A tools/build-site.js` writes `site/dist/`. It renders the pages, then runs
`imp preview --output` from `lib/src` into `site/dist/gallery/`. Set `IMP_SITE_URL` to the public
origin to get canonical links, `sitemap.xml` and `robots.txt`. Upload `site/dist/` as it is.
`deno task site` builds it, then serves `site/dist/` with `rfm`. The site draws its own navbar,
because the navbar of the design system is ink with white text, and the `shell` bar takes the
surface colour of the theme.

## After making changes

After you complete a batch of code changes, run `deno task check`. It runs `deno lint`, `deno fmt`
and `imp lint` on `lib/src`. Fix every issue it reports before you consider the work done. These
tools operate on imp's own repo source, so it is fine to invoke Deno directly here. This is internal
maintainer tooling, not a user-facing surface.

**Keep every change that `deno fmt` makes, also in files outside your scope.** `deno fmt` runs
repo-wide and can reformat files unrelated to your change, for example formatting drift in other
`todo/` or `adr/` files. Do **not** revert those reformats to keep a diff "focused". The formatted
state is the canonical state of the repo. Leave every change in place and include it in the commit.

**`deno lint` must pass clean.** If it reports an error, fix it before you consider the work done.
This holds for code you just wrote and for anything else it reports. Do not ignore, suppress, or
leave lint errors behind.

**The `imp lint` step of `deno task check` must pass clean too.** It lints `lib/src` with the rule
set that users get. That set is stricter than `deno lint`, and it includes the dead code checks. The
`imp.json` in `lib/src` lists the library entry points in `publicExports`, together with each export
that the CLI imports from `lib/src` by path. When you add such an import, list it there. Do not add
an `imp-lint-ignore` directive to library code.

## Git - commit on the branch you are on

**`main` is a working branch here. When the checked-out branch is `main`, commit straight to it.**
Do not create a topic branch first. Do not open a pull request. Do not fast-forward a side branch
back onto `main`. The history of the repo is linear on `main`, and a branch per change only adds a
merge to undo. When another branch is checked out, commit there instead. The rule is always to
commit where you already are.

Commit only when asked. `deno lint` and `deno fmt` must pass before you commit.

## Prose style - Simplified Technical English

**Write all prose in Simplified Technical English (ASD-STE100).** This covers `docs/`, `skills/`,
every `*.skill.md`, `adr/`, `todo/`, commit messages, user-facing strings, and this file. Code
identifiers, config keys, CLI commands, element names, and quoted CLI output are technical names.
Keep them as they are. Apply these rules:

- **Sentences.** Keep an instruction to 20 words or fewer. Keep a descriptive sentence to 25 words
  or fewer. Put one topic in one sentence. Put one instruction in one sentence. Split a long
  sentence instead of joining clauses with a dash or a semicolon.
- **Paragraphs.** Keep a paragraph to six sentences or fewer, on one topic. Start it with the topic
  sentence. Use a vertical list for a sequence of steps or a set of parallel items.
- **Verbs.** Use the active voice. Use the present tense. Give an instruction in the imperative
  ("Run `deno lint`", not "`deno lint` should be run"). Say "must" for a requirement and "can" for a
  possibility. Do not use "should", "may" or "might" for a requirement.
- **Words.** Use one term for one thing, everywhere. Use simple words in their most common meaning.
  Do not use idioms, metaphors, slang or humour ("out of the box", "footgun", "with teeth"). Do not
  use a noun cluster of more than three nouns. Do not leave out articles.
- **Warnings.** State the risk first, then the instruction.

The reason is not taste. Skills are read by agents that pay for every token, docs are read by
developers whose first language is often not English, and both are easier to translate and to search
when every sentence carries one idea.

## Code style

**Write ASCII only. Never write a long dash or other Unicode punctuation.** Every character you
write, in every file, must be plain ASCII. The dash is the character that most often gets through.
Write the hyphen `-`. Never write an em dash (U+2014), an en dash (U+2013) or a Unicode hyphen
(U+2010). The rest of the Unicode punctuation set goes the same way: `...` rather than a
single-character ellipsis (U+2026), `"` and `'` rather than curly quotes (U+2018-U+201D), `->`
rather than an arrow (U+2192), `|` rather than a middle dot (U+00B7). This holds everywhere: source,
docs, ADRs, skills, TODOs, commit messages, test snapshots and user-facing strings. It also holds
for this file.

**The rule covers punctuation, not content, and it has two deliberate exceptions.** Text that is
non-ASCII because that is what it says stays as written: a translation fixture in Arabic or Polish,
and third-party licence text quoted verbatim. Two glyph sets are kept on purpose. The first is the
pass/fail marks of `imp test` (U+2713 and U+2717), which show the result at a glance in a way a word
does not. The second is the box-drawing that esbuild prints in its own errors, which imp captures
rather than authors. Nothing else gets an exception. Do not add a third one without recording it
here.

The rule is not cosmetic, for two reasons. Skills and CLI output print into whatever encoding the
user's terminal has, where a non-ASCII byte is a mojibake risk rather than a nicer glyph. And a
markdown continuation line that starts with `-` after a wrapped long dash becomes a nested list
item. That class of bug shows up only when the page is rendered.

**Name a file with a hyphen between words, never an underscore.** `app-map.js`, `theme-colors.js`,
`user-card.skill.md`. An underscore needs one more key on most keyboards. The rule covers every file
in this repo: the library, the CLI, the tools, the tests, the scaffold of `imp init`, every path in
`docs/`, `skills/` and a `*.skill.md`. Two things keep an underscore because the name is not imp's
to choose: an environment value such as `IMP_BASEPATH`, since a shell does not accept a hyphen in a
name, and a vendored third-party asset that keeps its upstream name, such as the `.wasm` files under
`cli/src/vendor/`.

**Do not add comments to code.** Write self-explanatory code instead. Use clear, descriptive names
for functions, variables, and constants, so the intent is obvious without comments. Put prose
explanations in the docs (`docs/`) and ADRs (`adr/`), not in source files.

**Nothing in `lib/src` may run work at module scope.** A call in a top-level initializer forces a
bundler to keep the statement, and with it the whole module and everything it imports. That is how
an app ships the router because it rendered a button (`adr/tree-shakeable-library.md`). So module
scope declares functions, constants and plain data only. Build a value on first use. Import the
shared `impLogger` instead of calling `createLogger`. Write a short derived list out instead of
computing it. Only `Symbol`, `Set`, `Map`, `WeakMap`, `WeakSet` and `Object.freeze` can be called at
module scope, because a global cannot reach another module. A test fails on anything else and names
the line. Do not use `/* @__PURE__ */` to silence the test. That trades a checked rule for an
unchecked claim.

**Use modern JavaScript syntax (ES2017 / ES7 and newer).** This project targets modern browsers and
Deno only. There is no transpilation and no legacy support, so write current idiomatic JS. Prefer
`const`/`let` over `var`; arrow functions and rest/spread params over `function`/`arguments`;
template literals over string concatenation; destructuring, `for...of`, optional chaining (`?.`),
nullish coalescing (`??`), `async`/`await`, and other current language features. This applies to
browser-targeted code too, including scripts emitted as strings (for example the injected client and
the service worker code).

## Browser support - call the platform, never shadow it

**imp targets the current stable version of Chrome, Edge, Firefox and Safari** (Baseline Newly
available). A web platform feature is usable here the moment all four browsers ship it. imp does not
wait the further 30 months for Baseline Widely available. imp supports nothing older than current
stable. The full decision and its costs are in `adr/browser-support-baseline.md`.

Two rules follow, and they apply to every change:

- **Never write a polyfill, a feature detection, or a fallback path.** No `@supports` branch that
  guards a JS alternative. No `typeof el.showPopover === 'function'` check. No graceful-degradation
  tier. Below the floor imp **breaks rather than degrades**, on purpose. There is one code path, the
  current one.
- **Never write JavaScript that stands in for a platform primitive.** The rule is not "no
  JavaScript". imp is a JavaScript library. The rule is about what the JavaScript is _for_:
  - **Write it** when it implements a feature that nothing in the platform provides: sorting a
    table, fuzzy matching, walking a `field` path, validating a form, handling a keypress.
  - **Do not write it** when the platform owns the job: a focus trap (`showModal()` traps focus), an
    anchor positioning engine (CSS anchor positioning places it), a stacking registry (the top layer
    stacks), a scroll virtualizer (`content-visibility: auto`), a `:has()` shim.

**A component that cannot be built without the second kind does not get built.** Do not approximate
it. Do not ship it behind a caveat. Leave it out, and say in `docs/` what to use instead. This scope
rule has already removed `virtualList` from the catalog and parked `carousel`.

The rule needs a boundary, so here is the judgement call. A modal's scroll lock is **allowed**.
`showModal()` does not stop the page behind it from scrolling, on purpose. So `overflow: hidden` on
the document element is a one-property state toggle, not a shadow implementation of anything. When a
case is this close, put the reasoning in the ADR. Do not decide it again in silence.

Components with no platform counterpart at all (`comboBox`, `datePicker`, `tree`) are **in** scope.
They substitute for nothing. The platform has no such control.

## Direction and writing modes - logical always, RTL guaranteed

**Write every box in logical properties and logical units.** `inline-size` / `block-size`, not
`width` / `height`; `margin-inline-start`, not `margin-left`; `inset-block-end`, not `bottom`; `dvi`
/ `dvb`, not `vw` / `dvh`; `position-area` in logical keywords (`block-end`, `inline-start`). The
full decision and its scope are in `adr/logical-properties-rtl-scope.md`.

- **Never feed a physical unit to a logical property.** `max-inline-size: calc(100vw - ...)` is the
  bug this rule exists to stop. It bolts the text-flow axis to the width of the screen. It is also
  mismeasured in plain LTR, because `vw` counts the classic scrollbar and `dvi` does not. Both
  halves of one clamp must name the same axis.
- **LTR and RTL are a tested guarantee.** A direction bug in a standard component is a bug. The
  tests of an interactive component cover its mirrored geometry the same way they cover its
  keyboard.
- **Vertical writing modes are out of scope.** Logical properties mean that `vertical-rl` does not
  break structurally, and that is the whole commitment. Do not verify a component in it. Do not add
  a test for it. Do not fix an issue that reproduces only there. Close it as out of scope.
- **Direction is runtime state, never a build variant.** One bundle serves every direction. imp
  ships no per-direction build and never tells an app to serve RTL from its own URL. `init` already
  rewrites `<html dir>` when the language changes (`adr/translatable-by-default.md`).
- **The one exception is the fluid theme scale.** Its `clamp()` values in `lib/src/theme.js` use
  physical `vw` on purpose. They must be static, and a dynamic unit would resize every spacing token
  as a mobile URL bar slides. Do not cite this exception anywhere else.

## Accessibility

**imp supports accessibility by default.** An app built from standard components clears the common
WCAG bar without the app author wiring ARIA, focus, or keyboard handling by hand. Accessibility is a
property of the components imp ships, not something each app re-implements. Treat it as a shipping
requirement of every component, never as a follow-up pass. The full contract and its open questions
live in `todo/accessibility.md`.

When you build or change a standard component:

- **Render the native element wherever one exists** (`button`, `a[href]`, `input`, `<dialog>`), so
  that roles, states and keyboard behaviour come from the platform. Add ARIA roles only where no
  native element fits. ARIA changes what is _announced_, never what an element _does_. A `role` on a
  `div` buys nothing until the focus and key handling are written by hand as well.
- **Keep ARIA id references inside a single component.** `aria-labelledby`, `aria-describedby`,
  `aria-controls`, `aria-activedescendant`, `aria-errormessage` and `label[for]` resolve by id and
  **cannot cross a shadow root** (`adr/shadow-dom-isolation.md`). Two elements that need a reference
  between them must be rendered by the same component. So this decides where the component boundary
  falls. Settle it while you design the props, not after. It is the one accessibility decision that
  cannot be retrofitted without breaking the public API. Prefer a data-driven prop
  (`tabs({ items })`) over a compositional one wherever an internal reference exists. `aria-label`
  is a plain string and crosses boundaries freely, so it is how a control is named from outside.
- **Every pointer interaction has a keyboard equivalent**: Tab order, Enter/Space activation, arrow
  keys for composite widgets, Escape to dismiss overlays.
- **Bind ARIA state to the same state that drives the visuals**, so that `aria-expanded`,
  `aria-selected`, `aria-checked` and `aria-busy` can never drift from what is shown. A state
  attribute written once at mount and never updated is worse than none. It lies.
- **Every interactive element needs an accessible name.** Icon-only controls take an explicit label
  prop. User-facing strings route through `t()` (`adr/translatable-by-default.md`).
- **Styling:** a `:focus-visible` ring from the shared `focusRing`; contrast-carrying widths from
  `--imp-border-width` / `--imp-focus-ring-width` rather than hardcoded values; the shared
  `forcedColors` block wherever colour alone distinguishes two things; and `prefers-reduced-motion`
  respected by anything that animates.
- **Interactive components ship with a test** that asserts role, accessible name and keyboard
  operability. The baseline is a test-backed guarantee, not a best-effort convention.
