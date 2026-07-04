# In-process dependency bundling — esbuild-wasm plus the Deno esbuild plugin

## Context

`imp start` serves each `npm:`/`jsr:` dependency as a browser-ready ESM bundle under `/@dep/`,
produced on the fly. The original implementation used native `esbuild` with
`@luca/esbuild-deno-loader`. Both fail inside the single self-contained binary that `deno compile`
produces:

- **Native esbuild spawns a subprocess.** It launches a platform executable and talks to it over a
  pipe; inside the compiled binary that spawn fails (`Cannot read properties of undefined (reading
  'unref')`), contradicting `in-process-toolchain.md`, which requires the binary to spawn nothing.
- **`@luca/esbuild-deno-loader` cannot resolve dependencies there.** Its portable loader needs a
  `node_modules` directory and its native loader shells out to the `deno` binary — neither exists on
  an end user's machine running only the imp binary.

Hand-writing imp's own esbuild resolver-loader (npm registry metadata, semver, tarball fetch and
in-process extraction, jsr manifests, transitive resolution, `exports` maps) was scoped but is a
large, high-risk reimplementation of a package manager.

## Decision

Dependency bundling runs fully in-process, with no hand-rolled resolver:

- **Engine:** `esbuild-wasm`, loaded as the ESM browser build with a manually supplied wasm module
  and `worker: false` (`esbuild.initialize({ wasmModule, worker: false })`). This is the one
  esbuild-wasm entry that works both under `deno run` and compiled — the default entry spawns a
  worker script absent from the binary's virtual filesystem. The wasm is embedded by
  `deno compile --include src` reaching the whole `src/` tree, and the esbuild-wasm asset is
  embedded as part of its npm package.
- **Resolver-loader:** the official `@deno/esbuild-plugin` (built on `@deno/loader`, a wasm build of
  the same Rust crates Deno itself uses). It resolves and fetches `npm:` specifiers from
  `registry.npmjs.org` and `jsr:` specifiers from `jsr.io` itself, over the network, requiring no
  `node_modules`, no lockfile, and no ambient `deno`.

`src/cli/deps.js` initializes esbuild-wasm lazily on the first `/@dep/` request and bundles each
specifier with `[denoPlugin()]`, caching output per specifier.

## Consequences

- The compiled binary is self-contained for bundling: no ambient `deno`, no `node_modules`, no
  subprocess. Dev mode (`deno task imp`) and the compiled binary share one code path. This removes
  the last subprocess dependency the CLI had, fully satisfying `in-process-toolchain.md`.
- Unlike fmt and lint, bundling needs the network the first time a dependency is seen: it fetches
  packages from the npm and jsr registries. Downloads land in Deno's per-user global cache
  (`DENO_DIR`), never inside the project, consistent with `no-lockfile-exact-versions.md`. Repeat
  bundles are served from cache and from the in-memory per-specifier cache in `deps.js`.
- wasm esbuild is roughly an order of magnitude slower than native esbuild; the per-specifier cache
  keeps this off the hot path.
- Resolution semantics match Deno's own, since the plugin uses Deno's resolver crates — the same
  behavior apps get under `deno task imp`. The engine and resolver are reused by the planned
  `imp bundle` command (`todo/bundle-command.md`).
