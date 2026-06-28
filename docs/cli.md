# imp-ui — CLI

The `imp` CLI is the buildless runtime: a static dev server plus thin wrappers over Deno's native
tooling. No bundling, no transforms — files are served as-is. Source: `src/cli/`.

Run it through the `imp` task (`deno task imp <command>`), or compile a binary later with
`deno compile -A -o imp src/cli/main.js`.

## Commands

```
imp start [file.html] [--port 4507]   serve a page (default: index.html)
imp lint  [...paths]                   deno lint + imp rules
imp fmt   [...paths]                   deno fmt
```

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
(telemetry sink), `/@imp/sw.js` (the service worker), and `/@imp/*` (library source).

## `imp lint`

Runs `deno lint` with the imp lint plugin (`src/cli/lint_plugin.js`) layered on top. Current rule:
`no-capital-component` — imp components are lowercase functions (essence #14). If the project's
`deno.json` already declares `lint.plugins`, that configuration is used as-is instead.

## `imp fmt`

A pass-through to `deno fmt`; formatting is governed by `deno.json`.
