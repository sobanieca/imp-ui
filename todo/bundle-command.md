# `imp bundle` command

Pack an app into a prod-ready, self-contained, minified JS bundle the user can
upload to any static host or CDN. Must reuse the same resolution as the dev server so dev and prod
resolve specifiers identically: `imp`, `npm:`/`jsr:` inline specifiers, and `imp.json` bare aliases.

## Engine — already solved by the dev server

The compiled binary already bundles dependencies in-process for `imp start`'s `/@dep/` serving:
`esbuild-wasm` (ESM browser build, manually supplied wasm module, `worker: false`) driven by the
official `@deno/esbuild-plugin` for `npm:`/`jsr:` resolution — see
`adr/in-process-dependency-bundling.md` and `src/cli/deps.js`. `imp bundle` reuses this exact engine
and resolver, so dev and prod resolve specifiers identically and nothing new is needed for
dependency resolution.

Local module graphs must have their entry points resolved against `Deno.cwd()` into absolute
`file://` URLs (relative paths otherwise resolve into the binary's virtual filesystem).

Deno's own bundling utilities remain unusable inside a compiled binary (probed against Deno 2.9):
`deno bundle` lives in the full `deno` binary that `denort` strips, and `Deno.bundle()` throws
`Deno.bundle() is not available in compiled binaries`.

## Remaining work

- Drive `esbuild.build` in bundle mode over the app's HTML/JS entry points: minified ESM output,
  `imp` resolved to the baked-in library source, `imp.json` `imports` aliases expanded
  before resolution.
- Code-splitting: lazy-loaded modules (`import()`) split into separate chunks that load on demand
  rather than inlined into the main bundle.
- Write the built assets to an output directory the user can upload as-is.
- Dedupe shared dependencies by resolved package identity across the whole bundle graph (the dev
  server serves one copy per top-level package; the full bundle graph can do better).
- Emit self-contained JS with no external runtime dependency, so a web component authored with imp
  ui can be bundled and then dropped into any application — React, or anything else — without pulling
  in imp or a separate runtime. The bundle carries everything it needs to run on its own.

There is no lock file (`adr/no-lockfile-exact-versions.md`): top-level specifiers carry exact
versions enforced by the `exact-dependency-versions` lint rule, so resolution input is fully
determined by source code, and downloaded packages are cached in Deno's per-user global cache
outside the project.

## Considered and rejected

- **CDN-delegated resolution (esm.sh)** — makes a third-party service a hard dependency of every imp
  project, moves resolution behavior outside imp's control, and breaks offline use.
- **Runtime drivers (delegate to ambient `deno bundle` / `bun build`)** — output would vary by
  machine and installed runtime version, and a machine without a runtime cannot bundle at all;
  contradicts the self-contained single-binary promise (`adr/in-process-toolchain.md`).
