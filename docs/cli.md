# imp - CLI

The `imp` CLI is an all-in-one toolkit for imp apps: a static dev server, a dependency manager, a
linter, and a formatter in a single binary. imp is built for the AI era - every part of the workflow
is designed to work hand in hand with AI coding agents, to the point where an app can be developed
end to end without writing a line of code by hand.

**Development is buildless.** There is no build step, no bundling, and no transforms while you
work - `imp start` serves your files exactly as you wrote them. You edit a file, the browser
reloads, and what runs is the source you typed. Dependencies are added once with `imp install` and
live inside your repository from then on (see **[Managing dependencies](dependencies.md)**), so
serving needs no network and no package installation - a fresh clone is the whole, runnable app.

**Production has a build.** When you are ready to ship, imp packs the app into a single
self-contained, minified bundle you can upload to any static host or CDN - no imp runtime required
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
imp init [dir] [--pwa]                scaffold a new project (--pwa: installable app)
imp start [file.html] [--port 4507]   serve a page (default: index.html)
          [--mock | --no-mock]        answer from the mocks folder, or from the real API
imp build [file.html] [--output dist]   build the app for production
          [--pwa]                     also emit an installable, offline PWA
imp preview [path] [--port 4517]      preview components in isolation, one page per
            [--list] [--json]         *.preview.js file (no path: an index of all of them)
            [--mock | --no-mock]
imp review [clear]                    list the reviews written from the browser
                                      (clear: delete every saved review)
imp install [package[@version]]       vendor a dependency into dependencies/
                                      (no version: latest · no package: update all)
imp uninstall <package>               remove a vendored dependency
imp test  <file>                      run one test file: *.test.js unit in-process,
                                      *.spec.js e2e in a real browser
imp test  --unit | --e2e              run every file of that level, each in its own
                                      process, in parallel (--jobs <n> caps concurrency)
imp resize <image> [-w <px>] [-h <px>]   shrink an oversized PNG/JPEG asset in place,
           [--output <path>]          keeping aspect ratio unless --stretch is given
           [--stretch]                (neither -w nor -h: report current dimensions
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
at `imp skill` - the manuals imp carries for exactly that reader.

## Configuration - `imp.json`

The only config file you author is `imp.json` at your project root, and it is optional - every
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

## `imp init` - your first command

```
imp init [dir] [--pwa]
```

Scaffolds a new project you can run immediately. With no argument it scaffolds into the current
directory; give it a name and it creates that directory and scaffolds inside it. It never asks a
question - one command, and the project is on disk, which is what makes it safe to hand to an AI
agent as a first step.

What you get is deliberately small - a working app, not a template to study:

| File                 | What it is                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| `imp.json`           | your one config file, pinning the imp version that created the project |
| `index.html`         | the page imp serves, with the mount point and the entry module         |
| `src/main.js`        | applies the built-in light theme and mounts the app                    |
| `src/app.js`         | the app's components - a heading, a line of text, and a click counter  |
| `test/app.test.js`   | a unit test that mounts the component and clicks its button            |
| `test/app.spec.js`   | an end-to-end spec that drives the same app in a real browser          |
| `public/favicon.svg` | a placeholder mark, published at the site root                         |
| `.gitignore`         | ignores `dist/`, `.imp/`, every `.env` file, and the usual OS noise    |

There is no `README`, no `src/components/` tree, and no second example - the counter is there to
show the shape of an imp app (a component, a namespaced state, a live text node bound to it) and to
be deleted once you start writing your own.

The scaffold is a working project on arrival: `imp lint`, `imp fmt --check`, `imp test --unit` and
`imp test --e2e` all pass against it before you change a line, so a failure after your first edit is
about your edit.

**It will not overwrite your work.** If any file it would write already exists, `imp init` writes
nothing at all, names the conflicts, and exits with code 1 - run it in an empty directory instead.
An empty `public/` folder is not a conflict.

`.gitignore` is the one exception, because scaffolding into a repository that already has one is
normal. Rather than refusing, imp **appends the entries you are missing and leaves the rest of the
file alone**, then warns you that it did. It compares patterns rather than lines, so nothing is
duplicated: `node_modules` already covers `node_modules/`, a leading `/dist` already covers `dist/`,
and a single `.env*` already covers both `.env` and `.env.*`. If your file happens to cover
everything imp needs, it is left untouched.

### `--pwa` - start as an installable app

```
imp init my-app --pwa
```

Adds two things to the same scaffold: a filled-in `pwa` block in `imp.json` - name, short name,
theme and background colours, display mode, icon - so the block doubles as a list of what you can
tune, and an `icon.svg` at the project root. That single source image is what imp renders the whole
icon set from at build time, so there are no other icon files to manage; replace it with your own
artwork and every generated size follows. It lives at the project root rather than in `public/`
because it is a build input, not a published file.

The project is then `imp build --pwa`-ready with no further wiring - the **Progressive Web App**
section under `imp build` below describes what that build emits.

When you finish, `imp init` prints what it wrote and the commands to run next.

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

Three things are injected into every served HTML document automatically - you never reference the
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
  unhandled rejections to the terminal, prefixed `[browser:*]` - you (or an LLM coding assistant
  driving the session) read runtime behavior straight from the terminal, no devtools needed.

- **Network telemetry.** A service worker (registered at root scope) intercepts _all_ request
  types - `fetch`, `XMLHttpRequest`, images, scripts, navigations - and reports each as
  `[net] METHOD url → status ms`. Requests under `/@imp/` are passed through untouched.

Everything `imp start` prints - the browser console and error telemetry, the network telemetry, and
its own status lines - is **also written to a log file** at `.imp/dev.log`, one entry per line, so
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

The path is `.imp/dev.log` under the served project - `.imp/` is imp's per-project working directory
and should be git-ignored (a fresh `imp init` project already ignores it).

Live reload is included: file changes under the served directory trigger a browser reload (changes
inside `.git/`, `node_modules/`, `dist/`, and imp's own `.imp/` working directory are ignored).

Static files are served with correct content types for common web assets. Your `public/` folder is
served at the site root - `public/styles.css` answers `/styles.css`, exactly as it will in the built
site (see [The `public/` folder](#the-public-folder)) - and the rest of the project is served behind
it, so your module sources load as-is during development. Requesting a directory redirects to its
trailing-slash URL and serves the `index.html` inside it; paths outside the served directory are
rejected.

Internal endpoints (reserved, not part of your app): `/@imp/events` (reload stream), `/@imp/log`
(telemetry sink), `/@imp/review` (the review sink, described next), `/@imp/sw.js` (the service
worker), and `/@imp/*` (library source).

### Reviewing the page - notes for your agent

Every page the dev server serves carries a small **review widget** in the bottom corner. Click it
and the toolbox opens with one button, **Add review**: click that, and the next element you click on
the page is the one you are reviewing. Hover to see what is about to be picked - the element under
the pointer is outlined - then click it, type a comment, and press **Save review** (or
`Ctrl`/`Cmd` + `Enter`). The element you picked stays outlined while you type, so you never have to
check a DOM path to know what you are describing. `Escape` cancels the pick, and `Enter` takes the
highlighted element if you would rather move with the keyboard than the mouse.

That is the whole interaction: you click through the app and describe what is wrong in the words you
would use out loud, and imp records which page you were on and which element you meant, so your AI
coding agent does not have to guess either. Each review becomes a plain-text file you read back with
**[`imp review`](#imp-review)**, described there.

The widget is part of the dev server and nothing else: it is injected by `imp start` and
`imp preview`, never by `imp build`, so no review code reaches your production bundle. It only
appears when you are looking at the server over a loopback address, and the server accepts a review
only from the machine it runs on - open the dev server from another device on your network and the
widget is simply not there.

If you want the same thing for the people using your finished app, that is the `bugReport` component
(see **[Standard components](std-components.md)**). It is the same picker and the same captured
context, shipped in your bundle and handing the report to a function you write - it does not write
`.imp/reviews/` and it is not a replacement for this widget.

### Mock responses - `*.mock.js`

Point `imp.json` at a folder and the dev server answers matching requests itself, so the app runs
before - or entirely without - its backend:

```json
{
  "mocks": { "folder": "mocks", "enabled": true }
}
```

Both keys are required: `folder` says where the files are, `enabled` says whether they answer by
default. There is no way to declare mocks ambiguously - every project states which one it develops
against, and every run can override it.

Every `*.mock.js` file under that folder (nested folders included) exports a `mocks` array. Each
entry decides what it answers with `match`, and answers with `handler`:

```js
// mocks/users.mock.js
export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 800,
    handler: () => ({
      status: 200,
      body: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    }),
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/users',
    handler: (request) => ({ status: 201, body: { id: 3, ...request.body } }),
  },
]
```

Split them however your app is split - one file per resource, a folder per feature - and start the
server as usual. Nothing in your app changes: your client keeps its real base URL, your components
keep their real calls, and `imp build` leaves the folder out of production entirely.

- **`match(request)`** returns true when this entry should answer. The request it receives is
  `{ method, url, path, query, headers, body }` - `path` and `query` are the URL's, `body` arrives
  parsed when it was sent as JSON. **The first match wins**, in file-path order.
- **`handler(request)`** receives the same object and returns `{ status, headers, body }`. `status`
  defaults to `200`, and a `body` that is not a string is sent as JSON. Return a `Response` of your
  own when you need full control. Handlers may be async.
- **`delay`** is milliseconds of simulated latency, so you can see your spinners work.
- **Unmatched requests go to the real network**, which is how you mock the half of an API that does
  not exist yet while the rest keeps hitting your backend.
- **Throwing simulates a failed connection.** The request fails in the page exactly as it would with
  the server unreachable - not a `500`, an actual network error.
- **Mock files are ordinary modules.** They can import shared fixtures and any dependency you have
  installed, and each file is evaluated once, so a closure is how a mock keeps state between
  requests:

  ```js
  const flaky = () => {
    let calls = 0
    return () => {
      calls++
      if (calls % 2 === 0) throw new Error(`simulated network error on attempt ${calls}`)
      return { status: 200, body: { message: 'Success!' } }
    }
  }

  export const mocks = [
    { match: (request) => request.path === '/api/flaky', delay: 300, handler: flaky() },
  ]
  ```

#### Turning mocks on and off

A project usually has both days: one against fixtures, one against the running backend. Which one a
run gets is decided by `imp.json`, and overridden per run by a flag:

```
imp start              # what imp.json says
imp start --mock       # this run answers from the mocks folder
imp start --no-mock    # this run goes to the real API
```

`"enabled": true` is the setting while the backend does not exist yet - plain `imp start` develops
against fixtures. Once there is a backend to work with, keep the files and flip the default, so
`imp start` is a real run and mocking is the thing you ask for:

```json
{
  "mocks": { "folder": "mocks", "enabled": false }
}
```

The same two flags work on **`imp preview`** (fixtures for previewed components) and **`imp test`**
(fixtures for your e2e specs), so `imp test --e2e --mock` runs the suite with no backend at all.
When mocks are on, the server says so as it starts:

```
[INFO] mocks - 2 file(s) from mocks/ serving through the browser
```

Mocked answers are real responses arriving over the network layer of the browser, so everything
downstream behaves normally: an [HTTP client](http.md) retries a mocked `503`, a `delay` keeps
`pending` up, and your interceptors run. Every mocked request is reported in the terminal like any
other, tagged with the file and entry that answered it:

```
[HTTP] GET http://localhost:4507/api/users → 200 802ms (mock: mocks/users.mock.js #1)
```

Editing a mock file reloads the browser like any other change. A file that cannot be built is
reported in the terminal with its line, and the rest of the app keeps running.

Mocking works through a service worker that `imp start` registers for you, which means it covers
_every_ request the page makes - `fetch`, `XMLHttpRequest`, a third-party SDK - not just the ones
imp issues. It also means mock code runs outside the page: there is no `document` and no access to
your app's state in a `*.mock.js` file. `imp preview` and the e2e server used by `imp test` are the
same dev server, so your mocks apply there too.

### Dependencies

Vendored dependencies need nothing special from the dev server: the injected import map points each
declared alias at its bundle inside your project's `dependencies/` folder, which is served like any
other static file - no network, no on-the-fly resolution:

```js
import mitt from 'mitt'
```

If a declared dependency has no vendored bundle yet (say, right after editing `imp.json` by hand),
`imp start` prints a warning suggesting `imp install`.

## `imp build`

```
imp build [file.html|file.js] [--output dist] [--pwa]
```

Builds the production version of your app into an output directory (default: `dist/`) that you
upload to any static host or CDN exactly as it is - plain static files, no imp runtime, no import
map, nothing to install on the server. The output directory is replaced on every run.

It's called `build`, not `bundle`, because producing that output is more than bundling your
JavaScript: it's the whole production-build step, and it can emit additional generated files
alongside the bundled code, not just the bundles themselves.

Given an HTML page (default: `index.html`, the same entry `imp start` serves), imp finds the page's
module scripts and bundles each one into minified, self-contained JavaScript:

- **Same resolution as development.** `import { div } from 'imp/html'` and every vendored dependency
  alias resolve exactly as they do under `imp start` - every `imp` specifier to the built-in
  library, each alias to the bundle in your `dependencies/` folder. The build runs fully offline;
  what you tested in development is what ships.
- **Paths are preserved.** Each `<script type="module" src="…">` keeps its URL - the bundled file is
  written to the same relative path the source file had - so the HTML works unchanged. Inline
  `<script type="module">` blocks are bundled too and re-inlined, minified with their imports
  resolved.
- **Code splitting.** Modules you load lazily with `import()` are split into separate chunks (under
  `chunks/`, with content hashes) that load on demand, and code shared between several entry points
  is emitted once instead of being duplicated into each bundle.
- **You ship only the imp you use.** Unused code is dropped from the bundle, and that applies to imp
  itself as much as to your own modules: a page that never touches state, theming, translations or
  the router carries none of them, and importing one standard component does not bring along the
  others in its group. A page that mounts a single element builds under 4 kB of imp; one that uses
  every part of imp pays for every part. Nothing is configured for this - import what you need and
  the rest is never emitted.
- **Third-party license notices are collected, not stripped.** Every license notice carried by the
  code that ends up in the bundle is gathered into a single `LICENSES.txt` at the root of the
  output, and each emitted script opens with a one-line comment pointing at it. See
  [License notices](#license-notices) below.
- **Feature flags are resolved and folded away.** Every `flag('NAME')` check is answered for the
  environment you are building, the branch behind a disabled flag is removed along with everything
  only it used, and the build prints what it decided. See **[Feature flags](feature-flags.md)**.
- **Your `public/` folder becomes the site root.** Anything you put in `public/` - stylesheets,
  images, fonts, `favicon.ico`, `robots.txt` - is copied over unchanged, with `public/` itself
  stripped from the path: `public/logo.png` ships as `logo.png` and is served at `/logo.png`. That
  folder is the only thing copied, so nothing else can reach the output by accident: your module
  sources are already compiled into the bundles, and `imp.json`, your environment files, your mocks
  and anything else in the project are never part of the site. See
  [The `public/` folder](#the-public-folder) below.

Given a JavaScript module instead of a page, `imp build` emits that module as a single
self-contained file: imp itself and every dependency are compiled in, so the result - say, a web
component authored with imp - can be dropped into any application, whatever framework it uses,
without pulling in imp or any other runtime.

**A JS build carries its skills; a page build strips them.** A module entry is something other
developers program against, so if a `counter.skill.md` file sits next to it, imp folds that text
into the output as an `impSkill` export and it travels with the component to whoever installs it. An
HTML entry is a finished app that nobody writes code against, so imp adds no skill text, copies no
skill file into the output, and removes any `impSkill` it finds on the way in - from a pre-built
component you installed as much as from your own modules, and from lazily loaded chunks as much as
from the main bundle. See **[Components](components.md)**.

### License notices

Most open-source licenses - MIT, BSD, Apache-2.0 - let you ship the code on one condition: the
copyright and permission notice travels with it. Minifiers throw those notices away by default,
which quietly leaves the build you deploy out of compliance.

`imp build` keeps them. While bundling, it collects every legal comment it finds in the code that
made it into the output - the `/*! ... */`, `//!`, `@license` and `@preserve` blocks that libraries
use to mark their notices - and writes them to **`LICENSES.txt`** at the root of the output
directory:

```
Third-party license notices

Every license notice carried by the code bundled into this build is reproduced
below, one block per notice, exactly as its authors wrote it. Ship this file
alongside the build: the licenses it lists require the notice to travel with the
code. Every script imp emitted points back here.

/*! mitt v3.0.1 | MIT License | https://github.com/developit/mitt */

/*! @license DOMPurify 3.4.14 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 */
```

Each notice is reproduced verbatim, exactly as its author wrote it - imp never reformats, truncates
or summarizes license text. Identical notices are listed once.

Every JavaScript file the build emits - the bundles, the lazily loaded chunks, and the inline module
scripts re-inlined into your page - starts with a comment naming the file:

```js
/*! Third-party license notices: /LICENSES.txt */
```

so a reader who lands on a minified bundle can find the notices from there. Under a
[sub-path deployment](#deploying-under-a-sub-path) that reference is prefixed like every other
root-absolute URL, so it still points at the right place.

`LICENSES.txt` is part of the output: upload it with the rest of the directory, and keep it there.
Dropping it is what the notices are asking you not to do.

If nothing in the bundle carries a notice, no file is written and no comment is added.

This is separate from `imp licenses`, which prints the notices for the tools compiled into the imp
binary itself - the bundler, formatter and test runner you develop with, none of which ship in your
app. `LICENSES.txt` covers what your users actually download.

### The `public/` folder

`public/` holds the files that are served as-is, and **its contents are the root of your built
site**. The folder name never appears in a URL:

```
my-app/
  index.html            ← your page, stays at the project root
  app.js                ← compiled into the bundle
  public/
    styles.css          → /styles.css
    favicon.ico         → /favicon.ico
    assets/logo.png     → /assets/logo.png
```

So a page written against those URLs works in development and in production without change:

```html
<link rel="stylesheet" href="/styles.css">
<img src="/assets/logo.png" alt="">
```

`imp start` serves `public/` at the site root too, so a path that resolves in development resolves
in the built site as well.

A few consequences worth knowing:

- **`index.html` stays at the project root**, not in `public/`. imp processes your page - bundling
  its scripts, injecting environment values and PWA tags - while `public/` is verbatim passthrough.
  Put your page in `public/` and imp says so: the build reports the missing root entry and points at
  the copy it found, and `imp start` warns that a `public/index.html` is being ignored.
- **Only `public/` is copied.** Nothing else in your project can end up on the web by accident: not
  `imp.json`, not your environment files (which hold secrets), not your mocks, not your version
  control directory.
- **A build error, not a silent overwrite.** If a file in `public/` has the same path as something
  imp generates - a `public/app.js` against a bundled `app.js` - the build fails and tells you which
  path collided, rather than one quietly replacing the other.
- **The name is fixed.** The folder is always `public/` - there is nothing to configure.
- **The folder is optional.** A page with no external assets needs no `public/` folder at all.

### Deploying under a sub-path

If your app is served from a sub-path - `https://example.com/my-imp-app/` rather than the domain
root - set the `IMP_BASEPATH` environment value for that deployment (see
[Environments](#environments)):

```json
{
  "IMP_BASEPATH": "/my-imp-app"
}
```

`imp build` then prefixes every root-absolute URL it emits, so the whole site keeps working one
level down. A `href="/styles.css"` in your page becomes `href="/my-imp-app/styles.css"`, and the PWA
manifest, icons, service worker and its precache list all move with it. External URLs (`https://…`),
protocol-relative URLs (`//…`) and paths that are already relative are left exactly as written.

The same value is what the router reads to strip and re-add the prefix when matching routes and
building links, so one setting covers both your assets and your navigation. Inside a stylesheet,
write asset URLs relative to the stylesheet (`url(assets/logo.png)`) - those resolve against the
stylesheet's own location and stay correct under any prefix.

### Targeting an imp host - sharing the host's imp

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "targetImpHost": true
}
```

By default a JS-entry bundle carries everything it needs, including imp itself. If what you are
building is a component meant to run inside another imp application - an application that already
has imp - set `targetImpHost: true` in `imp.json`: bundling a JS entry then leaves every
`import … from 'imp'` (and `'imp/…'`) in the output as a bare import for the host to resolve, and
only your code and your dependencies are compiled in. Nothing changes in development - the dev
server's import map resolves `imp` exactly as before - and nothing changes for your other
dependencies, which are always bundled in with the versions you pinned.

Inside an imp application the bare `imp` imports are already resolvable: in development through the
import map the dev server injects, and in production because the host's own `imp build` resolves it
when it builds. The host page then holds a **single copy** of imp shared by the app and your
component, instead of one copy each. The same contract holds when your component is published to a
registry and vendored with `imp install` - the consuming app keeps the `imp` import bare and
provides its own copy. See **[Managing dependencies](dependencies.md)**.

Two things to be aware of:

- **The host must actually provide imp.** Outside an imp application that means adding an import map
  entry (or bundler alias) mapping `imp` - the bundle fails at load time in a page that maps
  nothing. When in doubt, leave `targetImpHost` off and ship self-contained.
- **imp version skew.** A self-contained bundle freezes the imp version it was built with; one built
  for an imp host runs against whatever imp version the host provides, which may be newer or older
  than the one you developed against. A host upgrading imp can change your component's behavior
  without your bundle changing at all - test your component against the imp versions your host
  applications actually run.

`targetImpHost` affects only JS entries. An HTML build has no import map in its production output,
so nothing could resolve a bare import left in it - bundling an HTML page compiles imp in as usual,
because the page is its own host.

### Progressive Web App - `imp build --pwa`

Add `--pwa` to a page build and imp emits everything an app needs to be installed to a home screen
and to keep working offline - a web app manifest, a full icon set scaled from one source image, and
an offline service worker - alongside the normal production output. Without the flag, `imp build`
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

Only `name` and `icon` are required. `icon` points at a **single** high-resolution source image - an
SVG (preferred, it scales to any size cleanly) or a large PNG or JPEG - and imp scales it to every
icon the manifest and the platforms need, so there is no hand-maintained icon set to keep in sync.
Raster sources should be at least 512px on their longest edge - the largest generated icon is
512×512, and a smaller source has to be upscaled to reach it, which costs sharpness; the build
prints a warning when that happens. The build then, in one step:

- **Generates the icon set** - 192px and 512px app icons, a 512px maskable icon padded to survive
  platform masking, and a 180px apple-touch-icon - regenerated from the source on every build.
- **Writes `manifest.webmanifest`** with your app's name, colors, and display mode, and guarantees
  the fields browsers require to offer installation (a name, 192px + 512px icons, a display mode,
  and a start URL).
- **Writes an offline service worker** (`sw.js`) and injects the manifest link, theme-color meta,
  the apple-touch-icon link, and the service-worker registration into your page's `<head>` - the
  built HTML ships ready to install, with no edits to your source.

**The service worker is the part that matters.** Anything can template a manifest and resize an
icon; what actually breaks for a real user is being offline, on a flaky network, or opening the app
the day after you deploy. imp gets this right because it builds your app and therefore knows the
exact set of files that make it up:

- **The precache list is exact.** The service worker precaches precisely the files this build
  produced - every hashed script and chunk, every asset, plus the manifest and icons - because imp
  derives that list from the build itself, not by scanning a folder and guessing afterwards. Nothing
  needed to run the app offline is missed, and nothing stale is cached.
- **Deploys are never stuck.** The cache is keyed to the content of the build, so a new deploy is a
  new cache: on activation the worker fetches what changed and deletes what's gone, and users move
  to the new version automatically instead of being pinned to an old one by their own cache.
- **Safe defaults, no configuration.** Your page and its deep links are served network-first and
  fall back to the cached app shell when offline; hashed assets are served cache-first; cross-origin
  responses, non-`GET` requests, and error responses are never cached. These are the choices that
  avoid the classic offline footguns, and they apply out of the box.

**In development (`imp start`) installability is automatic** - no `--pwa` flag and no HTML edits.
When your `imp.json` has a `pwa` block, the dev server injects the manifest and icon links and
serves a generated manifest and icons on the fly, so you can install the app and check its icons and
colors while you work. The **offline** service worker, though, is only ever generated by
`imp build --pwa`: in development the app keeps live reload and the terminal network telemetry (the
dev service worker reports requests and does no caching), and offline behavior is something you get
in the production build, where it belongs. That split is deliberate - you never want a caching
worker fighting live reload while you edit.

**One caveat when you preview a production build.** A service worker controls a whole origin, and
both the dev telemetry worker and the offline PWA worker claim root scope - so if you serve a
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
resolves the latest release - which also makes re-running it the update path - and with no arguments
at all it updates every declared dependency. `imp uninstall` removes a dependency's folder and its
pin. Your code imports dependencies by their bare alias (`import mitt from 'mitt'`). A package that
itself imports `imp` keeps that import bare - your app provides the imp library, so `imp` is never
mistaken for a registry package. The bundle keeps the package's license notice where the package put
it, so the notice is still there for `imp build` to collect into your app's
[`LICENSES.txt`](#license-notices).

See **[Managing dependencies](dependencies.md)** for the full story: version pinning, updating,
aliases, jsr packages and subpaths, what gets printed, and why the vendored folder is committed.

### File-size warning

Because vendored bundles are committed to your repository, `imp install` warns when a package
bundles to more than `maxFileSize` (200 kB by default) so a heavy dependency doesn't slip in
unnoticed. The warning names the total that would land in `dependencies/` and reminds you of the two
knobs. To silence it - for a dependency you know is large and want anyway - raise `maxFileSize`, or
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
integration tests, executed in-process against a built-in simulated browser environment - no real
browser, very fast; files ending in `.spec.js` are end-to-end tests - imp serves your app exactly
like `imp start`, launches a headless Chrome, and hands each spec a ready-made Puppeteer page
pointed at the running app, with the browser's console and network activity streaming to the
terminal. Tests are written with `test` and `expect` imported from `imp/test` - runner and
assertions are built into the binary, nothing to install.

imp runs **one test file per process** - the unit of isolation, so no two files share a process's
globals, timers, server, or browser. `imp test <file>` runs exactly that one file and exits with its
result. To run a whole level, name it: `imp test --unit` (every `*.test.js`) and `imp test --e2e`
(every `*.spec.js`) discover their files and run each in its own process, in parallel, capped by
`--jobs <n>` (default: your CPU count). Passing files are summarized to one line, failing files
print their full output, and the run exits `1` if any file failed. A bare `imp test` with more than
one candidate file won't guess - it asks you to choose `--unit`, `--e2e`, or a single file, runs
nothing, and exits non-zero so a stray `imp test` fails CI instead of passing green. For fan-out
across **machines** (a CI matrix, which imp can't schedule), `imp test --list` prints the selected
files as JSON to hand out one per job.

Add `--video <dir>` to an e2e run and imp records each spec's browser session as an animated GIF -
one file per spec, written into `<dir>`. Because a GIF plays inline in a GitHub pull request, this
is how an agent (or a person) can attach a clip of a new feature working so a human reviewer can
double-check its behaviour and look and feel. Recording is off by default; a `test.video` block in
`imp.json` tunes frame rate, duration, width, and quality (or turns it on without the flag).

See **[Testing](testing.md)** for the full runner API, the assertion reference, browser resolution,
recording, and the CI parallelization pattern.

## `imp preview`

```
imp preview [path] [--port 4517] [--env <name>] [--mock | --no-mock]
imp preview --list [--json]
```

Builds one component at a time, in isolation. `imp preview` serves each of your **preview files** as
its own page: the one line an AI agent should read before it writes code with the component sits
below the page head, and every named export becomes a labeled panel with two tabs - **Preview**,
holding that component in a stage you can drag to any size with a state editor beside it, and
**Code**, showing the call that built it. No app boot, no backend, no navigating to the right
screen - you edit the component, the page reloads, and you see it.

It is the same dev server as `imp start` underneath, so the browser's console and network activity
still stream to your terminal, saving any file reloads the page, your `public/favicon.svg` marks the
tab just as it does in your running app - imp's own mark stands in when the project has none - and
the review widget is in the corner - pick a part of the component you are previewing, comment on it,
and the note lands in `.imp/reviews/` with the preview page it came from (see
**[Reviewing the page](#reviewing-the-page---notes-for-your-agent)**).

### The preview file

A component in `todos.js` gets a sibling `todos.preview.js`. It is ordinary imp code: import the
component and export one instance per state worth looking at.

```js
import { todoList } from './todos.js'

export const empty = todoList({ todos: [] })
export const populated = todoList({ todos: [{ id: 1, title: 'Buy milk' }] })
export const busy = todoList({ loading: true })
```

Each **named export is a scenario**, and the export name is the panel label - the code is the only
place a scenario is named, so there is nothing to keep in sync. Panels appear in the order you wrote
them. A scenario is just the component pre-filled, built with the same call you would write at a
real call site, so there is no story format to learn; arguments dispatch by type exactly as they do
in your app. Export a function instead of an instance when a scenario needs setting up at render
time (`export const lazy = () => todoList(buildFixture())`) - imp calls it when it renders the
panel.

### Naming the component

Three export names are reserved, and none of them is a scenario. They are how the component
introduces itself on the page:

```js
export const name = 'Todo list'
export const category = 'Widgets'
export const description = "Run 'imp skill ./components/todos.js' before writing code with it."
```

`name` is the label in the catalog, the search, the page head and the browser tab; `category` is the
group it is listed under; `description` is the agent instruction shown below the head. Each one is
optional and each is a plain string. Declare none of them and imp falls back to the file's own name
and the folder it sits in, so `src/inputs/text_field.preview.js` is `text_field` under `inputs` -
readable, but not what you would call it out loud.

Because the grouping comes from `category` rather than the folder, the catalog can be organized the
way you talk about the components rather than the way the files happen to be laid out: two files in
different folders that declare the same `category` are listed together.

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
exports and receives `{ spy, orig }`; every import of that module - from the component and from
anything it imports, at any depth - resolves to what you returned, and `orig()` keeps the rest of it
real. See **[Mocking modules](testing.md#mocking-modules--mockmodule)** for the full behavior. Mocks
are plain objects you write and they live next to the component, so a reviewer sees the fixture and
the component in one diff.

A mock applies to the whole preview file, so scenarios that need different data differ by the
arguments you pass them.

### The stage

Each panel holds its component in a stage you resize by **dragging its right, bottom, or corner
handle** with a mouse or a finger. The component re-lays-out live at every width, which is the
quickest way to find the breakpoint where it breaks - no device emulation to open. A readout shows
the current size, and `phone`, `tablet`, and `desktop` buttons jump to common viewports; `fit`
returns the stage to the full page width.

### The state editor

Beside each stage is a form listing the state the component manages, found by reading your source
for `initState` and `useState` names. Values are shown as JSON: edit one, apply it (or press
`Ctrl`/`Cmd`+`Enter`), and the component updates through imp's normal fine-grained path - no
re-mount, no reload. The form also follows the state, so clicking around in the component shows the
new value.

Each panel gets its own form bound to its own instance, so `empty` and `populated` are poked
independently on the same page. This discovery is a convenience, not a rule about how you write
components: a state name that is computed at runtime or built behind a helper simply won't be
listed, and a value that isn't JSON data is shown read-only.

### The code behind a scenario

The **Code** tab shows what produced the panel next to it: the scenario's own call, with the preview
file's import lines above it, and a button to copy the lot. It is read straight out of your preview
file when the page is built, so it is the real code rather than a description of it and cannot drift
from what you are looking at - which makes a preview page something you can hand to someone else as
the answer to "how do I get this component to look like that?".

The snippet is syntax-highlighted, and its colours come from the same theme tokens as the rest of
the page - so the code stays readable under every theme you switch to, including the high-contrast
ones. Keywords are bold and comments italic as well as coloured, so the highlighting still reads
when colour is unavailable, as in Windows High Contrast mode.

Only exports written as `export const <scenario> = …` have code to show; a name re-exported through
`export { … }` gets a note instead of a snippet.

### The instruction for an agent

Below the page head, above the first scenario, the file's `description` is shown once with a button
to copy it. It exists because the two readers of a component need different things from the same
page: a person looks at the stage, and an agent about to write a call site needs to be told where
the component's manual is. It belongs to the component rather than to any one scenario, which is why
it is stated once at the top instead of repeated beside every panel.

Keep it an instruction rather than a summary -
`Run 'imp skill std/button' to learn what button can do before using it.` - so pasting it into an
agent is enough to get the whole manual, which stays in one place and cannot drift. A file that
declares no `description` says so in the same place.

### Themes

A theme switcher in the top bar applies a theme to the whole page, so you can check the component
under each of your themes without touching code. Your choice is remembered across reloads. The
built-in `imp-light` and `imp-dark` are always offered.

The whole page changes, toolbar included, because the preview page is itself an imp app built from
`imp/std` - the same buttons, tabs, selects and text fields your app uses, reading the same tokens.
So a theme that looks wrong here looks wrong in your app for the same reason, and the preview page
is one more place the library has to hold up.

List your own theme files in `preview.themes` to add them to the switcher:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Each path is a module that default-exports a theme - the same file your app passes to `applyTheme`,
nothing preview-specific about it. The label in the switcher is the theme's `name` (the file path if
it has none, or if two themes share a name). Your themes are listed first and the first one is
selected by default, so a preview opens looking like your app rather than like the starter theme.
Editing a theme file reloads the page with the new tokens applied, so a preview page is also the
fastest way to iterate on a theme. See **[Theming](theming.md)**.

### The theme editor

**edit theme**, beside the switcher, opens an editor for writing a theme rather than picking one. It
asks for the mode you are editing (light or dark), a **primary** and a **secondary** colour, a
**border radius** step and a **shadow** step - and derives every other colour token from those two
colours: the hover and active steps, a readable on-primary, and the surfaces, borders and text that
share the secondary's hue.

The page re-skins as you type, on real components, and your choices are remembered per theme across
reloads. When it looks right, **copy** or **download theme.js** hands you an ordinary theme module
with a `light` and a `dark` export, ready to drop into your app and pass to `init` - the editor
prints the two lines that do it right there in the panel. What it produces is a plain file with no
imp import in it, so from that point on it is yours to edit by hand; the 31 named palette colours
sit at the top of the file for exactly that. **reset** drops the draft and goes back to the picked
theme. See **[Theming](theming.md)**.

### Language and text direction

Next to the theme switcher are a **language** picker and a **direction** picker, so you can see a
component the way a reader of another language sees it without changing a line of code. Both choices
are remembered across reloads.

The language picker sets the page's language, which re-localizes everything bound through `lang` -
your own messages and the reserved `imp.` ones the standard components ask for alike. It lists the
languages you point it at, so tell it where your translation files are under `preview.translations`:

```json
{
  "preview": { "translations": { "en": "./locales/en.js", "pl": "./locales/pl.js" } }
}
```

Each path is a module that default-exports your messages - the same file your app passes to `init`.
The first one is selected by default, so a preview opens reading like your app, and editing a
translation file reloads the page with the new wording. Declare none and the picker is left out
entirely; the direction picker still works.

The direction picker has three settings. **auto** takes the direction from the language, which is
what your app does - pick Arabic or Hebrew and the component lays out right to left. **ltr** and
**rtl** pin it, so you can check a right-to-left layout while reading English text, which is the
quickest way to catch a hardcoded `margin-left`.

Only the component is affected: the preview's own toolbar and panels stay left to right whatever you
pick, so the controls do not move around underneath you. Direction is the one thing the page does
not share with the component it shows - a mirrored toolbar moves every control to the other side
mid-session, which the theme switcher never does. See **[Translations](i18n.md)**.

### Finding and opening previews

With no path, imp discovers every `*.preview.js` file in the project and `/` lists them all. Pass a
path to narrow it: a preview file opens straight to it, a component path opens its sibling preview
(`imp preview components/todos.js` finds `components/todos.preview.js`), and a folder limits
discovery to that folder. Add `?scenario=<name>` to a preview URL - or click **isolate** on a
panel - to render just that one scenario.

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

## `imp review`

```
imp review [clear]
```

Prints every review saved from the browser by the widget described under
**[Reviewing the page](#reviewing-the-page---notes-for-your-agent)** - the page it came from, the
element that was picked, and the comment left on it - oldest first:

```
.imp/reviews/2026-08-25T12-10-36-682Z.txt
  2026-08-25T12:10:36.682Z  http://localhost:4507/settings
  body > div#app > acme-settings >> form.panel > button.save
  The save button is disabled until a field is touched, but nothing says so.

[INFO] 1 review in .imp/reviews - 'imp review clear' deletes them all
```

It reads the project you run it from, so it works from any subdirectory, and with nothing saved yet
it says so instead of printing an empty list.

### What a review records

Each review is its own file under `.imp/reviews/`, named after the moment it was saved
(`2026-08-25T12-10-36-682Z.txt`), so nothing you write can overwrite anything you wrote before. The
file is plain text: a header describing where you were, then blocks describing the state you were
in, then your comment.

```
time: 2026-08-25T12:10:36.682Z
page: http://localhost:4507/settings
title: Settings - Acme
viewport: 1440x900
scroll: 0,1240
scheme: dark
lang: en
dir: ltr
element: body > div#app > acme-settings >> form.panel > button.save
rect: 96x36 at 512,604
text: Save changes
html: <button class="save" type="submit" disabled="">Save changes</button>

state:
  settings.profile = {"name":"Ada","role":"admin"}
  settings.dirty = false

controls:
  input[name=name] = "Ada"
  input[name=notifications] = "checked"
  select[name=timezone] = "Europe/Warsaw"

log:
  [BROWSER:error] TypeError: profile.email is undefined
  [HTTP] PATCH http://localhost:4507/api/profile -> 500 34ms

comment:
The save button is disabled until a field is touched, but nothing says so.
```

**A URL and a selector are not enough to say what the app was doing**, so imp records four more
things at the moment you pick the element:

- **`state`** - every piece of imp state in scope at the picked element, by name, as JSON. This is
  the real answer to "what state was the app in": imp state is named and holds plain data, so the
  block is both readable and reproducible - an agent can set the same values in a test or a preview
  scenario and be looking at the same screen. Only the state that reaches the picked element is
  listed, nearest provider first, so what you get is the state that component could actually see. On
  a preview page imp's own `imp.preview.*` entries appear too - they are the theme, language and
  direction you were previewing under.
- **`controls`** - what every form control actually held: typed text, checked boxes, selected
  options, and whether a control was disabled or read-only. **The HTML does not carry this** - a
  typed-in value lives on the element, not in the markup, so `html` above would show an empty field
  where you had typed a name. Picking anything inside a form records the whole form; picking outside
  one records the controls in what you picked. Password fields are **never recorded** - only how
  many characters were in them.
- **`log`** - the last 20 lines of the dev log as of that moment: the console error that fired, the
  request that failed. This is the "how did it get here" that a screenshot would not tell you
  either.
- **The environment** - `viewport` (with the device pixel ratio when it is not 1), `scroll` when the
  page was scrolled, `scheme` for light or dark, `motion` when reduced motion is on, and `lang` /
  `dir`. "Only when the window is narrow" and "only in dark mode" are half the reports anyone
  writes, and now neither has to be typed out. `rect` is the picked element's own size and position,
  which is how "it is 8px wide" stops being a guess.

`element` is the path from `<body>` down to what you picked, and `>>` marks a crossing into a
component's own shadow tree - so `acme-settings >> form.panel` is the form **rendered by**
`acme-settings`, which is usually the file to open. Deeply nested paths are cut at twelve steps and
start with `...`, keeping the end that names the component.

Nothing has to be parsed to use any of this. Hand the folder to your agent and ask it to work
through the list - `imp review`, or `cat .imp/reviews/*.txt`, are equally good ways in - and each
review carries enough to find the code, and to get back to the screen, without a follow-up question.

```
imp review clear
```

Deletes every saved review and removes the folder. imp never clears reviews on its own - not when
the server restarts, not when a build runs - so the list is a backlog you empty when you decide the
comments on it are settled, and losing one to a restart is not a thing that happens.

Reviews live in `.imp/`, which a fresh `imp init` project already git-ignores, so they stay on the
machine that wrote them. To share one, paste it - there is nothing to sync.

## `imp resize`

```
imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]
```

A convenience utility for the common case that bloats a repository: a committed image checked in far
larger than the page ever displays it. `imp resize` downscales it in place - it is not an image
editor, and anything beyond a straight resize is intentionally out of scope.

The aspect ratio is always preserved unless you explicitly opt out. How the width and height flags
combine:

- **One of `-w` / `-h`** - resize to that dimension and compute the other to preserve the original
  aspect ratio.
- **Both `-w` and `-h`** - scale the image, keeping its aspect ratio, to the largest size that fits
  within that width × height box.
- **Both plus `--stretch`** - resize to exactly that width × height, even if it distorts the
  picture. You asked for a specific size and accept the stretch.
- **Neither** - inspect mode; nothing is written. imp reports the image's current dimensions and
  byte size, and if the asset is oversized it also prints a ready-to-copy `imp resize` command that
  would bring it down to a sensible size. This is the natural first step: check what you have, then
  decide what to resize to - and it doubles as a quick way to check any PNG or JPEG's dimensions
  from the terminal.

By default the file is overwritten - that fits the "shrink a committed asset" purpose. Pass
`--output <path>` to write the result to a new file and leave the original untouched. Either way imp
reports the before and after dimensions and byte size.

Resizing **only ever downscales pixels, with minimal compression** - quality is prioritized over
squeezing out the last byte. A request larger than the source is clamped to the source, so the
command never upscales. If you need fine-grained control over compression or quality, reach for a
dedicated image tool; imp keeps this surface deliberately small.

**Scope.** Static **PNG** and **JPEG** are supported today. WebP, GIF, and animated images (animated
PNG included) are not yet handled - imp detects them and stops with a clear message rather than
silently dropping frames or changing format - and support may broaden later.

## `imp lint`

```
imp lint [...paths]
imp lint --fix [...paths]
```

Lints the given paths (default: the whole project) with a standard recommended rule set plus imp's
own rules, which are always applied: `no-capital-component` (imp components are lowercase functions)
and `exact-dependency-versions` (dependency pins in `imp.json` must be exact, and imports must go
through declared, vendored dependencies - see **[Managing dependencies](dependencies.md)**). `.html`
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

An ignored path - an exact file, or anything under a listed folder - never trips the check. Outside
a git repository the file-size scan is skipped; the rest of `imp lint` runs unchanged.

See **[Linting](lint.md)** for the full rule descriptions, configuration, ignore directives, and
output format.

## `imp fmt`

```
imp fmt [...paths]
imp fmt --check [...paths]
```

Formats the given paths in place (default: the whole project) - JavaScript, JSON, Markdown, CSS,
HTML, SVG, XML, SQL, and YAML, with inline `<script>`/`<style>` blocks in HTML formatted too.
`--check` reports files that would change without writing them and exits non-zero when formatting is
needed - useful in CI.

Options (line width, quotes, semicolons, …) come from the `fmt` block of `imp.json`, and
`imp-fmt-ignore` comments protect hand-crafted layout.

See **[Formatting](fmt.md)** for supported languages, all options and their defaults, ignore
directives, and check mode.

## `imp skill` - the manuals, for an AI agent

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

These manuals are written **for an agent**, not for you: they carry the same subjects as these
pages - the call shapes, the prop and option tables, and the mistakes the API invites - stripped of
the narrative a person reads a guide for. So `imp skill state` is not this documentation reflowed
for a terminal; it is the short, mechanical version of it, and the two are written and updated
together.

With no argument it prints an **index**: one line per subject with a short summary, grouped into
what you need to write an app (imports, rendering, components, state, routing, theming,
translations, logging), what you need to work in the project (the CLI, testing, dependencies,
linting, formatting), one line per standard component - and, last, every component **in your
project** that has a skill file next to it. An index is cheap to read, so an agent spends one call
finding out what exists and one more learning the part it needs.

With one or more subjects it prints those manuals in full. Skill text is the only thing written to
standard output - every diagnostic goes to standard error - so `imp skill state > state.md` captures
exactly the manual and nothing else. There are no flags: running the command and reading the output
is the whole interface.

Subjects answer to the names you are most likely to have in hand already. The import specifier works
(`imp skill imp/state`, `imp skill imp/std/button`), so does the plain subject (`state`,
`rendering`, `button`), and so does a page name (`state.md`), all case-insensitively. An unknown
subject prints the list of real ones to standard error and exits with code 1. Cross-references
between manuals are printed as the command that fetches them - "Rendering (imp skill rendering)",
plus a `Related:` line at the foot of the page - so an agent can always follow one manual to the
next without guessing at a file path or a URL.

**Components are asked for by file.** `imp skill ./components/counter.js` prints the skill file
sitting next to that module - `counter.skill.md` - and naming that file directly works too. It is
the same convention imp's own components follow, so `imp skill std/button` and
`imp skill ./components/counter.js` are one operation on two different components. A component with
no skill file exits with code 1 and names the file to write, so a tool can tell "no skill yet" apart
from a real failure. See **[Components](components.md)** for how to write one and what happens to it
at build time.

## `imp update` - pinning the imp version

```
imp update [version] [--check]
```

A project can pin the exact imp version it is built against with a `"version"` field in `imp.json`.
Once pinned, **any** imp binary runs the project on that version: on startup imp compares the pin
against itself, and on a mismatch it fetches the pinned version (once, cached per-user) and hands
off to it. There is nothing to install per project and no version managers to configure - whoever
runs `imp start`, `imp test`, or any other command gets the version the project pins, so a teammate
on a newer or older imp still builds and tests against the same one. Pins are exact (`"1.2.3"`,
never a range), which is what makes them reproducible.

`imp update` sets and moves that pin:

- **`imp update`** resolves the latest published release, downloads it, and writes it into
  `imp.json`'s `"version"` field - searching upward from the current directory for the project (so
  it works from any subdirectory) and preferring the `imp.json` at your repository root. It prints
  what changed, e.g. `imp updated 1.2.3 → 1.3.0`. The next command you run picks up the new version
  automatically. If the project has no `imp.json`, the release is still downloaded and cached; no
  pin is written.
- **`imp update <version>`** pins a specific version instead of the latest.
- **`imp update --check`** reports whether a newer release exists and changes nothing.

When you run imp interactively in a project that has **not** pinned a `"version"` in its `imp.json`,
and a newer release is available, imp also prints a one-line hint suggesting `imp update` (checked
at most once a day, never blocking the command). If your `imp.json` pins a version, imp assumes you
chose it on purpose and stays silent - move the pin yourself with `imp update` when you want a newer
release. Silence the hint for unpinned projects with the `--no-update-check` flag or by setting
`IMP_NO_UPDATE_CHECK`.

If a pinned version cannot be obtained - you are offline, or the release was removed - imp stops
with a clear error naming the version rather than silently running a different one; a pin that isn't
enforced is not a pin. To deliberately bypass the pin (say, to debug against the binary you have),
set `IMP_VERSION=system`.

Downloaded versions are cached per-user under `~/.imp/` (each is verified against its published
checksum before it is stored), shared across every project you work on. Set `IMP_HOME` to cache them
somewhere else - useful in CI or containers where the home directory isn't writable, or to keep the
binaries off your home volume.

## `imp prune` - reclaim disk space

```
imp prune
```

Every version imp downloads stays cached so switching between pinned projects never re-downloads,
but binaries are large and the cache only grows. imp records when each cached version was last run,
and whenever it downloads a new one it points out any that haven't run in over 30 days:

```
2 unused imp versions (1.1.0, 1.2.3) have not run in over 30 days - run 'imp prune' to reclaim disk space
```

`imp prune` deletes exactly those stale versions - anything not run in the last 30 days - and
reports how much space it freed. The version you are currently running is never removed, and any
version you pin again later is simply re-downloaded on demand, so pruning is always safe.

## `imp licenses`

```
imp licenses
```

imp is a single binary that bundles a number of open-source tools (the browser automation, the
formatter and linter engines, the image and video encoders, and more). `imp licenses` prints the
third-party license notices for everything the binary ships - each component, its version, and the
full text of its license - so the attribution required by those licenses is available straight from
the binary. It takes no arguments.

This covers the tools you _develop_ with, not the code you _ship_: none of it ends up in your app.
The notices for what your users download are collected by `imp build` into
[`LICENSES.txt`](#license-notices).
