# config - the `imp.json` file, key by key

The only config file a project author writes, at the project root, and **entirely optional** - every
command works without it. Never write a `deno.json`, a `package.json`, a lock file, or a bundler
config: imp reads `imp.json` in process and nothing else.

Commands search upward from the current directory, stopping at the repository root, so a command
works from any subfolder; in a monorepo each app folder carries its own `imp.json` and its own
`dependencies/`. `//` and `/* ... */` comments and trailing commas are accepted, and `imp.jsonc` is
tried when `imp.json` is absent.

## Every key

| Key                 | Type                                   | Default   | Read by                                                        |
| ------------------- | -------------------------------------- | --------- | -------------------------------------------------------------- |
| `version`           | exact version string                   | -         | every command (self-delegation); written by `imp update`       |
| `dependencies`      | alias -> exact `npm:`/`jsr:` specifier | `{}`      | `imp start`, `imp build`, `imp lint`; written by `imp install` |
| `targetImpHost`     | boolean                                | `false`   | `imp build` with a **JS** entry                                |
| `fmt`               | object                                 | see below | `imp fmt`                                                      |
| `lint`              | object                                 | `{}`      | `imp lint`                                                     |
| `test`              | object                                 | `{}`      | `imp test`                                                     |
| `preview`           | object                                 | `{}`      | `imp preview`                                                  |
| `pwa`               | object                                 | -         | `imp start`, `imp build --pwa`                                 |
| `environments`      | alias -> env file path                 | `{}`      | `imp start`, `imp build`, `imp preview` (`--env`)              |
| `flags`             | array of feature flag names            | `[]`      | `imp start`, `imp build` (folds them), `imp preview`           |
| `mocks`             | `{ folder, enabled }`, both required   | -         | `imp start`, `imp preview`, `imp test --e2e` (`--mock` wins)   |
| `maxFileSize`       | bytes                                  | `204800`  | `imp lint` (errors), `imp install` (warns)                     |
| `maxFileSizeIgnore` | array of repo-relative paths           | `[]`      | the same size check                                            |
| `maxLogEntries`     | number                                 | `4000`    | `imp start` (`.imp/dev.log`)                                   |
| `devServerPort`     | number                                 | `4507`    | `imp start` (`--port` wins)                                    |

## A file using everything

```json
{
  "version": "1.2.3",
  "dependencies": {
    "mitt": "npm:mitt@3.0.1",
    "base64": "jsr:@std/encoding@1.0.10/base64"
  },
  "devServerPort": 9085,
  "maxLogEntries": 10000,
  "maxFileSize": 262144,
  "maxFileSizeIgnore": ["assets/hero.png", "dependencies/charts"],
  "environments": {
    "default": "env/dev.json",
    "dev": "env/dev.json",
    "prod": "env/prod.json"
  },
  "flags": ["CHECKOUT_V2", "NEW_NAV"],
  "mocks": { "folder": "mocks", "enabled": false },
  "fmt": {
    "lineWidth": 100,
    "indentWidth": 2,
    "useTabs": false,
    "singleQuote": true,
    "semiColons": false,
    "exclude": ["vendor/"]
  },
  "lint": {
    "rules": { "no-unused-vars": "off", "eqeqeq": "warn" },
    "exclude": ["legacy/"]
  },
  "test": {
    "entry": "index.html",
    "browser": "/usr/bin/chromium",
    "exclude": ["drafts/"],
    "video": { "enable": true, "fps": 10, "maxDuration": 30, "width": 800, "quality": 80 }
  },
  "preview": {
    "exclude": ["vendor-demos"],
    "themes": ["src/theme/light.js", "src/theme/brand-dark.js"],
    "translations": { "en": "./locales/en.js", "pl": "./locales/pl.js" }
  },
  "pwa": {
    "name": "My App",
    "shortName": "App",
    "icon": "assets/icon.svg",
    "themeColor": "#0b0b0b",
    "backgroundColor": "#ffffff",
    "display": "standalone",
    "startUrl": "/",
    "scope": "/"
  }
}
```

Only `name` and `icon` are required inside `pwa`; every other block is optional in whole and in
part. Both keys of `mocks` are required when the block is present. Full detail per block:
[fmt](fmt.md), [lint](lint.md), [testing](testing.md), [dependencies](dependencies.md),
[preview](preview.md), [mocks](mocks.md), [start](start.md) and [build](build.md).

Two folders have fixed names and no key at all: **`public/`**, copied verbatim to the root of the
built site - see [build](build.md) - and **`dependencies/`**, holding the vendored bundles.

## Rules an agent gets wrong

- **Never hand-edit `dependencies`.** Run `imp install <pkg>` - it resolves, bundles into
  `dependencies/`, and writes the pin. A pin must be an exact `npm:`/`jsr:` version
  (`npm:mitt@3.0.1`, never `^3.0.1`, `3`, or a bare `npm:mitt`); `imp lint` errors otherwise.
- **Never write a `version` range.** It is one exact version, and it is set by `imp update`. Any imp
  binary then hands off to that version.
- **There is no lock file, no cache folder and no generated config.** If you are about to create
  one, the answer is `imp.json` plus the committed `dependencies/` folder.
- **imp writes nothing else into the project** - `.imp/` is the working directory (`dev.log`,
  reviews, screenshots, videos) and belongs in `.gitignore`, as do `dist/` and `.env` files.
- **A malformed value fails the command** with a message naming the key
  (`invalid imp.json - 'devServerPort' must be an integer between 1 and 65535`). An **unknown** key,
  though, is ignored - a misspelled key silently does nothing, so check the table above rather than
  trusting a clean run.
- **Config edits by imp preserve your comments and formatting**, so annotating the file is safe.
- `imp.json` is optional: do not create one just to hold defaults.

## Environments - `--env`

`environments` maps an alias to a file of values. Select it with `imp start --env dev` /
`imp build --env prod`. With no flag imp uses an alias literally named **`default`**, else the
`IMP_ENV` shell variable, else no environment at all. An undeclared alias stops the command and
lists the real ones.

The referenced file is JSON (string, number and boolean values) or a `.env` file (named `.env`,
ending in `.env`, or starting with `.env.` - `KEY=VALUE`, `#` comments, optional `export`, quoted
values, **every value a string**).

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "CHECKOUT_V2": true,
  "IMP_LOG_LEVEL": "debug"
}
```

- A value written **`$env.NAME`** is read from the shell at serve/build time; every other string is
  a literal. A missing shell variable stops the command naming the environment, key and variable.
- Read the values with `import { env } from 'imp'` - a frozen object, empty when no environment was
  selected. The same code works in development and production.
- **Environment values are not secret.** They ship to the browser; `$env.` only keeps a value out of
  the repository. Publishable keys and public config only - never a server-side secret.
- A key named in `flags` is a **feature flag**, not an env value: it is removed from `env` and read
  with `flag('CHECKOUT_V2')`, which `imp build` folds to a literal. See
  [feature-flags](feature-flags.md).
- Two names configure imp itself rather than your code: `IMP_LOG_LEVEL` (`debug`/`info`/`warn`/
  `error`, see [logging](logging.md)) and `IMP_BASEPATH` (the sub-path the app is served under, see
  [routing](routing.md)). Flag names may not start with `IMP_`.

Shell variables imp reads directly, outside any environment file: `IMP_ENV` (selects an
environment), `IMP_VERSION=system` (bypass the version pin), `IMP_HOME` (where downloaded versions
cache), `IMP_BROWSER` (e2e browser path), `IMP_NO_UPDATE_CHECK` (silence the update hint).
