# Finalize `imp lint` / `imp fmt` flag surface

Decide and finalize which flags `imp lint` and `imp fmt` accept beyond the current `--check`
(candidates: `--fix` for lint autofixes — the lint engine already returns fix data; `--quiet`;
reading from stdin for editor integration). Once finalized, document the full flag list in
`docs/cli.md`.
