# `imp install` / `imp uninstall` — vendored, in-tree dependencies

Replace inline `npm:`/`jsr:` import specifiers with dependencies that are bundled once and committed
into the repository, managed by `imp install` and `imp uninstall`. This is the vendoring direction
already anticipated in `adr/no-lockfile-exact-versions.md`.

## Why change the current approach

Today a dependency is referenced inline (`import mitt from 'npm:mitt@3.0.1'`) and the dev server
bundles it on the fly, fetching from the npm/jsr registries at request time
(`adr/in-process-dependency-bundling.md`). Two weaknesses:

- **Runtime registry fetches.** `imp start` needs the network the first time each dependency is
  seen, and CI needs registry access to bundle. Vendoring makes both fully offline once a dependency
  is added, and makes the eventual `imp bundle` much faster because deps are already resolved and
  bundled in-tree.
- **Transitive updates are invisible.** With inline pins there is no single action that refreshes a
  dependency and its transitive graph to the latest patched releases. Re-running `imp install` with
  the version omitted makes that a one-liner.

Committing bundled dependencies stays cheap: unlike `node_modules`, only the reachable, bundled,
minified source is stored — one bundle per top-level dependency, not a package tree, and nothing
that is not actually reachable. There is deliberately
**no transitive lock and no resolved-graph manifest**: the committed bundle is the frozen state, and
transitive versions are simply whatever was latest at add/update time. Reproducibility comes from the
committed bytes, not from tracking every transitive version.

## Commands

### `imp install`

Resolve, bundle (reusing the esbuild-wasm + `@deno/esbuild-plugin` engine in `src/cli/deps.js`),
write the bundle into `@imp/deps/`, and add the pin to `imp.json` under `dependencies`.

**Version syntax.** The version can be attached to the package name or passed as a separate
argument — both forms are equivalent:

```
imp install mitt@3.0.1
imp install mitt 3.0.1
```

If the version is omitted, the latest is resolved and the exact version it resolved to is pinned.
Because a re-install always re-resolves, this doubles as the update path — running `imp install`
against an already-declared dependency with no version bumps it (and its transitive graph) to the
latest patched releases:

```
imp install mitt
```

**Registry scheme.** `npm:` is assumed when no scheme is given, so `imp install mitt` means
`npm:mitt`. An explicit scheme selects the registry:

```
imp install npm:mitt
imp install jsr:somepackage
```

`jsr:` specifiers bundle the same way. The specifier value may also include a subpath (e.g.
`jsr:@std/encoding@1.0.10/base64`), so the bundle entry is exactly that module and the alias imports
it directly.

The alias key defaults to the package name (`mitt`); an explicit alias can be supplied when desired.

`imp install` prints the exact versions it resolves — the top-level package **and every transitive
dependency** (`name@version`) that went into the bundle — to the terminal. This is not persisted
anywhere (there is no resolved-graph manifest); it is printed so the user can see and manually verify
exactly what was pulled in, and note a specific transitive version if they need to.

### `imp uninstall`

```
imp uninstall mitt
```

Delete the bundle and drop the `imp.json` entry.

## Storage and config

- **`@imp/deps/`** in the project root holds the committed bundles, one self-contained ESM file per
  top-level dependency (e.g. `@imp/deps/mitt.js`), plus any emitted assets (see below). Each file is
  already **bundled and minified** at install time — the reachable dependency code and nothing else,
  so the repository never carries unused package files or unminified bulk. `imp bundle` still
  tree-shakes these vendored bundles into the final app bundle for production, but the on-disk vendor
  copy is kept small from the start.
- **`imp.json` `dependencies`** maps a bare import alias to its exact specifier and is the single
  source of truth:

  ```json
  {
    "dependencies": { "mitt": "npm:mitt@3.0.1" }
  }
  ```

  The specifier value may include a subpath (e.g. `"base64": "jsr:@std/encoding@1.0.10/base64"`), so
  the bundle entry is exactly that module and the alias imports it directly.
- **`imports` is removed.** The old `imp.json` `imports` alias section is superseded entirely by
  `dependencies`; the injected import map is built from `dependencies`.

## Import surface

Users import a vendored dependency by its alias, resolved through the import map to its `@imp/deps/`
file — no scheme and no version in the import line:

```js
import mitt from 'mitt'
```

The version lives only in `imp.json` `dependencies`.

## Assets in dependencies (wasm, svg, images, css)

Some packages import non-JS assets — a `.wasm` binary, an `.svg`, an image, a `.css` file — or
reference them via `new URL('./thing.wasm', import.meta.url)`. Bundling handles these through
esbuild's loaders; the vendoring output is therefore not always a single `.js` file:

- **Emit as sibling files (default).** Configure esbuild's `file` loader with `@imp/deps/` as the
  output directory so each asset is written next to the bundle (e.g. `@imp/deps/mitt.js` +
  `@imp/deps/<hash>.wasm`), and imports / `new URL(..., import.meta.url)` references are rewritten to
  point at the emitted path. The dev server serves these from `@imp/deps/`; `imp bundle` carries them
  into the production output. This keeps binary assets as real files rather than bloating the JS.
- **Inline small assets.** Small assets can instead be inlined as `dataurl` (base64) so the bundle
  stays a single self-contained file; apply a size threshold to avoid ballooning committed text.
- **CSS** imported by a package is bundled by esbuild into an emitted `.css` (or inlined), handled
  the same way.
- **Known gap:** packages that fetch assets at runtime from an absolute or CDN URL (rather than a
  bundler-visible `import` / `new URL`) are not vendored and would still hit the network — such
  packages are a poor fit for the offline guarantee and should be flagged.

## Lint rule impact

The always-on `exact-dependency-versions` rule currently enforces exact versions on inline `npm:`/
`jsr:` specifiers. Repoint it at the new model: every specifier value in `dependencies` must carry an
exact version, and every bare dependency import must resolve to a declared alias (a bare import with
no matching `dependencies` entry is a lint error hinting `imp install`).

## Dev server and bundle integration

- **`imp start`** serves `@imp/deps/` files directly through the import map instead of bundling on
  the fly. On-the-fly `/@dep/` bundling is retained only as the internal mechanism `imp install`
  uses, so the dev server itself needs no network once dependencies are vendored.
- **`imp bundle`** (`bundle-command.md`) tree-shakes the vendored `@imp/deps/` bundles into the
  final app bundle and dedupes transitive packages shared across top-level dependencies, so the
  per-dependency duplication in the vendored tree is removed from the shipped output.

## ADR impact

Implementing this **replaces `adr/no-lockfile-exact-versions.md`**: imp would now write one thing
into the project — the user-requested, committed `@imp/deps/` vendor directory (source, not derived
toolchain config). Record the new decision (vendored bundles as the reproducibility mechanism, still
no lock file and no transitive-version tracking, since the committed bundle is the frozen state) and
update the ADR table.

## Open questions

- **Directory name.** `@imp/deps/` is clearly imp-branded but the `@` prefix can trip some globbing
  and tooling; `imp.deps/` or `vendor/` are alternatives to weigh.
- **Asset inlining threshold.** The byte size below which assets are inlined as data URLs rather than
  emitted as sibling files.
- **Update policy.** Whether a version-less `imp install` always jumps to the latest version across
  majors, or offers a way to cap the bump.
