# imp

imp is a complete UI toolkit in one binary. It is the dev server, the component library, the state,
the router, the test runner, the linter, the formatter and the bundler. You install one file, and
you build the app.

imp is released as an experimental version. Until version `1.0.0`, any part of it can change.

## Install

```
curl -fsSL https://imp-ui.com/install.sh | bash
```

The script supports Linux and macOS. On Windows, run this command in PowerShell:

```
irm https://imp-ui.com/install.ps1 | iex
```

The docs are in [`docs/`](docs/). Start with [`docs/cli.md`](docs/cli.md).

For complete apps that are built with imp, see
[sobanieca/imp-examples](https://github.com/sobanieca/imp-examples). Two of them run live:
[Beacon](https://examples.imp-ui.com/observability/), an observability SPA, and
[Brickfall](https://examples.imp-ui.com/brickfall/), a game that installs as a PWA.

## Work on imp

### Prerequisites

- [Rust](https://rustup.rs/), stable, with `rustfmt` and `clippy`.
- A C compiler, for the JavaScript engine that the CLI embeds.
- [rfm](https://adam.sobaniec.com/remote-file-manager/), a static file server. `cargo xtask site`
  uses it to serve the built home page. No other task needs it.

The first browser test downloads a pinned Chrome into `~/.imp/browser/`, when the machine has no
Chrome or Chromium.

### Tasks

| Command                  | What it does                                                             |
| ------------------------ | ------------------------------------------------------------------------ |
| `cargo xtask example`    | serves the todo example from `examples` on <http://localhost:4400/>      |
| `cargo xtask preview`    | serves the component previews from `lib/src` on <http://localhost:4401/> |
| `cargo xtask site`       | builds the home page into `site/dist/` and serves that folder with `rfm` |
| `cargo xtask test`       | runs the library unit tests, the library e2e tests, then the Rust tests  |
| `cargo xtask check`      | formats and lints the repository, then runs `imp lint` on `lib/src`      |
| `cargo verify`           | runs `check` without writing a file, then `test`                         |
| `cargo update-snapshots` | runs the CLI tests and rewrites their snapshots                          |
| `cargo imp <args>`       | builds the CLI, then runs `imp <args>` in the current folder             |

`cargo xtask` with no task lists every task. Each task builds the CLI first when a file changed.
Do not run a binary from `target/` directly, because it can be older than the source.

### Repository layout

| Folder      | What it holds                                                        |
| ----------- | -------------------------------------------------------------------- |
| `cli/`      | the `imp` command in Rust, its browser modules, and its tests        |
| `xtask/`    | maintainer tasks: site build, vendoring, licences, size checks, perf |
| `lib/`      | the library that an app imports, with the standard components        |
| `docs/`     | the public documentation                                             |
| `skills/`   | the pages that `imp skill` prints for an AI agent                    |
| `adr/`      | the accepted architectural decisions, see `adr/README.md`            |
| `.todoer/`  | the planned work as todoer todos, one item per file                  |
| `examples/` | the todo example app                                                 |
| `site/`     | the home page                                                        |
| `perf/`     | the performance apps and scenarios                                   |

The rules for a change to this repository are in [`AGENTS.md`](AGENTS.md).

## License

MIT. See [`LICENSE`](LICENSE) and [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).
