# Transitive duplication across vendored bundles — accepted, not deduplicated

## Context

Every vendored dependency is a self-contained, minified bundle (`vendored-dependencies.md`), so two
dependencies that share a transitive package each carry their own copy of it, and `imp bundle`
builds production output from those bundles as opaque modules (`production-bundling.md`) — the
copies are invisible to the bundler and ship once per vendored bundle. Eliminating them was scoped,
and every viable direction surrenders a core guarantee:

- **Re-resolving `imp.json` pins at bundle time** would let esbuild see the full package graph and
  dedupe naturally, but it breaks offline bundling on a cold cache and reintroduces the silent
  transitive drift that vendoring was adopted to end — the shipped graph would no longer be the
  committed bytes.
- **Vendoring unbundled per-package module trees** would make shared packages visible and
  deduplicable, but reopens the package-tree-in-git problem and gives up the one-small-file-per-
  dependency property that makes committing `dependencies/` cheap.

## Decision

The duplication is accepted as a deliberate choice of imp's architecture — neither `imp install` nor
`imp bundle` dedupes transitive packages across vendored bundles, and no dedupe mechanism is
planned. imp's dependency model is intentionally hostile to the dependency profile where this cost
would matter: apps are expected to keep external dependencies to a minimum and let an agent write
small purpose-built modules instead of reaching for the registry. A project lean enough to fit that
model has little or no transitive overlap to dedupe; a project where the duplication hurts is
carrying more dependencies than imp encourages, and the growing bundle weight is the signal, not a
tooling gap.

The cost stays bounded and visible rather than managed:

- `imp install` prints every transitive package (`name@version`) that goes into each vendored
  bundle, so overlap between dependencies is apparent at install time.
- Within one production build, each vendored bundle is emitted exactly once across all chunks
  (`production-bundling.md`); only copies _between_ different vendored bundles are duplicated.
- Singleton-style libraries that rely on shared module state were already documented as a poor fit
  (`vendored-dependencies.md`); duplication of stateless code costs bytes, never correctness.

## Consequences

- Offline, byte-reproducible installs and builds are preserved unconditionally — the properties the
  rejected designs would have traded away.
- The bundler stays simple: vendored bundles need no package-identity analysis, manifest, or
  cross-bundle graph surgery.
- Apps with many overlapping dependencies pay for them in shipped bytes. The mitigation is the
  documented guidance to choose and minimize dependencies, not tooling.
- If imp's philosophy on dependency counts ever changes, this decision has to be revisited together
  with `vendored-dependencies.md`, since the acceptance rests on that model.
