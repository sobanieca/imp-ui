# imp — CLI

The `imp` CLI is an all-in-one toolkit for imp apps: a static dev server, a dependency manager, a
linter, and a formatter in a single binary. imp is built for the AI era — every part of the workflow
is designed to work hand in hand with AI coding agents, to the point where an app can be developed
end to end without writing a line of code by hand.

**Development is buildless.** There is no build step, no bundling, and no transforms while you work
— `imp start` serves your files exactly as you wrote them. You edit a file, the browser reloads, and
what runs is the source you typed. Dependencies are added once with `imp install` and live inside
your repository from then on (see **[Managing dependencies](dependencies.md)**), so serving needs no
network and no package installation — a fresh clone is the whole, runnable app.

**Production has a build.** When you are ready to ship, imp packs the app into a single
self-contained, minified bundle you can upload to any static host or CDN — no imp runtime required
on the server, just static files. Lazy-loaded modules are built too, split into separate chunks that
load on demand instead of being inlined into the main bundle. The same resolution used in
development is applied to the bundle, so what you tested is what ships.

## Installation

`imp` ships as a single self-contained binary. On macOS or Linux (x64 or arm64) the install script
detects your platform, downloads the latest binary, and puts it on your `PATH`:

```sh
curl -fsSL https://raw.githubusercontent.com/sobanieca/imp-ui/main/install.sh | bash
```

It installs to `/usr/local/bin` by default; set `INSTALL_DIR` to choose another location. To install
by hand instead, download the binary for your platform from the
[releases page](https://github.com/sobanieca/imp-ui/releases/latest), make it executable, and put it
anywhere on your `PATH`:

```sh
curl -fsSL -o imp https://github.com/sobanieca/imp-ui/releases/latest/download/imp-linux-x64
chmod +x imp
```

The asset names are `imp-linux-x64`, `imp-linux-arm64`, `imp-macos-x64`, and `imp-macos-arm64`.
Confirm the install with `imp --version`, which prints the version the binary runs.

## Commands

```
imp start [file.html] [--port 4507]   serve a page (default: index.html)
imp build [file.html] [--outdir dist]   build the app for production
          [--pwa]                     also emit an installable, offline PWA
imp preview [path] [--port 4517]      preview components in isolation, one page per
            [--list] [--json]         *.preview.js file (no path: an index of all of them)
imp install [package[@version]]       vendor a dependency into dependencies/
                                      (no version: latest · no package: update all)
imp uninstall <package>               remove a vendored dependency
imp test  <file>                      run one test file: *.test.js unit in-process,
                                      *.spec.js e2e in a real browser
imp test  --unit | --e2e              run every file of that level, each in its own
                                      process, in parallel (--jobs <n> caps concurrency)
imp resize <image> [-w <px>] [-h <px>]   shrink an oversized PNG/JPEG asset in place,
           [--out <path>] [--stretch]  keeping aspect ratio unless --stretch is given
                                      (neither -w nor -h: report current dimensions
                                      and size, plus a recommended resize command)
imp lint  [...paths] [--fix]          lint with imp rules (--fix applies autofixes)
imp fmt   [...paths]                  format source
imp skill [...subject]                print imp's manual for a subject, for an AI agent to
                                      read (no subject: the index of every subject)
imp update [version] [--check]        update to the latest release and pin it in imp.json
imp prune                             delete cached imp versions unused for 30+ days
imp licenses                          print third-party license notices for bundled tools
imp --version                         print the version this binary runs
imp help                              show usage
```

Running `imp` with no arguments, `imp help`, or `imp --help` prints usage. An unknown command prints
usage and exits with code 1. The usage text ends with a line addressed to AI agents, pointing them
at `imp skill` — the manuals imp carries for exactly that reader.

## Configuration — `imp.json`

The only config file you author is `imp.json` at your project root, and it is optional — every
command works without it. It holds your imp version pin, your vendored dependencies, per-command
options (`fmt`, `lint`, `test`, `preview`, `pwa`), and the named environments you select with
`--env`:

```json
{
  "version": "1.2.3",
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "devServerPort": 9085,
  "fmt": { "lineWidth": 100 }
}
```

Every key, what reads it, and the environment files behind `--env` are covered in
**[Configuration](config.md)**. The rest of this page describes the commands themselves and points
at the keys each one honours.

## `imp start`

```
imp start [file.html] [--port 4507]
```

Serves the directory containing the given HTML file (default: `index.html` in the current directory)
on the given port. The command exits with an error if the file does not exist or is a directory. The
entry file itself is reachable at `/`.

The port is resolved in this order: the `--port` flag if given, otherwise the `devServerPort` set in
`imp.json`, otherwise the default `4507`. Set a fixed port for a project without repeating the flag:

```json
{
  "devServerPort": 9085
}
```

Three things are injected into every served HTML document automatically — you never reference the
imp library by path (injection is skipped for documents that already contain it):

- **Import map.** `imp` and its subpaths resolve to the served library, so pages import by bare
  specifier (see **[Imports](imports.md)**):

  ```js
  import { mount } from 'imp'
  import { div, h1 } from 'imp/html'
  mount('#app', () => div(h1('hello')))
  ```

  The library source is served under `/@imp/` (`/@imp/imp.js`, `/@imp/api/html.js`, …). Bare
  specifiers are used instead of injecting globals because tag factories include names like `a`,
  `b`, `i`, `p`, `time`, and `menu` that would collide on `window`.

- **Console + error telemetry.** A small inline script forwards `console.*`, uncaught errors, and
  unhandled rejections to the terminal, prefixed `[browser:*]` — you (or an LLM coding assistant
  driving the session) read runtime behavior straight from the terminal, no devtools needed.

- **Network telemetry.** A service worker (registered at root scope) intercepts _all_ request types
  — `fetch`, `XMLHttpRequest`, images, scripts, navigations — and reports each as
  `[net] METHOD url → status ms`. Requests under `/@imp/` are passed through untouched.

Everything `imp start` prints — the browser console and error telemetry, the network telemetry, and
its own status lines — is **also written to a log file** at `.imp/dev.log`, one entry per line, so
you don't have to keep the terminal in view to see what happened. This is what makes the dev session
legible to an AI coding agent: while you click through the app, the agent can `grep .imp/dev.log`
for a `[browser:error]`, a failed request, or any message it expects, instead of needing to watch
the terminal. The file is truncated each time you start the server, so it always reflects the
current session, and it is capped: only the most recent entries are kept (4000 by default), with
older ones rolling off as new ones arrive, so a long session never grows the file without bound.
Raise or lower the cap with **`maxLogEntries`** in `imp.json`:

```json
{
  "maxLogEntries": 10000
}
```

The path is `.imp/dev.log` under the served project — `.imp/` is imp's per-project working directory
and should be git-ignored (a fresh `imp init` project already ignores it).

Live reload is included: file changes under the served directory trigger a browser reload (changes
inside `.git/`, `node_modules/`, `dist/`, and imp's own `.imp/` working directory are ignored).

Static files are served with correct content types for common web assets. Requesting a directory
redirects to its trailing-slash URL and serves the `index.html` inside it; paths outside the served
directory are rejected.

Internal endpoints (reserved, not part of your app): `/@imp/events` (reload stream), `/@imp/log`
(telemetry sink), `/@imp/sw.js` (the service worker), and `/@imp/*` (library source).

### Dependencies

Vendored dependencies need nothing special from the dev server: the injected import map points each
declared alias at its bundle inside your project's `dependencies/` folder, which is served like any
other static file — no network, no on-the-fly resolution:

```js
import mitt from 'mitt'
```

If a declared dependency has no vendored bundle yet (say, right after editing `imp.json` by hand),
`imp start` prints a warning suggesting `imp install`.

## `imp build`

```
imp build [file.html|file.js] [--outdir dist] [--pwa]
```

Builds the production version of your app into an output directory (default: `dist/`) that you
upload to any static host or CDN exactly as it is — plain static files, no imp runtime, no import
map, nothing to install on the server. The output directory is replaced on every run.

It's called `build`, not `bundle`, because producing that output is more than bundling your
JavaScript: it's the whole production-build step, and it can emit additional generated files
alongside the bundled code, not just the bundles themselves.

Given an HTML page (default: `index.html`, the same entry `imp start` serves), imp finds the page's
module scripts and bundles each one into minified, self-contained JavaScript:

- **Same resolution as development.** `import { div } from 'imp/html'` and every vendored dependency
  alias resolve exactly as they do under `imp start` — every `imp` specifier to the built-in
  library, each alias to the bundle in your `dependencies/` folder. The build runs fully offline;
  what you tested in development is what ships.
- **Paths are preserved.** Each `<script type="module" src="…">` keeps its URL — the bundled file is
  written to the same relative path the source file had — so the HTML works unchanged. Inline
  `<script type="module">` blocks are bundled too and re-inlined, minified with their imports
  resolved.
- **Code splitting.** Modules you load lazily with `import()` are split into separate chunks (under
  `chunks/`, with content hashes) that load on demand, and code shared between several entry points
  is emitted once instead of being duplicated into each bundle.
- **Everything else ships verbatim.** Files that were compiled into the bundles (your module
  sources, the vendored dependency bundles) are omitted from the output; every other project file —
  stylesheets, images, fonts, plain text — is copied over unchanged, so the output directory is the
  complete site.

Given a JavaScript module instead of a page, `imp build` emits that module as a single
self-contained file: imp itself and every dependency are compiled in, so the result — say, a web
component authored with imp — can be dropped into any application, whatever framework it uses,
without pulling in imp or any other runtime.

**A JS build carries its skills; a page build strips them.** A module entry is something other
developers program against, so if a `counter.skill.md` file sits next to it, imp folds that text
into the output as an `impSkill` export and it travels with the component to whoever installs it. An
HTML entry is a finished app that nobody writes code against, so imp adds no skill text, copies no
skill file into the output, and removes any `impSkill` it finds on the way in — from a pre-built
component you installed as much as from your own modules, and from lazily loaded chunks as much as
from the main bundle. See **[Components](components.md)**.

### Targeting an imp host — sharing the host's imp

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "targetImpHost": true
}
```

By default a JS-entry bundle carries everything it needs, including imp itself. If what you are
building is a component meant to run inside another imp application — an application that already
has imp — set `targetImpHost: true` in `imp.json`: bundling a JS entry then leaves every
`import … from 'imp'` (and `'imp/…'`) in the output as a bare import for the host to resolve, and
only your code and your dependencies are compiled in. Nothing changes in development — the dev
server's import map resolves `imp` exactly as before — and nothing changes for your other
dependencies, which are always bundled in with the versions you pinned.

Inside an imp application the bare `imp` imports are already resolvable: in development through the
import map the dev server injects, and in production because the host's own `imp build` resolves it
when it builds. The host page then holds a **single copy** of imp shared by the app and your
component, instead of one copy each. The same contract holds when your component is published to a
registry and vendored with `imp install` — the consuming app keeps the `imp` import bare and
provides its own copy. See **[Managing dependencies](dependencies.md)**.

Two things to be aware of:

- **The host must actually provide imp.** Outside an imp application that means adding an import map
  entry (or bundler alias) mapping `imp` — the bundle fails at load time in a page that maps
  nothing. When in doubt, leave `targetImpHost` off and ship self-contained.
- **imp version skew.** A self-contained bundle freezes the imp version it was built with; one built
  for an imp host runs against whatever imp version the host provides, which may be newer or older
  than the one you developed against. A host upgrading imp can change your component's behavior
  without your bundle changing at all — test your component against the imp versions your host
  applications actually run.

`targetImpHost` affects only JS entries. An HTML build has no import map in its production output,
so nothing could resolve a bare import left in it — bundling an HTML page compiles imp in as usual,
because the page is its own host.

### Progressive Web App — `imp build --pwa`

Add `--pwa` to a page build and imp emits everything an app needs to be installed to a home screen
and to keep working offline — a web app manifest, a full icon set scaled from one source image, and
an offline service worker — alongside the normal production output. Without the flag, `imp build`
produces a plain build exactly as before, so a PWA project can still make a quick, plain build with
a bare `imp build`.

Describe the app once, in a `pwa` block in `imp.json`:

```json
{
  "pwa": {
    "name": "My App",
    "shortName": "App",
    "themeColor": "#0b0b0b",
    "backgroundColor": "#ffffff",
    "display": "standalone",
    "icon": "assets/icon.svg"
  }
}
```

Only `name` and `icon` are required. `icon` points at a **single** high-resolution source image — an
SVG (preferred, it scales to any size cleanly) or a large PNG or JPEG — and imp scales it to every
icon the manifest and the platforms need, so there is no hand-maintained icon set to keep in sync.
Raster sources should be at least 512px on their longest edge — the largest generated icon is
512×512, and a smaller source has to be upscaled to reach it, which costs sharpness; the build
prints a warning when that happens. The build then, in one step:

- **Generates the icon set** — 192px and 512px app icons, a 512px maskable icon padded to survive
  platform masking, and a 180px apple-touch-icon — regenerated from the source on every build.
- **Writes `manifest.webmanifest`** with your app's name, colors, and display mode, and guarantees
  the fields browsers require to offer installation (a name, 192px + 512px icons, a display mode,
  and a start URL).
- **Writes an offline service worker** (`sw.js`) and injects the manifest link, theme-color meta,
  the apple-touch-icon link, and the service-worker registration into your page's `<head>` — the
  built HTML ships ready to install, with no edits to your source.

**The service worker is the part that matters.** Anything can template a manifest and resize an
icon; what actually breaks for a real user is being offline, on a flaky network, or opening the app
the day after you deploy. imp gets this right because it builds your app and therefore knows the
exact set of files that make it up:

- **The precache list is exact.** The service worker precaches precisely the files this build
  produced — every hashed script and chunk, every asset, plus the manifest and icons — because imp
  derives that list from the build itself, not by scanning a folder and guessing afterwards. Nothing
  needed to run the app offline is missed, and nothing stale is cached.
- **Deploys are never stuck.** The cache is keyed to the content of the build, so a new deploy is a
  new cache: on activation the worker fetches what changed and deletes what's gone, and users move
  to the new version automatically instead of being pinned to an old one by their own cache.
- **Safe defaults, no configuration.** Your page and its deep links are served network-first and
  fall back to the cached app shell when offline; hashed assets are served cache-first; cross-origin
  responses, non-`GET` requests, and error responses are never cached. These are the choices that
  avoid the classic offline footguns, and they apply out of the box.

**In development (`imp start`) installability is automatic** — no `--pwa` flag and no HTML edits.
When your `imp.json` has a `pwa` block, the dev server injects the manifest and icon links and
serves a generated manifest and icons on the fly, so you can install the app and check its icons and
colors while you work. The **offline** service worker, though, is only ever generated by
`imp build --pwa`: in development the app keeps live reload and the terminal network telemetry (the
dev service worker reports requests and does no caching), and offline behavior is something you get
in the production build, where it belongs. That split is deliberate — you never want a caching
worker fighting live reload while you edit.

**One caveat when you preview a production build.** A service worker controls a whole origin, and
both the dev telemetry worker and the offline PWA worker claim root scope — so if you serve a
`imp build --pwa` output and then run `imp start` on the _same host and port_, the offline worker
installed by the production preview can linger and keep serving its cache, which looks like stale
content or broken live reload in the dev server. It resolves itself once the dev worker takes over,
but the production caches persist until then. If you hit it, open your browser's dev tools →
Application → Service Workers, unregister the worker, and clear site data (or just preview
production builds on a different port than `imp start`).

## `imp install` and `imp uninstall`

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

`imp install` adds a dependency to your project: it resolves the package (npm by default, `jsr:` for
the jsr registry), bundles it into a single minified browser-ready module, writes the bundle into
the committed `dependencies/` folder, and pins the exact version in `imp.json`. Without a version it
resolves the latest release — which also makes re-running it the update path — and with no arguments
at all it updates every declared dependency. `imp uninstall` removes a dependency's folder and its
pin. Your code imports dependencies by their bare alias (`import mitt from 'mitt'`). A package that
itself imports `imp` keeps that import bare — your app provides the imp library, so `imp` is never
mistaken for a registry package.

See **[Managing dependencies](dependencies.md)** for the full story: version pinning, updating,
aliases, jsr packages and subpaths, what gets printed, and why the vendored folder is committed.

### File-size warning

Because vendored bundles are committed to your repository, `imp install` warns when a package
bundles to more than `maxFileSize` (200 kB by default) so a heavy dependency doesn't slip in
unnoticed. The warning names the total that would land in `dependencies/` and reminds you of the two
knobs. To silence it — for a dependency you know is large and want anyway — raise `maxFileSize`, or
add the dependency to `maxFileSizeIgnore` in `imp.json` (its folder, e.g. `dependencies/charts`, or
a specific file) so repeated updates stop warning:

```json
{
  "maxFileSize": 262144,
  "maxFileSizeIgnore": ["dependencies/charts"]
}
```

This is the same limit `imp lint` enforces (see below), so one number governs both.

## `imp test`

```
imp test <file> [--filter <text>]
imp test --unit | --e2e [--jobs <n>] [--filter <text>] [--list] [--video <dir>]
```

Runs the project's tests on two levels through one command: files ending in `.test.js` are unit and
integration tests, executed in-process against a built-in simulated browser environment — no real
browser, very fast; files ending in `.spec.js` are end-to-end tests — imp serves your app exactly
like `imp start`, launches a headless Chrome, and hands each spec a ready-made Puppeteer page
pointed at the running app, with the browser's console and network activity streaming to the
terminal. Tests are written with `test` and `expect` imported from `imp/test` — runner and
assertions are built into the binary, nothing to install.

imp runs **one test file per process** — the unit of isolation, so no two files share a process's
globals, timers, server, or browser. `imp test <file>` runs exactly that one file and exits with its
result. To run a whole level, name it: `imp test --unit` (every `*.test.js`) and `imp test --e2e`
(every `*.spec.js`) discover their files and run each in its own process, in parallel, capped by
`--jobs <n>` (default: your CPU count). Passing files are summarized to one line, failing files
print their full output, and the run exits `1` if any file failed. A bare `imp test` with more than
one candidate file won't guess — it asks you to choose `--unit`, `--e2e`, or a single file, runs
nothing, and exits non-zero so a stray `imp test` fails CI instead of passing green. For fan-out
across **machines** (a CI matrix, which imp can't schedule), `imp test --list` prints the selected
files as JSON to hand out one per job.

Add `--video <dir>` to an e2e run and imp records each spec's browser session as an animated GIF —
one file per spec, written into `<dir>`. Because a GIF plays inline in a GitHub pull request, this
is how an agent (or a person) can attach a clip of a new feature working so a human reviewer can
double-check its behaviour and look and feel. Recording is off by default; a `test.video` block in
`imp.json` tunes frame rate, duration, width, and quality (or turns it on without the flag).

See **[Testing](testing.md)** for the full runner API, the assertion reference, browser resolution,
recording, and the CI parallelization pattern.

## `imp preview`

```
imp preview [path] [--port 4517] [--env <name>]
imp preview --list [--json]
```

Builds one component at a time, in isolation. `imp preview` serves each of your **preview files** as
its own page: every named export becomes a labeled panel holding that component, centered in a stage
you can drag to any size, with a state editor beside it. No app boot, no backend, no navigating to
the right screen — you edit the component, the page reloads, and you see it.

It is the same dev server as `imp start` underneath, so the browser's console and network activity
still stream to your terminal, and saving any file reloads the page.

### The preview file

A component in `todos.js` gets a sibling `todos.preview.js`. It is ordinary imp code: import the
component and export one instance per state worth looking at.

```js
import { todoList } from './todos.js'

export const empty = todoList({ todos: [] })
export const populated = todoList({ todos: [{ id: 1, title: 'Buy milk' }] })
export const busy = todoList({ loading: true })
```

Each **named export is a scenario**, and the export name is the panel label — the code is the only
place a scenario is named, so there is nothing to keep in sync. Panels appear in the order you wrote
them. A scenario is just the component pre-filled, built with the same call you would write at a
real call site, so there is no story format to learn; arguments dispatch by type exactly as they do
in your app. Export a function instead of an instance when a scenario needs setting up at render
time (`export const lazy = () => todoList(buildFixture())`) — imp calls it when it renders the
panel.

### Mocking what the component imports

The point of an isolated preview is that a component with hard dependencies still renders on its
own. Replace any module it imports with `mockModule`, exactly as you would in a test:

```js
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

mockModule('./http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk', done: false }]),
}))

export const populated = todoList()
```

`mockModule(specifier, factory)` behaves the same here as in `imp test`: the specifier is a path
relative to the preview file or a dependency alias from `imp.json`; the factory returns the module's
exports and receives `{ spy, orig }`; every import of that module — from the component and from
anything it imports, at any depth — resolves to what you returned, and `orig()` keeps the rest of it
real. See **[Mocking modules](testing.md#mocking-modules--mockmodule)** for the full behavior. Mocks
are plain objects you write and they live next to the component, so a reviewer sees the fixture and
the component in one diff.

A mock applies to the whole preview file, so scenarios that need different data differ by the
arguments you pass them.

### The stage

Each panel holds its component in a stage you resize by **dragging its right, bottom, or corner
handle** with a mouse or a finger. The component re-lays-out live at every width, which is the
quickest way to find the breakpoint where it breaks — no device emulation to open. A readout shows
the current size, and `phone`, `tablet`, and `desktop` buttons jump to common viewports; `fit`
returns the stage to the full page width.

### The state editor

Beside each stage is a form listing the state the component manages, found by reading your source
for `initState` and `useState` names. Values are shown as JSON: edit one, apply it (or press
`Ctrl`/`Cmd`+`Enter`), and the component updates through imp's normal fine-grained path — no
re-mount, no reload. The form also follows the state, so clicking around in the component shows the
new value.

Each panel gets its own form bound to its own instance, so `empty` and `populated` are poked
independently on the same page. This discovery is a convenience, not a rule about how you write
components: a state name that is computed at runtime or built behind a helper simply won't be
listed, and a value that isn't JSON data is shown read-only.

### Themes

A theme switcher in the top bar applies a theme to the whole page, so you can check the component
under each of your themes without touching code. Your choice is remembered across reloads. The
built-in `imp-light` and `imp-dark` are always offered.

List your own theme files in `preview.themes` to add them to the switcher:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Each path is a module that default-exports a theme — the same file your app passes to `applyTheme`,
nothing preview-specific about it. The label in the switcher is the theme's `name` (the file path if
it has none, or if two themes share a name). Your themes are listed first and the first one is
selected by default, so a preview opens looking like your app rather than like the starter theme.
Editing a theme file reloads the page with the new tokens applied, so a preview page is also the
fastest way to iterate on a theme. See **[Theming](theming.md)**.

### Language and text direction

Next to the theme switcher are a **language** picker and a **direction** picker, so you can see a
component the way a reader of another language sees it without changing a line of code. Both choices
are remembered across reloads.

The language picker sets the page's language, which re-localizes everything bound through `lang` —
your own messages and the reserved `imp.` ones the standard components ask for alike. It lists the
languages you point it at, so tell it where your translation files are under `preview.translations`:

```json
{
  "preview": { "translations": { "en": "./locales/en.js", "pl": "./locales/pl.js" } }
}
```

Each path is a module that default-exports your messages — the same file your app passes to `init`.
The first one is selected by default, so a preview opens reading like your app, and editing a
translation file reloads the page with the new wording. Declare none and the picker is left out
entirely; the direction picker still works.

The direction picker has three settings. **auto** takes the direction from the language, which is
what your app does — pick Arabic or Hebrew and the component lays out right to left. **ltr** and
**rtl** pin it, so you can check a right-to-left layout while reading English text, which is the
quickest way to catch a hardcoded `margin-left`.

Only the component is affected: the preview's own toolbar and panels stay left to right whatever you
pick, so the controls do not move around underneath you. See **[Translations](i18n.md)**.

### Finding and opening previews

With no path, imp discovers every `*.preview.js` file in the project and `/` lists them all. Pass a
path to narrow it: a preview file opens straight to it, a component path opens its sibling preview
(`imp preview components/todos.js` finds `components/todos.preview.js`), and a folder limits
discovery to that folder. Add `?scenario=<name>` to a preview URL — or click **isolate** on a panel
— to render just that one scenario.

`imp preview --list` prints the discovered preview files, one per line, and `--list --json` prints
them as a JSON array for tooling. `--port` chooses the port (default 4517) and `--env` selects an
environment entry from `imp.json`, exactly like `imp start`. Keep a folder out of discovery with a
`preview.exclude` array in `imp.json`:

```json
{
  "preview": { "exclude": ["vendor-demos"] }
}
```

Preview files are never part of your app: nothing imports them, so `imp build` never sees them.

## `imp resize`

```
imp resize <image> [-w <px>] [-h <px>] [--out <path>] [--stretch]
```

A convenience utility for the common case that bloats a repository: a committed image checked in far
larger than the page ever displays it. `imp resize` downscales it in place — it is not an image
editor, and anything beyond a straight resize is intentionally out of scope.

The aspect ratio is always preserved unless you explicitly opt out. How the width and height flags
combine:

- **One of `-w` / `-h`** — resize to that dimension and compute the other to preserve the original
  aspect ratio.
- **Both `-w` and `-h`** — scale the image, keeping its aspect ratio, to the largest size that fits
  within that width × height box.
- **Both plus `--stretch`** — resize to exactly that width × height, even if it distorts the
  picture. You asked for a specific size and accept the stretch.
- **Neither** — inspect mode; nothing is written. imp reports the image's current dimensions and
  byte size, and if the asset is oversized it also prints a ready-to-copy `imp resize` command that
  would bring it down to a sensible size. This is the natural first step: check what you have, then
  decide what to resize to — and it doubles as a quick way to check any PNG or JPEG's dimensions
  from the terminal.

By default the file is overwritten — that fits the "shrink a committed asset" purpose. Pass
`--out <path>` to write the result to a new file and leave the original untouched. Either way imp
reports the before and after dimensions and byte size.

Resizing **only ever downscales pixels, with minimal compression** — quality is prioritized over
squeezing out the last byte. A request larger than the source is clamped to the source, so the
command never upscales. If you need fine-grained control over compression or quality, reach for a
dedicated image tool; imp keeps this surface deliberately small.

**Scope.** Static **PNG** and **JPEG** are supported today. WebP, GIF, and animated images (animated
PNG included) are not yet handled — imp detects them and stops with a clear message rather than
silently dropping frames or changing format — and support may broaden later.

## `imp lint`

```
imp lint [...paths]
imp lint --fix [...paths]
```

Lints the given paths (default: the whole project) with a standard recommended rule set plus imp's
own rules, which are always applied: `no-capital-component` (imp components are lowercase functions)
and `exact-dependency-versions` (dependency pins in `imp.json` must be exact, and imports must go
through declared, vendored dependencies — see **[Managing dependencies](dependencies.md)**). `.html`
files are covered too: inline `<script>` blocks are linted like any other code.

`--fix` rewrites files in place, applying every autofix the rule set offers (in `.html` files the
inline `<script>` blocks are fixed too) and leaving only the problems that need a human. Problems
suppressed by `imp-lint-ignore` comments are never touched.

Per-rule severities and excluded paths are configured under `lint` in `imp.json`, and
`imp-lint-ignore` comments suppress findings in code.

**File-size check.** `imp lint` also scans every file tracked in your git repository and errors when
any single file is larger than `maxFileSize` (200 kB by default), reporting each oversized file with
its size and exiting non-zero so oversized commits fail CI. It shares one limit with `imp install`:
set `maxFileSize` in `imp.json` to change it, and list repo-relative paths in `maxFileSizeIgnore` to
exempt files that are legitimately large (a committed asset, say):

```json
{
  "maxFileSize": 262144,
  "maxFileSizeIgnore": ["assets/hero.png"]
}
```

An ignored path — an exact file, or anything under a listed folder — never trips the check. Outside
a git repository the file-size scan is skipped; the rest of `imp lint` runs unchanged.

See **[Linting](lint.md)** for the full rule descriptions, configuration, ignore directives, and
output format.

## `imp fmt`

```
imp fmt [...paths]
imp fmt --check [...paths]
```

Formats the given paths in place (default: the whole project) — JavaScript, JSON, Markdown, CSS,
HTML, SVG, XML, SQL, and YAML, with inline `<script>`/`<style>` blocks in HTML formatted too.
`--check` reports files that would change without writing them and exits non-zero when formatting is
needed — useful in CI.

Options (line width, quotes, semicolons, …) come from the `fmt` block of `imp.json`, and
`imp-fmt-ignore` comments protect hand-crafted layout.

See **[Formatting](fmt.md)** for supported languages, all options and their defaults, ignore
directives, and check mode.

## `imp skill` — the manuals, for an AI agent

```
imp skill                        the index: every subject with a one-line summary
imp skill <subject>              one subject's manual, in full
imp skill state routing          several manuals in one call
imp skill std/button             one standard component's skill
imp skill ./components/counter.js   one of your own components' skills
```

imp assumes a lot of app code is written by an AI coding agent, and an agent cannot browse a
documentation site while it works. `imp skill` prints a manual straight out of the binary: offline,
with no network call, and at the exact version of imp the project runs, so what the agent reads is
what the project executes.

These manuals are written **for an agent**, not for you: they carry the same subjects as these pages
— the call shapes, the prop and option tables, and the mistakes the API invites — stripped of the
narrative a person reads a guide for. So `imp skill state` is not this documentation reflowed for a
terminal; it is the short, mechanical version of it, and the two are written and updated together.

With no argument it prints an **index**: one line per subject with a short summary, grouped into
what you need to write an app (imports, rendering, components, state, routing, theming,
translations, logging), what you need to work in the project (the CLI, testing, dependencies,
linting, formatting), one line per standard component — and, last, every component **in your
project** that has a skill file next to it. An index is cheap to read, so an agent spends one call
finding out what exists and one more learning the part it needs.

With one or more subjects it prints those manuals in full. Skill text is the only thing written to
standard output — every diagnostic goes to standard error — so `imp skill state > state.md` captures
exactly the manual and nothing else. There are no flags: running the command and reading the output
is the whole interface.

Subjects answer to the names you are most likely to have in hand already. The import specifier works
(`imp skill imp/state`, `imp skill imp/std/button`), so does the plain subject (`state`,
`rendering`, `button`), and so does a page name (`state.md`), all case-insensitively. An unknown
subject prints the list of real ones to standard error and exits with code 1. Cross-references
between manuals are printed as the command that fetches them — "Rendering (imp skill rendering)",
plus a `Related:` line at the foot of the page — so an agent can always follow one manual to the
next without guessing at a file path or a URL.

**Components are asked for by file.** `imp skill ./components/counter.js` prints the skill file
sitting next to that module — `counter.skill.md` — and naming that file directly works too. It is
the same convention imp's own components follow, so `imp skill std/button` and
`imp skill ./components/counter.js` are one operation on two different components. A component with
no skill file exits with code 1 and names the file to write, so a tool can tell "no skill yet" apart
from a real failure. See **[Components](components.md)** for how to write one and what happens to it
at build time.

## `imp update` — pinning the imp version

```
imp update [version] [--check]
```

A project can pin the exact imp version it is built against with a `"version"` field in `imp.json`.
Once pinned, **any** imp binary runs the project on that version: on startup imp compares the pin
against itself, and on a mismatch it fetches the pinned version (once, cached per-user) and hands
off to it. There is nothing to install per project and no version managers to configure — whoever
runs `imp start`, `imp test`, or any other command gets the version the project pins, so a teammate
on a newer or older imp still builds and tests against the same one. Pins are exact (`"1.2.3"`,
never a range), which is what makes them reproducible.

`imp update` sets and moves that pin:

- **`imp update`** resolves the latest published release, downloads it, and writes it into
  `imp.json`'s `"version"` field — searching upward from the current directory for the project (so
  it works from any subdirectory) and preferring the `imp.json` at your repository root. It prints
  what changed, e.g. `imp updated 1.2.3 → 1.3.0`. The next command you run picks up the new version
  automatically. If the project has no `imp.json`, the release is still downloaded and cached; no
  pin is written.
- **`imp update <version>`** pins a specific version instead of the latest.
- **`imp update --check`** reports whether a newer release exists and changes nothing.

When you run imp interactively in a project that has **not** pinned a `"version"` in its `imp.json`,
and a newer release is available, imp also prints a one-line hint suggesting `imp update` (checked
at most once a day, never blocking the command). If your `imp.json` pins a version, imp assumes you
chose it on purpose and stays silent — move the pin yourself with `imp update` when you want a newer
release. Silence the hint for unpinned projects with the `--no-update-check` flag or by setting
`IMP_NO_UPDATE_CHECK`.

If a pinned version cannot be obtained — you are offline, or the release was removed — imp stops
with a clear error naming the version rather than silently running a different one; a pin that isn't
enforced is not a pin. To deliberately bypass the pin (say, to debug against the binary you have),
set `IMP_VERSION=system`.

Downloaded versions are cached per-user under `~/.imp/` (each is verified against its published
checksum before it is stored), shared across every project you work on. Set `IMP_HOME` to cache them
somewhere else — useful in CI or containers where the home directory isn't writable, or to keep the
binaries off your home volume.

## `imp prune` — reclaim disk space

```
imp prune
```

Every version imp downloads stays cached so switching between pinned projects never re-downloads,
but binaries are large and the cache only grows. imp records when each cached version was last run,
and whenever it downloads a new one it points out any that haven't run in over 30 days:

```
2 unused imp versions (1.1.0, 1.2.3) have not run in over 30 days — run 'imp prune' to reclaim disk space
```

`imp prune` deletes exactly those stale versions — anything not run in the last 30 days — and
reports how much space it freed. The version you are currently running is never removed, and any
version you pin again later is simply re-downloaded on demand, so pruning is always safe.

## `imp licenses`

```
imp licenses
```

imp is a single binary that bundles a number of open-source tools (the browser automation, the
formatter and linter engines, the image and video encoders, and more). `imp licenses` prints the
third-party license notices for everything the binary ships — each component, its version, and the
full text of its license — so the attribution required by those licenses is available straight from
the binary. It takes no arguments.
