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

`imp` ships as a single self-contained binary. Download the binary for your platform, put it on your
`PATH`, and you are ready — there is nothing else to install.

## Commands

```
imp start [file.html] [--port 4507]   serve a page (default: index.html)
imp install [package[@version]]       vendor a dependency into dependencies/
                                      (no version: latest · no package: update all)
imp uninstall <package>               remove a vendored dependency
imp lint  [...paths]                  lint with imp rules
imp fmt   [...paths]                  format source
imp help                              show usage
```

Running `imp` with no arguments, `imp help`, or `imp --help` prints usage. An unknown command prints
usage and exits with code 1.

## Configuration — `imp.json`

The only config file you author is `imp.json` at your project root; it is optional — every command
works without it.

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "fmt": { "lineWidth": 100 }
}
```

- **`dependencies`** — the dependencies vendored into your project, one entry per package mapping a
  bare import alias to the exact version installed. Written and updated by `imp install` /
  `imp uninstall`; you normally never edit it by hand. Each alias is exposed to the browser through
  the injected import map, so you write `import mitt from 'mitt'`. See
  **[Managing dependencies](dependencies.md)**.
- **`fmt`** — formatting options for `imp fmt` (defaults listed under `imp fmt` below).
- **`lint`** — extra lint configuration (`rules`, `exclude`); the imp rule set is always applied on
  top.

That is the whole footprint: your repository contains your code, at most one `imp.json`, and the
`dependencies/` folder holding your vendored dependencies — all of it source you commit. imp writes
no lock file, no cache folder, and no generated config into your project; registry downloads are
cached per-user, outside the project.

Instead of a lock file, reproducibility comes from what is committed: `imp.json` pins exact versions
(`npm:mitt@3.0.1`, never `npm:mitt@3`) and the committed bundle in `dependencies/` is the frozen
result of resolving that pin. `imp lint` enforces the model — see the `exact-dependency-versions`
rule under `imp lint`.

## `imp start`

```
imp start [file.html] [--port 4507]
```

Serves the directory containing the given HTML file (default: `index.html` in the current directory)
on the given port (default: `4507`). The command exits with an error if the file does not exist or
is a directory. The entry file itself is reachable at `/`.

Three things are injected into every served HTML document automatically — you never reference the
imp library by path (injection is skipped for documents that already contain it):

- **Import map.** `imp` resolves to the served library, so pages import by bare specifier:

  ```js
  import { div, h1, mount } from 'imp'
  mount('#app', () => div(h1('hello')))
  ```

  The library source is served under `/@imp/` (`/@imp/imp.js`, `/@imp/render.js`, …). A bare
  specifier is used instead of injecting globals because tag factories include names like `a`, `b`,
  `i`, `p`, `time`, and `menu` that would collide on `window`.

- **Console + error telemetry.** A small inline script forwards `console.*`, uncaught errors, and
  unhandled rejections to the terminal, prefixed `[browser:*]` — you (or an LLM coding assistant
  driving the session) read runtime behavior straight from the terminal, no devtools needed.

- **Network telemetry.** A service worker (registered at root scope) intercepts _all_ request types
  — `fetch`, `XMLHttpRequest`, images, scripts, navigations — and reports each as
  `[net] METHOD url → status ms`. Requests under `/@imp/` are passed through untouched.

Live reload is included: file changes under the served directory trigger a browser reload (changes
inside `.git/`, `node_modules/`, and `dist/` are ignored).

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
pin. Your code imports dependencies by their bare alias (`import mitt from 'mitt'`).

See **[Managing dependencies](dependencies.md)** for the full story: version pinning, updating,
aliases, jsr packages and subpaths, what gets printed, and why the vendored folder is committed.

## `imp lint`

```
imp lint [...paths]
```

Lints the given paths (default: the whole project) with a standard recommended rule set plus imp's
own rules, which are always applied: `no-capital-component` (imp components are lowercase functions)
and `exact-dependency-versions` (dependency pins in `imp.json` must be exact, and imports must go
through declared, vendored dependencies — see **[Managing dependencies](dependencies.md)**). `.html`
files are covered too: inline `<script>` blocks are linted like any other code.

Per-rule severities and excluded paths are configured under `lint` in `imp.json`, and
`imp-lint-ignore` comments suppress findings in code.

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
