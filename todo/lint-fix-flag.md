# Add `--fix` flag to `imp lint`

Add a `--fix` flag to `imp lint` that applies lint autofixes — the lint engine already returns fix
data, so wire it through to rewrite files in place. Once implemented, document the flag in
`docs/cli.md`.
