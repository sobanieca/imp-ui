# Production bundling — `imp bundle` over vendored bundles and the baked-in library

## Context

Development is buildless: `imp start` serves source files verbatim and injects an import map that
points `imp` at the served library and each `imp.json` dependency alias at its vendored
`dependencies/<alias>/` bundle (`vendored-dependencies.md`). Production needs the opposite shape:
self-contained, minified static files with no import map and no imp runtime, uploadable to any
static host. The output must resolve specifiers exactly as development did, or what was tested is
not what ships. The bundling engine question was already settled for `imp install`: esbuild-wasm
plus `@deno/esbuild-plugin`, fully in-process (`in-process-dependency-bundling.md`); Deno's own
bundling utilities remain unavailable inside a compiled binary (`deno bundle` is stripped from
`denort`, and `Deno.bundle()` throws in compiled binaries, probed against Deno 2.9).

## Decision

`imp bundle [file.html|file.js] [--outdir dist]` reuses the `imp install` engine to build the app's
own module graph, resolving bare specifiers the same way the dev import map does — offline, with an
imp-owned esbuild resolver that intercepts before the Deno resolver:

- **`imp` resolves to the library source baked into the binary**, loaded from the compiled binary's
  virtual filesystem. Entry points and library modules are addressed as absolute `file://` URLs;
  local entry paths are resolved against the project before bundling, because relative paths would
  otherwise resolve into that virtual filesystem instead of the project.
- **Each dependency alias resolves to its vendored `dependencies/<alias>/` bundle.** No registry is
  contacted; a declared alias with no vendored bundle fails the build with a hint to run
  `imp install`.
- **An HTML entry keeps its URLs.** Every `<script type="module">` with a local `src` becomes an
  entry point whose bundled output is written to the same project-relative path, so the HTML ships
  unchanged; inline module scripts are bundled as additional entries and re-inlined. Lazily loaded
  modules (`import()`) and code shared between entry points split into content-hashed files under
  `chunks/`.
- **Unbundled files ship verbatim.** Every file the bundler consumed as an input (module sources,
  vendored bundles) is omitted from the output; everything else in the project — stylesheets,
  images, other assets, including vendored dependency assets referenced by runtime URL — is copied
  through unchanged, minus `imp.json` and internal folders. The output directory (default `dist/`,
  replaced on each run) is the complete uploadable site.
- **A JS entry emits a self-contained module**: imp and all dependencies compiled in, so an imp
  component can be dropped into any application without a runtime. No files are copied in this mode.
- **`targetImpHost: true` in `imp.json` (JS entries only) keeps `imp` imports out of the bundle** as
  bare specifiers for the host context to resolve — the dev server's import map and a host app's own
  `imp bundle` both resolve bare `imp`, so a component can share the host's single copy of imp
  instead of carrying its own. imp is the only import that can stay bare: declared dependencies are
  always compiled in with their vendored, pinned versions, keeping the option a single boolean
  instead of a per-import list. An HTML entry compiles imp in regardless — the page is its own host,
  and its production output has no import map that could resolve a bare import. The former
  `--external` flag is removed and rejected with a migration hint.

## Consequences

- Production builds are offline and deterministic from the repository state: `imp.json` pins plus
  committed `dependencies/` bundles fully determine the input, so no lock file is needed
  (`vendored-dependencies.md`).
- Dev and prod resolve specifiers identically; the shipped output needs no import map and no imp
  runtime.
- Entry files keep stable, source-derived names — HTML never has to be rewritten, but entries get no
  content-hash cache busting; only chunks and emitted assets are hashed.
- Each vendored bundle enters the graph as one opaque, already-minified module: it is emitted once
  and shared across all chunks, but a transitive package duplicated across two different vendored
  bundles stays duplicated in the output — accepted deliberately
  (`transitive-duplication-accepted.md`) — and tree-shaking inside vendored bundles is limited to
  what their bundled form exposes.
- Bundles built for an imp host trade the frozen-version guarantee for sharing: the component runs
  against whatever imp version the host provides, so version skew between author and host becomes
  possible — a contract self-contained bundles never have. In exchange the host page holds one imp
  instance, which matters once imp carries shared state. The skew is confined to imp: every other
  dependency ships frozen inside the bundle, at the cost of possible duplicates between host and
  component (`transitive-duplication-accepted.md`).
- `imp install` closes the consumer side of this contract: while vendoring it treats `imp` as
  external, so a published bundle built with `targetImpHost` keeps its bare `imp` imports instead of
  resolving them against a registry (`vendored-dependencies.md`).
- wasm esbuild is roughly an order of magnitude slower than native esbuild; the cost is paid per
  `imp bundle` run, never while serving.
