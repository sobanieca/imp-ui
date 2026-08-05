# Runtime npm dependencies are pre-bundled into the binary at build time

## Context

`deno compile` embeds every npm package in the module graph as its **complete package tree** - every
dist format, `.d.ts` files, source maps, and type-only transitive packages. For imp's runtime
libraries this multiplied the binary far beyond the code actually executed: the `imp test`
dependencies alone (happy-dom ~31 MB embedded with its `@types/*` train, puppeteer-core with
chromium-bidi and devtools-protocol ~35 MB) plus the eslint tree pushed the binary from 153 MB to
~200 MB, while the reachable code in those packages is a few MB.

## Decision

Every npm package imp uses **at runtime inside the compiled binary** is pre-bundled at build time
into a single minified ESM file under `cli/src/vendor/`, and imp's source imports that file instead
of the npm specifier - the same vendoring pattern as the dprint wasm plugins.

- `tools/prebundle_npm_deps.js` (wired into the `compile` task) bundles each entry with the
  in-process esbuild engine: `happy-dom` → `vendor/happy_dom.js`, `puppeteer-core` →
  `vendor/puppeteer_core.js`, and eslint (`eslint/universal` + the `@eslint/js` recommended rules +
  browser `globals`) → `vendor/eslint.js`.
- **Exact versions are pinned in the tool itself**, mirroring how the wasm plugin pins live in
  `cli/src/fmt_plugins.js`. The packages must _not_ appear in `deno.json` imports: `deno compile`
  embeds every npm package in the workspace lockfile whether or not the module graph references it,
  so an import-map entry alone re-adds the whole package tree. The tool generates entry modules
  against `npm:<name>@<version>`, and a version banner on the first line of each vendor file lets
  re-runs skip bundles that are already current.
- **Bundles target the Deno runtime:** platform `node`, ESM, with node builtins externalized under
  the `node:` prefix (required for first-party modules in Deno) and the optional native add-ons
  `supports-color`, `utf-8-validate`, and `bufferutil` left external - `ws` and puppeteer already
  treat them as optional behind try/catch. A `createRequire` shim in the banner serves CJS `require`
  calls of those externals, and packages whose `module` field points at a default-export-only ESM
  build while CJS consumers `require` their named API (esquery) are redirected to their `main`
  entry.
- `cli/src/vendor/` stays gitignored and is excluded from repo lint/fmt; the vendor files are build
  artifacts, regenerated on demand.
- Packages used only at build/tooling time, or whose package tree is needed at runtime
  (`esbuild-wasm`'s wasm binary, `@dprint/formatter`), are out of scope.

## Consequences

- The binary drops from ~209 MB to ~155 MB with zero behavior change: same package versions, same
  APIs, only tree-shaken instead of whole-tree embedding.
- New runtime npm dependencies must be routed through `tools/prebundle_npm_deps.js` rather than
  imported directly from source that ships in the binary - a direct npm import silently re-adds a
  whole package tree.
- The vendor bundles must exist before the binary can be compiled, exactly as `imp fmt` already
  requires the vendored wasm plugins - `deno task compile` runs the prebundle tool first, and every
  task that invokes imp compiles through it, so this is never a manual step.
- Dependency bumps are manual: edit the version pins in `tools/prebundle_npm_deps.js` - these
  packages are invisible to `deno outdated`. The next compile detects the version banner mismatch
  and re-bundles automatically.
