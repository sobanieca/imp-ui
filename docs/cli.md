# imp — CLI

The `imp` CLI is the buildless toolkit for imp apps: a static dev server plus a linter and a
formatter. No bundling, no transforms, no install step for your dependencies — your files are served
exactly as you wrote them.

## Installation

`imp` ships as a single self-contained binary. Download the binary for your platform, put it on your
`PATH`, and you are ready — there is nothing else to install.

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
  "imports": { "mitt": "npm:mitt@3.0.1" },
  "fmt": { "lineWidth": 100 }
}
```

- **`imports`** — bare-specifier aliases for dependencies, so you can write
  `import mitt from 'mitt'` instead of the full `npm:`/`jsr:` specifier. Each alias is exposed to
  the browser through the injected import map and resolved through `/@dep/` (see below).
- **`fmt`** — formatting options for `imp fmt` (defaults listed under `imp fmt` below).
- **`lint`** — extra lint configuration (`rules`, `exclude`); the imp rule set is always applied on
  top.

That is the whole footprint: **imp never creates files or directories in your project** — no lock
file, no cache folder, no generated config. Your repository contains your code and, at most, one
`imp.json`. Downloaded dependencies are cached per-user, outside the project.

Instead of a lock file, reproducibility comes from your source: dependency specifiers pin exact
versions (`npm:mitt@3.0.1`, never `npm:mitt@3`), and `imp lint` enforces this — see the
`exact-dependency-versions` rule under `imp lint`.

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

Import any npm or jsr package straight from app code — no install step, no manual import map. Always
pin the exact version (there is no lock file — the version in your code _is_ the pin):

```js
import mitt from 'npm:mitt@3.0.1'
import { encodeBase64 } from 'jsr:@std/encoding@1.0.10/base64'
```

When the dev server serves a `.js`/`.mjs` file it rewrites these `npm:`/`jsr:` specifiers — in
static imports, re-exports, and dynamic `import()` calls — to `/@dep/…` URLs. The first request for
each `/@dep/…` URL resolves the package (honouring `imp.json`) and transpiles it to a single
browser-ready ES module; results are cached in memory for the life of the process. Only
`npm:`/`jsr:` specifiers are touched — every other line is served byte-for-byte, and bare `imp`
still resolves via the import map. A package that fails to resolve returns a module that throws,
surfacing the error in both the browser console and the terminal.

Bare aliases declared under `imports` in `imp.json` work the same way: they are added to the
injected import map pointing at their `/@dep/…` URL, so `import mitt from 'mitt'` resolves without
the full specifier.

### Why exact versions?

imp has no lock file, so your source code is the only record of what your app depends on. An exact
version makes that record reproducible: every machine and every CI run resolves the same package
from the same import line, and a dependency change is visible in code review because the version
lives in the import statement.

One thing an exact pin cannot freeze is the package's _own_ dependencies — package authors declare
those as ranges, and they are resolved when the package is fetched. **imp assumes the packages you
use are well-behaved about their transitive dependencies**: the ranges they declare stay compatible,
so resolving them at a different time does not change behavior. In practice this means preferring
small, self-contained packages — which are also the packages that work best in the browser. If a
library has a history of breaking through its transitive dependencies, it is a poor fit for imp.

### Shared dependencies and singletons

> **One copy per top-level package.** Each top-level specifier is bundled independently, with its
> transitive dependencies inlined into the bundle. Two packages that share a dependency therefore
> each get their own copy of it. For stateless utility libraries this is harmless. But libraries
> built around the **singleton pattern** — a single shared instance that multiple packages are
> supposed to see — can break in subtle ways: a framework and its plugin each bundle their own copy
> of the "shared" core, state written through one copy is invisible through the other, and
> `instanceof` checks fail across copies (e.g. React and a React component library). If you need a
> shared library, import it once yourself at the top level and pass instances to the code that needs
> them, or choose packages that don't rely on shared module state.

## `imp lint`

```
imp lint [...paths]
```

Lints the given paths (default: the whole project) with a standard recommended rule set plus imp's
own rules, which are always applied:

- **`no-capital-component`** — imp components are lowercase functions; a capitalized function name
  is reported.
- **`exact-dependency-versions`** — every `npm:`/`jsr:` specifier (in imports, dynamic imports, and
  `imp.json` aliases) must pin an exact version (`npm:mitt@3.0.1`). imp has no lock file, so the
  versions written in your code are what make dependency resolution reproducible across machines;
  ranges and missing versions are reported. See _Why exact versions?_ under `imp start` for the full
  rationale and what it assumes about your dependencies.

`imp lint` checks `.js`, `.mjs`, and `.cjs` files — and `.html` files too: inline `<script>` blocks
are linted like any other code, with problems reported at their real line in the HTML file. Inline
`npm:`/`jsr:` import specifiers are how imp apps declare dependencies — no rule forbids them, only
the version pinning above applies. Directories named `.git`, `node_modules`, and `dist` are always
skipped.

Rule names follow the widely used ESLint naming, so any rule you know from that ecosystem is spelled
the same here. Extra configuration declared under `lint` in `imp.json` is layered on top:

```json
{
  "lint": {
    "rules": { "no-unused-vars": "off" },
    "exclude": ["legacy/"]
  }
}
```

- **`rules`** — per-rule severities (`"off"`, `"warn"`, `"error"`). Warnings are reported but do not
  fail the command; errors exit non-zero.
- **`exclude`** — project-relative paths to skip.

To suppress a finding in code, use an ignore comment on the line above (rule list optional,
comma-separated), or disable linting for a whole file:

```js
// imp-lint-ignore no-capital-component
const Widget = () => div('widget')
```

```js
// imp-lint-ignore-file
```

## `imp fmt`

```
imp fmt [...paths]
imp fmt --check [...paths]
```

Formats the given paths in place (default: the whole project). `--check` reports files that would
change without writing them and exits non-zero when formatting is needed — useful in CI.

One formatter covers your whole project:

| Files                    | Language   |
| ------------------------ | ---------- |
| `.js .mjs .cjs`          | JavaScript |
| `.json .jsonc`           | JSON       |
| `.md`                    | Markdown   |
| `.css .scss .sass .less` | CSS        |
| `.html`                  | HTML       |
| `.svg`                   | SVG        |
| `.yaml .yml`             | YAML       |

HTML is formatted inside-out: inline `<script>` and `<style>` blocks are formatted with the
JavaScript and CSS formatters, honouring your `fmt` options.

Options come from the `fmt` block of `imp.json`. Defaults when absent: no semicolons
(`"semiColons": false`), single quotes (`"singleQuote": true`), line width 100 (`"lineWidth": 100`),
two-space indentation (`"indentWidth": 2`, `"useTabs": false`). An `exclude` list of
project-relative paths is honoured like in `lint`.

To keep hand-crafted layout, mark the next node with an ignore comment — or exempt a whole file:

```js
// imp-fmt-ignore
const matrix = [1, 2, 3]
```

```js
// imp-fmt-ignore-file
```

In Markdown, `imp-fmt-ignore-start` / `imp-fmt-ignore-end` comments fence off a region.
