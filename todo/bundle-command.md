# `imp bundle` command

Pack an app into a prod-ready, self-contained, minified JS bundle (plus source map) the user can
upload to any static host or CDN. Must reuse the same resolution as the dev server so dev and prod
resolve specifiers identically: `imp`, `npm:`/`jsr:` inline specifiers, and `imp.json` bare aliases.

## Engine decision — esbuild-wasm in-process (verified)

Deno's own bundling utilities are confirmed unusable inside a compiled binary (probed against Deno
2.9):

- `deno bundle` (CLI, back since 2.4) lives in the full `deno` binary; `denort` strips it.
- `Deno.bundle()` (runtime API, 2.5+) works under `deno run` but throws in compiled binaries with an
  explicit `Deno.bundle() is not available in compiled binaries` error. It also downloads a native
  esbuild binary on first use, so it would not have fit the no-subprocess architecture anyway
  (`adr/in-process-toolchain.md`).

The working engine — verified end-to-end in a compiled probe binary — is the same pattern as fmt and
lint: `npm:esbuild-wasm` (ESM browser build, manually supplied wasm module, `worker: false`),
running fully in-process. Bundling + minification of local module graphs works identically under
`deno run` and compiled; entry points must be resolved against `Deno.cwd()` into absolute `file://`
URLs (relative paths resolve into the binary's virtual filesystem).

## The remaining gap — imp's own resolver-loader plugin

`@luca/esbuild-deno-loader` cannot resolve `npm:` specifiers in the compiled setting: its `portable`
loader requires a `node_modules` directory and its `native` loader shells out to the `deno` binary
(both verified failing). imp therefore needs its own esbuild plugin that resolves and loads
specifiers:

- `npm:` — fetch package metadata + tarball from the npm registry, extract in-process (gzip via
  `DecompressionStream`, small tar reader), cache globally under `~/.imp/cache/` keyed by URL +
  integrity hash — never inside the project (`adr/no-lockfile-exact-versions.md`).
- `jsr:` — plain HTTPS module fetches against jsr.io, same lock/cache treatment.
- `imp` bare specifier — the library source baked into the binary.
- `imp.json` `imports` aliases — expanded before resolution, same as the dev server.

This resolver is shared work with `esbuild-wasm-bundling.md` (compiled `/@dep/` serving uses the
same engine and hits the same loader gap) — implement once, use in both `imp start` and
`imp bundle`. It also unlocks fixing the dev server's one-copy-per-top-level-package limitation:
with imp controlling resolution, shared dependencies can be deduplicated by resolved package
identity across the whole bundle graph.

There is no lock file (`adr/no-lockfile-exact-versions.md`): top-level specifiers carry exact
versions enforced by the `exact-dependency-versions` lint rule, so resolution input is fully
determined by source code. Semver logic is still needed once per package for transitive ranges
declared by package authors; resolve them at fetch time and cache the resolved subgraph in the
global cache keyed by the parent package version, so repeat runs are pure checksummed downloads.
Accepted trade-off: transitive drift across long time spans is possible — mitigated by exact
top-level pins and cache stability, and resolvable later by optional pinning inside `imp.json` if it
ever bites.

## Considered and rejected

- **CDN-delegated resolution (esm.sh)** — would eliminate the resolver entirely and shrink
  `imp bundle` to an http-loader plugin, but makes a third-party service a hard dependency of every
  imp project, moves resolution behavior outside imp's control, and breaks offline use. Full control
  over dependency resolution is worth owning the resolver.
- **Runtime drivers (delegate to ambient `deno bundle` / `bun build`)** — output would vary by
  machine and installed runtime version, and a machine without a runtime cannot bundle at all;
  contradicts the self-contained single-binary promise (`adr/in-process-toolchain.md`).
