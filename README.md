# imp

imp is a complete UI toolkit in one binary. It is the dev server, the component library, the state,
the router, the test runner, the linter, the formatter and the bundler. You install one file, and
you build the app.

imp is not released yet. Until version `1.0.0`, any part of it can change.

## Install

```
curl -fsSL https://sobanieca.github.io/imp-ui/install.sh | bash
```

The script supports Linux and macOS. On Windows x64, run this command in PowerShell:

```
irm https://sobanieca.github.io/imp-ui/install.ps1 | iex
```

The docs are in [`docs/`](docs/). Start with [`docs/cli.md`](docs/cli.md).

## Work on imp

### Prerequisites

- [Deno](https://deno.com/), for the build scripts and the tests.
- [rfm](https://sobanieca.github.io/remote-file-manager/), a static file server. `deno task site`
  uses it to serve the built home page. No other task needs it.
- Git. The build compares the binary with the files that Git sees.

The first compile downloads the formatter plugins into `cli/src/vendor/`. The first browser test
downloads a pinned Chrome into `~/.imp/browser/`, when the machine has no Chrome or Chromium.

### Tasks

| Task                | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `deno task example` | serves the todo example from `examples/todo` on <http://localhost:4507/> |
| `deno task preview` | serves the component previews from `lib/src` on <http://localhost:4517/> |
| `deno task site`    | builds the home page into `site/dist/` and serves that folder with `rfm` |
| `deno task test`    | runs the library unit tests, the library e2e tests, then the CLI tests   |
| `deno task check`   | runs `deno lint`, `deno fmt`, then `imp lint` on `lib/src`               |

Each task compiles `./imp` first when a file changed. To run any other imp command on the current
source, use `deno run -A tools/imp.js <args>`. Do not run `./imp` directly, because it can be older
than the source.

### Repository layout

| Folder      | What it holds                                                   |
| ----------- | --------------------------------------------------------------- |
| `cli/`      | the `imp` command, and its tests                                |
| `lib/`      | the library that an app imports, with the standard components   |
| `docs/`     | the public documentation                                        |
| `skills/`   | the pages that `imp skill` prints for an AI agent               |
| `adr/`      | the accepted architectural decisions, see `adr/README.md`       |
| `todo/`     | the planned work, one item per file                             |
| `examples/` | example apps                                                    |
| `site/`     | the home page                                                   |
| `tools/`    | maintainer scripts: compile, site build, vendoring, size checks |
| `perf/`     | the performance apps and scenarios                              |

The rules for a change to this repository are in [`CLAUDE.md`](CLAUDE.md).

## License

MIT. See [`LICENSE`](LICENSE) and [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).
