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
  package it records the name, the exact version, the integrity hash that imp checked, whether the
  registry lists a provenance attestation (`attestationListed`), the SPDX identifier and the full
  licence text.
- **imp checks every npm package before it writes the manifest.** TLS alone proves only that the
  bytes came from the registry host. So imp reads the `dist.integrity` hash of the exact version
  from the npm registry. It downloads the package archive and compares its hash with that value.
  Then it compares every file that went into the bundle with the same file in the archive. So the
  check covers the bytes that imp really bundled, and not only an archive that imp downloaded for
  the check. On a mismatch, `imp install` refuses the install and writes nothing. That is the same
  standard that `imp update` applies to the binary of imp, see `binary-distribution.md`.
- **imp verifies the registry signature of the hash.** The hash and the archive come from the same
  registry, so a hash check alone cannot detect a changed pair. The npm registry signs the string
  `<name>@<version>:<integrity>` with an ECDSA P-256 key, in `dist.signatures`. imp reads the public
  keys from `https://registry.npmjs.org/-/npm/v1/keys` once per install, and verifies each signature
  with WebCrypto. A version with no signature, a signature from a key that the registry does not
  list, and a signature that does not verify, each fail the install. A key with an `expires` date is
  valid only for a version that was published before that date. imp reads the publish time from the
  full package document of the registry, and only when the key has such a date. The npm client
  applies the same expiry rule.
- **imp records whether the registry lists a provenance attestation. It does not verify it.** For an
  npm package, the field is `true` when the version has `dist.attestations.provenance`. imp does
  not check the Sigstore bundle, so the field claims only what the registry lists. Most packages
  publish no attestation yet, so a requirement would block the common case.
- **imp reads the licence data at vendor time, from the resolved package itself.** That is the only
  moment when imp has the package, and not the bundle. imp reads the `license` field of its
  `package.json`, and its `LICENSE` file, from the resolved package directory. When the package
  declares no SPDX identifier, imp records the identifier as absent. It does not guess one.
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
- The attribution is complete for the common case. A package whose licence lives only in a `LICENSE`
  file appears in `LICENSES.txt`.
- `LICENSES.txt` grows. It holds a full licence text in place of a banner of one line, which is
  about one kilobyte per package. It is a legal artifact that a person reads, and not a payload. So
  completeness beats brevity.
- The manifest records the graph at install time. It cannot detect that somebody edited the bundle
  by hand later. It describes the bytes in good faith, and a reviewer sees the bytes in the same
  diff.
- `imp install` makes network requests per package. It fetches the metadata of the version and the
  archive, for the integrity check. It fetches the full package document when the signing key has
  an expiry date. That document can be large for a package with many versions. The install already
  needs the network, so this adds time and no new requirement.
- The checks prove that the npm registry signed the hash of the archive that imp bundled. They
  detect an archive, a hash or a local copy that differs from what the registry signed. imp reads
  the keys from the same registry, so the checks trust that registry. They do not detect a malicious
  version that the author published. A review of the diff of the bundle addresses that.
- imp records a package that declares no licence as such, and warns about it. imp does not infer,
  normalize or repair an SPDX identifier. An absent identifier stays absent.
