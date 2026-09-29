# cli - every command, and which skill covers it

One binary holds the dev server, the dependency manager, the test runner, the linter, the formatter,
the builder and the image resizer. There is nothing to install, and it works offline. **Development
is buildless.** `imp start` serves your files as written. Production is one `imp build`.

This page is the map. Each command has its own manual. Read that manual before you run the command.

| Command                              | Does                                                     | Read                            |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------- |
| `imp init [dir] [--pwa]`             | scaffold a runnable project - page, component, tests     | [init](init.md)                 |
| `imp start [file.html]`              | serve a page with live reload and terminal telemetry     | [start](start.md)               |
| `--mock` / `--no-mock`               | answer from `*.mock.js` files, or from the real API      | [mocks](mocks.md)               |
| `imp build [file.html\|file.js]`     | production build; `--pwa` for an installable offline app | [build](build.md)               |
| `imp preview [path]`                 | render components in isolation from `*.preview.js`       | [preview](preview.md)           |
| `imp preview --output <dir>`         | export the gallery as static files that any page embeds  | [preview](preview.md)           |
| `imp review [clear]`                 | read what the review widget saved to `.imp/reviews/`     | [review](review.md)             |
| `imp logs [-n <count>] [-f]`         | print the log of the dev server session; `-f` follows it | [start](start.md)               |
| `imp test <file> \| --unit \| --e2e` | `*.test.js` in-process, `*.spec.js` in a real browser    | [testing](testing.md)           |
| `imp install [pkg[@version]]`        | vendor a dependency into `dependencies/`                 | [dependencies](dependencies.md) |
| `imp uninstall <pkg>`                | remove one                                               | [dependencies](dependencies.md) |
| `imp audit [--sbom]`                 | known vulnerabilities (OSV), or a CycloneDX SBOM         | [dependencies](dependencies.md) |
| `imp lint [...paths] [--fix]`        | imp's rules plus a standard set; `--fix` autofixes       | [lint](lint.md)                 |
| `imp fmt [...paths] [--check]`       | format every file type in the project                    | [fmt](fmt.md)                   |
| `imp resize <image>`                 | downscale an oversized PNG/JPEG asset                    | [resize](resize.md)             |
| `imp map [file]`                     | print the application map: paths, labels, access, notes  | [routing](routing.md)           |
| `imp skill [...subject]`             | print a manual for an AI agent                           | [skill](skill.md)               |
| `imp update [version]`               | update and pin the version in `imp.json`                 | [update](update.md)             |
| `imp prune`                          | delete cached versions unused for 30+ days               | [update](update.md)             |
| `imp licenses`                       | third-party license notices for bundled tools            | [update](update.md)             |
| `imp help` / `imp --version`         | usage, or the version this binary runs                   | -                               |

The configuration of every command lives in one optional `imp.json`. [config](config.md) gives every
key, and the `--env` environment files.

## Shared behaviour

- **imp prints the usage text** when you run `imp` with no argument, `imp help`, or `imp --help`. An
  unknown command prints the usage text and exits `1`. The last line of the usage text points an AI
  agent at `imp skill`.
- **A path defaults to the whole project** for `imp lint` and `imp fmt`. Every command that walks
  the tree always skips `.git`, `node_modules`, `dist` and the vendored `dependencies/` folder.
- **`--env <name>`** selects an environment on `imp start`, `imp build` and `imp preview`. With no
  flag, imp uses `IMP_ENV`, then an alias named `default`, then no environment. See
  [config](config.md).
- **`--mock` and `--no-mock`** decide, for one run of `imp start`, `imp preview` or
  `imp test --e2e`, whether imp answers a request from the mocks folder. With no flag, the `mocks`
  block in `imp.json` decides. See [mocks](mocks.md).
- **The exit code is the interface.** It is `0` on success and `1` on failure. A failure is a failed
  lint, a failing test file, a build error, or an unknown skill subject. `imp audit` also exits `2`
  when the audit did not complete.
- **`.imp/` is imp's working directory for the project.** It holds `dev.log`, `reviews/`,
  `screenshots/` and `videos/`. Put it in `.gitignore`, with `dist/` and every `.env` file.
- **A pinned `version` in `imp.json` wins against the binary that you invoke.** Every command that
  you run uses the version of the project. See [update](update.md).

## The whole footprint

Your repository holds your code, your static assets in `public/`, at most one `imp.json`, and the
committed `dependencies/` folder. imp writes no lock file, no cache folder and no generated config
into the project. imp caches a registry download and an imp version per user, outside the project.
Never create a `deno.json`, a `package.json` or a bundler config for an imp project.
