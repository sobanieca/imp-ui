# imp-ui — CLI

The `imp` CLI is the buildless runtime: a static dev server plus thin wrappers over Deno's native
tooling. No bundling, no transforms — files are served as-is. Source: `src/cli/`.

Run it through the `imp` task (`deno task imp <command>`), or compile a binary later with
`deno compile -A -o imp src/cli/main.js`.

## Commands

```
imp start [file.html] [--port 4507]   serve a page (default: index.html)
imp lint  [...paths]                   lint with imp rules
imp fmt   [...paths]                   format source
```

## Configuration — `imp.json`

The only config file you author is `imp.json` at your project root; it is optional. imp targets Deno
underneath, but you never write a `deno.json` — on each command imp derives an internal Deno config
(`.imp/deno.json`, gitignored) from your `imp.json` and points its tooling at it. Dependency
versions are pinned in `imp.lock`.

```json
{
  "imports": { "mitt": "npm:mitt@3" },
  "fmt": { "lineWidth": 100 }
}
```

- **`imports`** — bare-specifier aliases for dependencies, so you can write
  `import mitt from 'mitt'` instead of the full `npm:`/`jsr:` specifier. Each alias is exposed to
  the browser through the injected import map and resolved through `/@dep/` (see below).
- **`fmt`** — formatting options for `imp fmt`.
- **`lint`** — extra lint configuration; the imp rule set is always applied on top.

## `imp start`

Serves the directory containing the given HTML file. The file itself is reachable at `/`. Three
things are injected into every served HTML document automatically — you never reference the imp
bundle by path:

- **Import map.** `imp` resolves to the served library, so pages import by bare specifier:

  ```js
  import { div, h1, mount } from 'imp'
  mount('#app', () => div(h1('hello')))
  ```

  The library source is served under `/@imp/` (`/@imp/imp.js`, `/@imp/render.js`, …). A bare
  specifier is used instead of injecting globals because tag factories include names like `a`, `b`,
  `i`, `p`, `time`, and `menu` that would collide on `window`.

- **Console + error telemetry.** A small inline script forwards `console.*`, uncaught errors, and
  unhandled rejections to the terminal, prefixed `[browser:*]`. An LLM driving the session reads
  runtime behavior straight from stdout.

- **Network telemetry.** A service worker (registered at root scope) intercepts _all_ request types
  — `fetch`, `XMLHttpRequest`, images, scripts, navigations — and reports each as
  `[net] METHOD url → status ms`. Requests under `/@imp/` are passed through untouched.

Live reload is included: file changes under the served directory trigger a browser reload over SSE.

Internal endpoints (reserved, not part of your app): `/@imp/events` (reload stream), `/@imp/log`
(telemetry sink), `/@imp/sw.js` (the service worker), `/@imp/*` (library source), and `/@dep/*`
(bundled third-party dependencies, see below).

### npm and jsr dependencies

Import any npm or jsr package straight from app code using Deno's native specifiers — no install
step, no manual import map:

```js
import mitt from 'npm:mitt@3'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
```

When the dev server serves a `.js` file it rewrites these `npm:`/`jsr:` specifiers to `/@dep/…`
URLs. The first request for each `/@dep/…` URL resolves the package (honouring `imp.json` and
`imp.lock`) and transpiles it to a single browser-ready ES module; results are cached in memory for
the life of the process. Only `npm:`/`jsr:` specifiers are touched — every other line is served
byte-for-byte, and bare `imp` still resolves via the import map. A package that fails to resolve
returns a module that throws, surfacing the error in both the browser console and the terminal.

Bare aliases declared under `imports` in `imp.json` work the same way: they are added to the
injected import map pointing at their `/@dep/…` URL, so `import mitt from 'mitt'` resolves without
the full specifier.

> **One copy per top-level package.** Each top-level specifier is bundled independently with its
> transitive deps inlined, so two different packages that share a dependency get separate copies of
> it. That is fine for stateless utility libraries; libraries that require a single shared instance
> (e.g. React and its renderer) are a known limitation of this first version.

## `imp lint`

Lints with the imp lint plugin (`src/cli/lint_plugin.js`) always applied. Current rule:
`no-capital-component` — imp components are lowercase functions (essence #14). Extra rules declared
under `lint` in `imp.json` are layered on top.

## `imp fmt`

Formats your source. Options come from the `fmt` block of `imp.json` (sensible defaults are used
when absent).
