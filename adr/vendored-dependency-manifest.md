# Every vendored dependency records what it bundled - dependencies/<alias>/manifest.json

## Context

`vendored-dependencies.md` froze an app's dependencies as committed bytes and deliberately declined
a lock file: the bundle _is_ the frozen state, so nothing needs to re-derive it. That settles
reproducibility, and it leaves a different question unanswered - not "will I get the same bytes
tomorrow?" but "what is in these bytes?".

Nothing recorded the answer. `imp install` resolved the full transitive graph, printed it to stdout,
and discarded it. From a fresh clone the graph was gone, and it was gone in a way no later command
could recover: the vendored artifact is a single minified bundle, not a package tree, so there is no
`node_modules` to read back and no version string to grep for. Re-running `imp install` does not
recover it either - transitive versions resolve to latest again, so the inspected graph would not be
the shipped one, and the evidence would be overwritten in the act of looking. The printed audit
record survived only as terminal scrollback.

That left three things unanswerable from the repository. Which packages and versions is this app
shipping - for an SBOM, or when a CVE lands against a transitive package. Under what licenses - a
question `built-app-license-notices.md` could only answer for packages that happen to carry a
`/*! */` or `@license` header, which is not the common shape for small MIT packages; a package whose
license lives only in a `LICENSE` file contributed nothing to `LICENSES.txt`, silently. And whether
any of it is licensed on terms the team cannot ship.

The vendoring model makes this sharper rather than softer. A registry-installed project can always
read the resolved graph back out of the tree on disk; imp resolves the graph once and then destroys
it. Freezing the bytes removed the fallback that would have made recording them optional.

## Decision

`imp install` writes a manifest beside every vendored bundle - `dependencies/<alias>/manifest.json`,
committed like the bundle it describes.

- **It describes the committed bytes; it does not constrain the next install.** This is not a lock
  file and does not reintroduce one. `vendored-dependencies.md` stands unchanged: the bundle remains
  the frozen state, `imp install` still re-resolves transitive versions to latest, and nothing reads
  the manifest to pin anything. A dependency update shows the graph change as a diff.
- **One manifest per top-level dependency**, inside that dependency's folder, so `imp uninstall`
  removes it with everything else and each folder stays self-contained. Two dependencies sharing a
  transitive package each record it.
- **What it records:** the alias, the exact resolved specifier, an install timestamp, the bare `imp`
  imports kept in the bundle, and every package that went into it - registry, name, exact version,
  SPDX identifier and full license text.
- **License data is read at vendor time, from the resolved package itself**, which is the only
  moment imp has the package rather than the bundle. For an npm package that is `license` in its
  `package.json` and its `LICENSE` file, read from the resolved package directory. For a JSR package
  it is the license file named in the published version manifest; JSR publishes no SPDX identifier,
  so the identifier is recorded as absent rather than guessed.
- **A package with neither an identifier nor license text is reported, not hidden.** `imp install`
  warns, naming each package, so the gap is visible when it is introduced rather than at an audit.

`imp build` merges the recorded notices with the legal comments it already collects, into the same
`LICENSES.txt` under two headings: the packages recorded at install time, and the notices carried in
the bundled code. Both are reproduced verbatim.

- **Which manifests are read is decided by the build graph, not the dependency list.** The build
  reads its own metafile and takes manifests only for the vendored bundles that were actually
  linked, so a declared but unimported dependency contributes no notice.
- **A bundled dependency with no manifest warns.** Its licenses are absent from `LICENSES.txt`, and
  a silently short notice file is the failure this decision exists to prevent.
- **The two sources are kept side by side, not deduplicated against each other.** A package's header
  banner and its license file are different artifacts and both may be required to travel; imp
  reproduces what it found rather than judging one redundant.

## Consequences

- A fresh clone answers "which versions of what am I shipping, under what license?" without a
  network call, a registry, or a rebuild. SBOM export, vulnerability scanning and a license policy
  gate all become transforms over data already in the repository.
- Attribution is complete for the common case it used to miss. A package whose license lives only in
  a `LICENSE` file is now reproduced in `LICENSES.txt`; previously it contributed nothing and
  nothing said so.
- `LICENSES.txt` grows - full license texts rather than one-line banners, roughly a kilobyte per
  package. It is a legal artifact read by a person, not a payload, and completeness beats brevity.
- The manifest records the graph at install time; it cannot detect that the bundle was later edited
  by hand. It describes the bytes in good faith, and the bytes are reviewable in the same diff.
- `imp install` does one network round trip per JSR package to fetch its license text. npm packages
  cost nothing extra - the resolved package is already on disk from bundling.
- A package that declares no license at all is recorded as such and warned about. imp does not
  infer, normalize, or repair an SPDX identifier; an absent identifier stays absent.
