# imp - Configuration (`imp.json`)

The only config file that you write is `imp.json`, at your project root. It is optional. Every
command works without it.

```json
{
  "version": "1.2.3",
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "fmt": { "lineWidth": 100 }
}
```

You can annotate the file freely. imp accepts a `//` line comment, a `/* ... */` block comment and a
trailing comma, although strict JSON forbids them. If you prefer, name the file `imp.jsonc`. imp
looks for `imp.json` first, and then for `imp.jsonc` in the same directory. Some commands edit the
file for you. These are `imp install`, `imp uninstall`, and the version pin that `imp update`
writes. They change only the keys that they must change, and they keep your comments and your
formatting. When no config file exists, these commands create `imp.json`.

A command finds the config by a search upward from the directory where you run it. The search stops
at your repository root. So a command works from any subfolder of a project. In a monorepo, each app
folder carries its own `imp.json`, or `imp.jsonc`, and its own `dependencies/`. imp discovers each
one on its own, from where you are.

## The keys

- **`version`** is the exact imp version that this project is built against. When it is set, any imp
  binary runs the project on that version, and downloads the version once if necessary. So everyone
  who works on the project uses the same imp, whichever binary they installed. Set the key with
  `imp update`. See **[Pinning the imp version](cli.md#imp-update--pinning-the-imp-version)**.
- **`dependencies`** holds the dependencies that you vendored into your project. There is one entry
  per package. It maps a bare import alias to the exact version that imp installed. `imp install`
  and `imp uninstall` write and update the key. Usually you never edit it by hand. imp exposes each
  alias to the browser through the injected import map, so you write `import mitt from 'mitt'`. See
  **[Managing dependencies](dependencies.md)**.
- **`licenses`** holds the license terms that you accept from a vendored dependency. It is a tier,
  which is `"permissive"`, the default, or `"weak-copyleft"` or `"any"`. It can also be your own
  list of SPDX identifiers, such as `["MIT", "ISC", "Apache-2.0"]`. `imp install` and `imp build`
  both refuse a package outside the policy. See
  **[The license policy](dependencies.md#the-license-policy)**.
- **`targetImpHost`** is `true` when what you build must run inside another imp application.
  `imp build` then keeps the `imp` imports bare, for that host to provide. It does not compile its
  own copy in. See **[Targeting an imp host](cli.md#targeting-an-imp-host--sharing-the-hosts-imp)**.
- **`fmt`** holds the formatting options for `imp fmt`. See **[Formatting](fmt.md)**.
- **`lint`** holds more lint configuration: `rules`, `exclude`, and `publicExports` for code that
  something outside the project uses. imp always applies its own rule set on top. See
  **[Linting](lint.md)**.
- **`test`** holds the testing options for `imp test`: `entry`, `browser`, `exclude`, and a `video`
  block that records an e2e spec as a GIF. See **[Testing](testing.md)**.
- **`preview`** holds the options for `imp preview`. `exclude` is an array of paths whose
  `*.preview.js` files imp leaves out of the discovery. `themes` is an array of paths to your own
  theme modules, which imp offers in the preview theme menu. `translations` maps a language code to
  one of your translation files, which imp offers in the preview language switcher. `groups` is the
  path to a module that names the groups of the catalog, with their icons and their order. See
  **[`imp preview`](cli.md#imp-preview)**.
- **`pwa`** describes your app as a Progressive Web App. `name` and `icon` are necessary. The
  optional keys are `shortName`, `themeColor`, `backgroundColor`, `display`, `startUrl` and `scope`.
  The block drives the manifest and the icons that `imp start` injects automatically, and the full
  offline PWA that `imp build --pwa` emits. See
  **[Progressive Web App](cli.md#progressive-web-app--imp-build---pwa)**.
- **`environments`** holds the named configuration sets that you select with `--env`. Each one maps
  an alias to a JSON file of values. So the same source can ship against a different API URL per
  target, with no change to the code. See _Environments_ below.
- **`flags`** lists, by name, the feature flags that your app can check. Each environment says
  whether a flag is on. `imp build` folds the answer into the code, so imp does not ship a disabled
  feature at all. See **[Feature flags](feature-flags.md)**.
- **`mocks`** says where your `*.mock.js` files live, and whether they answer by default. Both
  `folder` and `enabled` are necessary, so a project always states which backend it develops
  against. `--mock` and `--no-mock` override `enabled` for one run. `imp build` never copies the
  folder. See **[Mock responses](cli.md#mock-responses--mockjs)**.
- **`maxFileSize`** is the largest size, in bytes, that any single committed file can reach before
  `imp lint` reports an error and `imp install` gives a warning. The default is 200 kB, which is
  `204800`. See **[Linting](lint.md)**.
- **`maxFileSizeIgnore`** is an array of repo-relative paths that `maxFileSize` does not cover. A
  listed file, and everything under a listed folder, never causes the size check to fail.
- **`maxLogEntries`** is the number of recent entries that `imp start` keeps in its dev log file,
  `.imp/dev.log`. The default is 4000. imp removes an older entry when the file reaches the limit.
  See **[`imp start`](cli.md#imp-start)**.
- **`devServerPort`** is the port where `imp start` listens. The default is 4507. A `--port` flag on
  the command line overrides it. See **[`imp start`](cli.md#imp-start)**.

Two folders have a fixed name and no key. imp copies the contents of `public/` to the root of the
built site without a change, see **[The `public/` folder](cli.md#the-public-folder)**.
`dependencies/` holds your vendored bundles.

That is the whole footprint. Your repository contains your code, at most one `imp.json`, and the
`dependencies/` folder with your vendored dependencies. All of it is source that you commit. imp
writes no lock file, no cache folder and no generated config into your project. imp caches a
registry download per user, outside the project.

In place of a lock file, the reproducibility comes from what you commit. `imp.json` pins an exact
version, such as `npm:mitt@3.0.1` and never `npm:mitt@3`. The committed bundle in `dependencies/` is
the frozen result of that pin. `imp lint` enforces the model. See the `exact-dependency-versions`
rule in **[Linting](lint.md)**.

## Environments - per-target config

The same app can need different configuration per target. Examples are a different API URL in
development and in production, and a feature that is on in staging. Declare a named environment in
`imp.json`, and select one when you serve or build. Each alias points at a file that holds the
values of that environment:

```json
{
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json",
    "default": "env/dev.json"
  }
}
```

Each file is either JSON or a `.env` file. A JSON file is a flat object of string, number and
boolean values:

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "SUPPORT_EMAIL": "help@example.com"
}
```

A `.env` file is any path named `.env`, or ending in `.env`, or starting with `.env.`. It uses the
`KEY=VALUE` syntax, with a `#` comment, an optional `export` prefix, and a value in single or double
quotes. Every value in a `.env` file is a string:

```
API_URL=https://api.example.com
STRIPE_PUBLISHABLE_KEY=$env.STRIPE_PUBLISHABLE_KEY
# a number stays a string here
PAGE_SIZE=25
```

In both formats, imp reads a value written as `$env.NAME` from the shell environment, when you serve
or build. Every other string is a literal. A reference to a shell variable that is not set stops the
command with an error. The error names the environment, the key and the missing variable. So a build
that is half configured never starts. Keep a file that holds a `$env.` secret, or a value per
developer, out of the repository. Add it to `.gitignore`. A fresh `imp init` project already ignores
a `.env` file.

Select an environment with `--env` on `imp start` or `imp build`:

```
imp start --env dev
imp build --env prod
```

With no `--env`, imp uses an alias named `default`, when you defined one. Then it uses the `IMP_ENV`
shell variable, when it is set. This helps in CI, where `--env` always wins against the variable.
Otherwise imp serves and builds with no environment. An alias that you never declared stops the
command, and imp lists the aliases that you did declare.

Read the selected values in your app through the `env` object that imp exports. The same code works
in development and in production:

```js
import { env } from 'imp'

fetch(`${env.API_URL}/users`)
```

`env` is a frozen object. It is empty when you select no environment.

A value that turns a feature on or off is a **[feature flag](feature-flags.md)**, not an env value.
Declare the name in the `flags` key of `imp.json`, set it to `true` or `false` per environment, and
read it with `flag('NAME')`. The difference matters at build time. imp reads an `env` value while
the app runs. imp resolves a flag during `imp build`, and drops the code behind a disabled flag from
the output. A declared flag is not part of `env`.

**An environment value is not secret.** Everything that you put in an environment ships to the
browser, and any visitor can read it. `$env.` only keeps a value out of your repository. It does not
make the value private. Put only a publishable key and public configuration here. Other frontend
toolchains state the same rule with their `VITE_` and `NEXT_PUBLIC_` prefixes. Never put a
server-side secret or a private API key here.

### The values that imp reads itself

Two names in an environment file configure imp, not your code. They are also the reason why a
feature flag must not have an `IMP_` prefix:

| Value           | What it does                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `IMP_LOG_LEVEL` | the log level the app runs at - `debug`, `info`, `warn`, `error`. See **[Logging](logging.md)**.           |
| `IMP_BASEPATH`  | the sub-path your app is served under, stripped and re-added by the router. See **[Routing](routing.md)**. |

Everything else in the file is yours, and it arrives through `env`.
