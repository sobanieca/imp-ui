# Dependency bundling with rolldown and imp's own package resolver

## Context

`imp install` turns each `npm:` dependency into a minified ESM bundle that the browser can run, and
vendors it under `dependencies/`, see `vendored-dependencies.md`. `imp build` and `imp test` bundle
an app that imports those aliases. A bundler needs a resolver that reaches a package registry, picks
a version, fetches the package, and resolves a path inside it. imp runs on a machine that has no
package manager, no `node_modules` and no other runtime, see `native-toolchain.md`.

## Decision

imp bundles with rolldown, and resolves packages with a resolver of its own, in `cli/src/npm.rs`.
The resolver is written for imp. It reuses no code of another loader.

- **A specifier names an npm package and a range.** `npm:name@range/subpath` reads from
  `registry.npmjs.org`. imp installs packages from the npm registry only.
- **Version resolution follows npm semver.** imp reads the packument once per run, picks the highest
  version that satisfies the range, and caches the packument in memory.
- **A package is fetched once, and checked.** imp downloads the tarball, verifies the strongest
  `integrity` hash that the registry lists, and extracts it into the cache folder of imp at
  `~/.imp/npm/registry.npmjs.org/<name>/<version>/`. A project folder never receives a download.
- **Resolution inside a package follows Node.** imp reads the `exports` and `imports` maps with the
  `browser` and `import` conditions, falls back to `module` and `main`, and honours the `browser`
  field, also when it maps one file of the package to another. A bare import from inside a package
  resolves against the `dependencies`, `peerDependencies` and `optionalDependencies` of that
  package. A Node builtin fails the bundle and names the importer.
- **rolldown does the rest.** It converts CommonJS, tree-shakes, splits chunks and minifies. imp
  emits a non-JS asset, such as a wasm file, an image, a font or a stylesheet, as a sibling file.

## Consequences

- `imp install` needs the network, and nothing else does. A second install of the same version reads
  the cache. A tampered tarball fails the integrity check, and imp writes nothing.
- A package that relies on a Node builtin does not bundle for the browser. The error names the
  package and the builtin.
- Two packages that need different versions of a third one each get their own copy, see
  `transitive-duplication-accepted.md`.
