# imp — Managing dependencies

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

imp vendors your dependencies: `imp install` downloads a package, bundles it into a single
browser-ready, minified module, and stores that bundle inside your project, in a `dependencies/`
folder you commit alongside your code. After that, the dependency is simply part of your repository
— starting the dev server, running CI, or cloning the project fresh needs no package installation
and no network access.

## Adding a dependency

```
imp install mitt
```

This resolves the latest release of the `mitt` package from npm, bundles it, writes the bundle to
`dependencies/mitt/mitt.js`, and records the exact version it resolved in `imp.json`:

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" }
}
```

Your code imports the package by its bare name — no version, no URL:

```js
import mitt from 'mitt'
```

The name on the left side of the `imp.json` entry is the **alias**: the specifier your imports use,
and the name of the dependency's subfolder. It defaults to the package name; pass `--alias` to
choose your own:

```
imp install mitt --alias events
```

## Pinning a version

To install a specific version, attach it to the package name or pass it as a second argument — the
two forms are equivalent:

```
imp install mitt@3.0.1
imp install mitt 3.0.1
```

Versions are always exact (`3.0.1`, never `^3` or `3`). When you omit the version, imp resolves the
latest release and pins the exact version it found — `imp.json` always records precisely what is in
the bundle.

## npm and jsr

Package names refer to npm by default — `imp install mitt` means `npm:mitt`. Prefix with `jsr:` to
install from the jsr registry instead:

```
imp install jsr:@std/encoding
```

A specifier can also name a module inside the package, so the bundle contains exactly that module:

```
imp install jsr:@std/encoding@1.0.10/base64
```

This installs under the alias `base64` (the last path segment), so you write:

```js
import { encodeBase64 } from 'base64'
```

## Updating

Re-installing an already-declared dependency without a version bumps it — and everything it depends
on internally — to the latest release:

```
imp install mitt
```

Running `imp install` with no arguments at all updates **every** declared dependency the same way:

```
imp install
```

One command refreshes your entire dependency surface; the diff in `imp.json` and `dependencies/`
shows exactly what changed.

## Removing

```
imp uninstall mitt
```

This deletes the dependency's entire `dependencies/mitt/` folder and removes its entry from
`imp.json`.

## What `imp install` prints

Every install prints the files it wrote and the exact version of every package that went into the
bundle — the package you asked for and everything it pulled in:

```
installed micromark (npm:micromark@4.0.2)
  dependencies/micromark/micromark.js (52.1 kB)
  bundled packages:
    decode-named-character-reference@1.3.0
    micromark@4.0.2
    micromark-core-commonmark@2.0.3
    ...
```

This listing is your audit record: read it to see what you are actually shipping, and note a
specific version if you ever need to trace one.

## The `dependencies/` folder

`dependencies/` holds one subfolder per dependency, named after its alias. Each subfolder contains
that dependency's self-contained bundle plus any assets the package needs — a `.wasm` binary, CSS,
images, fonts — emitted as sibling files, so removing the folder removes the dependency completely.

**Commit this folder.** It is deliberately cheap to keep in git: unlike a `node_modules` tree, it
stores only the code that is actually reachable from your imports, already bundled and minified —
one small file per dependency, not thousands. In exchange you get:

- **Offline everything.** The dev server and CI never talk to a package registry; a fresh clone is
  the whole, runnable app.
- **Reproducibility from bytes.** There is no lock file. The committed bundle _is_ the frozen state
  of the dependency — what you tested is what every machine runs, because it is the same bytes.
- **Reviewable updates.** A dependency change shows up in code review as a change to its pin in
  `imp.json` and to its bundle.

## Choosing dependencies well

Each dependency is bundled independently and self-contained, so two packages that share an internal
dependency each carry their own copy of it. This holds in production too: `imp bundle` ships each
dependency's bundle as-is and never merges shared internals across dependencies. That is a
deliberate choice, not a missing feature — merging would mean re-resolving packages at build time,
giving up the offline, reproducible-from-your-repository build — and it reflects how imp expects
apps to be built: with few dependencies, so there is little overlap to merge in the first place. If
shipped weight from overlapping dependencies becomes noticeable, treat it as a prompt to drop or
consolidate dependencies rather than something a build option will solve.

For stateless utility libraries the duplication is harmless. Libraries built around a **singleton**
— one shared instance that several packages are supposed to see — can break in subtle ways: state
written through one copy is invisible through the other, and `instanceof` checks fail across copies.
If you need a shared library, install it once yourself and pass instances to the code that needs it,
or choose packages that don't rely on shared module state.

Two more things to know:

- A package that fetches its assets at runtime from a CDN (rather than importing them) is not fully
  vendored and will still hit the network — a poor fit for the offline guarantee.
- imp assumes you lean on dependencies as little as possible. In the AI era, an agent can write and
  maintain a small, purpose-built module for your app faster than you can vet a package — so before
  reaching for a registry, consider having your agent write the code instead. Fewer dependencies
  mean less code shipped to the browser and a codebase your agent understands completely.

## Lint enforcement

`imp lint` keeps the model honest: every entry in `dependencies` must pin an exact version, inline
`npm:`/`jsr:` specifiers in import statements are errors (install the package instead), and a bare
import that doesn't match a declared dependency is an error suggesting the `imp install` command to
fix it. See **[Linting](lint.md)**.
