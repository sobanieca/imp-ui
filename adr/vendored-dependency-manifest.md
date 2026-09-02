# Every vendored dependency records what it bundled - dependencies/<alias>/manifest.json

## Context

`vendored-dependencies.md` froze the dependencies of an app as committed bytes, and it deliberately
refused a lock file. The bundle _is_ the frozen state, so nothing must derive it again. That settles
reproducibility. It leaves a different question open. The question is not "do I get the same bytes
tomorrow?". It is "what is in these bytes?".

Nothing recorded the answer. `imp install` resolved the full transitive graph, printed it to stdout,
and threw it away. From a fresh clone the graph was gone, and no later command could recover it. The
vendored artifact is one minified bundle, and not a package tree. So there is no `node_modules` to
read back, and no version string to search for. A second run of `imp install` does not recover the
graph either. A transitive version resolves to the latest again. So the graph that you inspect is
not the graph that you shipped, and the act of looking overwrites the evidence. The printed audit
record survived only as scrollback in a terminal.

That left three questions that a repository could not answer. Which packages and versions does this
app ship? A person needs that for a software bill of materials, and when a CVE lands against a
transitive package. Under which licences does it ship? `built-app-license-notices.md` could answer
that only for a package that happens to carry a `/*! */` comment or an `@license` marker, and that
is not the common shape for a small MIT package. A package whose licence lives only in a `LICENSE`
file contributed nothing to `LICENSES.txt`, and nothing said so. And is any of it licensed on terms
that the team cannot ship?

The vendoring model makes this sharper, and not softer. A project that installs from a registry can
always read the resolved graph out of the tree on disk. imp resolves the graph once, and then
destroys it. To freeze the bytes removed the fallback that would make a record optional.

## Decision

`imp install` writes a manifest beside every vendored bundle. It is
`dependencies/<alias>/manifest.json`, and you commit it, like the bundle that it describes.

- **It describes the committed bytes. It does not constrain the next install.** It is not a lock
  file, and it brings none back. `vendored-dependencies.md` does not change. The bundle stays the
  frozen state. `imp install` still resolves a transitive version to the latest one. Nothing reads
  the manifest to pin anything. An update to a dependency shows the change to the graph as a diff.
- **There is one manifest per top-level dependency**, inside the folder of that dependency. So
  `imp uninstall` removes it with everything else, and each folder stays self-contained. Two
  dependencies that share a transitive package each record that package.
- **What it records** is the alias, the exact resolved specifier, a timestamp of the install, the
  bare `imp` imports that stay in the bundle, and every package that went into the bundle. For each
  package it records the registry, the name, the exact version, the SPDX identifier and the full
  licence text.
- **imp reads the licence data at vendor time, from the resolved package itself.** That is the only
  moment when imp has the package, and not the bundle. For an npm package, imp reads the `license`
  field of its `package.json`, and its `LICENSE` file, from the resolved package directory. For a
  JSR package, imp reads the licence file that the published manifest of the version names. JSR
  publishes no SPDX identifier. So imp records the identifier as absent. It does not guess one.
- **imp reports a package that has neither an identifier nor a licence text. It does not hide it.**
  `imp install` warns, and names each such package. So the gap is visible when somebody introduces
  it, and not at an audit.

`imp build` merges the recorded notices with the legal comments that it already collects, into the
same `LICENSES.txt`, under two headings. The first heading holds the packages that imp recorded at
install time. The second holds the notices that the bundled code carries. imp reproduces both
without a change.

- **The build graph decides which manifests imp reads, and the list of dependencies does not.** The
  build reads its own metafile. It takes a manifest only for a vendored bundle that it really
  linked. So a dependency that you declare and do not import contributes no notice.
- **A bundled dependency with no manifest gives a warning.** Its licences are absent from
  `LICENSES.txt`. A file of notices that is short with no message is the failure that this decision
  exists to prevent.
- **imp keeps the two sources side by side. It does not compare them against each other.** The
  header banner of a package, and its licence file, are different artifacts, and both can be
  required to travel. imp reproduces what it found. It does not judge one of them redundant.

## Consequences

- A fresh clone answers the question "which versions of what do I ship, and under which licence?".
  There is no network call, no registry and no rebuild. An export of a software bill of materials, a
  scan for a vulnerability, and a gate on a licence policy, all become transforms over data that is
  already in the repository.
- The attribution is complete for the common case that it used to miss. A package whose licence
  lives only in a `LICENSE` file now appears in `LICENSES.txt`. Before, it contributed nothing, and
  nothing said so.
- `LICENSES.txt` grows. It holds a full licence text in place of a banner of one line, which is
  about one kilobyte per package. It is a legal artifact that a person reads, and not a payload. So
  completeness beats brevity.
- The manifest records the graph at install time. It cannot detect that somebody edited the bundle
  by hand later. It describes the bytes in good faith, and a reviewer sees the bytes in the same
  diff.
- `imp install` makes one network request per JSR package, to fetch its licence text. An npm package
  costs nothing extra, because the resolved package is already on disk from the bundling.
- imp records a package that declares no licence as such, and warns about it. imp does not infer,
  normalize or repair an SPDX identifier. An absent identifier stays absent.
