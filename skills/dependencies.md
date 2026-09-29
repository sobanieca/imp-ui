# dependencies - vendoring packages into `dependencies/`

```
imp install [package[@version]] [version] [--alias name]
imp uninstall <package>
```

`imp install` downloads a package and bundles it into one minified module that the browser can run.
It writes the bundle under `dependencies/<alias>/` and pins the exact version in `imp.json`. You
**commit** that folder. So a fresh clone is the whole app, and it runs. imp needs no registry access
in development, in CI or in the build.

```
imp install mitt              latest, pinned exactly
imp install mitt@3.0.1        a specific version (imp install mitt 3.0.1 is equivalent)
imp install jsr:@std/encoding@1.0.10/base64    jsr, and a module inside the package
imp install mitt --alias events
imp install                   re-resolve and update every declared dependency
imp uninstall mitt            remove the folder and the pin
imp audit                     check npm packages against OSV; exit 1 on a finding, 2 if incomplete
imp audit --sbom              write sbom.cdx.json (CycloneDX 1.7); --output <file> moves it
```

```json
{ "dependencies": { "mitt": "npm:mitt@3.0.1" } }
```

```js
import mitt from 'mitt'
```

## Rules an agent gets wrong

- **Import by the bare alias only.** Never write `import mitt from 'npm:mitt@3.0.1'`. Never use a
  URL or a path into `dependencies/`. An inline registry specifier is an
  `imp/exact-dependency-versions` lint error.
- **A bare import that is not a declared alias is a lint error.** The error names the `imp install`
  command to run. See [lint](lint.md). Add a package with the command. Never edit `imp.json` by
  hand, see [config](config.md).
- **A failed `imp install` changes nothing.** With no argument, imp checks every package before it
  writes. It stages the new folders in `.imp/`, then swaps them in and updates `imp.json`. A failure
  at any step restores every folder and `imp.json`. Fix the cause and run it again.
- **A pin is always exact.** Write `npm:mitt@3.0.1`. Never write `^3.0.1`, `3` or a bare `npm:mitt`.
  There is no lock file. The pin and the committed bundle give the reproducibility.
- **`imp` is reserved.** It always means the imp library of [imports](imports.md). You can never
  install it or use it as an alias. It stays bare inside a vendored bundle that imports it.
- **Prefer to write the code.** imp expects few dependencies. An agent can write and maintain a
  small module for one purpose faster than a team can vet a package. The module also ships less code
  to the browser.
- To update a package, run `imp install <pkg>` again with no version.

## What you get in the repository

`dependencies/<alias>/` holds the self-contained bundle, a `manifest.json`, and every asset that the
package needs as a sibling file. An asset can be a `.wasm` file, a stylesheet or a font. So when you
delete the folder, you remove the dependency completely. The default alias is the package name. For
a subpath install it is the last path segment. The alias is both the import specifier and the folder
name.

```
installed micromark (npm:micromark@4.0.2)
  dependencies/micromark/micromark.js (52.1 kB)
  dependencies/micromark/manifest.json (packages, versions, licenses)
  bundled packages:
    micromark@4.0.2 - MIT
    micromark-core-commonmark@2.0.3 - MIT
  integrity: 2 npm packages checked against the signed hash of the npm registry
```

`manifest.json` records the same resolution on disk. It holds the alias, the resolved specifier, the
install timestamp, the bare `imp` imports that imp kept, and every bundled package. For each package
it gives the registry, the exact version, `integrity` (the checked SRI hash, `null` for jsr),
`attestationListed` (`true` when the registry lists a provenance attestation), the SPDX identifier
and the full license text.

- **`imp install` refuses a package that fails the integrity check.** It verifies the npm registry
  signature of the `dist.integrity` hash. It compares the npm archive with that hash, and every
  bundled file with that archive. On a missing or invalid signature, or a mismatch, it writes
  nothing. Never work around it. Report it, because the package or the local cache was changed.
- **imp does not verify a provenance attestation.** `attestationListed` says only that the registry
  lists one. A package with no attestation is not an error.

- **Commit the manifest with the bundle.** It is the only record of what the minified bundle
  contains. A new `imp install` resolves a transitive version to the latest one, so it cannot
  reproduce the manifest.
- **The manifest is not a lock file.** Nothing reads it back to pin a version. It describes the
  committed bytes.
- **Read it to learn which versions of what, under which license.** `imp build` folds its licenses
  into the `LICENSES.txt` of the app, see [build](build.md).
- **Never edit or delete the manifest by hand.** For a bundled dependency with no manifest,
  `imp build` warns and leaves its licenses out of `LICENSES.txt`. `imp install` writes the manifest
  again.

The bundle also keeps the license notice of the package, `/*! ... */` or `@license`, where the
package put it. Never remove it.

## Audit - `imp audit`

- It reads the committed manifests only. A dependency with no manifest fails the audit. Run
  `imp install` to record it.
- Exit codes: `0` no known vulnerability, `1` a vulnerability found, `2` the audit did not complete.
  Code `2` means a missing manifest, or no answer from OSV after four attempts. Never treat `2` as a
  pass.
- No dependencies in `imp.json` prints `nothing to audit` and exits `0`.
- It checks npm packages against OSV. A jsr package is listed as not checked, because OSV has no jsr
  records.
- To fix a finding, run `imp install <pkg>@<fixed version>`. For a transitive package, update the
  dependency that contains it. Then run `imp audit` again.
- `--sbom` needs no network and never fails on a vulnerability. A missing manifest makes it exit `2`
  and write no file. Commit the file only when the project wants it in git.

## License policy - `licenses` in `imp.json`

`imp install` and `imp build` both refuse a package outside the policy. The default is
`"permissive"`, so the gate works with no configuration.

| Value                    | Accepts                                                 |
| ------------------------ | ------------------------------------------------------- |
| `"permissive"` (default) | MIT, ISC, BSD-*, Apache-2.0, 0BSD, Unlicense, CC0, Zlib |
| `"weak-copyleft"`        | the above plus MPL-_, LGPL-_, EPL-_, CDDL-_             |
| `"any"`                  | everything, including GPL, AGPL, SSPL - no check        |
| `["MIT", "ISC", ...]`    | exactly these SPDX identifiers, nothing else            |

- **An install fails before imp writes anything.** There is no bundle and no `imp.json` entry. The
  rejected package leaves nothing behind. To fix the failure, widen `licenses` or select another
  package. Never edit a manifest by hand.
- **`OR` takes the most permissive branch. `AND` must satisfy every branch.** So
  `(BSD-3-Clause OR GPL-2.0)` passes `"permissive"`.
- **A license that imp cannot identify gives a warning, never a block.** This covers every JSR
  package, because JSR publishes no identifier. Check those terms yourself.

A bundle that is larger than `maxFileSize` gives a warning, because the bundle goes into git. The
default limit is 200 kB. To accept the bundle, raise `maxFileSize` or list the folder in
`maxFileSizeIgnore` in `imp.json`. `imp lint` enforces the same limit. Apart from that limit, every
command that walks the tree skips `dependencies/`. So `imp lint` and `imp fmt` never report or
rewrite the bundle of a package.

## Trade-offs to design around

- **imp bundles each dependency on its own.** So two packages that share an internal dependency each
  carry their own copy, in development and in `imp build`. This is harmless for a stateless utility.
  **A library that uses a singleton breaks in ways that are hard to see.** State written through one
  copy is invisible to the other, and `instanceof` fails across the two copies. Install such a
  library once yourself, and pass the instances around.
- **A package that fetches an asset from a CDN at runtime is not fully vendored.** It still uses the
  network.
- A package that is built for an imp host keeps its `imp` imports bare. The install listing says so.
  The component then runs against **your** imp version. Exercise it after an imp update.
