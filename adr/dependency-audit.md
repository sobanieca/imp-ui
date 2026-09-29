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
  a query over pages, it returns a `next_page_token` for that query. imp sends the same query again
  to `querybatch`, with that token as its `page_token`, until no query has a next page. It then
  reads each advisory that OSV returns. OSV needs no account and no key, and it merges the GitHub
  advisory database with other sources. imp sends nothing else.
- **imp tries a busy request again.** On a 429 or a 5xx answer, imp waits and sends the request
  again, four attempts at most. It waits as long as the `Retry-After` header asks, up to one minute.
  With no header, it waits one second, then two, then four. A result list that does not match the
  queries in length stops the audit, because a missing result would hide a package.
- **The report is one block per affected package.** Each advisory shows its identifier, its severity
  when the source gives one, its summary, the first version that fixes it, and a link to the
  advisory.
- **The exit code separates a finding from an audit that did not complete.** Code 0 means that imp
  checked every npm package and found nothing. Code 1 means a known vulnerability. Code 2 means that
  the audit did not complete: a declared dependency has no manifest, a manifest is not valid, or OSV
  did not answer. A CI step that fails on any code other than 0 then never passes an audit that
  checked nothing. A script that reads the code can tell a finding from a network failure.
- **A declared dependency with no manifest fails the audit.** imp has no record of what its bundle
  contains, so a pass would claim a check that did not happen. The same holds for `--sbom`, which
  then writes no file. A project with no declared dependency passes with code 0, and the output says
  that there is nothing to audit.
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
- A package that the manifest does not record is invisible to both modes. So a declared dependency
  that has no manifest stops both modes with code 2, and names the dependency.
- The manifest records no edges between packages. So the bill of materials lists every package, and
  records only the edges from the app to its declared dependencies.
- A jsr package has no package URL type and no archive hash. Its component carries the registry
  reference and its distribution URL only.
