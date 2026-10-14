# AGENTS.md

This file is the entry point for an AI agent that changes this repository. The full rules are in
[`CLAUDE.md`](CLAUDE.md). Read that file before you change anything.

## The repository

imp is a UI toolkit in one binary. The binary is a Rust program in `cli/`. It embeds the JavaScript
library in `lib/src`, the browser modules in `cli/js`, the templates in `cli/templates` and the
skill pages in `skills/`. Maintainer tasks live in `xtask/`.

## The commands

| Command                  | When to run it                                               |
| ------------------------ | ------------------------------------------------------------ |
| `cargo xtask check`      | after every batch of changes; it formats and lints the repo  |
| `cargo verify`           | before you say that the work is done; CI runs the same steps |
| `cargo xtask test`       | to run every test; pass a filter to narrow the Rust tests    |
| `cargo update-snapshots` | after a change to CLI output that you verified by hand       |
| `cargo imp <args>`       | to run the current imp in the current folder                 |

Run one library test file with `cargo imp test <file>` from `lib/test`. The calendar tests need
`TZ=Europe/Warsaw`.

## The rules that an agent gets wrong

- Write ASCII only, in every file. Write `-`, never a long dash.
- Do not add comments to code.
- Name a file with a hyphen between words. A Rust module uses `#[path = "x-y.rs"]`.
- Write prose in Simplified Technical English.
- Update `docs/` and `skills/` in the same change as the feature.
- Keep every change that `cargo xtask check` makes, also in files outside your change.
- Do not preserve backward compatibility. imp is not released.
