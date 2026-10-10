# imp - Managing dependencies

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

imp vendors your dependencies. `imp install` downloads a package and bundles it into a single
minified module that the browser can run. It stores that bundle inside your project, in a
`dependencies/` folder that you commit with your code. After that, the dependency is part of your
repository. To start the dev server, to run CI, or to clone the project again, you need no package
installation and no network access.

## How to add a dependency

```
imp install mitt
```

This command resolves the latest release of the `mitt` package from npm. It bundles the package,
writes the bundle to `dependencies/mitt/mitt.js`, and records the exact version it resolved in
`imp.json`:

```json
{
  "dependencies": { "mitt": "npm:mitt@3.0.1" }
}
```

Your code imports the package by its bare name. There is no version and no URL:

```js
import mitt from 'mitt'
```

The name on the left of the `imp.json` entry is the **alias**. It is the specifier that your imports
use, and the name of the subfolder of the dependency. It defaults to the package name. To choose
your own alias, pass `--alias`:

```
imp install mitt --alias events
```

One name is reserved. `imp` always means the imp library itself, which every app can already import.
You cannot install `imp` as a dependency, and you cannot use it as an alias.

An alias is one folder name. It holds letters, digits, `.`, `_` and `-` only. It must not start with
`.`, and it must not contain `..`, `/` or `\`. So an alias cannot point at a folder outside
`dependencies/`. imp refuses an `imp.json` with any other alias.

## How to pin a version

To install a specific version, attach the version to the package name, or pass it as a second
argument. The two forms are equivalent:

```
imp install mitt@3.0.1
imp install mitt 3.0.1
```

A version is always exact, such as `3.0.1`. It is never `^3` or `3`. When you leave the version out,
imp resolves the latest release and pins the exact version it found. `imp.json` always records
exactly what is in the bundle.

## npm and jsr

A package name refers to npm by default. `imp install mitt` means `npm:mitt`. To install from the
jsr registry, add the `jsr:` prefix:

```
imp install jsr:@std/encoding
```

A specifier can also name a module inside the package. The bundle then contains exactly that module:

```
imp install jsr:@std/encoding@1.0.10/base64
```

This installs under the alias `base64`, the last path segment. So you write:

```js
import { encodeBase64 } from 'base64'
```

## How to update

To update a declared dependency, install it again with no version. imp moves the package, and
everything it depends on internally, to the latest release:

```
imp install mitt
```

`imp install` with no argument updates **every** declared dependency the same way:

```
imp install
```

One command refreshes your whole dependency surface. The diff in `imp.json` and in `dependencies/`
shows exactly what changed. imp resolves, bundles and checks every package first. It writes the
folders and `imp.json` only when every package passed. So when one package fails, nothing changes,
and your dependencies never mix old and new versions.

The write is also all or nothing. imp writes every new folder into a temporary folder in `.imp/`
first. Then it moves each old folder aside, moves each new folder into place, and updates
`imp.json`. When one of these steps fails, for example because the disk is full, imp moves the old
folders back and restores `imp.json`. The command then fails with the cause.

## How to remove a dependency

```
imp uninstall mitt
```

This command deletes the whole `dependencies/mitt/` folder of the dependency, and removes its entry
from `imp.json`.

## What `imp install` prints

Every install prints the files imp wrote, and the exact version of every package that went into the
bundle. That includes the package you asked for, and everything it brought in:

```
installed micromark (npm:micromark@4.0.2)
  dependencies/micromark/micromark.js (52.1 kB)
  dependencies/micromark/manifest.json (packages, versions, licenses)
  bundled packages:
    decode-named-character-reference@1.3.0 - MIT
    micromark@4.0.2 - MIT
    micromark-core-commonmark@2.0.3 - MIT
    ...
  integrity: 12 npm packages checked against the signed hash of the npm registry
```

Read the listing to see what you ship. When the registry lists a provenance attestation for a
package, the package shows `attestation listed by the registry` after its license. imp does not
verify that attestation. imp also writes the same listing to disk, so it stays there long after the
terminal scrolls away. See **[The dependency manifest](#the-dependency-manifest)**.

## The integrity check

`imp install` checks every npm package before it writes anything. For each package in the bundle,
imp does these steps:

1. It reads the `integrity` hash that the npm registry publishes for that exact version.
2. It checks the registry signature of that hash. The npm registry signs the package name, the
   version and the hash with its own key. imp reads the public keys of the registry and verifies the
   signature.
3. It downloads the package archive, and compares its hash with the published hash.
4. It compares every file that went into the bundle with the same file in that archive.

When one of these checks fails, imp refuses the install and names the package. It writes no bundle
and no manifest, and it does not change `imp.json`. So a changed archive, or a changed copy of a
file on your machine, never reaches the `dependencies/` folder.

A package with no registry signature fails the check. A signature from a key that the registry does
not list also fails. The registry retires a key on a date. A retired key is valid only for a version
that was published before that date.

The checks prove that the archive is the one that the npm registry signed. They do not prove that
the author published safe code. imp reads the keys from the same registry, so the checks also trust
that registry.

imp also records whether the registry lists a provenance attestation for the version. An attestation
links a published version to the source repository and the build that made it. imp records only that
the registry lists one. It does not verify the attestation, and it does not refuse a package that
has none.

The checks cover npm packages. For a jsr package, imp records whether the registry lists an
attestation, but a jsr package has no archive hash to check.

## Large dependencies

You commit a vendored bundle to your repository, so imp warns you when a package is heavy. When a
dependency bundles to more than **200 kB**, `imp install` prints its size in a readable form. You
see what goes into git:

```
warning: npm:some-heavy-package@2.1.0 bundles to 1.4 MB, which will be committed into your git repository
```

The install continues normally. The warning asks you to check that a dependency of this size is
worth a commit, or to look for a lighter alternative.

## Packages built with imp

A component that another imp project publishes for an imp host contains a bare
`import { div } from 'imp/html'` statement. See **[the CLI docs](cli.md)** on `targetImpHost`. The
author leaves the import unresolved on purpose, so the component shares the copy of imp of the
application, instead of carrying its own copy.

`imp install` keeps that contract. A bare `imp` or `imp/...` import is the one specifier imp never
resolves against a registry. It always means the imp library your toolchain ships. It never means an
npm package named `imp`. imp keeps the import bare in the vendored bundle. Your app provides the
library the same way it provides it to your own code: through the import map in development, and
through your own `imp build` in production.

imp bundles in everything else that a package imports, at install time, from the dependency graph of
the package, exactly as its author declared it. The aliases in your `imp.json` play no part in how
the internals of a package resolve. `imp` is the only external.

**A package that keeps a bare `imp` import is an imp component, and it ships its manual.** Its
author builds it with `imp build`, which writes `imp-skill.md` beside the bundle. The author
publishes that file next to the entry module of the package, which is the file that the specifier
resolves to. `imp install` copies it into `dependencies/<alias>/`, beside the bundle and
`manifest.json`. A missing `imp-skill.md` stops the install, and the message names it:

```
npm:some-imp-counter@1.0.0 imports imp, so it is an imp component, and it has no imp-skill.md next to its entry module - its author builds it with imp build, which writes imp-skill.md beside the bundle, and publishes it with the bundle
```

A package that does not import imp gets no `imp-skill.md`. In your app, `imp skill counter` prints
the manual of the component, as it is. See
**[`imp skill`](cli.md#imp-skill---the-manuals-for-an-ai-agent)**. The manual is only as current as
the release that shipped it.

The `zones` and `outcomes` of the `app-analytics.json` of your app hold only the names in your own
code. They do not hold the zone and outcome names of an installed component. So your analytics store
drops the records of a zone or an outcome that only an installed component sends, see
**[Analytics](analytics.md)**.

When a package expects imp, the install listing says so:

```
installed counter (npm:some-imp-counter@1.0.0)
  dependencies/counter/counter.js (2.1 kB)
  dependencies/counter/imp-skill.md (1.4 kB)
  dependencies/counter/manifest.json (packages, versions, licenses)
  bundled packages:
    some-imp-counter@1.0.0 - MIT
  imp imports kept bare (resolved by this app at runtime): imp
    note: this package runs against the imp version this app provides, not the one it was built with
```

Take that note seriously. The component runs against your imp version, which can be newer or older
than the version its author developed against. After you update imp, test the installed components
that expect it.

## The `dependencies/` folder

`dependencies/` holds one subfolder per dependency, named after its alias. Each subfolder contains
the self-contained bundle of that dependency, and every asset the package needs. An asset can be a
`.wasm` binary, CSS, an image or a font. imp emits each asset as a sibling file. When you remove the
folder, you remove the dependency completely.

imp carries an asset that a package **imports** into the production build automatically, with a
content hash, under `chunks/`. The build cannot see an asset that a package instead loads by URL at
runtime. Copy that asset into your `public/` folder, so it ships. See
**[The `public/` folder](cli.md#the-public-folder)**.

**Commit this folder.** It is cheap to keep in git on purpose. A `node_modules` tree stores
thousands of files. This folder stores only the code that your imports reach, already bundled and
minified: one small file per dependency. In exchange you get these benefits:

- **Everything works offline.** The dev server and CI never talk to a package registry. A fresh
  clone is the whole app, and it runs.
- **Reproducibility from the bytes.** There is no lock file. The committed bundle is the frozen
  state of the dependency. What you tested is what every machine runs, because it is the same bytes.
- **Updates that you can review.** A change to a dependency appears in code review as a change to
  its pin in `imp.json`, and a change to its bundle.

Committed does not mean that you maintain it. `imp lint` and `imp fmt` skip the folder. The minified
bundle of a package never reports a finding against your code, and imp never reformats it. The one
check that still reads it is the file-size limit, because the bundle goes into git.

**The license notice of a package stays in its bundle.** Minification normally removes such a
comment. `imp install` keeps it, because the notice must survive to what your users download.
`imp build` collects it from there into the `LICENSES.txt` of your app. See
**[License notices](cli.md#license-notices)**. Leave the notice where it is.

## The dependency manifest

Beside every bundle sits a `manifest.json` that describes the bundle. The bundle is minified and
self-contained, so you cannot read it, and you cannot tell from it what went in. A new `imp install`
does not tell you either, because it resolves the latest transitive versions again, not the versions
you shipped. The manifest answers the question instead.

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
      "integrity": "sha512-...",
      "attestationListed": false,
      "license": "MIT",
      "licenseText": "..."
    }
  ]
}
```

The manifest lists every package that went into the bundle, with its exact version, the integrity
hash that imp checked, whether the registry lists a provenance attestation, its license identifier,
and the full text of that license. A jsr package has `null` as its `integrity`. Commit it with the
bundle. `imp uninstall` removes it with everything else in the folder.

imp writes the manifest when you install, and it describes what you installed. It is not a lock
file, and nothing reads it back to pin a version. So you can answer these questions from a fresh
clone, with no network:

- **What do I ship?** Every package and its exact version, for an inventory or a software bill of
  materials. `imp audit --sbom` writes that bill for you.
- **Does this affect me?** When an advisory names a package and a version, the answer is in the
  repository. You do not need a rebuild. `imp audit` checks every package for you.
- **Can I ship this?** Every license identifier and its text. `imp build` folds the same data into
  the `LICENSES.txt` of your app.

When a package declares no license, `imp install` says so and names the package. It does not skip
past the package in silence. Settle that question with the author of the package before you ship.

## How to audit your dependencies

```
imp audit
imp audit --sbom [--output <file>]
```

`imp audit` reads the manifest of every declared dependency and checks each npm package against the
[OSV database](https://osv.dev) of known vulnerabilities. OSV is free, and needs no account and no
key. imp sends only the name and the version of each package.

```
node-forge@0.7.0 (in node-forge)
  GHSA-5rrq-pxf6-6jx5 LOW Prototype Pollution in node-forge debug API. - fixed in 1.0.0
    https://osv.dev/vulnerability/GHSA-5rrq-pxf6-6jx5
1 known vulnerability in 1 npm package, of 12 checked
```

For each vulnerability, imp prints its identifier, its severity when the database gives one, a
summary, the first version that fixes it, and a link to the full advisory. To fix a finding, install
the fixed version with `imp install <package>@<version>`. For a package that another package brings
in, update the dependency that contains it.

The exit code tells a CI step what happened:

| Code | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| `0`  | imp checked every npm package and found no known vulnerability           |
| `1`  | imp found at least one known vulnerability                               |
| `2`  | the audit did not complete, so imp cannot say whether a package is clean |

The audit does not complete when a declared dependency has no manifest, because imp has no record of
what that bundle contains. Run `imp install` to write the manifest. The audit also does not complete
when the OSV database does not answer. imp tries a request again when OSV is busy or has a server
error. It waits as long as OSV asks, and it stops after four attempts.

When `imp.json` declares no dependencies, `imp audit` says so and exits with code 0. Your app then
vendors no package, so there is nothing to check.

The OSV database has no records for jsr packages. `imp audit` lists them as not checked. When every
dependency is a jsr package, the report says that there are no npm packages to check.

### A software bill of materials

`imp audit --sbom` writes a software bill of materials in the [CycloneDX](https://cyclonedx.org) 1.7
JSON format. The default file is `sbom.cdx.json` in the root of the project. `--output` writes it to
another path. This command needs no network, because it only transforms the committed manifests.
When a declared dependency has no manifest, the bill would be incomplete. imp then writes no file,
and exits with code 2.

The file lists every bundled package once, with its version, its package URL, its license and the
integrity hash that `imp install` checked. Give it to a security review, or to a scanner that reads
CycloneDX. imp does not write the SPDX format.

## The license policy

A bundled SPA that you ship distributes every package inside it. A copyleft dependency can then
oblige you to publish your own source. imp checks for that before it becomes your problem. The
`licenses` key in `imp.json` says what you accept:

```json
{ "licenses": "permissive" }
```

`"permissive"` is the default, so the check runs even when you configure nothing. There are three
tiers, and each one includes the tiers before it:

| Value             | Accepts                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `"permissive"`    | MIT, ISC, BSD, Apache-2.0, 0BSD, Unlicense, CC0, Zlib and similar |
| `"weak-copyleft"` | the above plus MPL, LGPL, EPL, CDDL                               |
| `"any"`           | everything, including GPL, AGPL and SSPL - no check               |

When a tier is not the line you want to draw, give your own list of SPDX identifiers instead. imp
then refuses anything that is not on the list:

```json
{ "licenses": ["MIT", "ISC", "Apache-2.0"] }
```

`imp install` and `imp build` both enforce the policy. An install fails before imp writes the
bundle, so a package you must not ship never arrives in your repository:

```
imp install axe-core

  1 bundled package falls outside the 'permissive' license policy:
    axe-core@4.8.2 is MPL-2.0, which is weak copyleft
  set 'licenses' in imp.json to 'weak-copyleft' to allow it
```

The build runs the same check against every dependency it bundles. That check catches a dependency
somebody else added, and a policy you made stricter later.

Two details are worth knowing:

- **A choice of licenses counts as the most permissive license you can take.** A package published
  as `(BSD-3-Clause OR GPL-2.0)` passes the permissive tier, because you can take the BSD terms. A
  package licensed under several licenses at the same time must satisfy all of them.
- **imp reports a license it cannot identify. It never allows or refuses it in silence.**
  `imp install` warns and names the package. The build does not fail. This covers every JSR package,
  because JSR publishes no license identifier. imp does not block you over something it only failed
  to read, and it does not pretend that it checked.

## How to choose a dependency well

imp bundles each dependency on its own, and each bundle is self-contained. Two packages that share
an internal dependency each carry their own copy of it, and this also holds in production.
`imp build` ships the bundle of each dependency as it is. It never merges shared internals across
two dependencies. This choice is deliberate, not a missing feature. A merge would mean imp resolves
the packages again at build time, and that gives up the offline build that is reproducible from your
repository. The choice also matches how imp expects you to build an app: with few dependencies, so
there is little overlap to merge. When the shipped weight of overlapping dependencies becomes
visible, treat it as a reason to remove or consolidate dependencies. No build option solves it.

For a stateless utility library, the duplication is harmless. A library built around a
**singleton**, one shared instance that several packages must see, can break in ways that are hard
to find. State written through one copy is invisible through the other, and an `instanceof` check
fails across the two copies. When you need a shared library, install it once yourself and pass the
instances to the code that needs them. You can also select a package that does not use shared module
state.

Two more points are worth knowing:

- A package that fetches its assets from a CDN at runtime, instead of importing them, is not fully
  vendored. It still uses the network, which does not suit the offline guarantee.
- imp expects you to use as few dependencies as possible. In the AI era, an agent can write and
  maintain a small module for your app, for one purpose, faster than you can vet a package. Before
  you go to a registry, consider that your agent can write the code instead. Fewer dependencies mean
  less code in the browser, and a codebase that your agent understands completely.

## Lint enforcement

`imp lint` keeps the model correct. Every entry in `dependencies` must pin an exact version. An
inline `npm:` or `jsr:` specifier in an import statement is an error, and you must install the
package instead. A bare import that matches no declared dependency is an error, and the message
suggests the `imp install` command that fixes it. See **[Linting](lint.md)**.
