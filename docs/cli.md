# imp - CLI

The `imp` CLI is a complete toolkit for an imp app. One binary holds a static dev server, a
dependency manager, a linter and a formatter. imp is built for the AI era. Every part of the
workflow works with an AI coding agent. You can develop an app from start to end and write no line
of code by hand.

**Development is buildless.** There is no build step, no bundling and no transform while you work.
`imp start` serves your files exactly as you wrote them. You edit a file, the browser reloads, and
the source you typed is what runs. You add a dependency once, with `imp install`. It then lives
inside your repository. See **[Managing dependencies](dependencies.md)**. The server needs no
network and no package installation. A fresh clone is the whole app, and it runs.

**Production has a build.** When you are ready to ship, imp packs the app into one self-contained,
minified bundle. You upload it to any static host or CDN. The server needs no imp runtime, only the
static files. imp also builds each module that loads lazily into its own chunk, instead of inlining
it into the main bundle. That chunk loads on demand. The build resolves imports exactly as
development does, so what you tested is what you ship.

## Installation

`imp` ships as one self-contained binary, for macOS, Linux and Windows, on x64 and on arm64. On
macOS and on Linux, the install script detects your platform, downloads the latest binary, and puts
it on your `PATH`:

```sh
curl -fsSL https://sobanieca.github.io/imp-ui/install.sh | bash
```

The script installs to `/usr/local/bin` by default, for all users. If you can't write to that
folder, the script stops with an error: run it with `sudo bash` instead of `bash`. To choose another
location, set `INSTALL_DIR` to a folder on your `PATH`, such as
`curl -fsSL https://sobanieca.github.io/imp-ui/install.sh | INSTALL_DIR=~/.local/bin bash`.
To install by hand, download the binary for your platform from the
[releases page](https://github.com/sobanieca/imp-ui/releases/latest). Make it executable and put it
anywhere on your `PATH`:

```sh
curl -fsSL -o imp https://github.com/sobanieca/imp-ui/releases/latest/download/imp-linux-x64
chmod +x imp
```

On Windows, run this command in PowerShell. It installs `imp.exe` into
`%LOCALAPPDATA%\Programs\imp`, and adds that folder to your `PATH`. It needs no administrator
rights. To choose another folder, set `INSTALL_DIR`.

```powershell
irm https://sobanieca.github.io/imp-ui/install.ps1 | iex
```

The asset names are `imp-linux-x64`, `imp-linux-arm64`, `imp-macos-x64`, `imp-macos-arm64`,
`imp-windows-x64.exe` and `imp-windows-arm64.exe`. Each asset has a `.sha256` file beside it, and
both scripts verify it. There is no binary for Linux with musl, such as Alpine. To confirm the
install, run `imp --version`. It prints the version that the binary runs.

## Commands

```
imp init [dir] [--pwa] [--font <name>] scaffold a new project (--pwa: installable app)
imp start [file.html] [--port 4400]   serve a page (default: index.html)
          [--mock | --no-mock]        answer from the mocks folder, or from the real API
          [--no-reload]               keep the page as it is when a file changes
          [--host <address>]          listen on another address than 127.0.0.1
imp build [file.html] [--output dist]   build the app for production
          [--pwa]                     also emit an installable, offline PWA
imp preview [path] [--port 4401]      preview components in isolation, one page per
            [--list] [--json]         *.preview.js file (no path: an index of all of them)
            [--output <dir>]          export the gallery as static files that any page embeds
            [--mock | --no-mock] [--no-reload] [--host <address>]
imp review [clear]                    list the reviews written from the browser
                                      (clear: delete every saved review)
imp logs [-n <count>] [-f]            print the log of the dev server session
                                      (-n: the last <count> entries | -f: follow it)
imp install [package[@version]]       vendor a dependency into dependencies/
                                      (no version: latest | no package: update all)
imp uninstall <package>               remove a vendored dependency
imp audit [--sbom] [--output <file>]  check the vendored packages for known vulnerabilities
                                      (--sbom: write a CycloneDX bill of materials)
imp test  <file>                      run one test file in headless Chrome: *.test.js
                                      unit in a blank page, *.spec.js e2e against the app
imp test  --unit | --e2e              run every file of that level, each in its own
                                      process, in parallel (--jobs <n> caps concurrency |
                                      --screenshots <dir> | --video <dir>)
imp resize <image> [-w <px>] [-h <px>]   shrink an oversized PNG/JPEG asset in place,
           [--output <path>]          keeping aspect ratio unless --stretch is given
           [--stretch]                (neither -w nor -h: report current dimensions
                                      and size, plus a recommended resize command)
imp lint  [...paths] [--fix]          lint with imp rules (--fix applies autofixes)
imp fmt   [...paths]                  format source
imp map   [file]                      print the application map of the app: every node
                                      with its path, label, access and description
                                      (the 'map' file of imp.json, or a part you pass)
imp skill [...subject]                print imp's manual for a subject, for an AI agent to
                                      read (no subject: the index of every subject)
imp skill --init                      create the /imp skill for Claude Code, Codex and Cursor
imp update [version] [--check]        update to the latest release and pin it in imp.json
imp prune                             delete cached imp versions unused for 30+ days
imp licenses                          print third-party license notices for bundled tools
imp --version                         print the version this binary runs
imp help                              show usage
```

imp prints the usage text when you run `imp` with no argument, `imp help`, or `imp --help`. An
unknown command prints the usage text and exits with code 1. The last line of the usage text is
addressed to an AI agent. It points at `imp skill`, which prints the manuals that imp carries for
exactly that reader.

## Configuration - `imp.json`

The only config file that you write is `imp.json`, at your project root. It is optional, and every
command works without it. It holds your imp version pin, your vendored dependencies, the options of
each command (`fmt`, `lint`, `test`, `preview` and `pwa`), and the named environments that you
select with `--env`:

```json
{
  "version": "1.2.3",
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "devServerPort": 9085,
  "fmt": { "lineWidth": 100 }
}
```

**[Configuration](config.md)** covers every key, what reads it, and the environment files behind
`--env`. The rest of this page describes the commands, and names the keys that each one reads.

## `imp init` - your first command

```
imp init [dir] [--pwa] [--font <name>]
```

`imp init` scaffolds a new project that you can run immediately. With no argument, it scaffolds into
the current directory. Give it a name, and it creates that directory and scaffolds inside it. It
never asks a question. One command puts the project on disk. That is what makes it safe to give to
an AI agent as a first step.

What you get is deliberately small. It is a working app, not a template to study:

| File                 | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `imp.json`           | your one config file: the imp version, and the path of the map          |
| `index.html`         | the page imp serves, with the mount point, the entry and the font       |
| `src/main.js`        | applies the theme of the app and mounts the frame                       |
| `src/theme.js`       | the theme of the app: the built-in light theme with the font of the app |
| `src/app-map.js`     | the application map - the features of the app, one node per line        |
| `src/app.js`         | the frame, the router, and a click counter bound to the home node       |
| `test/app.test.js`   | a unit test that mounts the frame and clicks the button of the counter  |
| `test/app.spec.js`   | an end-to-end spec that drives the same app in a real browser           |
| `public/favicon.svg` | a placeholder mark, published at the site root                          |
| `public/fonts/`      | one font family, its `@font-face` stylesheet, and its license           |
| `.gitignore`         | ignores `dist/`, `.imp/`, every `.env` file, and the usual OS noise     |

There is no `README`, no `src/components/` tree and no second example. The counter shows the shape
of an imp app: a component, a namespaced state, and a live text node bound to that state. The map
shows the shape of a routed app. It has two nodes. `home` binds the counter, and `about` renders a
placeholder until you bind a screen to it. The nav of the frame works from the first run. See
**[Routing](routing.md)**. Delete the counter when you start to write your own app.

The scaffold is a working project when it arrives. `imp lint`, `imp fmt --check`, `imp test --unit`
and `imp test --e2e` all pass against it before you change a line. A failure after your first edit
is about your edit.

### The font of a new app

Every new app gets a font of its own. `imp init` picks one family at random from a short list, and
writes it into the project. To choose the family yourself, give its name to `--font`:

```
imp init my-app --font space-grotesk
```

| `--font`            | Family            | License                   |
| ------------------- | ----------------- | ------------------------- |
| `inter`             | Inter             | SIL Open Font License 1.1 |
| `manrope`           | Manrope           | SIL Open Font License 1.1 |
| `plus-jakarta-sans` | Plus Jakarta Sans | SIL Open Font License 1.1 |
| `dm-sans`           | DM Sans           | SIL Open Font License 1.1 |
| `outfit`            | Outfit            | SIL Open Font License 1.1 |
| `space-grotesk`     | Space Grotesk     | SIL Open Font License 1.1 |
| `sora`              | Sora              | SIL Open Font License 1.1 |
| `figtree`           | Figtree           | SIL Open Font License 1.1 |
| `nunito-sans`       | Nunito Sans       | SIL Open Font License 1.1 |
| `work-sans`         | Work Sans         | SIL Open Font License 1.1 |

imp picks the font, not your AI agent. A random choice from a program is truly random, so two new
apps rarely look the same. The choice is also part of the scaffold before the agent starts. The
agent skill of `imp init` tells the agent to keep the font and to build a palette of its own around
it: the colours, a gradient where it suits, the radius and the shadows. See
**[Theming](theming.md)**.

The font is **hosted by the app itself**. imp copies the font files from its own binary into
`public/fonts/`, and `index.html` links `/fonts/fonts.css`. The page sends no request to another
origin. This has three results:

- The reader's browser does not tell a font service which pages the reader opens.
- The app works offline, and a `--pwa` build caches the font with the rest of the app.
- A Content Security Policy of `style-src 'self'` permits the font. You add no origin.

Each family is the Latin and the Latin Extended subset, with the weights from 400 to 700. A script
that the font does not have, such as Arabic or Chinese, uses the system font. Every family on the
list is licensed under the SIL Open Font License 1.1. This license permits you to use the font in
any app, also in a commercial app. It requires that the copyright notice and the license travel with
the font. So `imp init` writes the license file of the family beside the font files, and `imp build`
publishes it with them. Keep that file. The page does not need to show a credit.

**imp does not overwrite your work.** When one file that it would write is already present,
`imp init` writes nothing, names the conflicts, and exits with code 1. Run it in an empty directory
instead. An empty `public/` folder is not a conflict.

`.gitignore` is the one exception, because it is normal to scaffold into a repository that already
has one. imp does not refuse. It **appends the entries that you do not have, and leaves the rest of
the file as it is**. It then warns you that it changed the file. imp compares patterns, not lines.
So it duplicates nothing. `node_modules` already covers `node_modules/`. A leading `/dist` already
covers `dist/`. One `.env*` already covers `.env` and `.env.*`. When your file covers everything
that imp needs, imp leaves it as it is.

### `--pwa` - start as an installable app

```
imp init my-app --pwa
```

`--pwa` adds two things to the same scaffold. The first is a complete `pwa` block in `imp.json`,
with the name, the short name, the theme and background colours, the display mode and the icon. This
block is also a list of what you can tune. The second is an `icon.svg` at the project root. imp
renders the whole icon set from that one source image, at build time, so there is no other icon file
to manage. Replace the image with your own artwork, and every generated size follows. The image
lives at the project root, not in `public/`, because it is a build input, not a published file.

The project is then ready for `imp build --pwa`, and you connect nothing else. The **Progressive Web
App** section under `imp build`, below, describes what that build emits.

At the end, `imp init` prints what it wrote, and the commands to run next.

## `imp map` - the app on one screen

```
imp map [file]
```

`imp map` reads the file that exports your application map, named by the `map` key of `imp.json`,
and prints the tree. Every node shows its path, its label from its name, and its `description`:

```
app
  /                                Home
    The dashboard
  /projects                        Projects
    /projects/:projectId           Project id
      /projects/:projectId/settings  Settings
  /admin                           Admin
    /admin/users                   Users
  /login                           Login
```

`imp map src/admin/map.js` prints a part of the map on its own, with the description of the node
that it hangs from on the first line, and its paths relative to that node.

The command reads the file in a JavaScript engine that is part of the binary, with no browser. It
loads no translation, so a label is the name of the node in sentence case. The file must not touch
the DOM or the network. A file that exports no map, or a
path that does not exist, exits with code 1 and says what it expected. See **[Routing](routing.md)**
for the map itself.

## `imp start`

```
imp start [file.html] [--port 4400] [--env <name>] [--mock | --no-mock] [--no-reload]
          [--host <address>]
```

`imp start` serves the directory that contains the HTML file that you give. The default file is
`index.html` in the current directory. The command exits with an error when the file does not exist,
or when it is a directory. The entry file answers at `/`.

imp resolves the port in this order: the `--port` flag, then the `devServerPort` in `imp.json`, then
the default `4400`. Set a fixed port for a project, so you do not repeat the flag:

```json
{
  "devServerPort": 9085
}
```

### The dev server is a local tool

`imp start` and `imp preview` are tools for local development. Do not expose them to other machines.
The dev server reads every file of the project, and it has no login. So it must not be the server of
a real site. To publish the app, run `imp build` and upload the output.

By default the dev server listens on `127.0.0.1`. So only programs on your own machine can open the
page. To test the page on a phone, pass `--host 0.0.0.0`. The server then listens on every network
address of the machine, and it prints one URL for each address:

```
imp start --host 0.0.0.0
```

> **Warning:** With `--host`, every device on that network can read the files of your project. Use
> `--host` only on a network that you trust, and stop the server when you are done.

The dev server answers only a request that names it by a loopback name, such as `localhost` or
`127.0.0.1`, or by an address of `--host`. Any other host name gets the status `403`. This stops a
web page that points its own domain name at your machine, a DNS rebinding attack, from reading your
files. With `--host 0.0.0.0`, open one of the URLs that the server prints.

The dev server protects its own endpoints. Live reload, the log of the page, the mock responses and
the saved reviews answer only a request from a page of the dev server itself. A POST must send
`application/json`. A request from another site gets the status `403`. The server does not serve a
file or a folder whose name starts with `.`, such as `.env` or `.git`, and answers `404`. The one
exception is `.well-known/`.

imp injects three things into every served HTML document, so you never reference the imp library by
path. imp skips the injection for a document that already contains the item:

- **Import map.** `imp` and its subpaths resolve to the served library, so pages import by bare
  specifier (see **[Imports](imports.md)**):

  ```js
  import { mount } from 'imp'
  import { div, h1 } from 'imp/html'
  mount('#app', () => div(h1('hello')))
  ```

  imp serves the library source under `/@imp/`, as `/@imp/imp.js`, `/@imp/api/html.js` and so on.
  imp uses a bare specifier instead of a global. The tag factories hold names such as `a`, `b`, `i`,
  `p`, `time` and `menu`. Those names would collide on `window`.

- **Console and error telemetry.** A small inline script forwards `console.*`, an uncaught error and
  an unhandled rejection to the terminal, with the prefix `[BROWSER:*]`. You read the runtime
  behaviour in the terminal, with no developer tools open. An AI coding agent that drives the
  session reads it the same way.

- **Network telemetry.** A service worker, registered at root scope, intercepts _every_ kind of
  request. That covers `fetch`, `XMLHttpRequest`, an image, a script and a navigation. It reports
  each one as `[HTTP] METHOD url -> status ms`. imp passes a request under `/@imp/` through without
  a change.

imp **also keeps everything that `imp start` prints as a log of the session**, one entry per line.
That covers the browser console, the error telemetry, the analytics records, the network telemetry
and the status lines of imp. **[`imp logs`](#imp-logs)** prints that log, so you do not have to
watch the terminal to see what happened. This is what makes the development session readable for an
AI coding agent. While you click through the app, the agent can run
`imp logs | grep '\[BROWSER:error\]'` for an error, a failed request, or any message it expects. It
does not have to watch the terminal. imp starts the log again each time you start the server, so the
log always holds the current session. imp also caps the log. It keeps the most recent entries, 4000
by default, and removes an older entry as a new one arrives. A long session never grows the log
without a limit. To raise or lower the cap, set **`maxLogEntries`** in `imp.json`:

```json
{
  "maxLogEntries": 10000
}
```

The log is a plain text file, `.imp/dev.log`, under the served project. `.imp/` is the working
directory of imp for that project, and git must ignore it. A fresh `imp init` project already
ignores it.

Live reload is included. A file change under the served directory reloads the browser. imp ignores a
change inside `.git/`, `node_modules/`, `dist/` and its own `.imp/` working directory. A reload
loses the state that the page does not store, such as text in a field or an open dialog. Pass
`--no-reload` to keep the page as it is while you edit. The server still serves every saved file, so
the next reload that you make yourself shows the new code.

A failed change does not stop the server. When imp cannot apply a change, or the file watcher fails,
imp writes the error to the terminal and to the session log. The server keeps running, and the next
good save applies again.

imp serves a static file with the correct content type for a common web asset. imp serves your
`public/` folder at the site root, so `public/styles.css` answers `/styles.css`, exactly as it does
in the built site. See [The `public/` folder](#the-public-folder). imp serves the rest of the
project behind that folder, so your module sources load as written during development. A request for
a directory redirects to the URL with a trailing slash, and serves the `index.html` inside the
directory. imp rejects a path outside the served directory.

These internal endpoints are reserved, and they are not part of your app: `/@imp/events` is the
reload stream, `/@imp/log` is the telemetry sink, which the widget below also reads back,
`/@imp/review` is the review sink, described next, `/@imp/sw.js` is the dev service worker, and
`/@imp/*` is the library source.

### Your own service worker

A browser runs one service worker per scope. When your app registers a worker of its own, for a push
notification or a background sync, that worker and the dev service worker of imp would replace each
other at root scope. Name your worker in `imp.json`, and imp steps aside:

```json
{
  "serviceWorker": "src/sw.js"
}
```

With that key, the dev server registers no worker of its own. It bundles your source and serves the
bundle at `/sw.js`, so your worker can import from imp and from your own modules. `imp build` writes
the same bundle as `sw.js` in the output folder.

Your app registers `/sw.js` itself, in development and in production alike. Put the call in the
entry module of your app, so that it runs once on every page load:

```js
navigator.serviceWorker.register('/sw.js')
```

Register `/sw.js`, not the path of your source. The source imports from imp, and only the bundle can
resolve those imports.

Dev mode is one call inside your worker. `startDevMode` from `imp/service-worker` adds the network
telemetry, the answers from your `*.mock.js` files, and the immediate activation that an edit needs.
It changes nothing else about the worker. You decide when it runs. The bundle carries the values of
the selected environment, so `env` from `imp` works in the worker as it does in the page:

```js
import { env } from 'imp'
import { startDevMode } from 'imp/service-worker'

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification(event.data.text()))
})

if (env.DEV_TOOLS === 'on') startDevMode()
```

`DEV_TOOLS` is not a value that imp defines. It is an ordinary environment value, and you choose its
name. Set it in the file of your development environment only, see
**[Environments](config.md#environments---per-target-config)**:

```json
{
  "DEV_TOOLS": "on"
}
```

The gate is necessary. The build keeps the call, and a production worker with the call would report
every request to a dev server that does not exist. Your production environment does not set
`DEV_TOOLS`, so the call does not run there.

Call `startDevMode` at the top level of the worker, not inside an event. A browser only honours a
listener that a worker adds while the script first runs.

An edit to the worker, or to a file that it imports, reloads the browser like any other change. The
new bundle installs on that navigation. When the bundle cannot be built, imp reports the file and
the line in the terminal, and the worker request fails with the same message. Under a sub-path, see
[Deploying under a sub-path](#deploying-under-a-sub-path), register `url('/sw.js')`.

Your worker can also work offline, with the same behaviour as the worker that `imp build --pwa`
writes for a project without one. Call `precacheBuild` from `imp/service-worker`:

```js
import { precacheBuild } from 'imp/service-worker'

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification(event.data.text()))
})

precacheBuild()
```

`imp build --pwa` writes the list of the files of the build into your bundle, and `precacheBuild`
caches them when the worker installs. It serves your page network-first, with the cached app shell
as the fallback, and every other file of the build from the cache. It keeps the previous build for
an open tab, see [Progressive Web App](#progressive-web-app---imp-build---pwa). A build without
`--pwa` writes no list, and in development there is no list either. The call then does nothing, so
you never need to gate it. Call it at the top level of the worker. When your own `fetch` listener
answers a request first, your answer wins.

### Reviewing the page - notes for your agent

Every page that the dev server serves carries a small **review widget**. It is the imp mark in the
bottom corner. Drag it to any place on the page when it covers something, and imp remembers the
place across reloads. Click it, and four round buttons appear: **Add review**, **Console logs**,
**Network logs** and **Theme editor**. The panel and the buttons take their colours from the theme
that your app applied, so the widget is light on a light theme and dark on a dark one. A page with
no theme gets a dark widget.

**Add review** starts a selection. The next element that you click on the page is the element that
you review. Move the pointer to see what imp is about to select. imp outlines the element under the
pointer. Click the element, type a comment, and press **Save review**, or `Ctrl` or `Cmd` with
`Enter`. The selected element stays outlined while you type, so you never have to check a DOM path
to know what you describe. `Escape` cancels the selection. `Enter` takes the highlighted element,
when you prefer the keyboard to the mouse.

**Console logs** and **Network logs** show what the page sent to your terminal since it loaded: what
it logged, what failed, and each request with its status and its time. A new line appears as it
happens, so press a button in the app and watch what it logged. Each line is one row, cut with an
ellipsis. Click a row to read all of it. The console view filters by level. The network view filters
by kind and by outcome. It starts on **Fetch**, a request that your code made with `fetch` or
`XMLHttpRequest`. **Resource** is what the browser fetched on its own: a script, a style sheet, a
font or an image. **OK** and **Failed** split them by status. Each filter has its own colour, and
the level or the status of a row carries the same colour. The page keeps the last 2000 entries, and
a reload starts the list again. The bin button beside the title empties the view, so the next line
stands alone. It clears the page only. The terminal and `imp logs` keep the whole session. The views
give a glance, not a debugger. For a stack trace, a request body or a timing chart, open the
developer tools of the browser.

**Theme editor** opens the **Tokens** view of the editor that `imp preview` has, in the panel of the
widget, for the theme that your app applied. It shows the whole theme as JSON. Edit any token, and
the app re-skins as soon as the JSON parses, on its own screens. The knobs that derive a theme from
two colours are in `imp preview`, where you start a theme. The widget is where you tune one token
against your real screens. imp keeps the draft for that theme across reloads, so a save in your
editor does not undo your edits. **copy** or **download theme.js** gives you the theme as an
ordinary module. Pass it to `init`. imp drops the draft by itself when the theme of that name
changes, and **reset** drops it at once. See **[the theme editor](#the-theme-editor)** under
`imp preview` for the knobs and the file.

That is the whole interaction. You click through the app, and you describe what is wrong in the
words that you would say out loud. imp records which page you were on and which element you meant,
so your AI coding agent does not have to guess either. Each review becomes a plain-text file. You
read it back with **[`imp review`](#imp-review)**, described there.

The widget is part of the dev server, and of nothing else. `imp start` and `imp preview` inject it.
`imp build` never injects it, so no review code reaches your production bundle. The widget appears
only when you look at the server over a loopback address. The server accepts a review only from the
machine that runs it. Open the dev server from another device on your network, and the widget is not
there.

For the same feature for the people who use your finished app, use the `bugReport` component. See
the [component gallery](/components). It has the same picker and captures the same context. It ships
in your bundle, and it gives the report to a function that you write. It does not write to
`.imp/reviews/`, and it does not replace this widget.

### Mock responses - `*.mock.js`

Point `imp.json` at a folder, and the dev server answers a matching request itself. So the app runs
before its backend exists, or with no backend at all:

```json
{
  "mocks": { "folder": "mocks", "enabled": true }
}
```

Both keys are necessary. `folder` says where the files are. `enabled` says whether they answer by
default. Every project states which backend it develops against, and every run can override that.

Every `*.mock.js` file under that folder exports a `mocks` array. imp also reads a nested folder.
Each entry decides what it answers, with `match`, and answers, with `handler`:

```js
// mocks/users.mock.js
export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 800,
    handler: () => ({
      status: 200,
      body: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    }),
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/users',
    handler: (request) => ({ status: 201, body: { id: 3, ...request.body } }),
  },
]
```

Split the files as your app is split, with one file per resource, or one folder per feature. Then
start the server as usual. Nothing in your app changes. Your client keeps its real base URL. Your
components keep their real calls. `imp build` leaves the folder out of production.

- **`match(request)`** returns true when this entry must answer. The request that it receives is
  `{ method, url, path, query, headers, body }`. `path` and `query` come from the URL. `body`
  arrives parsed when the page sent it as JSON. **The first match wins**, in file-path order.
- **`handler(request)`** receives the same object, and returns `{ status, headers, body }`. The
  default `status` is `200`. imp sends a `body` that is not a string as JSON. Set a `content-type`
  in `headers` to send anything else. A handler can be async.
- **`delay`** is the simulated latency in milliseconds, so you can watch your spinners work.
- **imp sends an unmatched request to the real network.** That is how you mock the half of an API
  that does not exist yet, while the rest goes to your backend.
- **A thrown error simulates a failed connection.** The request fails in the page exactly as it does
  when the server is unreachable. It is a real network error, not a `500`.
- **A mock file is an ordinary module.** It can import a shared fixture, and any dependency that you
  installed. imp loads the files once when the run starts, so a closure is how a mock keeps state
  between two requests. All tabs share that state, and a reload keeps it:

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

#### Generated data

A mock often needs data that looks real: an id, a person, an email. Import `fake` from `imp/fake`:

```js
import { fake } from 'imp/fake'

export const mocks = [
  {
    route: 'POST /api/users',
    handler: (request) => {
      const name = fake.name()
      return {
        status: 201,
        body: { id: fake.guid(), name, email: fake.email(name), ...request.body },
      }
    },
  },
]
```

| Call                 | Gives                                                           |
| -------------------- | --------------------------------------------------------------- |
| `fake.guid()`        | a random UUID, such as `'9b2f4e1c-0d3a-4c5e-a1b2-3c4d5e6f7a8b'` |
| `fake.name()`        | a first name and a last name, such as `'Maria Novak'`           |
| `fake.email(name?)`  | an address such as `'maria.novak42@example.org'`, from `name`   |
| `fake.phone()`       | a phone number such as `'+1 415 555 0142'`                      |
| `fake.hash(length?)` | `length` hex characters, 32 when you give no length             |
| `fake.address()`     | `{ street, city, postalCode, country }`                         |

Each call gives a new random value. The values are safe to show: an email uses the domains
`example.com`, `example.org` and `example.net`, which never receive mail. A phone number is in the
`555-0100` to `555-0199` range, which no person owns. The values are not secure, so do not use
`fake.hash` for a real secret. A test and a preview can import `imp/fake` too, for example to fill a
list with people. `imp build` refuses it in an app.

#### Turning mocks on and off

A project usually has both kinds of day: one against the fixtures, and one against the running
backend. `imp.json` decides which one a run gets, and a flag overrides that per run:

```
imp start              # what imp.json says
imp start --mock       # this run answers from the mocks folder
imp start --no-mock    # this run goes to the real API
```

Use `"enabled": true` while the backend does not exist. A plain `imp start` then develops against
the fixtures. When there is a backend to work with, keep the files and change the default. A plain
`imp start` is then a real run, and you ask for mocking when you want it:

```json
{
  "mocks": { "folder": "mocks", "enabled": false }
}
```

The same two flags work on **`imp preview`**, where the files are fixtures for a previewed
component, and on **`imp test`**, where they are fixtures for your e2e specs. So
`imp test --e2e --mock` runs the suite with no backend. When the mocks are on, the server says so as
it starts:

```
[INFO] mocks - 2 file(s) from mocks/ answering requests
```

A mocked answer is a real response, and it arrives over the network layer of the browser. So
everything after it behaves normally. An [HTTP client](http.md) retries a mocked `503`. A `delay`
keeps `pending` above zero, and your interceptors run. imp reports a mocked request in the terminal
like any other request, with the file and the entry that answered it:

```
[HTTP] GET http://localhost:4400/api/users -> 200 802ms (mock: mocks/users.mock.js #1)
```

An edit to a mock file, or to a file that it imports, reloads the browser like any other change. imp
then loads the mocks again, so their state starts again from the files. An edit that you save while
imp loads the mocks is not lost. imp loads them one more time. imp reports a file that it cannot
build, with its line, in the terminal, and the rest of the app continues to run.

Mocking works through a service worker that `imp start` registers for you. So it covers _every_
request that the page makes: `fetch`, `XMLHttpRequest` and a third-party SDK, not only the requests
that imp issues. The worker sends each request to the `imp start` process, and your mock code runs
there. The browser can stop an idle service worker at any time and start it again from nothing. So
the worker keeps no state, and a list that a mock remembers stays correct for the whole run.

The mock code runs outside the page, in a worker thread of the `imp start` process. In a `*.mock.js`
file there is no `document`, and there is no access to the state of your app. The code runs with the
same access to your machine as `imp start`, as any other script in your project does. Each load of
the mocks gets a new thread, and imp stops the old thread after its last answer. So a long session
with many edits does not grow the memory of the server. An error that your mock code throws outside
a handler, for example in a timer, stops only the mocks. imp reports it, and the next request loads
the mocks again. `imp preview` and the e2e server of `imp test` are the same dev server, so your
mocks apply there as well.

### Dependencies

A vendored dependency needs nothing special from the dev server. The injected import map points each
declared alias at its bundle, inside the `dependencies/` folder of your project. imp serves that
bundle like any other static file. There is no network, and no resolution while the app runs:

```js
import mitt from 'mitt'
```

When a declared dependency has no vendored bundle yet, `imp start` prints a warning that suggests
`imp install`. This happens, for example, straight after you edit `imp.json` by hand.

## `imp build`

```
imp build [file.html|file.js] [--output dist] [--pwa]
```

`imp build` builds the production version of your app into an output directory. The default is
`dist/`. You upload that directory to any static host or CDN, exactly as it is. It holds plain
static files. There is no imp runtime, no import map, and nothing to install on the server. imp
replaces the output directory on every run.

imp deletes the output directory before it writes the build. So it refuses an output directory that
holds your work:

- the project folder, or a folder that contains it
- `public/`, a folder that contains it, or a folder inside it
- a folder that contains a source file of the build, such as `src/`
- a folder that holds files that imp did not write

A new folder or an empty folder is always accepted. Each build writes a `.imp-output` marker file
into the folder, so the next build knows that it can replace the folder.

The command is `build`, not `bundle`, because the output is more than a bundle of your JavaScript.
It is the whole production build step, and it can emit more generated files beside the bundled code.

With an HTML page, which defaults to `index.html`, the same entry that `imp start` serves, imp finds
the module scripts of the page. It bundles each one into minified, self-contained JavaScript:

- **The resolution is the same as in development.** `import { div } from 'imp/html'`, and every
  vendored dependency alias, resolve exactly as they do under `imp start`. Every `imp` specifier
  resolves to the built-in library, and each alias resolves to the bundle in your `dependencies/`
  folder. The build runs offline. What you tested in development is what you ship.
- **Every script gets a content hash in its name.** So does every file that your code imports, such
  as an image or a font. All of them go into `chunks/`, and only imp writes there. A
  `public/chunks/` folder stops the build, see [Deploying an app](deploy.md). imp writes the bundle
  of each `<script type="module" src="...">` to `chunks/`, with a content hash in the file name,
  such as `chunks/main-4ZDAFRFX.js`. It then points the `src` of the built page at that file. The
  HTML file keeps its own name. So a browser can cache every script for a long time, and a deploy
  never serves an old script under a new page. imp also bundles an inline `<script type="module">`
  block, and writes it to its own hashed file under `chunks/`. The built page has no inline script.
  The names depend only on your sources. The same project gives the same names in any folder.
- **A script cannot import CSS.** A component carries its styles in its `styles`, inside its own
  shadow root. A stylesheet for the page itself lives in `public/`, and the page links it with
  `<link rel="stylesheet">`. So an `import './card.css'` has no place to go, and the build stops
  with a message that names the script.
- **imp splits the code.** imp puts a module that you load lazily with `import()` into a separate
  chunk, under `chunks/`, with a content hash. That chunk loads on demand. imp emits code that
  several entry points share once, instead of a copy in each bundle. imp writes a chunk only when an
  entry can reach it. So a lazy import inside code that the build drops, such as the world data of a
  `map` that you never render, adds no file to the output.
- **You ship only the imp that you use.** imp drops unused code from the bundle. That applies to imp
  itself as much as to your own modules. A page that never touches state, theming, translations or
  the router carries none of them. An import of one standard component does not bring the other
  components of its group. A page that mounts one element builds less than 4 kB of imp. A page that
  uses every part of imp pays for every part. There is nothing to configure. Import what you need,
  and imp emits nothing else.
- **imp preloads what a script needs at once.** For each chunk that a script of your page imports
  statically, imp adds a `<link rel="modulepreload">` tag to the `<head>`. So the browser fetches
  the whole first screen in parallel, and not one import after another. A chunk that loads through
  `import()` gets no tag, because the page may never need it.
- **A size budget stops a build that grew too much.** Set `build.maxSize` in `imp.json`, in bytes. A
  build whose output is larger fails. imp names the largest files, and leaves no output folder, so
  an oversized build cannot reach a deploy. imp sets no budget by default.
- **A built app logs warnings and errors only.** The default log level of a built app is `warn`, so
  a debug message and an info message stay out of the console of every user. `IMP_LOG_LEVEL` sets
  another level, see [Logging](logging.md).
- **imp drops its development checks.** While `imp start` serves your app, imp checks the page as it
  renders, and warns in the console about a mistake that the browser hides. One such check finds a
  styled element that moved into the shadow root of another component. `imp build` folds every such
  check away. The production bundle holds no check, no message and no cost.
- **imp collects a third-party license notice. It does not remove it.** imp gathers every license
  notice that the code in the bundle carries, into one `LICENSES.txt` at the root of the output.
  Each emitted script starts with a comment of one line that points at that file. See
  [License notices](#license-notices) below.
- **imp writes the pages, zones and outcomes of your app to `app-analytics.json`.** When `imp.json`
  names a `map`, the build runs that file and writes `app-analytics.json` at the root of the output.
  Its `pages` list holds the pattern of every node. Its `zones` and `outcomes` lists hold, sorted,
  every zone name and every outcome name that the app can send. The names come from each module of
  the bundle, and not from `dependencies/`. An analytics store reads the file from your site, and
  accepts a record only for a page, a zone and an outcome that exist. A `public/` file with this
  name stops the build. See [Analytics](analytics.md#check-each-record-on-the-server).
- **imp resolves a build flag and folds it away.** imp answers every `flag('NAME')` check for the
  environment that you build. It removes the branch behind a disabled flag, with everything that
  only that branch used. The build prints what it decided. See **[Build flags](build-flags.md)**.
- **Your `public/` folder becomes the site root.** imp copies anything that you put in `public/`
  without a change, and removes `public/` from the path. That covers a stylesheet, an image, a font,
  `favicon.ico` and `robots.txt`. So `public/logo.png` ships as `logo.png`, and it answers at
  `/logo.png`. That folder is the only thing that imp copies, so nothing else can reach the output
  by accident. Your module sources are already compiled into the bundles. `imp.json`, your
  environment files, your mocks and everything else in the project are never part of the site. See
  [The `public/` folder](#the-public-folder) below.
- **imp writes no source map.** A stack trace from production points into minified code. So handle
  errors properly in your app, and do not depend on the stack trace:
  - Put an error boundary around each part of the page that can fail on its own, such as the page of
    a route or a dashboard card. See [Error boundaries](components.md#error-boundaries).
  - Catch the rejection of async work that runs outside a mount, such as a fetch in an event
    handler. Show the failure to the user.
  - Count each error on its page. imp does this for you when you register an analytics sink: every
    uncaught error, render error and failed request becomes an `error` record with its page. A sink
    that forwards those records to your store tells you which page breaks and how often, without a
    map back to your source. See [Analytics](analytics.md#errors-only).

With a JavaScript module in place of a page, `imp build` emits that module as one self-contained
file. imp compiles in imp itself and every dependency. You can drop the result into any application,
on any framework. It needs no imp runtime and no other runtime. A web component that you wrote with
imp is an example.

**A JS entry is a component, and its build writes its manual beside the bundle.** Other developers
program against a component. So the output folder also gets `imp-skill.md`, a copy of the skill file
beside the entry, such as `counter.skill.md`. A JS entry with no skill file stops the build, and the
message names the file to write. Publish `imp-skill.md` with the bundle, next to the entry module of
your package. Then `imp install` copies it into the app that installs the component. imp puts no
skill text into any bundle. See **[Components](components.md)**.

### Content Security Policy

A built app works under a strict Content Security Policy with no setting, no hash and no nonce:

```
Content-Security-Policy: script-src 'self'; style-src 'self'
```

That policy blocks every inline script and every `style` attribute. So a page that it protects runs
only the scripts that your own server sends. imp builds for it:

- **imp writes no inline script.** An inline `<script type="module">` of your page goes into a
  hashed file under `chunks/`. The environment values go into `chunks/env-<hash>.js`. The script
  that registers the service worker of `--pwa` goes into a hashed file too.
- **A classic inline `<script>` in your page stays as you wrote it**, and the policy blocks it. Move
  its code into a module.
- **`imp build` warns about each inline construct in your page that the policy blocks.** That is a
  classic inline `<script>`, an event handler attribute such as `onclick`, a `javascript:` URL, a
  `<style>` element and a `style` attribute. The warning names the line of each case:

  ```
  [WARN] index.html has inline code that the Content Security Policy script-src 'self'; style-src 'self' blocks:
    index.html:12 - an inline classic <script> - move the code into a module
    index.html:19 - an inline event handler onclick= - add the listener in a module
  ```
- **A `style` prop works under the policy**, as an object and as a string. imp sets the style
  through the CSS object model, which the policy does not block. The styles of the components are
  constructed stylesheets, which it does not block either.
- **Markup in `html()` with a `style` attribute is blocked.** Write that style in CSS instead, or
  add `'unsafe-inline'` to `style-src`. The same applies to a `<style>` element or a `style`
  attribute in your `index.html`. Put that CSS in a file in `public/`.
- **Add each origin that you load from.** An app that loads the script of an analytics provider adds
  its origin to `script-src`, and the origin that it sends data to, to `connect-src`. A web font
  from another origin needs `style-src` and `font-src` entries.

imp writes no policy. It emits no `<meta http-equiv>` tag and no host file, such as `_headers`. Your
app knows its origins, and your host decides the format of its headers. Send the policy as a header
from the host. imp does not support Trusted Types: `require-trusted-types-for 'script'` blocks the
`innerHTML` that `html()` uses. The policy applies to the build only. `imp start` injects inline
scripts for the dev tools, so do not send the policy from the dev server.

### License notices

Most open-source licences, such as MIT, BSD and Apache-2.0, let you ship the code on one condition.
The copyright notice and the permission notice must travel with the code. A minifier removes those
notices by default. So the build that you deploy is not compliant, and nothing tells you.

`imp build` keeps the notices, and writes them to **`LICENSES.txt`** at the root of the output
directory. It uses three sources, because no one of them alone is complete:

- **The licence of imp itself.** Your bundle contains the parts of the imp library that your app
  uses. imp is MIT-licensed, so its notice travels with them. When the host page provides imp, as
  with `targetImpHost`, the bundle contains no imp code and the file leaves this notice out.
- **The licence that imp recorded for every package that you vendored.** `imp install` reads the
  licence identifier and the full licence text of each package when it resolves the package, and
  records them beside the bundle. This half catches the common case: a small package whose licence
  lives in a `LICENSE` file, and nowhere in its code.
- **The legal comments in the bundled code.** Those are the `/*! ... */`, `//!`, `@license` and
  `@preserve` blocks. A library uses them to mark a notice that must travel with the source.

```
Third-party license notices

Every license notice carried by the code bundled into this build is reproduced
below, one block per notice, exactly as its authors wrote it. Ship this file
alongside the build: the licenses it lists require the notice to travel with the
code. Every script imp emitted points back here.

The imp library bundled into this build

imp@0.1.0 - MIT

MIT License

Copyright (c) 2026 Adam Sobaniec
...

Packages bundled into this build

Recorded when each dependency was installed, one block per package.

mitt@3.0.1 - MIT

MIT License

Copyright (c) 2021 Jason Miller
...

Notices carried in the bundled code

/*! @license DOMPurify 3.4.14 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 */
```

imp reproduces each notice exactly as its author wrote it. imp never reformats, cuts or summarizes a
licence text. imp lists two identical notices once. A package can appear in both sections. Its
header banner and its licence file are two separate notices, and imp reproduces what it found. It
does not decide that one of them is redundant.

imp lists only the dependencies that your code imports. imp drops a dependency that `imp.json`
declares and nothing imports, so that dependency contributes no notice. When a bundled dependency
has no recorded licence, the build warns and names it. Run `imp install` to record the licences.

Every script that holds bundled code starts with a comment that names the licence file. That covers
the bundles, the chunks that load lazily, and the files of your inline module scripts:

```js
/*! Third-party license notices: /LICENSES.txt */
```

So a reader who arrives at a minified bundle can find the notices from there. Under a
[deployment on a sub-path](#deploying-under-a-sub-path), imp puts the base in front of that
reference, like every other root-absolute URL, so it still points at the correct place.

`LICENSES.txt` is part of the output. Upload it with the rest of the directory, and keep it there.
The notices ask you not to remove it.

When nothing in the bundle carries a notice, imp writes no file and adds no comment. This happens
only when the bundle contains no imp code and no third-party code.

This file is separate from `imp licenses`. That command prints the notices for the tools that imp
compiles into its own binary. Those are the bundler, the formatter and the test runner that you
develop with, and none of them ships in your app. `LICENSES.txt` covers what your users download.

### The `public/` folder

`public/` holds the files that imp serves without a change. **Its contents are the root of your
built site.** The folder name never appears in a URL:

```
my-app/
  index.html            <- your page, stays at the project root
  app.js                <- compiled into the bundle
  public/
    styles.css          -> /styles.css
    favicon.ico         -> /favicon.ico
    assets/logo.png     -> /assets/logo.png
```

So a page that you write against those URLs works in development and in production, with no change:

```html
<link rel="stylesheet" href="/styles.css">
<img src="/assets/logo.png" alt="">
```

`imp start` also serves `public/` at the site root. So a path that resolves in development also
resolves in the built site.

A few consequences are worth knowing:

- **`index.html` stays at the project root**, not in `public/`. imp processes your page. It bundles
  the scripts, and injects the environment values and the PWA tags. `public/` passes through without
  a change. When you put your page in `public/`, imp says so. The build reports the missing entry at
  the root, and points at the copy that it found. `imp start` warns that it ignores a
  `public/index.html`.
- **imp copies `public/` only.** Nothing else in your project can reach the web by accident. That
  covers `imp.json`, your environment files, which hold secrets, your mocks, and your version
  control directory.
- **A collision is a build error, not a silent overwrite.** When a file in `public/` has the same
  path as a file that imp generates, such as a `public/app.js` against a bundled `app.js`, the build
  fails and names the path. One file does not replace the other in silence.
- **The name is fixed.** The folder is always `public/`. There is nothing to configure.
- **The folder is optional.** A page with no external asset needs no `public/` folder.

### Deploying under a sub-path

When your app is served from a sub-path, such as `https://example.com/my-imp-app/` in place of the
domain root, set the `IMP_BASEPATH` environment value for that deployment. See
[Environments](config.md#environments---per-target-config):

```json
{
  "IMP_BASEPATH": "/my-imp-app"
}
```

`imp build` then puts the base in front of every root-absolute URL that it emits, so the whole site
keeps working one level down. A `href="/styles.css"` in your page becomes
`href="/my-imp-app/styles.css"`. That holds for an `href`, a `src` and a `poster` attribute, for
each image in a `srcset` or an `imagesrcset`, and for the `content` of an `og:image` or a
`twitter:image` meta tag. The PWA manifest, the icons, the service worker and its precache list all
move with it. imp leaves an external URL (such as `https://...`), a protocol-relative URL (such as
`//...`), and a path that is already relative exactly as you wrote it.

The router reads the same value. It removes and adds the prefix when it matches a route and when it
builds a link, so one setting covers your assets and your navigation. Inside a stylesheet, write an
asset URL relative to the stylesheet, as in `url(assets/logo.png)`. Such a URL resolves against the
location of the stylesheet, and it stays correct under any prefix.

### Targeting an imp host - sharing the host's imp

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "targetImpHost": true
}
```

By default, a bundle from a JS entry carries everything that it needs, and that includes imp itself.
When you build a component that must run inside another imp application, which already has imp, set
`targetImpHost: true` in `imp.json`. A bundle of a JS entry then leaves every
`import ... from 'imp'`, and every `'imp/...'` import, in the output as a bare import for the host
to resolve. imp compiles in your code and your dependencies only. Nothing changes in development,
because the import map of the dev server resolves `imp` as before. Nothing changes for your other
dependencies either, because imp always bundles them in, at the versions that you pinned.

Inside an imp application, a bare `imp` import already resolves. In development it resolves through
the import map that the dev server injects. In production it resolves because the `imp build` of the
host resolves it while it builds. The host page then holds a **single copy** of imp, shared by the
app and your component, in place of one copy each. The same contract holds when you publish your
component to a registry, and somebody vendors it with `imp install`. The consuming app keeps the
`imp` import bare, and provides its own copy. See **[Managing dependencies](dependencies.md)**.

Know two things:

- **The host must really provide imp.** Outside an imp application, that means an import map entry,
  or a bundler alias, that maps `imp`. The bundle fails at load time in a page that maps nothing.
  When you are not sure, leave `targetImpHost` off and ship a self-contained file.
- **The imp versions can differ.** A self-contained bundle fixes the imp version that you built it
  with. A bundle for an imp host runs against the imp version that the host provides. That version
  can be newer or older than the version that you developed against. When a host updates imp, the
  behaviour of your component can change, and your bundle does not change at all. Test your
  component against the imp versions that your host applications run.

`targetImpHost` affects a JS entry only. An HTML build has no import map in its production output,
so nothing could resolve a bare import that it left there. A bundle of an HTML page compiles imp in
as usual, because the page is its own host.

### Progressive Web App - `imp build --pwa`

Add `--pwa` to a page build, and imp emits everything that an app needs to install to a home screen
and to keep working offline: a web app manifest, a full icon set scaled from one source image, and
an offline service worker. imp emits those beside the normal production output. Without the flag,
`imp build` produces a plain build. A PWA project can still make a quick, plain build with a bare
`imp build`.

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

Only `name` and `icon` are necessary. `icon` points at a **single** source image of high resolution.
Prefer an SVG, because it scales to any size cleanly. A large PNG or JPEG also works. imp scales
that image to every icon that the manifest and the platforms need, so there is no icon set to
maintain by hand. A raster source must be 512px or more on its longest edge. The largest generated
icon is 512x512. imp must upscale a smaller source to reach that size, which costs sharpness, and
the build prints a warning when that happens. The build then does the following, in one step:

- **imp generates the icon set.** That is a 192px app icon, a 512px app icon, a 512px maskable icon
  with padding that survives the mask of a platform, and a 180px apple-touch-icon. imp generates
  them from the source on every build.
- **imp writes `manifest.webmanifest`**, with the name, the colours and the display mode of your
  app. It also guarantees the fields that a browser needs before it offers an installation: a name,
  a 192px icon and a 512px icon, a display mode, and a start URL.
- **imp writes an offline service worker**, `sw.js`. It injects the manifest link, the theme-color
  meta tag, the apple-touch-icon link and a script that registers the service worker into the
  `<head>` of your page. The built HTML is ready to install, and you edit no source.

**The service worker is the part that matters.** Anything can make a manifest from a template and
resize an icon. What really breaks for a user is a lost connection, an unreliable network, or an app
that they open the day after you deploy. imp gets this right, because it builds your app and so it
knows the exact set of files the app is made of:

- **The precache list is exact.** The service worker precaches exactly the files that this build
  produced: every hashed script and chunk, every asset, the page, the manifest and the icons. imp
  derives the list from the build itself. It does not scan a folder and guess afterwards. imp misses
  nothing that the app needs to run offline, and it caches nothing stale.
- **The files of `public/` are precached too, except the files of your host.** A host reads some
  files as its own settings and does not serve them. imp leaves out `_redirects`, `_headers`,
  `_routes.json`, `404.html`, `CNAME`, `netlify.toml`, `vercel.json` and `staticwebapp.config.json`
  at the root of `public/`. It also leaves out every file or folder whose name starts with a dot,
  such as `.well-known/`. `LICENSES.txt` and `app-analytics.json` stay out as well, because the app
  never loads them. imp encodes each file name in its URL, so a name with a space, a `#`, a `%` or a
  non-ASCII letter loads.
- **One missing file does not stop the install.** A precached file that the build writes is
  required. When one of them does not load, the worker does not install, and the browser tries again
  on the next visit. So a user never gets a partial deploy. A file from `public/` is optional. When
  it does not load, the worker logs a warning and installs without it. When the storage of the
  browser is full, the worker installs with the files that fit, and loads the other files from the
  network. So a full storage never stops an update.
- **A deploy is never stuck.** The cache key comes from the content of the build, so a new deploy is
  a new cache. The new worker takes control at once, and a user moves to the new version
  automatically. Their own cache does not hold them on an old version.
- **An update downloads only what changed.** A file under `chunks/` has a content hash in its name,
  so its content never changes. The new worker copies such a file from the cache of an earlier build
  when it is there. It downloads the other hashed files, and it downloads the page, the manifest,
  the icons and the files of `public/` again, past the HTTP cache of the browser.
- **A deploy does not break an open tab.** A tab that runs the previous build can still load a lazy
  chunk of that build after the deploy, although the server no longer has it. The new worker keeps
  the cache of the build that was active before it, also after a rollback to an older build. It
  deletes every older cache of the app when it activates. It deletes the kept cache when no tab that
  was open at the update remains. So an app keeps at most two build caches, also when it never loads
  a new page. You write no code for this, and the app shows no prompt. Two deploys while one tab
  stays open can still remove a chunk of the first build. A reload of that tab fixes it.
- **Apps on one origin keep their own caches.** The worker names its caches after its scope, such as
  `/app/`. It deletes only the caches of its own app. So two apps under `/a/` and `/b/` on one host
  do not delete the caches of each other. The worker also keeps every cache that your app makes.
- **The defaults are safe, and there is no configuration.** imp serves your page and its deep links
  network-first, and falls back to the cached app shell when the connection is lost. It serves a
  hashed asset cache-first. It never caches a cross-origin response, a request that is not a `GET`,
  or an error response. Those choices avoid the common offline problems, and they apply with no
  setup.

**A project with its own service worker keeps it.** When `imp.json` names a `serviceWorker`, see
[Your own service worker](#your-own-service-worker), `imp build --pwa` still writes the manifest and
the icons, and registers your worker in the built HTML. It writes no second worker, because the two
would claim the same file and the same scope. Call `precacheBuild()` in your worker, and it gets the
same precache and the same update behaviour as the worker that imp writes.

**In development, with `imp start`, installability is automatic.** You need no `--pwa` flag and no
edit to the HTML. When your `imp.json` has a `pwa` block, the dev server injects the manifest link
and the icon links. It generates and serves the manifest and the icons while it runs, so you can
install the app and check its icons and its colours while you work. But only `imp build --pwa`
generates the **offline** service worker. In development the app keeps live reload and the network
telemetry in the terminal, because the development service worker reports a request and caches
nothing. You get the offline behaviour in the production build, where it belongs. That split is
deliberate: a caching worker must never fight live reload while you edit.

**There is one problem when you preview a production build.** A service worker controls a whole
origin, and the development telemetry worker and the offline PWA worker both claim root scope. So
when you serve the output of `imp build --pwa`, and then run `imp start` on the _same host and
port_, the offline worker from the production preview can stay registered and keep serving its
cache. In the dev server that looks like stale content, or a broken live reload. The problem clears
when the development worker takes over. The production caches remain until then. To fix it now, open
the developer tools of your browser, go to Application, then Service Workers, unregister the worker,
and clear the site data. You can also preview a production build on a port that differs from the
port of `imp start`.

## `imp install` and `imp uninstall`

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

`imp install` adds a dependency to your project. It resolves the package from the npm registry. It
bundles the package into one minified module that the browser can run. It writes the bundle into the
committed `dependencies/` folder, and pins the exact version in `imp.json`. With no version, it
resolves the latest release. A second run then updates that dependency. With no argument at all, it
updates every declared dependency. `imp uninstall` removes the folder of a dependency, and its pin.
Your code imports a dependency by its bare alias, as in `import mitt from 'mitt'`. A package that
imports `imp` itself keeps that import bare, because your app provides the imp library. imp never
treats `imp` as a registry package. The bundle keeps the licence notice of the package where the
package put it, so the notice is there for `imp build` to collect into the
[`LICENSES.txt`](#license-notices) of your app.

Such a package is an **imp component**. It must ship `imp-skill.md` next to its entry module, as
`imp build` writes it. `imp install` copies the file into the folder of the dependency. A missing
`imp-skill.md` stops the install. `imp skill <alias>` then prints the manual of the component.

Before it writes, `imp install` checks each npm package against the hash that the npm registry signs
for it. It then puts every package in place, or none of them. `imp audit` checks the vendored
packages for known vulnerabilities.

**[Managing dependencies](dependencies.md)** gives the full story: how to pin a version, how to
update, aliases, a subpath, what imp prints, and why you commit the vendored folder.

### File-size warning

You commit a vendored bundle to your repository. `imp install` warns when a package bundles to more
than `maxFileSize`, which is 200 kB by default, so a heavy dependency never arrives without a
message. The warning names the total that would land in `dependencies/`, and reminds you of the two
settings. To stop the warning for a dependency that you know is large and want anyway, raise
`maxFileSize`, or add the dependency to `maxFileSizeIgnore` in `imp.json`. Add its folder, such as
`dependencies/charts`, or one file. A later update then gives no warning:

```json
{
  "maxFileSize": 262144,
  "maxFileSizeIgnore": ["dependencies/charts"]
}
```

`imp lint` enforces the same limit, described below. So one number governs both commands.

## `imp test`

```
imp test <file> [--filter <text>]
imp test --unit | --e2e [--jobs <n>] [--filter <text>] [--list] [--video <dir>]
```

`imp test` runs the tests of the project on two levels, through one command. A file that ends in
`.test.js` is a unit test or an integration test. imp runs it in a blank page of a headless Chrome,
with no server, and it is very fast. A file that ends in
`.spec.js` is an end-to-end test. imp serves your app exactly as `imp start` does, launches a
headless Chrome, and gives each spec a Puppeteer page that points at the running app. The console
and the network activity of the browser stream to the terminal. You write a test with `test` and
`expect` from `imp/test`. The runner and the assertions are part of the binary, so there is nothing
to install.

imp runs **one test file per process and per browser**. That is the unit of isolation, so no two
files share the globals, the timers, the server or the browser of a process. `imp test <file>` runs exactly that one
file, and exits with its result. To run a whole level, name it. `imp test --unit` covers every
`*.test.js` file, and `imp test --e2e` covers every `*.spec.js` file. Each command discovers its
files, and runs each one in its own process, in parallel. `--jobs <n>` caps the number, and the
default is your CPU count. imp summarizes a passing file in one line. A failing file prints its full
output. The run exits `1` when a file failed. A bare `imp test` with more than one candidate file
does not guess. It asks you to select `--unit`, `--e2e` or a single file. It runs nothing, and exits
with a non-zero code, so a stray `imp test` fails CI instead of passing green. To spread the files
across **machines**, in a CI matrix that imp cannot schedule, run `imp test --list`. It prints the
selected files as JSON, and the matrix hands out one file per job.

Add `--video <dir>` to an e2e run, and imp records the browser session of each spec as an animated
GIF. It writes one file per spec into `<dir>`. A GIF plays inline in a GitHub pull request. This is
how an agent, or a person, attaches a clip of a new feature at work, so a human reviewer can check
its behaviour and its look and feel. Recording is off by default. A `test.video` block in `imp.json`
tunes the frame rate, the duration, the width and the quality. It can also turn recording on without
the flag.

**[Testing](testing.md)** gives the full runner API, the assertion reference, the browser
resolution, the recording, and the pattern for parallel runs in CI.

## `imp preview`

```
imp preview [path] [--port 4401] [--env <name>] [--mock | --no-mock] [--no-reload]
            [--host <address>]
imp preview --list [--json]
imp preview --output <dir> [--env <name>]
```

`imp preview` builds one component at a time, in isolation. It serves every one of your **preview
files** in one app. The catalog is down the side, and a click opens a component in place, with no
page load. The `imp skill` command that an AI agent must run before it writes code with the
component sits below the page head. Every named export becomes a tab in a vertical strip. The panel
of a tab holds the component in a stage that you can drag to any size, with the code of the call
site under a rule and a state editor behind a toggle button. A **Skill** tab shows the skill file of
the component, rendered as a page. You start no app, you need no backend, and you navigate to no
screen. You edit the component, the page reloads, and you see it. A preview file that fails to build
shows its error in place of its panels, and the rest of the catalog stays up.

Underneath, this is the same dev server as `imp start`. The console and the network activity of the
browser still stream to your terminal, and a save of any file reloads the page. Pass `--no-reload`
to keep the page and its state, such as a stage that you resized, while you edit. imp still reads
the catalog again on a save, so the next reload that you make yourself shows the new files. Your
`public/favicon.svg` marks the tab, as it does in your running app. When the project has none, the
mark of imp stands in. The imp mark in the corner is the review widget. Select a part of the
component that you preview, comment on it, and the note arrives in `.imp/reviews/`, with the preview
page that it came from. See **[Reviewing the page](#reviewing-the-page---notes-for-your-agent)**.

### The preview file

A component in `todos.js` gets a sibling file, `todos.preview.js`. That file is ordinary imp code.
Import the component, and export one instance per state that is worth a look.

```js
import { todoList } from './todos.js'

export const empty = todoList({ todos: [] })
export const populated = todoList({ todos: [{ id: 1, title: 'Buy milk' }] })
export const busy = todoList({ loading: true })
```

Each **named export is a scenario**, and the name of the export is the label of the panel. The code
is the only place where you name a scenario, so there is nothing to keep in step. The panels appear
in the order in which you wrote them. A scenario is the component with its values already filled in.
You build it with the same call that you would write at a real call site, so there is no story
format to learn. imp dispatches an argument by type exactly as it does in your app. When a scenario
needs a setup at render time, export a function in place of an instance, as in
`export const lazy = () => todoList(buildFixture())`. imp calls the function when it renders the
panel.

An export name is an identifier, and an identifier reads badly as a label. A scenario can carry a
label of its own. Export an object with a `scenario` string and a `component`:

```js
export const overdue = {
  scenario: 'Three overdue items, one of them done',
  component: todoList({ todos: overdueFixture() }),
}
```

imp shows the `scenario` text as the tab and as the title of the panel. `component` is the instance,
or a function that returns one, exactly as a plain export. The export name stays the id of the
scenario in the address, so a link to it reads `?scenario=overdue`.

### The code of a scenario

A rule under the stage of every panel carries a **Code example** button. It opens the call site of
the scenario, highlighted and ready to copy:

```js
import { todoList } from './todos.js'

todoList({ todos: [] })
```

imp does not ask you to write that snippet. It reads the preview file and cuts the snippet out of
it. The snippet is the expression of the export, with every import that the expression uses, and
every helper of the file that it reaches. So a scenario that wraps a field in a shared `form(...)`
helper shows that helper above the call. Nothing is hidden. The code that you see is the code that
rendered the panel. A scenario that is a function shows the call inside it. Once you open the code
of one panel, every panel opens with its code shown, until you hide it again.

### The skill of a component

The **Skill** tab renders the skill file of the component, the `todos.skill.md` that sits next to
`todos.js`. See **[Components](components.md)**. It is the same text that `imp skill` prints for an
agent, with the prop table and the rules as a page. The line below the page head is the `imp skill`
command for this component. imp derives it from the path of the file, so there is nothing to
declare. A component with no skill file says so in both places.

### Naming the component

Three export names are reserved, and none of them is a scenario. They are how the component
introduces itself on the page:

```js
export const name = 'Todo list'
export const group = 'Widgets'
export const description = 'A checkable list of todos, with an empty and a loading state.'
```

`name` is the label in the catalog, in the search, in the page head and in the browser tab. `group`
is the group that the component is listed under. `description` is a sentence for a person, under the
title of the page. Each one is optional. Declare none of them, and imp falls back to the name of the
file and the folder that the file sits in. So `src/inputs/text-field.preview.js` is `text_field`
under `inputs`. That is readable, but not what you would say out loud.

### The description

The `description` is written for a person who opens the page. imp shows it under the title of the
component, above the scenario tabs. It is markdown, so it can carry a list, a link, a bold word and
inline code. Write more than a sentence with a template literal. imp removes the indentation, so the
text lines up with your code:

```js
export const description = `
  A checkable list of todos.

  - **empty** shows the placeholder
  - **busy** shows the spinner while the request is open

  The list keeps its scroll position across a reload.
`
```

The text must be a literal. A template literal with a `${...}` substitution in it is not, so imp
ignores it and the page shows no description.

The description is for a person. The agent reads the `*.skill.md` file of the component, which the
**Skill** tab of the same page shows.

The grouping comes from `group`, not from the folder. You can organize the catalog in the way that
you talk about the components, not in the way that the files happen to sit. Two files in different
folders that declare the same `group` are listed together.

### Groups, their icons and their descriptions

The catalog at the side lists one row per group, with the components under it. By default a
component belongs to the folder that holds its preview file. Every group has a folder icon, and the
groups are in alphabetical order. To name the groups yourself, with their own icons and their own
order, point `preview.groups` in `imp.json` at a module of yours:

```json
{
  "preview": { "groups": "src/preview-groups.js" }
}
```

```js
import { luLayoutGrid, luTextCursorInput } from 'imp/icons'

export const groups = {
  widgets: {
    name: 'Widgets',
    icon: luLayoutGrid,
    description: 'Small **stateful** widgets. Each one keeps its count in a state.',
  },
  inputs: { name: 'Inputs', icon: luTextCursorInput },
}
```

The module exports an object named `groups`, with one key per group. `name` is the label of the
group in the catalog. `icon` is an icon from `imp/icons`, the same value that you give to the `icon`
component. `description` is optional markdown for a person. A click on the group name in the catalog
opens the page of the group, with a card per component. The description is under the title of that
page, so it says what the group holds and when to reach for it. `priority` is an optional number. A
group with a priority comes before every group without one, and a lower number comes first. So
`priority: 1` puts a group at the top, whatever its place in the object. A preview file then imports
the object, and exports one of its entries as `group`:

```js
import { groups } from '../preview-groups.js'

export const group = groups.widgets
```

A group is a value that your editor completes and that a rename refactors, not a string that must
match another string. The groups appear in the order in which you list them, after the ones with a
priority. A component with no `group` export falls back to its folder, and such a folder comes after
the listed groups, with the folder icon. The module is ordinary imp code, and imp bundles it into
the preview app, so an edit to it reloads the catalog, like any other change. A path that resolves
to no file stops `imp preview` at startup. A `group` that is not an entry of that module, or that is
imported from another file, is reported in the terminal, and the component falls back to its folder.

### Mocking what the component imports

The purpose of an isolated preview is that a component with heavy dependencies still renders on its
own. Replace any module that it imports with `mockModule`, exactly as you do in a test:

```js
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

mockModule('./http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk', done: false }]),
}))

export const populated = todoList()
```

`mockModule(specifier, factory)` behaves here as it behaves in `imp test`. The specifier is a path
relative to the preview file, or a dependency alias from `imp.json`. The factory returns the exports
of the module, and it receives `{ spy, orig }`. Every import of that module resolves to what you
returned. That covers an import from the component, and from anything that the component imports, at
any depth. `orig()` keeps the rest of the module real. See
**[Mocking modules](testing.md#how-to-mock-a-module---mockmodule)** for the full behaviour. A mock
is a plain object that you write, and it lives next to the component, so a reviewer sees the fixture
and the component in one diff.

A mock applies to the whole preview app. Every preview shares one module graph, so a module that one
file mocks is mocked for every component that imports it. Two files that mock the same module must
return the same factory. Otherwise imp reports both files and leaves them out of the build until
they agree. Two scenarios that need different data differ in the arguments that you pass to them.

### The stage

Each panel holds its component in a stage. Resize the stage by **dragging its right handle, its
bottom handle or its corner handle**, with a mouse or a finger. The component lays itself out again
at every width. That is the fastest way to find the width where it breaks, with no device emulation.
A readout shows the current size.

A handle is hard to hit on a phone, so the pencil button beside the readout opens two boxes, one for
the width and one for the height, in pixels. Type a number, and the stage takes that size at once.
Clear a box, and that axis goes back to the size that the layout gives it. A drag of a handle writes
its new size into the boxes.

The screen does not cap the width. Type a width wider than the screen, and the stage takes it. The
canvas then scrolls sideways, so you can move to the right and check the far edge of the component.
On a phone, this is how you look at a component at a desktop width.

On a phone, the scenario tabs leave little room beside them, so the strip of tabs folds. The button
at its foot folds the tabs away, and the panel, with its head, its stage and its code panel, gets
the width of the screen. The strip starts folded on a narrow screen and open on a wide one, and imp
remembers your choice in the browser. Unfold the strip to pick another scenario.

### The state editor

The sliders button in the head of a panel opens a movable window with a form. The window opens under
that button, so it is where you look, on a phone as well. It lists every state that a component in
the scenario initialized, with the tag of the component that holds it. imp finds that state in the
running scenario, not in your source, so a state with a computed name, or one declared behind a
helper, is listed like any other. A state that a child reads with `useState` appears once, under the
component that initialized it. A scenario with no state gets no button. imp leaves out the state
that its own standard components hold, because that state belongs to the component, not to your
scenario.

A component that reads a state with `useState` needs a provider above it, or it does not mount. Wrap
it in a small component in the preview file, one that calls `initState` with that name and a fixture
value, and pass the wrapper as the scenario. The editor then lists the state under the wrapper, and
an edit there drives the component.

The form shows a value as JSON. Edit one value, and apply it, or press `Ctrl` or `Cmd` with `Enter`.
The component then updates through the normal fine-grained path of imp. There is no remount and no
reload. The form also follows the state, so a click inside the component shows the new value. It
shows a value that is not JSON data as read-only.

Each panel gets its own form, bound to its own instance, so you can change `empty` and `populated`
independently, on the same page. imp reads the scenario again each time you open the window, so a
state that a component initialized after the first paint is listed when you open it.

### The instruction for an agent

The Skill tab starts with the `imp skill` command of the component, with a button to copy it. It
exists because the two readers of a component need different things from the same page. A person
looks at the stage. An agent that is about to write a call site must learn the component first, and
that command prints the whole skill file. imp derives the command from the path of the file. A
standard component gets `imp skill std/button`, and a component of yours gets
`imp skill ./components/todos.js`. There is nothing to write, and the command cannot point at the
wrong file. A component without a skill file gets a line that names the file to write.

### Themes

A theme button in the settings panel applies a theme to the whole page, so you can check the
component under each of your themes and change no code. The button shows the current theme with an
icon. A sun means `imp-light`, a moon means `imp-dark`, a contrast circle and an eclipse mean the
two high-contrast themes, and a palette means a theme of your own. Click the button to move to the
next theme. Put the pointer over the button, or give it the focus, to open a menu of every theme.
Select any theme from that list. imp remembers your choice across a reload. imp always offers the
built-in `imp-light` and `imp-dark`, unless a theme of yours takes one of those names.

The whole page changes, and the toolbar with it. The preview page is itself an imp app, built from
`imp/std`. It uses the same buttons, tabs, selects and text fields as your app, and it reads the
same tokens, so a theme that looks wrong here looks wrong in your app, for the same reason. The
preview page is one more place where the library must work.

To add your own theme files to the menu, list them in `preview.themes`:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Each path is a module that default-exports a theme. It is the same file that your app passes to
`applyTheme`, and there is nothing about it that is only for a preview. The label in the menu is the
`name` of the theme. When the theme has no name, or when two themes share a name, imp uses the file
path. imp lists your themes first, and selects the first one by default, so a preview opens with the
look of your app, not the look of the starter theme. A theme of yours that carries the name of a
built-in theme replaces that built-in theme in the menu. Use this to keep the four names, and the
remembered choice of a person, while you change a token such as `font-family`. An edit to a theme
file reloads the page with the new tokens applied, so a preview page is also the fastest way to work
on a theme. See **[Theming](theming.md)**.

### The theme editor

**edit theme**, beside the theme button, opens an editor. The review widget of `imp start` opens the
**Tokens** view of the same editor on a page of your app. It edits the theme that the theme button
selected, and starts from the tokens of that theme. Select a dark theme to write a dark one. It asks
for a **primary** colour and a **secondary** colour, a **font** and a **mono font**, a **border
radius** step, a **shadow** step and a **shadow colour**. A colour has a picker beside its hex
value. A font is a list of suggestions that accepts any font stack. A step is a row of buttons. It
derives every other colour token from the two base colours: a readable on-primary colour, and the
surfaces, the borders and the text, which share the hue of the secondary colour. Those knobs sit on
the **Knobs** tab. The **Tokens** tab holds the whole theme as JSON. Edit any value there, and the
page re-skins as soon as the JSON parses. A token that has no knob, such as `background-app`, a font
weight or a spacing step, starts as the selected theme sets it, and the exported file carries it
too. A knob rewrites the tokens that it drives, and leaves the rest as you set them.

The page re-skins while you type, on real components. imp remembers your choices per theme, across a
reload. The draft belongs to the name of the applied theme, so the same draft follows that theme
into your app when you open the editor there. When the theme looks correct, **copy** or **download
theme.js** gives you an ordinary theme module, with the theme as its default export. You drop it
into your app and pass it to `init`. The editor prints the two lines that do that, in the panel. The
editor produces a plain file, with no imp import in it, so from that point the file is yours to edit
by hand. **reset** drops the draft, and returns to the selected theme. imp also drops a draft when
the theme that it started from changes, so an old draft never hides a new theme. See
**[Theming](theming.md)**.

### The page around a preview - `preview.entry`

imp generates the HTML page that frames every preview. That page has no stylesheet of yours in it,
so a web font that your app loads through a `<link>` in `index.html` does not load in a preview, and
the theme editor cannot show it. To frame every preview with a page of your own, point
`preview.entry` at an HTML file:

```json
{
  "preview": { "entry": "preview.html" }
}
```

imp serves that file as the page of the app, so the catalog and every component open inside it. It
replaces the `<title>`, or adds one, and it appends its own script at the end of the `<body>`.
Everything else in the file is yours, and it stays as written. Put the font links, the icon and any
stylesheet that a preview needs in its `<head>`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
    />
  </head>
  <body></body>
</html>
```

Write a file for the preview. Do not point `preview.entry` at the `index.html` of your app. imp
keeps every script in the entry file, so the app would start inside the preview page. A path that
resolves to no file fails the command at startup. An edit to the file reloads the page.

`imp preview` serves the `public/` folder at the site root, as `imp start` does. So a font that you
host yourself goes under `public/fonts/`, and the entry page links it as `/fonts/fonts.css`. Write
every link of the entry page as a root-relative path or as a full URL. A path such as
`fonts/fonts.css` breaks on a component page, because that page has an address of its own.

### Language and text direction

Beside the theme button are a **language** picker and a **direction** button, so you can see a
component as a reader of another language sees it, and change no line of code. imp remembers both
choices across a reload.

The language picker sets the language of the page. That localizes again everything that is bound
through `lang`. It covers your own messages, and the reserved `imp.` messages that the standard
components ask for. The picker lists the languages that you point it at. Say where your translation
files are, under `preview.translations`:

```json
{
  "preview": { "translations": { "en": "./locales/en.js", "pl": "./locales/pl.js" } }
}
```

Each path is a module that default-exports your messages. It is the same file that your app passes
to `init`. imp selects the first one by default, so a preview opens with the wording of your app. An
edit to a translation file reloads the page with the new wording. Declare none, and imp leaves the
picker out. The direction button still works.

The direction button works like the theme button. It shows the current setting with an icon, a click
moves to the next setting, and the pointer over it opens a menu of the three settings. **auto**
takes the direction from the language, which is what your app does. Select Arabic or Hebrew, and the
component lays out from right to left. **ltr** and **rtl** pin the direction, so you can check a
right-to-left layout while you read English text. That is the fastest way to find a fixed
`margin-left`.

The setting affects the component only. The toolbar and the panels of the preview stay left to
right, whatever you select, so the controls do not move under you. The direction is the one thing
that the page does not share with the component that it shows. A mirrored toolbar moves every
control to the other side in the middle of a session, and the theme button never does that. See
**[Translations](i18n.md)**.

### Finding and opening previews

With no path, imp discovers every `*.preview.js` file in the project, and `/` lists them all. Pass a
path to narrow the discovery. A preview file opens directly. A component path opens the preview
beside it, so `imp preview components/todos.js` finds `components/todos.preview.js`. A folder limits
the discovery to that folder. Every component has an address of its own, `/<group>/<name>` in lower
case with hyphens, such as `/widgets/counter`. A reload keeps it, and a bookmark opens it. A click
on a scenario tab adds `?scenario=<name>` to the address, so a link opens that scenario.

`imp preview --list` prints the discovered preview files, one per line. `--list --json` prints them
as a JSON array, for a tool to read. `--port` selects the port, and the default is 4401. `--host`
selects the address, as on `imp start`, and the same warning applies. `--env` selects an environment
entry from `imp.json`, exactly as on `imp start`. To keep a folder out of the discovery, use a
`preview.exclude` array in `imp.json`:

```json
{
  "preview": { "exclude": ["vendor-demos"] }
}
```

A preview file is never part of your app. Nothing imports it, so `imp build` never sees it.

### Exporting the gallery - `imp preview --output`

```
imp preview --output site/public/components
```

The same gallery publishes as static files, with no imp process behind it. `--output` writes a
folder. One script in it, `imp-preview.js`, defines a custom element, `<imp-preview>`. A page loads
the script and places the element, and the element shows the gallery:

```html
<script type="module" src="/components/imp-preview.js"></script>
<imp-preview></imp-preview>
```

The element is a block that fills the height of the screen. Give it another height with CSS, as you
would size any element. The gallery inside it is the page that `imp preview` serves, in a frame of
its own, so it keeps its own theme, language and direction pickers, and never touches the styles or
the elements of your page. The sidebar has no imp logo. Your page owns the brand and the navigation
above the gallery.

The folder holds the app of the gallery and one bundle per group. A click on a group in the sidebar
loads that group, so a visitor downloads the components that they look at. Upload the folder as it
is, next to the page that embeds it. Every host that serves static files serves it, because nothing
in it needs a server.

The folder also holds `LICENSES.txt`, with the licence notices of the code in the bundles: the
notice of imp, and the notices of your dependencies and of the icons. imp writes it the same way as
`imp build`, see [License notices](#license-notices). Each script points at it. Upload it with the
rest of the folder.

The gallery keeps its place in the address of your page. A component is `#/<group>/<name>`, and a
scenario adds `?scenario=<name>`. So `https://example.com/components#/inputs/button` opens the
button. A reload keeps it, and a link shares it. The element writes the fragment as the visitor
moves, and it follows a fragment that your page sets.

The gallery follows the theme of your page. Set the `theme` attribute to the name of a theme in the
menu of the gallery, and the gallery applies it:

```html
<imp-preview theme="imp-dark"></imp-preview>
```

The attribute is live. Change it when a visitor switches the theme of your page, and the gallery
switches with it. The same works in the other direction. When a visitor picks a theme inside the
gallery, the element writes the name into its `theme` attribute, and dispatches an
`imp-preview-theme` event with the name as `detail`. Listen to that event to keep the theme of your
page in step. A name that the menu does not hold is ignored. Without the attribute the gallery opens
with the theme that the visitor last picked.

Three things differ from the served page. There is no dev server, so there is no reload, no
telemetry and no review widget. The element resolves every link of the entry page against the
address of the host page. So a root-relative link such as `/fonts/fonts.css` loads from the site
that embeds the gallery, and that site must serve the file at the same path. A preview file that
fails to build fails the export, in place of a marked card in the catalog. `--env` selects an
environment for the components, as it does for the served page.

The output folder belongs to the export. imp empties it before it writes, as `imp build` does with
its output folder. It refuses the same folders as `imp build`, except a folder inside `public/`.
Point `--output` at a folder inside `public/` of the app that embeds the gallery, and `imp build`
ships it with the app.

## `imp review`

```
imp review [clear]
```

`imp review` prints every review that the widget saved from the browser. See
**[Reviewing the page](#reviewing-the-page---notes-for-your-agent)**. For each review it prints the
page that it came from, the element that the person selected, and the comment. The oldest review
comes first:

```
.imp/reviews/2026-08-25T12-10-36-682Z.txt
  2026-08-25T12:10:36.682Z  http://localhost:4400/settings
  body > div#app > acme-settings >> form.panel > button.save
  The save button is disabled until a field is touched, but nothing says so.

[INFO] 1 review in .imp/reviews - 'imp review clear' deletes them all
```

The command reads the project that you run it from, so it works from any subdirectory. When nothing
is saved yet, it says so. It does not print an empty list.

### What a review records

Each review is a file of its own, under `.imp/reviews/`. imp names it after the moment when it saved
the review, as in `2026-08-25T12-10-36-682Z.txt`, so nothing that you write can overwrite what you
wrote before. The file is plain text. It has a header that describes where you were, then blocks
that describe the state that you were in, then your comment.

```
time: 2026-08-25T12:10:36.682Z
page: http://localhost:4400/settings
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
  [HTTP] PATCH http://localhost:4400/api/profile -> 500 34ms

comment:
The save button is disabled until a field is touched, but nothing says so.
```

**A URL and a selector do not say what the app was doing.** So imp records four more things, at the
moment when you select the element:

- **`state`** holds every imp state in scope at the selected element, by name, as JSON. It is the
  real answer to the question "what state was the app in?". imp state is named and holds plain data,
  so the block is readable, and you can reproduce it. An agent can set the same values in a test, or
  in a preview scenario, and see the same screen. imp lists only the state that reaches the selected
  element, with the nearest provider first, so you get the state that the component could see. On a
  preview page, imp also writes its own `imp.preview.*` entries: the theme, the language and the
  direction of the preview.
- **`controls`** holds what every form control really held: the typed text, the checked boxes, the
  selected options, and whether a control was disabled or read-only. **The HTML does not carry
  this.** A typed-in value lives on the element, not in the markup, so the `html` line above would
  show an empty field where you typed a name. When you select an element inside a form, imp records
  the whole form. When you select an element outside a form, imp records the controls inside what
  you selected. imp **never records** a password field. It records only the number of characters in
  it.
- **`log`** holds the last 20 lines of the development log at that moment: the console error that
  fired, and the request that failed. It answers the question "how did it get here?", which a
  screenshot does not answer.
- **The environment** covers `viewport`, with the device pixel ratio when it is not 1, `scroll` when
  the page was scrolled, `scheme` for light or dark, `motion` when reduced motion is on, and `lang`
  and `dir`. Half of the reports that people write say "only when the window is narrow" or "only in
  dark mode". Now nobody has to type either one. `rect` is the size and the position of the selected
  element, so "it is 8px wide" is no longer a guess.

`element` is the path from `<body>` down to what you selected. `>>` marks a crossing into the shadow
tree of a component. So `acme-settings >> form.panel` is the form that `acme-settings` **renders**,
which is usually the file to open. imp cuts a deeply nested path at twelve steps and starts it with
`...`. It keeps the end of the path, which names the component.

You parse nothing to use any of this. Give the folder to your agent, and ask it to work through the
list. `imp review` and `cat .imp/reviews/*.txt` are equally good ways in. Each review carries enough
to find the code and to return to the screen, so the agent asks no follow-up question.

```
imp review clear
```

`imp review clear` deletes every saved review, and removes the folder. imp never clears a review on
its own. It does not clear one when the server restarts, and it does not clear one when a build
runs. The list is a backlog. You empty it when you decide that the comments on it are settled, and a
restart never loses one.

A review lives in `.imp/`, and a fresh `imp init` project already tells git to ignore that folder,
so a review stays on the machine that wrote it. To share one, paste it. There is nothing to
synchronize.

## `imp logs`

```
imp logs [-n <count>] [-f]
```

`imp logs` prints the log of the current dev server session, one entry per line. It is everything
that `imp start` or `imp preview` printed since it started: the browser console, the errors, each
request with its status, and the status lines of imp. See
**[Console and error telemetry](#imp-start)** for what each prefix means. The output is the log as
it is, with no colour and no header, so the command composes with the tools that you already use:

```sh
imp logs | grep '\[BROWSER:error\]'
imp logs | grep '\[net\] POST' | tail -20
imp logs -n 50
imp logs -f
```

**`-n <count>`** prints the last `<count>` entries only. **`-f`** prints the log, then keeps the
process open and prints each new entry as the dev server writes it. Press Ctrl-C to stop. This is
the one command that an AI coding agent runs to watch the session while you click through the app.

`imp start` and `imp preview` write the same log, so one command reads both. The command reads the
project that you run it from, so it works from any subdirectory. It reads and never writes. The log
holds the current session only, because the dev server starts it again at each start. When no dev
server has run in the project yet, the command says so and exits `1`. When a nested folder of the
project holds a session log, because you started the server there, the message names that folder.

## `imp resize`

```
imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]
```

`imp resize` is a small utility for the common case that makes a repository large: a committed image
that is much larger than the page shows it. `imp resize` downscales the image in place. It is not an
image editor. Any operation other than a resize is out of scope, on purpose.

imp always keeps the aspect ratio, until you ask it not to. The width flag and the height flag
combine in this way:

- **With one of `-w` and `-h`**, imp resizes to that dimension. It computes the other dimension, and
  keeps the original aspect ratio.
- **With both `-w` and `-h`**, imp scales the image to the largest size that fits inside that width
  by height box, and keeps the aspect ratio.
- **With both flags and `--stretch`**, imp resizes to exactly that width and height, also when the
  picture is distorted. You asked for a specific size, and accept the distortion.
- **With neither flag**, imp uses inspect mode and writes nothing. It reports the current dimensions
  and the byte size of the image. When the asset is oversized, it also prints an `imp resize`
  command that you can copy, and that brings the asset down to a sensible size. This is the natural
  first step: check what you have, then decide what to resize to. You can also use inspect mode to
  read the dimensions of any PNG or JPEG from the terminal.

By default imp overwrites the file. That suits the purpose, which is to shrink a committed asset. To
write the result to a new file and keep the original, pass `--output <path>`. In both cases imp
reports the dimensions and the byte size before and after.

A resize **only downscales the pixels, with minimal compression**. imp puts the quality above the
last byte. imp clamps a request that is larger than the source to the source, so the command never
upscales. When you need close control of the compression, or of the quality, use a dedicated image
tool. imp keeps this surface deliberately small.

**Scope.** imp supports static **PNG** and **JPEG** today. It does not yet handle WebP, GIF and an
animated image, including an animated PNG. imp detects such a file and stops with a clear message.
It does not remove frames or change the format in silence. imp can support more formats later.

## `imp lint`

```
imp lint [...paths]
imp lint --fix [...paths]
```

`imp lint` lints the paths that you give, and by default the whole project. It uses a standard
recommended rule set, and the rules of imp, which imp always applies. Two of those rules are
`no-capital-component`, because an imp component is a lowercase function, and
`exact-dependency-versions`, because a dependency pin in `imp.json` must be exact and an import must
go through a declared, vendored dependency. See **[Managing dependencies](dependencies.md)**. imp
also covers an `.html` file. It lints an inline `<script>` block like any other code.

`--fix` rewrites a file in place. It applies every autofix that the rule set offers, and it fixes an
inline `<script>` block in an `.html` file as well. It leaves only the problems that need a person.
imp never touches a problem that an `imp-lint-ignore` comment suppresses.

You configure the severity of each rule, and the excluded paths, under `lint` in `imp.json`. An
`imp-lint-ignore` comment suppresses a finding in the code.

**The file-size check.** `imp lint` also scans every file that your git repository tracks. It
reports an error when a single file is larger than `maxFileSize`, which is 200 kB by default. It
names each oversized file with its size, and exits with a non-zero code, so an oversized commit
fails CI. The limit is the same one that `imp install` uses. To change it, set `maxFileSize` in
`imp.json`. To exempt a file that must be large, such as a committed asset, list its repo-relative
path in `maxFileSizeIgnore`:

```json
{
  "maxFileSize": 262144,
  "maxFileSizeIgnore": ["assets/hero.png"]
}
```

An ignored path never fails the check. It can be one file, or anything under a listed folder.
Outside a git repository, imp skips the file-size scan, and the rest of `imp lint` runs as usual.

**[Linting](lint.md)** gives the full description of each rule, the configuration, the ignore
directives and the output format.

## `imp fmt`

```
imp fmt [...paths]
imp fmt --check [...paths]
```

`imp fmt` formats the paths that you give, in place, and by default the whole project. It formats
JavaScript, JSON, Markdown, CSS, HTML, SVG, XML, SQL and YAML. It also formats an inline `<script>`
block and an inline `<style>` block in HTML. `--check` reports the files that would change, and
writes none. It exits with a non-zero code when a file needs formatting, which helps in CI.

The options come from the `fmt` block of `imp.json`. They cover the line width, the quotes, the
semicolons and more. An `imp-fmt-ignore` comment protects a layout that you made by hand.

**[Formatting](fmt.md)** gives the supported languages, every option and its default, the ignore
directives, and check mode.

## `imp skill` - the manuals, for an AI agent

```
imp skill                        the index: every subject with a one-line summary
imp skill <subject>              one subject's manual, in full
imp skill state routing          several manuals in one call
imp skill std/button             one standard component's skill
imp skill ./components/counter.js   one of your own components' skills
imp skill widget                 the skill of an imp component installed as dependencies/widget/
```

imp expects an AI coding agent to write much of the app code, and an agent cannot browse a
documentation site while it works. `imp skill` prints a manual out of the binary. It works offline,
it makes no network call, and it prints at the exact imp version that the project runs. What the
agent reads is what the project executes.

These manuals are written **for an agent**, not for you. They cover the same subjects as these
pages: the call shapes, the prop tables and the option tables, and the mistakes that the API
invites. They leave out the narrative that a person reads a guide for. So `imp skill state` is not
this documentation reformatted for a terminal. It is the short, mechanical version of it, and imp
writes and updates the two together.

With no argument, the command prints an **index**: one line per subject, with a short summary. imp
groups the subjects. The first group is what you need to write an app: imports, rendering,
components, state, routing, theming, translations and logging. The second group is what you need to
work in the project: the CLI, testing, dependencies, linting and formatting. Then comes one line per
standard component. Then comes every component **in your project** that has a skill file beside it.
Last comes every imp component that you installed into `dependencies/`, by its alias. An index is
cheap to read, so an agent spends one call to learn what exists, and one more call to learn the part
it needs.

With one or more subjects, the command prints those manuals in full. Skill text is the only thing on
standard output, and every diagnostic goes to standard error. So `imp skill state > state.md`
captures the manual and nothing else. The only flag is `--init`, see below. Otherwise the whole
interface is to run the command and read the output.

A subject answers to the name that you already have. The import specifier works, as in
`imp skill imp/state` and `imp skill imp/std/button`. The plain subject works, as in `state`,
`rendering` and `button`. A page name works, as in `state.md`. Every form ignores case. For an
unknown subject, imp prints the list of real subjects to standard error, and exits with code 1. imp
prints a cross-reference between two manuals as the command that fetches it, such as "Rendering (imp
skill rendering)". It also adds a `Related:` line at the foot of the page, so an agent can always go
from one manual to the next, and guesses no file path and no URL.

**Ask for a component by file.** `imp skill ./components/counter.js` prints the skill file that sits
beside that module, which is `counter.skill.md`. A direct name of that file also works. It is the
same convention that the components of imp follow. So `imp skill std/button` and
`imp skill ./components/counter.js` are one operation on two different components. A component with
no skill file exits with code 1, and imp names the file to write, so a tool can tell "no skill yet"
from a real failure. See **[Components](components.md)** to learn how to write a skill file, and
what happens to it at build time.

**Ask for an installed component by alias.** `imp skill widget` prints the `imp-skill.md` that
`imp install` copied into `dependencies/widget/`, as it is. When a subject has the same name as an
alias, the subject wins.

### `imp skill --init` - the `/imp` skill for your agent

An agent learns imp from `imp skill` only when it knows to run the command. `imp skill --init`
writes a small skill that tells it so. Claude Code, Codex and Cursor load the skill. Then you ask
for work with `/imp` (Claude Code, Cursor) or `$imp` (Codex):

```
/imp add a settings page with a theme switch
```

The command writes the same `SKILL.md` to two folders: `.agents/skills/imp/` (Codex, Cursor) and
`.claude/skills/imp/` (Claude Code, Cursor). It finds the place in this order:

1. imp looks for `.git` in the current folder and in each parent folder, up to your home folder.
2. In a git repository, the skill goes to the git root, also when you run the command in a
   subfolder. One skill serves the whole repository. An agent that you start in a package of a
   monorepo finds it too.
3. Outside a git repository, the skill goes to your home folder, such as `~/.claude/skills/imp/`.
   Then the agents see the skill in every project.

imp does not replace a skill that exists. It exits with code 1 and names the file. Delete both files
to write the skill again, for example after an update of imp.

## `imp update` - pinning the imp version

```
imp update [version] [--check]
```

A project can pin the exact imp version that it is built against, with a `"version"` field in
`imp.json`. After you pin a version, **any** imp binary runs the project on that version. At
startup, imp compares the pin against itself. When the two differ, imp fetches the pinned version
and hands the run to it. imp fetches the version once, and caches it per user. There is nothing to
install per project, and there is no version manager to configure. Whoever runs `imp start`,
`imp test` or any other command gets the version that the project pins, so a colleague on a newer or
older imp still builds and tests against the same version. A pin is exact, such as `"1.2.3"`, and
never a range. That is what makes it reproducible.

`imp update` sets that pin, and moves it:

- **`imp update`** resolves the latest published release, downloads it, and writes it into the
  `"version"` field of `imp.json`. It searches upward from the current directory for the project, so
  it works from any subdirectory, and prefers the `imp.json` at your repository root. It prints what
  changed, for example `imp updated 1.2.3 -> 1.3.0`. The next command that you run uses the new
  version. When the project has no `imp.json`, imp still downloads and caches the release, and
  writes no pin.
- **`imp update <version>`** pins a specific version, in place of the latest one.
- **`imp update --check`** reports whether a newer release exists, and changes nothing.

When you run imp interactively in a project that has **not** pinned a `"version"` in its `imp.json`,
and a newer release exists, imp also prints a hint of one line that suggests `imp update`. imp
checks for a newer release at most once a day, and the check never blocks the command. When your
`imp.json` pins a version, imp assumes that you chose that version on purpose, and stays silent.
Move the pin yourself, with `imp update`, when you want a newer release. To stop the hint in a
project with no pin, use the `--no-update-check` flag, or set `IMP_NO_UPDATE_CHECK`.

When imp cannot obtain a pinned version, it stops with a clear error that names the version. This
happens when you are offline, or when somebody removed the release. imp does not run a different
version in silence. A pin that imp does not enforce is not a pin. To bypass the pin on purpose, for
example to debug against the binary that you have, set `IMP_VERSION=system`.

imp caches a downloaded version per user, under `~/.imp/`, and verifies each one against its
published checksum before it stores it. Every project that you work on shares that cache. The same
folder holds the browser of the e2e tests. To move the whole folder, set `IMP_CACHE_DIR`. That helps
in CI, and in a container where the home directory is not writable. It also keeps the binaries off
your home volume.

### Versions and stability

imp is not released yet. Until version `1.0.0`, any release can change or remove an export, a config
key, a command or an output format. Pin a version, and update the pin on purpose.

From version `1.0.0`, imp follows semantic versioning:

- A breaking change goes into a new major version only. A breaking change is one that can make a
  correct app, its tests or its build fail.
- A deprecated feature keeps working, and imp warns about it, for at least one minor version before
  imp removes it. The warning names the replacement.
- A minor version adds features, and a patch version fixes defects. Neither one needs a change in
  your app.
- An exit code, a file that imp writes, and a machine format such as `--json` are stable in the same
  way. The wording of a message for a person can change in any version.

## `imp prune` - reclaim disk space

```
imp prune
```

imp keeps every version that it downloads in the cache, so a move between two pinned projects
downloads nothing again. But a binary is large, and the cache only grows. imp records when each
cached version last ran. Whenever it downloads a new version, it reports any version that has not
run for more than 30 days:

```
2 unused imp versions (1.1.0, 1.2.3) have not run in over 30 days - run 'imp prune' to reclaim disk space
```

`imp prune` deletes exactly those old versions: the versions that have not run in the last 30 days.
It reports how much space it freed. imp never removes the version that runs now. When you pin a
deleted version again later, imp downloads it on demand. A prune is always safe.

## `imp licenses`

```
imp licenses
```

imp is one binary, and it contains several open-source tools: the browser automation, the formatter
engine, the linter engine, the image encoder, the video encoder and more. It also contains the
JavaScript runtime that executes imp. `imp licenses` prints the third-party licence notices for
everything that the binary ships. For each component it prints the name, the version and the full
text of its licence. A tool that imp bundles from npm packages lists every one of those packages,
with its licence and its copyright lines. So the attribution that those licences require comes
straight out of the binary. The command takes no argument.

This covers the tools that you _develop_ with, not the code that you _ship_. None of it reaches your
app. `imp build` collects the notices for what your users download, into
[`LICENSES.txt`](#license-notices).
