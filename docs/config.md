# imp - Configuration (`imp.json`)

The only config file you write is `imp.json`, at your project root. It is optional. Every command
works without it.

```json
{
  "version": "1.2.3",
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "fmt": { "lineWidth": 100 }
}
```

imp accepts a `//` line comment, a `/* ... */` block comment, and a trailing comma in this file,
even though strict JSON forbids them. You can also name the file `imp.jsonc`. imp looks for
`imp.json` first, then for `imp.jsonc`.

Some commands edit the file for you: `imp install`, `imp uninstall`, and `imp update` when it pins a
version. Each command changes only the keys it must change, and keeps your comments and your
formatting. When no config file exists, these commands create `imp.json`.

A command searches upward from the current directory to find the config. The search stops at your
repository root, so a command works from any subfolder of a project. In a monorepo, each app folder
has its own `imp.json` (or `imp.jsonc`) and its own `dependencies/` folder.

## The keys

- **`version`** pins the exact imp version for this project. Any imp binary then runs the project on
  that version, and downloads it once if needed. Set the key with `imp update`. See
  **[Pinning the imp version](cli.md#imp-update--pinning-the-imp-version)**.
- **`dependencies`** lists the packages you vendored into your project. Each entry maps an import
  alias to the exact version imp installed. `imp install` and `imp uninstall` write and update the
  key, so you rarely edit it by hand. imp exposes each alias to the browser, so you write
  `import mitt from 'mitt'`. See **[Managing dependencies](dependencies.md)**.
- **`licenses`** lists the license terms you accept from a vendored dependency. It is a tier -
  `"permissive"` (the default), `"weak-copyleft"`, or `"any"` - or your own list of SPDX
  identifiers, such as `["MIT", "ISC", "Apache-2.0"]`. `imp install` and `imp build` refuse a
  package outside this policy. See **[The license policy](dependencies.md#the-license-policy)**.
- **`targetImpHost`** is `true` when your build must run inside another imp application. `imp build`
  then keeps the `imp` imports bare, for that host to provide. See
  **[Targeting an imp host](cli.md#targeting-an-imp-host--sharing-the-hosts-imp)**.
- **`map`** is the path of the file that exports your application map, such as `src/app-map.js`.
  `imp init` writes the key. See **[Routing](routing.md)**.
- **`build`** holds the options for `imp build`. `maxSize` is the budget, in bytes, for the whole
  output folder. A build that writes more fails, names its largest files, and leaves no output. See
  **[`imp build`](cli.md#imp-build)**.
- **`fmt`** holds the formatting options for `imp fmt`. See **[Formatting](fmt.md)**.
- **`lint`** holds more lint settings: `rules`, `exclude`, and `publicExports` for code that
  something outside the project uses. imp always applies its own rule set on top. See
  **[Linting](lint.md)**.
- **`test`** holds the testing options for `imp test`: `entry`, `browser`, `exclude`, and a `video`
  block that records an end-to-end test as a GIF. See **[Testing](testing.md)**.
- **`preview`** holds the options for `imp preview`: `exclude` for paths to leave out, `themes` for
  your own theme modules, `translations` for the languages the preview switcher offers, `groups` for
  the module that names the catalog groups, and `entry` for an HTML file that frames every preview
  page. See **[`imp preview`](cli.md#imp-preview)**.
- **`pwa`** describes your app as a Progressive Web App. `name` and `icon` are required. The
  optional keys are `shortName`, `themeColor`, `backgroundColor`, `display`, `startUrl`, and
  `scope`. The block drives the manifest that `imp start` injects and the offline app that
  `imp build --pwa` produces. See
  **[Progressive Web App](cli.md#progressive-web-app--imp-build---pwa)**.
- **`environments`** lists the named configuration sets you select with `--env`. Each name maps to a
  JSON file of values. See _Environments_ below.
- **`flags`** lists, by name, the feature flags your app can check. Each environment says whether a
  flag is on. `imp build` folds the answer into the code, so a disabled feature never ships. See
  **[Feature flags](feature-flags.md)**.
- **`mocks`** sets where your `*.mock.js` files live, and whether they answer by default. Both
  `folder` and `enabled` are required. `--mock` and `--no-mock` override `enabled` for one run.
  `imp build` never copies the folder. See **[Mock responses](cli.md#mock-responses--mockjs)**.
- **`serviceWorker`** is the path of your own service worker source, such as `src/sw.js`.
  `imp start` serves it at `/sw.js` instead of its own dev worker, and `imp build` writes the same
  bundle as `sw.js`. See **[Your own service worker](cli.md#your-own-service-worker)**.
- **`maxFileSize`** is the largest size, in bytes, a single committed file can reach before
  `imp lint` reports an error and `imp install` gives a warning. The default is 200 kB (`204800`).
  See **[Linting](lint.md)**.
- **`maxFileSizeIgnore`** lists repo-relative paths that `maxFileSize` skips. A listed file, and
  everything under a listed folder, never fails the size check.
- **`maxLogEntries`** is the number of recent entries `imp start` keeps in the session log that
  `imp logs` prints. The default is 4000. imp removes the oldest entry once the log reaches the
  limit. See **[`imp logs`](cli.md#imp-logs)**.
- **`devServerPort`** is the port `imp start` listens on. The default is 4507. A `--port` flag on
  the command line overrides it. See **[`imp start`](cli.md#imp-start)**.

Two folders have a fixed name and no key. imp copies the contents of `public/` to the root of the
built site, unchanged. See **[The `public/` folder](cli.md#the-public-folder)**. `dependencies/`
holds your vendored bundles.

That is the whole footprint. Your repository holds your code, at most one `imp.json`, and the
`dependencies/` folder. You commit all of it. imp writes no lock file, no cache folder, and no
generated config into your project. It caches a registry download per user, outside the project.

Reproducibility comes from what you commit, not from a lock file. `imp.json` pins an exact version,
such as `npm:mitt@3.0.1`, never `npm:mitt@3`. The committed bundle in `dependencies/` is the frozen
result of that pin. `imp lint` enforces this. See the `exact-dependency-versions` rule in
**[Linting](lint.md)**.

## Environments - per-target config

The same app can need different configuration per target: a different API URL in development and in
production, or a feature that is on in staging only. Declare a named environment in `imp.json`, and
select one when you serve or build. Each name points at a file that holds the values for that
environment:

```json
{
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json",
    "default": "env/dev.json"
  }
}
```

Each file is either JSON or a `.env` file. A JSON file is a flat object of string, number, and
boolean values:

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "SUPPORT_EMAIL": "help@example.com"
}
```

A `.env` file is any path named `.env`, ending in `.env`, or starting with `.env.`. It uses
`KEY=VALUE` syntax, with a `#` comment, an optional `export` prefix, and a value in single or double
quotes. Every value in a `.env` file is a string:

```
API_URL=https://api.example.com
STRIPE_PUBLISHABLE_KEY=$env.STRIPE_PUBLISHABLE_KEY
# a number stays a string here
PAGE_SIZE=25
```

In both formats, imp reads a value written as `$env.NAME` from the shell environment when you serve
or build. Every other string is a literal value. A reference to an unset shell variable stops the
command with an error that names the environment, the key, and the missing variable.

Keep a file that holds a `$env.` secret, or a value per developer, out of the repository. Add it to
`.gitignore`. A fresh `imp init` project already ignores `.env` files.

Select an environment with `--env` on `imp start` or `imp build`:

```
imp start --env dev
imp build --env prod
```

With no `--env`, imp uses the `IMP_ENV` shell variable if it is set. A `--env` flag always wins over
the variable, which helps in CI. With neither set, imp uses an alias named `default`, if you defined
one. Otherwise imp serves and builds with no environment. An alias you never declared stops the
command, and imp lists the aliases you did declare.

Read the selected values in your app through the `env` object that imp exports. The same code works
in every environment:

```js
import { env } from 'imp'

fetch(`${env.API_URL}/users`)
```

`env` is a frozen object. It is empty when you select no environment.

A value that turns a feature on or off is a **[feature flag](feature-flags.md)**, not an environment
value. Declare its name in the `flags` key of `imp.json`, set it to `true` or `false` per
environment, and read it with `flag('NAME')`. The difference matters at build time: imp reads an
`env` value while the app runs, but it resolves a flag during `imp build` and drops the code behind
a disabled flag from the output. A declared flag is never part of `env`.

**An environment value is not secret.** Everything you put in an environment ships to the browser,
and any visitor can read it. `$env.` only keeps a value out of your repository. It does not make the
value private. Put only a publishable key or public configuration here, the same way other frontend
tools use a `VITE_` or `NEXT_PUBLIC_` prefix. Never put a server-side secret or a private API key
here.

### The values that imp reads itself

Three names in an environment file configure imp, not your code. For this reason, a feature flag
must not use an `IMP_` prefix:

| Value           | What it does                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `IMP_LOG_LEVEL` | The log level the app runs at: `debug`, `info`, `warn`, or `error`. See **[Logging](logging.md)**.      |
| `IMP_BASEPATH`  | The sub-path your app is served under. The router strips and re-adds it. See **[Routing](routing.md)**. |
| `IMP_ROUTING`   | Set to `hash` to keep the route in the address fragment, for an app inside a page it does not own.      |

Everything else in the file is yours, and it arrives through `env`.
