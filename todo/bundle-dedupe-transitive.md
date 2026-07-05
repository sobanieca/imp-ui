# Dedupe transitive packages across vendored bundles in `imp bundle`

`imp bundle` builds the app from the committed `dependencies/<alias>/` bundles
(`adr/production-bundling.md`). Each vendored bundle enters the graph as one opaque,
already-minified module, so it is emitted exactly once across the whole output — but a transitive
package that two different vendored bundles both contain is still shipped twice, once inside each
bundle (`adr/vendored-dependencies.md`).

Deduping by resolved package identity across the whole bundle graph cannot be done from the vendored
output: the transitive copies are minified into it and invisible. Possible directions, each with a
cost to weigh against the offline-from-repository guarantee:

- **Re-resolve top-level specifiers at bundle time.** Let `imp bundle` resolve each `imp.json` pin
  through the registry resolver (as `imp install` does) instead of using the vendored bundle, so
  esbuild sees the full package graph and dedupes shared transitive packages naturally. Breaks
  offline bundling on a cold cache, and the shipped graph is no longer byte-identical to the
  committed one — transitive versions could drift between install time and bundle time unless the
  resolution is pinned somehow.
- **Vendor the transitive graph unbundled.** Have `imp install` store per-package modules instead of
  one flat bundle, so shared packages are visible and deduplicable at bundle time. Contradicts the
  one-file-per-dependency simplicity of `adr/vendored-dependencies.md` and reopens the
  package-tree-in-git problem it was designed to avoid.

Until then the duplication is bounded and visible: `imp install` prints every transitive package
that goes into each vendored bundle, so overlap between dependencies can be spotted at install time.
