# Environments: named JSON or `.env` files in `imp.json`, one injected global for dev and build

## Context

The same source often must ship against different configuration. An example is a different API URL
in development, in staging and in production. Nobody wants to edit code between two targets.
Frontend config is not secret, because everything reaches the browser. So the need is to select a
named set of values at build time or serve time, and to expose it to app code. The need is not to
hide the values.

Two constraints shaped the mechanism:

- **`imp start` serves raw ES modules**, with an injected import map, and it bundles nothing.
  `imp build` runs esbuild. An approach that works only at compile time, such as the `define` option
  of esbuild, or `import.meta.env`, would work in the bundle but not in the raw dev server. That
  would force two different code paths, and it would make development differ from production.
- **A user edits `imp.json` only.** imp follows the model that hides Deno. So the selection and the
  configuration of an environment must appear in the config of imp, and not in a file that belongs
  to Deno or to a bundler.

## Decision

- **`imp.json` holds named environments.** An `environments` map pairs each alias with a path to a
  file of values, as in `{ "dev": "env/dev.json", "prod": "env/prod.json" }`. `loadImpConfig`
  validates that `environments` is an object of string paths. imp reads and resolves a referenced
  file only when somebody selects that environment.
- **A file is JSON or a `.env` file.** imp parses a referenced file as a dotenv file when its name
  is `.env`, or ends in `.env`, or starts with `.env.`. That format holds `KEY=VALUE` lines, a `#`
  comment, an `export` prefix, and a value in single or double quotes. Every value in it is a
  string. imp parses any other path as JSON, which also carries a number and a boolean. The dotenv
  parser of imp deliberately does **no** expansion of a `$VAR` of its own. So a `$env.NAME`
  reference reaches the resolver without a change, and it behaves the same way in both formats.
- **The values are a flat set of a string, a number or a boolean.** Each env file is flat. imp
  rejects a nested object and an array in JSON. A string of the form `$env.NAME` resolves at build
  time or at serve time, from the shell, through `Deno.env.get`. Any other string is a literal. A
  reference to a `$env.NAME` that is not set is an error that stops the command immediately. The
  message names the alias, the key and the variable. An environment that is half filled is worse
  than a build that stops.
- **The selection has a precedence.** `--env <alias>` on `imp start` or `imp build` wins. Then comes
  the `IMP_ENV` shell variable, which helps in CI. Then comes an alias named `default`, when
  somebody defined one. Otherwise there is no environment, and `env` is an empty object. That is the
  behaviour of today, and a project that never opts in does not break. An unknown alias fails
  immediately, and imp lists the aliases that exist.
- **There is one runtime mechanism, and development equals production.** imp sets the resolved
  values as the global `globalThis.__IMP_ENV__ = { ... }` before any module of the page runs. The
  dev server writes that statement into an inline script in the head of the HTML, in front of the
  import map. The production build writes it into a hashed file, `chunks/env-<hash>.js`, and loads
  that file with a classic script in the head, so a strict Content Security Policy allows it, see
  `production-bundling.md`. Both escape `<` in the values, so a value that holds `</script>` cannot
  end the script. The library of imp exports a frozen `env` object, read from that global, and it is
  empty when imp set nothing. So app code writes `import { env } from 'imp'`, and never touches the
  global.
- **An env file stays out of the build output.** imp excludes every file that `environments`
  references from the static copy into the output directory. It is config for build time, like
  `imp.json`.
- **A value that turns a feature on or off is a flag, not an env value.** imp removes a name that
  `flags` lists in `imp.json` from the injected `env` object. You read such a name through `flag()`,
  which `imp build` resolves and folds away. See `adr/build-flags.md`.

## Consequences

- There is one authoring API, and one behaviour, across `imp start` and `imp build`. The bundler and
  the dev server do not differ. imp always reads an `env` value at runtime. It folds nothing away,
  and a bundler shakes nothing out. That is why anything that must remove code from a production
  build goes through `flag()` instead.
- An env value ships to the browser, and any visitor can read it. `$env.` keeps a value out of the
  repository. It does not make the value private. Only a publishable key, and public config, belong
  here.
- An env file that holds a `$env.` secret, or a value per developer, must go into `.gitignore`. imp
  reads such a file at build time or at serve time, from wherever it sits on disk.
