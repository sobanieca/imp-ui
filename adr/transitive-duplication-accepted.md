# Transitive duplication across vendored bundles - accepted, not deduplicated

## Context

Every vendored dependency is a self-contained, minified bundle, see `vendored-dependencies.md`. So
two dependencies that share a transitive package each carry their own copy of it. `imp build`
produces the production output from those bundles, and it treats each one as an opaque module, see
`production-bundling.md`. So the copies are invisible to the bundler, and each vendored bundle ships
its own copy. imp scoped the removal of those copies. Every workable direction gives up a core
guarantee:

- **A new resolution of the `imp.json` pins at bundle time** would let the bundler see the full package
  graph and remove the duplicates naturally. But it breaks an offline bundle on a cold cache. It
  also brings back the silent drift of a transitive version, which is what vendoring removed. The
  shipped graph would no longer be the committed bytes.
- **A vendored tree of unbundled modules per package** would make a shared package visible, and
  possible to deduplicate. But it opens the problem of a package tree in git again. It also gives up
  the property of one small file per dependency, which is what makes a commit of `dependencies/`
  cheap.

## Decision

imp accepts the duplication as a deliberate choice of its architecture. Neither `imp install` nor
`imp build` removes a duplicate transitive package across two vendored bundles, and imp plans no
mechanism to do so. The dependency model of imp is deliberately unfriendly to the dependency profile
where this cost would matter. imp expects an app to keep its external dependencies to a minimum, and
to let an agent write a small module for one purpose instead of going to the registry. A project
that is lean enough for that model has little or no transitive overlap to remove. A project where
the duplication hurts carries more dependencies than imp encourages. The growing weight of the
bundle is the signal, and it is not a gap in the tooling.

The cost stays limited and visible. imp does not manage it:

- `imp install` prints every transitive package, as `name@version`, that goes into each vendored
  bundle. So an overlap between two dependencies is visible at install time.
- Inside one production build, imp emits each vendored bundle exactly once across all the chunks,
  see `production-bundling.md`. Only a copy _between_ two different vendored bundles is a duplicate.
- A library in the style of a singleton depends on shared module state. `vendored-dependencies.md`
  already documents that such a library is a poor fit. A duplicate of stateless code costs bytes,
  and never correctness.

## Consequences

- An install and a build stay offline and reproducible byte for byte, without a condition. Those are
  the properties that the rejected designs would give up.
- The bundler stays simple. A vendored bundle needs no analysis of package identity, no manifest,
  and no surgery on a graph across two bundles.
- An app with many overlapping dependencies pays for them in the bytes that it ships. The answer is
  the documented guidance to select few dependencies. The answer is not tooling.
- If the philosophy of imp about the number of dependencies ever changes, somebody must reconsider
  this decision together with `vendored-dependencies.md`. The acceptance rests on that model.
