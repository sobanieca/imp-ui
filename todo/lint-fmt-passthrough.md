# Finalize `imp lint` / `imp fmt` flag passthrough

Decide and finalize which flags `imp lint` (e.g. `--fix`) and `imp fmt` accept through the
passthrough to the underlying toolchain, keeping the surface imp-branded. Once finalized, document
the full flag list and supported `fmt` options in `docs/cli.md`.
