# imp audit - known vulnerabilities from OSV, and a CycloneDX bill of materials

## Context

Every vendored bundle records its packages, see `vendored-dependency-manifest.md`. The manifest
answers "which versions of what do I ship?", but only for a person who opens it and reads it. A
security review asks two further questions. Does a shipped package have a known vulnerability? And
can the team hand over a software bill of materials in a standard format? Both answers are
transforms over data that the repository already holds. Without a command, each team writes the same
script, or answers the questions by hand.

## Decision

One command, `imp audit`, reads the committed manifests of the declared dependencies.

- **The check uses the OSV database.** `imp audit` sends the name and the version of each npm
  package to `https://api.osv.dev/v1/querybatch`, in batches of 1000. When OSV splits the result of
  a package over pages, imp asks `/v1/query` for each next page until no page is left. It then reads
  each advisory that OSV returns. OSV needs no account and no key, and it merges the GitHub advisory
  database with other sources. imp sends nothing else.
- **The report is one block per affected package.** Each advisory shows its identifier, its severity
  when the source gives one, its summary, the first version that fixes it, and a link to the
  advisory. The command exits with code 1 when it finds a vulnerability, so a CI step fails.
- **A jsr package is not checked.** OSV has no jsr ecosystem. The report names each such package as
  not checked, so the gap is visible.
- **`imp audit --sbom` writes a CycloneDX 1.7 JSON file.** The default path is `sbom.cdx.json` in
  the project root, and `--output` changes it. Each package is one `library` component, with its
  version, its package URL, its licence, its integrity hash and its distribution URL. The app is the
  metadata component, and it depends on each declared dependency. This mode reads no network and
  never fails on a vulnerability.
- **imp does not write SPDX.** One format covers the need. CycloneDX is the format that the common
  scanners read, and it carries the hashes and the licences that the manifest records.

## Consequences

- A security review gets both answers from one command, with no tool to install.
- The audit needs the network. The bill of materials does not, so a sealed CI can still produce it.
- A package that the manifest does not record is invisible to both modes. `imp audit` warns about a
  declared dependency that has no manifest.
- The manifest records no edges between packages. So the bill of materials lists every package, and
  records only the edges from the app to its declared dependencies.
- A jsr package has no package URL type and no archive hash. Its component carries the registry
  reference and its distribution URL only.
