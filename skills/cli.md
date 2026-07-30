# cli — every command, and which skill covers it

One binary: dev server, dependency manager, test runner, linter, formatter, builder, image resizer.
Nothing to install, works offline. **Development is buildless** — `imp start` serves your files as
written; production is a single `imp build`.

This page is the map. Each command has its own manual — read that one before running it.

| Command                              | Does                                                     | Read                            |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------- |
| `imp init [dir] [--pwa]`             | scaffold a runnable project — page, component, tests     | [init](init.md)                 |
| `imp start [file.html]`              | serve a page with live reload and terminal telemetry     | [start](start.md)               |
| `--mock` · `--no-mock`               | answer from `*.mock.js` files, or from the real API      | [mocks](mocks.md)               |
| `imp build [file.html\|file.js]`     | production build; `--pwa` for an installable offline app | [build](build.md)               |
| `imp preview [path]`                 | render components in isolation from `*.preview.js`       | [preview](preview.md)           |
| `imp test <file> \| --unit \| --e2e` | `*.test.js` in-process, `*.spec.js` in a real browser    | [testing](testing.md)           |
| `imp install [pkg[@version]]`        | vendor a dependency into `dependencies/`                 | [dependencies](dependencies.md) |
| `imp uninstall <pkg>`                | remove one                                               | [dependencies](dependencies.md) |
| `imp lint [...paths] [--fix]`        | imp's rules plus a standard set; `--fix` autofixes       | [lint](lint.md)                 |
| `imp fmt [...paths] [--check]`       | format every file type in the project                    | [fmt](fmt.md)                   |
| `imp resize <image>`                 | downscale an oversized PNG/JPEG asset                    | [resize](resize.md)             |
| `imp skill [...subject]`             | print a manual for an AI agent                           | [skill](skill.md)               |
| `imp update [version]`               | update and pin the version in `imp.json`                 | [update](update.md)             |
| `imp prune`                          | delete cached versions unused for 30+ days               | [update](update.md)             |
| `imp licenses`                       | third-party license notices for bundled tools            | [update](update.md)             |
| `imp help` · `imp --version`         | usage · the version this binary runs                     | —                               |

Configuration for all of it lives in one optional `imp.json` — every key, and the `--env`
environment files, in [config](config.md).

## Shared behaviour

- **Running `imp` with no arguments, `imp help`, or `imp --help` prints usage**; an unknown command
  prints usage and exits `1`. The usage text ends with a line pointing an AI agent at `imp skill`.
- **Paths default to the whole project** for `imp lint` and `imp fmt`; `.git`, `node_modules` and
  `dist` are always skipped by anything that walks the tree.
- **`--env <name>`** selects an environment on `imp start`, `imp build` and `imp preview`; with no
  flag imp uses an alias named `default`, else `IMP_ENV`, else no environment. See
  [config](config.md).
- **`--mock` / `--no-mock`** decide, for one run of `imp start`, `imp preview` or `imp test --e2e`,
  whether requests are answered from the mocks folder; without a flag the `mocks` block in
  `imp.json` decides. See [mocks](mocks.md).
- **Exit codes are the interface**: `0` on success, `1` on failure — a failed lint, a failing test
  file, a build error, an unknown skill subject.
- **`.imp/` is imp's per-project working directory** (`dev.log`, `screenshots/`, `videos/`) and
  belongs in `.gitignore`, along with `dist/` and any `.env` files.
- **A pinned `version` in `imp.json` wins over the binary you invoked** — whatever command you run,
  it runs on the project's version. See [update](update.md).

## The whole footprint

Your repository holds your code, your static assets in `public/`, at most one `imp.json`, and the
committed `dependencies/` folder. imp writes no lock file, no cache folder and no generated config
into the project — registry downloads and imp versions cache per user, outside it. Never create a
`deno.json`, a `package.json`, or a bundler config for an imp project.
