# config - the `imp.json` file, key by key

`imp.json` is the only config file that a project author writes. It sits at the project root and it
is **completely optional**. Every command works without it. Never write a `deno.json`, a
`package.json`, a lock file or a bundler config. imp reads `imp.json` in process, and nothing else.

A command searches upward from the current directory and stops at the repository root. So a command
works from any subfolder. In a monorepo, each app folder carries its own `imp.json` and its own
`dependencies/`. imp accepts a `//` comment, a `/* ... */` comment and a trailing comma. When
`imp.json` is absent, imp tries `imp.jsonc`.

## Every key

| Key                 | Type                                   | Default      | Read by                                                           |
| ------------------- | -------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `version`           | exact version string                   | -            | every command (self-delegation); written by `imp update`          |
| `dependencies`      | alias -> exact `npm:`/`jsr:` specifier | `{}`         | `imp start`, `imp build`, `imp lint`; written by `imp install`    |
| `licenses`          | tier string or SPDX id array           | `permissive` | `imp install`, `imp build` (both error on a violation)            |
| `targetImpHost`     | boolean                                | `false`      | `imp build` with a **JS** entry                                   |
| `fmt`               | object                                 | see below    | `imp fmt`                                                         |
| `lint`              | object                                 | `{}`         | `imp lint`                                                        |
| `test`              | object                                 | `{}`         | `imp test`                                                        |
| `map`               | path of the application map file       | -            | `imp map`; `imp init` writes `src/app-map.js`                     |
| `preview`           | object                                 | `{}`         | `imp preview`                                                     |
| `pwa`               | object                                 | -            | `imp start`, `imp build --pwa`                                    |
| `environments`      | alias -> env file path                 | `{}`         | `imp start`, `imp build`, `imp preview` (`--env`)                 |
| `flags`             | array of feature flag names            | `[]`         | `imp start`, `imp build` (folds them), `imp preview`              |
| `mocks`             | `{ folder, enabled }`, both required   | -            | `imp start`, `imp preview`, `imp test --e2e` (`--mock` wins)      |
| `serviceWorker`     | path of your service worker source     | -            | `imp start` (serves it at `/sw.js`), `imp build` (writes `sw.js`) |
| `maxFileSize`       | bytes                                  | `204800`     | `imp lint` (errors), `imp install` (warns)                        |
| `maxFileSizeIgnore` | array of repo-relative paths           | `[]`         | the same size check                                               |
| `maxLogEntries`     | number                                 | `4000`       | `imp start` (the log that `imp logs` prints)                      |
| `devServerPort`     | number                                 | `4507`       | `imp start` (`--port` wins)                                       |

## A file that uses every key

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
  "serviceWorker": "src/sw.js",
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
    "exclude": ["legacy/"],
    "publicExports": ["src/sdk.js", "src/plugin.js#register"]
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
    "translations": { "en": "./locales/en.js", "pl": "./locales/pl.js" },
    "groups": "src/preview-groups.js",
    "entry": "preview.html"
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

Inside `pwa`, only `name` and `icon` are necessary. Every other block is optional, as a whole and in
each part. When the `mocks` block is present, both of its keys are necessary. For the full detail of
each block, read [fmt](fmt.md), [lint](lint.md), [testing](testing.md),
[dependencies](dependencies.md), [preview](preview.md), [mocks](mocks.md),
[service-worker](service-worker.md), [start](start.md) and [build](build.md).

Two folders have a fixed name and no key. **`public/`** goes to the root of the built site without a
change, see [build](build.md). **`dependencies/`** holds the vendored bundles.

## Rules an agent gets wrong

- **Never edit `dependencies` by hand.** Run `imp install <pkg>`. The command resolves the package,
  bundles it into `dependencies/`, and writes the pin. A pin must be an exact `npm:` or `jsr:`
  version, such as `npm:mitt@3.0.1`. Never write `^3.0.1`, `3` or a bare `npm:mitt`. `imp lint`
  reports an error for those forms.
- **Never write a range in `version`.** It is one exact version, and `imp update` sets it. Any imp
  binary then hands the run to that version.
- **There is no lock file, no cache folder and no generated config.** When you are about to create
  one, use `imp.json` and the committed `dependencies/` folder instead.
- **imp writes nothing else into the project.** `.imp/` is the working directory. It holds
  `dev.log`, the reviews, the screenshots and the videos. Put it in `.gitignore`, with `dist/` and
  every `.env` file.
- **A malformed value fails the command**, and the message names the key, for example
  `invalid imp.json - 'devServerPort' must be an integer between 1 and 65535`. imp ignores an
  **unknown** key. So a misspelled key does nothing and gives no message. Check the table above. Do
  not trust a run that reports no error.
- **When imp edits the config, it keeps your comments and your formatting.** So it is safe to
  annotate the file.
- `imp.json` is optional. Do not create one only to hold the defaults.

## Environments - `--env`

`environments` maps an alias to a file of values. Select an alias with `imp start --env dev` or
`imp build --env prod`. With no flag, imp uses the `IMP_ENV` shell variable, then an alias named
**`default`**, then no environment. An undeclared alias stops the command, and imp lists the real
aliases.

The file is JSON, with a string, number or boolean value. It can also be a `.env` file. A `.env`
file is named `.env`, or ends in `.env`, or starts with `.env.`. It holds `KEY=VALUE` lines, `#`
comments, an optional `export` and a quoted value. **Every value in a `.env` file is a string.**

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "CHECKOUT_V2": true,
  "IMP_LOG_LEVEL": "debug"
}
```

- imp reads a value written as **`$env.NAME`** from the shell, at serve time or build time. Every
  other string is a literal. A shell variable that is missing stops the command. The message names
  the environment, the key and the variable.
- Read the values with `import { env } from 'imp'`. `env` is a frozen object. It is empty when you
  select no environment. The same code works in development and in production.
- **An environment value is not secret.** It ships to the browser. `$env.` only keeps the value out
  of the repository. Put a publishable key and public config there. Never put a server-side secret
  there.
- A key that you name in `flags` is a **feature flag**, not an env value. imp removes it from `env`.
  Read it with `flag('CHECKOUT_V2')`, which `imp build` folds to a literal. See
  [feature-flags](feature-flags.md).
- Three names configure imp itself, not your code. `IMP_LOG_LEVEL` takes `debug`, `info`, `warn` or
  `error`, see [logging](logging.md). `IMP_BASEPATH` is the sub-path that the app is served under,
  and `IMP_ROUTING: "hash"` keeps the route in the fragment for an app inside a page it does not
  own, see [routing](routing.md). A flag name must not start with `IMP_`.

imp reads these shell variables directly, outside any environment file: `IMP_ENV` selects an
environment, `IMP_VERSION=system` bypasses the version pin, `IMP_CACHE_DIR` moves the cache folder
of imp (the downloaded versions and the e2e browser), `IMP_BROWSER` gives the path of the e2e
browser, and `IMP_NO_UPDATE_CHECK` stops the update hint.
