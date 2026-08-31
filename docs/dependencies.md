# imp - Managing dependencies

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

imp vendors your dependencies: `imp install` downloads a package, bundles it into a single
browser-ready, minified module, and stores that bundle inside your project, in a `dependencies/`
folder you commit alongside your code. After that, the dependency is simply part of your
repository - starting the dev server, running CI, or cloning the project fresh needs no package
installation and no network access.

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

Your code imports the package by its bare name - no version, no URL:

```js
import mitt from 'mitt'
```

The name on the left side of the `imp.json` entry is the **alias**: the specifier your imports use,
and the name of the dependency's subfolder. It defaults to the package name; pass `--alias` to
choose your own:

```
imp install mitt --alias events
```

One name is reserved: `imp` always refers to the imp library itself, which every app can already
import - it cannot be installed as a dependency or used as an alias.

## Pinning a version

To install a specific version, attach it to the package name or pass it as a second argument - the
two forms are equivalent:

```
imp install mitt@3.0.1
imp install mitt 3.0.1
```

Versions are always exact (`3.0.1`, never `^3` or `3`). When you omit the version, imp resolves the
latest release and pins the exact version it found - `imp.json` always records precisely what is in
the bundle.

## npm and jsr

Package names refer to npm by default - `imp install mitt` means `npm:mitt`. Prefix with `jsr:` to
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

Re-installing an already-declared dependency without a version bumps it - and everything it depends
on internally - to the latest release:

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
bundle - the package you asked for and everything it pulled in:

```
installed micromark (npm:micromark@4.0.2)
  dependencies/micromark/micromark.js (52.1 kB)
  dependencies/micromark/manifest.json (packages, versions, licenses)
  bundled packages:
    decode-named-character-reference@1.3.0 - MIT
    micromark@4.0.2 - MIT
    micromark-core-commonmark@2.0.3 - MIT
    ...
```

Read it to see what you are actually shipping. The same listing is written to disk, so it is still
there long after the terminal has scrolled - see
**[The dependency manifest](#the-dependency-manifest)**.

## Large dependencies

Because vendored bundles are committed to your repository, imp warns you when a package is heavy. If
a dependency bundles to more than **200 kB**, `imp install` prints its size in human-friendly form
so you notice what is going into git:

```
warning: npm:some-heavy-package@2.1.0 bundles to 1.4 MB, which will be committed into your git repository
```

The install proceeds normally - the warning is just a nudge to double-check that a dependency this
large is worth committing, or a prompt to look for a lighter alternative.

## Packages built with imp

A component published from another imp project built for an imp host (see **[the CLI docs](cli.md)**
on `targetImpHost`) contains bare `import { div } from 'imp/html'` statements, deliberately left
unresolved so the component shares the application's copy of imp instead of carrying its own.

`imp install` honors that contract: a bare `imp` or `imp/...` import is the one specifier never
resolved against a registry - it always means the imp library your toolchain ships, never an npm
package that happens to be called `imp`. The import is kept bare in the vendored bundle, and your
app provides it the same way it provides it to your own code: through the import map in development,
and through your own `imp build` in production.

Everything else a package imports is bundled in at install time from the package's own dependency
graph, exactly as declared by its author - your `imp.json` aliases play no part in how a package's
internals resolve. `imp` is the only external.

When a package expects imp, the install listing says so:

```
installed counter (npm:some-imp-counter@1.0.0)
  dependencies/counter/counter.js (2.1 kB)
  bundled packages:
    some-imp-counter@1.0.0
  imp imports kept bare (resolved by this app at runtime): imp
    note: this package runs against the imp version this app provides, not the one it was built with
```

That note is worth taking seriously: the component runs against your imp version, which may be newer
or older than the one its author developed against - after upgrading imp, exercise the installed
components that expect it.

## The `dependencies/` folder

`dependencies/` holds one subfolder per dependency, named after its alias. Each subfolder contains
that dependency's self-contained bundle plus any assets the package needs - a `.wasm` binary, CSS,
images, fonts - emitted as sibling files, so removing the folder removes the dependency completely.

An asset a package **imports** is carried into the production build automatically, content-hashed
under `assets/`. An asset a package instead loads by URL at runtime is not something the build can
see: copy it into your `public/` folder so it ships (see
**[The `public/` folder](cli.md#the-public-folder)**).

**Commit this folder.** It is deliberately cheap to keep in git: unlike a `node_modules` tree, it
stores only the code that is actually reachable from your imports, already bundled and minified -
one small file per dependency, not thousands. In exchange you get:

- **Offline everything.** The dev server and CI never talk to a package registry; a fresh clone is
  the whole, runnable app.
- **Reproducibility from bytes.** There is no lock file. The committed bundle _is_ the frozen state
  of the dependency - what you tested is what every machine runs, because it is the same bytes.
- **Reviewable updates.** A dependency change shows up in code review as a change to its pin in
  `imp.json` and to its bundle.

Committed does not mean maintained by you: `imp lint` and `imp fmt` skip the folder, so a package's
minified bundle never reports findings against your code or gets reformatted under you. The one
check that still looks at it is the file-size limit, since the bundle lands in git.

**A package's license notice stays in its bundle.** Minifying normally throws those comments away;
`imp install` keeps them, because the notice has to survive all the way to what your users download.
`imp build` picks it up from there and collects it into your app's `LICENSES.txt` - see
**[License notices](cli.md#license-notices)**. Leave the notice where it is.

## The dependency manifest

Beside every bundle sits a `manifest.json` describing it. The bundle is minified and self-contained,
which makes it unreadable: you cannot tell by looking what went into it, and re-running
`imp install` does not tell you either, because it resolves the latest transitive versions again
rather than the ones you shipped. The manifest is what answers the question instead.

```json
{
  "alias": "micromark",
  "specifier": "npm:micromark@4.0.2",
  "installedAt": "2026-08-27T09:14:02Z",
  "impImports": [],
  "packages": [
    {
      "registry": "npm",
      "name": "micromark",
      "version": "4.0.2",
      "license": "MIT",
      "licenseText": "..."
    }
  ]
}
```

Every package that went into the bundle is listed with its exact version, its license identifier and
that license's full text. Commit it with the bundle; `imp uninstall` removes it along with
everything else in the folder.

It is written when you install, and it describes what you installed - it is not a lock file and
nothing reads it back to pin a version. That means you can answer, from a fresh clone and with no
network:

- **What am I shipping?** Every package and exact version, for an inventory or a software bill of
  materials.
- **Am I affected?** When an advisory names a package and version, the answer is in the repository
  rather than in a rebuild.
- **May I ship this?** Every license identifier and text, which is also what `imp build` folds into
  your app's `LICENSES.txt`.

If a package declares no license at all, `imp install` says so and names it, rather than passing
over it quietly. That is a question to settle with the package's author before you ship.

## The license policy

Shipping a bundled SPA distributes every package inside it, so a copyleft dependency can oblige you
to publish your own source. imp checks for that before it becomes your problem. The `licenses` key
in `imp.json` says what you accept:

```json
{ "licenses": "permissive" }
```

`"permissive"` is the default, so the check is on even if you never configure it. Three tiers, each
including the ones before it:

| Value             | Accepts                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `"permissive"`    | MIT, ISC, BSD, Apache-2.0, 0BSD, Unlicense, CC0, Zlib and similar |
| `"weak-copyleft"` | the above plus MPL, LGPL, EPL, CDDL                               |
| `"any"`           | everything, including GPL, AGPL and SSPL - no check               |

If a tier is not the distinction you want to draw, give your own list of SPDX identifiers instead,
and anything not on it is refused:

```json
{ "licenses": ["MIT", "ISC", "Apache-2.0"] }
```

Both `imp install` and `imp build` enforce it. Install fails before the bundle is written, so a
package you may not ship never lands in your repository:

```
imp install axe-core

  1 bundled package falls outside the 'permissive' license policy:
    axe-core@4.8.2 is MPL-2.0, which is weak copyleft
  set 'licenses' in imp.json to 'weak-copyleft' to allow it
```

The build runs the same check against every dependency it bundles, which is what catches a
dependency someone else added, or a policy you tightened after the fact.

Two details worth knowing:

- **A choice of licenses counts as the most permissive one you could take.** A package published as
  `(BSD-3-Clause OR GPL-2.0)` passes the permissive tier, because you may take the BSD terms.
  Conversely a package licensed under several at once must satisfy all of them.
- **A license imp cannot identify is reported, never silently allowed or refused.** `imp install`
  warns and names the package; the build does not fail on it. This covers every JSR package, since
  JSR publishes no license identifier. imp will not block you over something it merely failed to
  read, and it will not pretend it checked.

## Choosing dependencies well

Each dependency is bundled independently and self-contained, so two packages that share an internal
dependency each carry their own copy of it. This holds in production too: `imp build` ships each
dependency's bundle as-is and never merges shared internals across dependencies. That is a
deliberate choice, not a missing feature - merging would mean re-resolving packages at build time,
giving up the offline, reproducible-from-your-repository build - and it reflects how imp expects
apps to be built: with few dependencies, so there is little overlap to merge in the first place. If
shipped weight from overlapping dependencies becomes noticeable, treat it as a prompt to drop or
consolidate dependencies rather than something a build option will solve.

For stateless utility libraries the duplication is harmless. Libraries built around a
**singleton** - one shared instance that several packages are supposed to see - can break in subtle
ways: state written through one copy is invisible through the other, and `instanceof` checks fail
across copies. If you need a shared library, install it once yourself and pass instances to the code
that needs it, or choose packages that don't rely on shared module state.

Two more things to know:

- A package that fetches its assets at runtime from a CDN (rather than importing them) is not fully
  vendored and will still hit the network - a poor fit for the offline guarantee.
- imp assumes you lean on dependencies as little as possible. In the AI era, an agent can write and
  maintain a small, purpose-built module for your app faster than you can vet a package - so before
  reaching for a registry, consider having your agent write the code instead. Fewer dependencies
  mean less code shipped to the browser and a codebase your agent understands completely.

## Lint enforcement

`imp lint` keeps the model honest: every entry in `dependencies` must pin an exact version, inline
`npm:`/`jsr:` specifiers in import statements are errors (install the package instead), and a bare
import that doesn't match a declared dependency is an error suggesting the `imp install` command to
fix it. See **[Linting](lint.md)**.
