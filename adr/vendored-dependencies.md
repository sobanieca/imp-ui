# Vendored, committed dependencies - `imp install`, no lock file

## Context

An app used to declare a dependency inline, in its own code, as `import mitt from 'npm:mitt@3.0.1'`.
The dev server bundled that dependency while it ran, and it fetched the package from the npm or jsr
registry at the moment of the request. That kept the project free of a generated file, and it had
two structural weaknesses:

- **imp fetched from a registry at runtime.** `imp start` needed the network the first time when it
  saw each dependency, and CI needed access to a registry before it could bundle at all.
- **A transitive version drifted, and nobody saw it.** An exact pin at the top level cannot freeze
  the version ranges of a package. There was also no single action that refreshed a dependency with
  its transitive graph. So the resolved graph changed with no message, whenever a cache was cold at
  a different time.

The previous decision said that there is no lock file, that an exact version lives in the source,
and that imp never writes into the project. It rested on assumptions about a transitive graph that
behaves well, and that setup left those assumptions permanently unverifiable.

## Decision

imp vendors a dependency. It resolves the dependency, bundles it, and commits the bundle into the
repository. `imp install` and `imp uninstall` manage that.

- **The `dependencies` key of `imp.json` is the one source of truth.** It maps a bare import alias
  to an exact `npm:` or `jsr:` specifier, and that specifier can carry a subpath. An example is
  `{ "dependencies": { "mitt": "npm:mitt@3.0.1" } }`. The old `imports` section for an alias is
  removed. imp rejects its presence, and the error hints at the migration. App code imports a
  dependency by its alias only, as in `import mitt from 'mitt'`. It never uses an inline specifier.
- **`dependencies/` at the project root holds the committed output.** There is one subfolder per
  top-level dependency, keyed by its alias, as in `dependencies/mitt/mitt.js`. Each subfolder holds
  a self-contained, minified ESM bundle, and any asset that imp emitted, such as a wasm file, an
  image, a font or a stylesheet. So one `imp uninstall` removes the whole dependency cleanly. imp
  stores only code that is reachable, bundled and minified. It never stores a package tree.
- **`imp install` resolves and pins.** With a version, it bundles exactly that version. With no
  version, it resolves the latest release, and pins the exact version that it resolved. So a second
  run against a declared dependency, with no version, is the update path. `imp install` with no
  argument resolves and bundles every declared dependency again. imp assumes `npm:` when you give no
  scheme. The command prints the top-level package, and every transitive package, as `name@version`,
  that went into the bundle.
- **There is no separate command for an update of a dependency.** imp folds the update into
  `imp install`, and gives it no verb of its own. To install the latest version, and to update to
  the latest version, are the same operation, which resolves and vendors again. A separate command
  would only duplicate that. `imp install` for all, and `imp install <package>` for one, are the
  only update path. The `imp update` command is unrelated. It updates the pinned imp _version_, and
  not a dependency, see `version-pinning-self-delegation.md`.
- **There is no lock file.** The committed bundle is the frozen state. A transitive version is
  whatever was the latest one at the moment of the install or the update. The reproducibility comes
  from the committed bytes, and not from a record of every transitive version. imp does record what
  the resolution _was_, beside each bundle, see `vendored-dependency-manifest.md`. That manifest
  describes the committed bytes. It never constrains the next install. So it is not a lock file, and
  it does not act as one.
- **While it vendors, imp treats `imp` as the only external.** `imp install` never resolves the bare
  specifier `imp` against a registry. `imp` is reserved. imp rejects it as an alias, and as a key of
  `dependencies` in `imp.json`. It always means the imp library. imp keeps a bare `imp` import of a
  package in the vendored bundle, as it is. The app resolves it, through the injected import map in
  development, and through `imp build` in production. That is the consumer side of a publication
  with `targetImpHost`, see `production-bundling.md`, and imp applies it on every install, with no
  choice to make. imp resolves every other import of a package from the dependency graph of that
  package, and bundles it in at install time. The declared aliases of the installing app play no
  part in the internal resolution of a package. So a vendored bundle depends on nothing local,
  except imp. imp lists a bare `imp` import that it kept, in the printed resolution, with a note
  about a difference of version.
- **The dev server bundles no dependency.** The injected import map maps each alias to its
  `dependencies/<alias>/` bundle, which imp serves as a plain static file. Only `imp install`
  invokes the in-process bundling engine, see `in-process-dependency-bundling.md`.
- **The `exact-dependency-versions` lint rule enforces the model.** Every specifier in
  `dependencies` must pin an exact version. An inline `npm:` or `jsr:` import in code is an error. A
  bare import that matches no declared alias, other than `imp`, is an error, and the message hints
  at `imp install`.

This replaces the previous decision, which said that imp never writes into the project.
`imp install` writes exactly two things, and a user asked for both. They are committed source. They
are the `dependencies/` vendor directory, and the pin in `imp.json`. imp still writes no derived
toolchain config, no cache, and no lock file into the project.

## Consequences

- After you add a dependency, `imp start`, `imp build` and CI all work offline. Only `imp install`
  touches the network. `imp build` is faster, because the dependencies are already resolved and
  bundled in the tree, see `production-bundling.md`.
- A fresh clone is the whole app, with its dependencies. Nobody installs anything before work
  starts. A committed bundle stays small, because imp stores only code that is reachable and
  minified. A change to a dependency appears in a review as a diff of its pin, and a diff of its
  bundle.
- An update is one line. `imp install <package>` moves one dependency, with its transitive graph.
  `imp install` moves everything. A transitive version between two updates is frozen in the
  committed bytes. So a drift can no longer happen with no message.
- Each bundle is self-contained. So two dependencies that share a transitive package each carry
  their own copy of it. For a stateless utility that is harmless. A library in the style of a
  singleton depends on shared module state, and it stays a poor fit. `imp build` emits each vendored
  bundle once across the whole output. A copy shared _between_ two vendored bundles stays
  duplicated. That is a deliberate choice, see `transitive-duplication-accepted.md`.
- A package that fetches an asset at runtime, from an absolute URL or from a CDN, is invisible to
  the bundler. imp does not vendor that asset, and the package still uses the network. Such a
  package is a poor fit for the offline guarantee.
- A vendored package that expects imp runs against the imp version of the app, and not against the
  version that its author wrote it for. That is the trade about a difference of version, from
  `production-bundling.md`. The printed note about kept bare imports shows it. For every other
  import, the opposite holds. A package always carries the versions that its author declared, also
  when the app vendors the same package under an alias. That is the deliberate duplication of
  `transitive-duplication-accepted.md`. imp chose it over a silent rewiring of the internals of a
  package to a local alias with the same name.
