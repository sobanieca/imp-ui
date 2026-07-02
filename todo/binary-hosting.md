# Host the `imp` binary

Publish the compiled `imp` binary somewhere with predictable per-version, per-platform URLs (e.g.
GitHub Releases: `.../releases/download/v{version}/imp-{os}-{arch}` plus a `.sha256` per asset).
Once hosted, add the concrete download URL / install one-liner to the Installation section of
`docs/cli.md`. Also unblocks the download step of `version-manager.md`.
