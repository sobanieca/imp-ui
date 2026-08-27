# dependencies - vendoring packages into `dependencies/`

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

`imp install` downloads a package, bundles it into one minified browser-ready module under
`dependencies/<alias>/`, and pins the exact version in `imp.json`. That folder is **committed**, so
a fresh clone is the whole runnable app - no registry access in dev, CI, or the build.

```
imp install mitt              latest, pinned exactly
imp install mitt@3.0.1        a specific version (imp install mitt 3.0.1 is equivalent)
imp install jsr:@std/encoding@1.0.10/base64    jsr, and a module inside the package
imp install mitt --alias events
imp install                   re-resolve and update every declared dependency
imp uninstall mitt            remove the folder and the pin
```

```json
{ "dependencies": { "mitt": "npm:mitt@3.0.1" } }
```

```js
import mitt from 'mitt'
```

## Rules an agent gets wrong

- **Import by bare alias only.** Never `import mitt from 'npm:mitt@3.0.1'`, never a URL, never a
  path into `dependencies/`. Inline registry specifiers are an `imp/exact-dependency-versions` lint
  error.
- **A bare import that is not a declared alias is a lint error** naming the `imp install` command to
  run. See [lint](lint.md). Add packages with the command, never by hand-editing `imp.json` - see
  [config](config.md).
- **Pins are always exact** - `npm:mitt@3.0.1`, never `^3.0.1`, `3`, or a bare `npm:mitt`. There is
  no lock file; the pin plus the committed bundle are the reproducibility.
- **`imp` is reserved** - it always means the imp library of [imports](imports.md), can never be
  installed or used as an alias, and stays bare inside a vendored bundle that imports it.
- **Prefer writing the code.** imp assumes few dependencies: an agent can write and maintain a small
  purpose-built module faster than a package can be vetted, and it ships less to the browser.
- Re-running `imp install <pkg>` with no version **is** the update path.

## What you get in the repo

`dependencies/<alias>/` holds the self-contained bundle plus any assets the package needs (`.wasm`,
CSS, fonts) as sibling files, so deleting the folder removes the dependency completely. The default
alias is the package name (or the last path segment for a subpath install), and it is both the
import specifier and the folder name.

Every install prints the files written and every package version that went into the bundle - read it
as the audit record:

```
installed micromark (npm:micromark@4.0.2)
  dependencies/micromark/micromark.js (52.1 kB)
  bundled packages:
    micromark@4.0.2
    micromark-core-commonmark@2.0.3
```

The bundle keeps the package's own license notice (`/*! ... */`, `@license`) where the package put
it, so `imp build` can collect it into the app's `LICENSES.txt` - see [build](build.md). Never strip
it out.

A bundle over `maxFileSize` (200 kB default) warns, because it lands in git. Raise `maxFileSize` or
list the folder in `maxFileSizeIgnore` in `imp.json` to accept it - the same limit `imp lint`
enforces. Apart from that limit, `dependencies/` is skipped by everything that walks the tree, so
`imp lint` and `imp fmt` never report or rewrite a package's bundle.

## Trade-offs to design around

- **Each dependency is bundled independently**, so two packages sharing an internal dependency each
  carry their own copy - in development and in `imp build` alike. Harmless for stateless utilities;
  **singleton-based libraries break subtly** (state written through one copy is invisible to the
  other, `instanceof` fails across copies). Install such a library once yourself and pass instances
  around.
- **A package that fetches assets from a CDN at runtime is not fully vendored** and still hits the
  network.
- A package built for an imp host keeps its `imp` imports bare; the install listing says so, and the
  component then runs against **your** imp version - exercise it after an imp upgrade.
