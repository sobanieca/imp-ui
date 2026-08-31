# Vendored, committed dependencies - `imp install`, no lock file

## Context

Dependencies used to be declared inline in app code (`import mitt from 'npm:mitt@3.0.1'`) and
bundled on the fly by the dev server, which fetched packages from the npm/jsr registries at request
time. That kept the project free of generated files, but it had two structural weaknesses:

- **Runtime registry fetches.** `imp start` needed the network the first time each dependency was
  seen, and CI needed registry access to bundle at all.
- **Invisible transitive drift.** An exact top-level pin cannot freeze a package's own dependency
  ranges, and there was no single action to refresh a dependency and its transitive graph - the
  resolved graph changed silently whenever caches were cold at a different time.

The previous decision (no lock file, exact versions in source, imp never writes into the project)
rested on assumptions about well-behaved transitive graphs that this left permanently unverifiable.

## Decision

Dependencies are vendored: resolved, bundled, and committed into the repository, managed by
`imp install` and `imp uninstall`.

- **`imp.json` `dependencies`** is the single source of truth: a map from a bare import alias to an
  exact `npm:`/`jsr:` specifier (optionally with a subpath), e.g.
  `{ "dependencies": { "mitt": "npm:mitt@3.0.1" } }`. The old `imports` alias section is removed and
  its presence is rejected with a migration hint. App code imports dependencies only by their alias
  (`import mitt from 'mitt'`) - never by inline specifier.
- **`dependencies/` in the project root** holds the committed output, one subfolder per top-level
  dependency keyed by its alias (`dependencies/mitt/mitt.js`). Each subfolder contains a
  self-contained, minified ESM bundle plus any emitted assets (wasm, images, fonts, css), so a
  single `imp uninstall` removes the whole dependency cleanly. Only reachable, bundled, minified
  code is stored - never a package tree.
- **`imp install` resolves and pins.** With a version it bundles exactly that version; without one
  it resolves the latest release and pins the exact version it resolved to. Re-running against a
  declared dependency with no version is therefore the update path, and `imp install` with no
  arguments re-resolves and re-bundles every declared dependency. `npm:` is assumed when no scheme
  is given. The command prints the top-level package and every transitive package (`name@version`)
  that went into the bundle.
- **Dependency updates have no separate command.** Updating a dependency is folded into
  `imp install` rather than given its own verb, because installing latest and updating to latest are
  the same resolve-and-re-vendor operation - a distinct command would only duplicate it.
  `imp install` (all) and `imp install <package>` (one) are the sole dependency-update path. (The
  unrelated `imp update` command updates the pinned imp _version_, not dependencies -
  `version-pinning-self-delegation.md`.)
- **No lock file.** The committed bundle is the frozen state; transitive versions are whatever was
  latest at install/update time. Reproducibility comes from the committed bytes, not from tracking
  every transitive version. What the resolution _was_ is recorded beside each bundle
  (`vendored-dependency-manifest.md`) - that manifest describes the committed bytes and never
  constrains the next install, so it is not a lock file and does not act as one.
- **`imp` is the only external while vendoring.** `imp install` never resolves the bare specifier
  `imp` against a registry: `imp` is reserved - rejected as an alias and as an `imp.json` dependency
  key - and always denotes the imp library. A bare `imp` import in a package is kept in the vendored
  bundle as-is, resolved by the app itself: through the injected import map in development and by
  `imp build` in production - the consumer side of publishing with `targetImpHost`
  (`production-bundling.md`), applied on every install with no opt-in. Every other import a package
  makes is resolved from the package's own dependency graph and bundled in at install time; the
  installing app's declared aliases play no part in a package's internal resolution, so a vendored
  bundle depends on nothing local except imp. Kept bare `imp` imports are listed in the printed
  resolution with a version-skew note.
- **The dev server does no dependency bundling.** The injected import map maps each alias to its
  `dependencies/<alias>/` bundle, served as plain static files. The in-process bundling engine
  (`in-process-dependency-bundling.md`) is invoked only by `imp install`.
- **The `exact-dependency-versions` lint rule enforces the model:** every specifier in
  `dependencies` must pin an exact version, inline `npm:`/`jsr:` imports in code are errors, and a
  bare import that matches no declared alias (other than `imp`) is an error hinting `imp install`.

This replaces the previous decision that imp never writes into the project: `imp install` writes
exactly two things, both of them user-requested, committed source - the `dependencies/` vendor
directory and the pin in `imp.json`. imp still writes no derived toolchain config, caches, or lock
files into the project.

## Consequences

- Once a dependency is added, `imp start`, `imp build`, and CI are fully offline - the network is
  touched only by `imp install`. `imp build` is faster because dependencies are already resolved and
  bundled in-tree (`production-bundling.md`).
- A fresh clone is the whole app, dependencies included; nothing needs installing before work
  starts. Committed bundles stay small because only reachable, minified code is stored, and a
  dependency change shows up in review as a diff of its pin and its bundle.
- Updating is a one-liner: `imp install <package>` bumps one dependency (and its transitive graph),
  `imp install` bumps everything. Transitive versions between updates are frozen in the committed
  bytes - drift can no longer happen silently.
- Each bundle is self-contained, so two dependencies sharing a transitive package each carry their
  own copy. For stateless utilities this is harmless; singleton-style libraries that rely on shared
  module state remain a poor fit. `imp build` emits each vendored bundle once across the whole
  output, but copies shared _between_ vendored bundles stay duplicated - a deliberate choice
  (`transitive-duplication-accepted.md`).
- Packages that fetch assets at runtime from absolute or CDN URLs (invisible to the bundler) are not
  vendored and still hit the network - such packages are a poor fit for the offline guarantee.
- A vendored package that expects imp runs against the app's imp version, not the one it was
  authored against - the version-skew trade-off of `production-bundling.md`, surfaced by the printed
  kept-bare-imports note. For every other import the opposite holds: a package always carries the
  versions its author declared, even when the app vendors the same package under an alias - the
  deliberate duplication of `transitive-duplication-accepted.md`, chosen over silently rewiring a
  package's internals to a same-named local alias.
