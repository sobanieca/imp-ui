# imp — CLI

The `imp` CLI is the buildless toolkit for imp apps: a static dev server plus a linter and a
formatter. No bundling, no transforms, no install step for your dependencies — your files are served
exactly as you wrote them.

## Installation

`imp` ships as a single self-contained binary. Download the binary for your platform, put it on
your `PATH`, and you are ready — there is nothing else to install.

## Commands

```
imp start [file.html] [--port 4507]   serve a page (default: index.html)
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
  "imports": { "mitt": "npm:mitt@3" },
  "fmt": { "lineWidth": 100 }
}
```

- **`imports`** — bare-specifier aliases for dependencies, so you can write
  `import mitt from 'mitt'` instead of the full `npm:`/`jsr:` specifier. Each alias is exposed to
  the browser through the injected import map and resolved through `/@dep/` (see below).
- **`fmt`** — formatting options for `imp fmt` (defaults listed under `imp fmt` below).
- **`lint`** — extra lint configuration (`rules`, `plugins`, `exclude`); the imp rule set is always
  applied on top.

Two more files appear next to `imp.json` as you work:

- **`imp.lock`** — pins the exact versions of your resolved dependencies. Commit it so every machine
  resolves identically.
- **`.imp/`** — internal derived config, regenerated on every command. It ignores itself from git
  automatically; never edit it and never commit it.

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
(telemetry sink), `/@imp/sw.js` (the service worker), `/@imp/*` (library source), and `/@dep/*`
(bundled third-party dependencies, see below).

### npm and jsr dependencies

Import any npm or jsr package straight from app code — no install step, no manual import map:

```js
import mitt from 'npm:mitt@3'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
```

When the dev server serves a `.js`/`.mjs` file it rewrites these `npm:`/`jsr:` specifiers — in
static imports, re-exports, and dynamic `import()` calls — to `/@dep/…` URLs. The first request for
each `/@dep/…` URL resolves the package (honouring `imp.json` and `imp.lock`) and transpiles it to a
single browser-ready ES module; results are cached in memory for the life of the process. Only
`npm:`/`jsr:` specifiers are touched — every other line is served byte-for-byte, and bare `imp`
still resolves via the import map. A package that fails to resolve returns a module that throws,
surfacing the error in both the browser console and the terminal.

Bare aliases declared under `imports` in `imp.json` work the same way: they are added to the
injected import map pointing at their `/@dep/…` URL, so `import mitt from 'mitt'` resolves without
the full specifier.

> **One copy per top-level package.** Each top-level specifier is bundled independently with its
> transitive deps inlined, so two different packages that share a dependency get separate copies of
> it. That is fine for stateless utility libraries; libraries that require a single shared instance
> (e.g. React and its renderer) are a known limitation of this first version.

## `imp lint`

```
imp lint [...paths]
```

Lints the given paths (default: the whole project) with a standard recommended rule set plus imp's
own rules, which are always applied:

- **`no-capital-component`** — imp components are lowercase functions; a capitalized function name
  is reported.

Inline `npm:`/`jsr:` import specifiers are explicitly allowed — they are how imp apps declare
dependencies, so no rule flags them.

Extra configuration declared under `lint` in `imp.json` (`rules`, `plugins`, `exclude`) is layered
on top.

## `imp fmt`

```
imp fmt [...paths]
imp fmt --check [...paths]
```

Formats the given paths in place (default: the whole project). `--check` reports files that would
change without writing them and exits non-zero when formatting is needed — useful in CI.

Options come from the `fmt` block of `imp.json`. Defaults when absent: no semicolons, single quotes,
line width 100.
