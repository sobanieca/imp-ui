# Runtime npm dependencies are pre-bundled into the binary at build time

## Context

`deno compile` embeds every npm package in the module graph as its **complete package tree**. That
covers every dist format, every `.d.ts` file, every source map, and every transitive package that
exists for types only. For the runtime libraries of imp, that made the binary far larger than the
code that runs. The dependencies of `imp test` alone are one example. happy-dom embedded about 31
MB, with its train of `@types/*` packages. puppeteer-core, with chromium-bidi and devtools-protocol,
embedded about 35 MB. With the eslint tree, the binary grew from 153 MB to about 200 MB. The code
that imp reaches inside those packages is a few MB.

## Decision

imp pre-bundles at build time every npm package that it uses **at runtime inside the compiled
binary**. Each one becomes a single minified ESM file under `cli/src/vendor/`. The source of imp
imports that file, and not the npm specifier. This is the same vendoring pattern as for the dprint
wasm plugins.

- `tools/prebundle_npm_deps.js`, which the `compile` task runs, bundles each entry with the
  in-process esbuild engine. `happy-dom` becomes `vendor/happy_dom.js`. `puppeteer-core` becomes
  `vendor/puppeteer_core.js`. eslint, which is `eslint/universal` with the recommended rules of
  `@eslint/js` and the browser `globals`, becomes `vendor/eslint.js`.
- **The tool itself pins an exact version.** That mirrors the pins of the wasm plugins in
  `cli/src/fmt_plugins.js`. The packages must _not_ appear in the imports of `deno.json`.
  `deno compile` embeds every npm package in the lockfile of the workspace, whether or not the
  module graph references it. So an import-map entry alone adds the whole package tree again. The
  tool generates an entry module against `npm:<name>@<version>`. A version banner on the first line
  of each vendor file lets a second run skip a bundle that is already current.
- **A bundle targets the Deno runtime.** The platform is `node`, the format is ESM, and imp keeps a
  node builtin external under the `node:` prefix, which Deno requires for a first-party module. imp
  also keeps the optional native add-ons external, which are `supports-color`, `utf-8-validate` and
  `bufferutil`. `ws` and puppeteer already treat them as optional, behind a try and catch. A
  `createRequire` shim in the banner serves a CJS `require` call for one of those externals. One
  package, esquery, has a `module` field that points at an ESM build with a default export only,
  while a CJS consumer requires its named API. imp redirects such a package to its `main` entry.
- `cli/src/vendor/` stays out of git, and the repository lint and fmt exclude it. A vendor file is a
  build artifact, and imp generates it again on demand.
- A package that imp uses only at build time or for tooling is out of scope. So is a package whose
  package tree imp needs at runtime, which covers the wasm binary of `esbuild-wasm`, and
  `@dprint/formatter`.

## Consequences

- The binary falls from about 209 MB to about 155 MB, and the behaviour does not change. The package
  versions are the same, and the APIs are the same. imp embeds a tree-shaken bundle in place of the
  whole tree.
- A new runtime npm dependency must go through `tools/prebundle_npm_deps.js`. Do not import it
  directly from source that ships in the binary. A direct npm import adds a whole package tree
  again, and nothing reports that.
- A vendor bundle must exist before imp can compile the binary. That is the same requirement that
  `imp fmt` already has for the vendored wasm plugins. `deno task compile` runs the prebundle tool
  first, and every task that invokes imp compiles through that task. So this is never a manual step.
- A version change is manual. Edit the version pin in `tools/prebundle_npm_deps.js`. `deno outdated`
  does not see these packages. The next compile finds that the version banner differs, and bundles
  the package again.
