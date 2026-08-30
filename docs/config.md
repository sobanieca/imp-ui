# imp - Configuration (`imp.json`)

The only config file you author is `imp.json` at your project root; it is optional - every command
works without it.

```json
{
  "version": "1.2.3",
  "dependencies": { "mitt": "npm:mitt@3.0.1" },
  "fmt": { "lineWidth": 100 }
}
```

You can annotate the file freely: `//` line and `/* ... */` block comments and trailing commas are
accepted even though strict JSON forbids them. If you prefer, name the file `imp.jsonc` instead -
imp looks for `imp.json` first and falls back to `imp.jsonc` in the same directory. Commands that
edit the file for you (`imp install`, `imp uninstall`, and the version pin written by `imp update`)
change only the keys they touch and leave your comments and formatting in place. When no config file
exists yet, these commands create `imp.json`.

Commands find the config by searching upward from the directory you run them in, stopping at your
repository root, so they work from any subfolder of a project - and in a monorepo, each app folder
carries its own `imp.json` (or `imp.jsonc`) and its own `dependencies/`, discovered independently
based on where you are.

## The keys

- **`version`** - the exact imp version this project is built against. When set, any imp binary
  transparently runs the project on that version, downloading it once if needed - so everyone
  working on the project uses the same imp regardless of which one they installed. Set it with
  `imp update`; see **[Pinning the imp version](cli.md#imp-update--pinning-the-imp-version)**.
- **`dependencies`** - the dependencies vendored into your project, one entry per package mapping a
  bare import alias to the exact version installed. Written and updated by `imp install` /
  `imp uninstall`; you normally never edit it by hand. Each alias is exposed to the browser through
  the injected import map, so you write `import mitt from 'mitt'`. See
  **[Managing dependencies](dependencies.md)**.
- **`targetImpHost`** - set to `true` when what you build is meant to run inside another imp
  application: `imp build` then keeps `imp` imports bare for that host to provide instead of
  compiling its own copy in. See
  **[Targeting an imp host](cli.md#targeting-an-imp-host--sharing-the-hosts-imp)**.
- **`fmt`** - formatting options for `imp fmt`. See **[Formatting](fmt.md)**.
- **`lint`** - extra lint configuration (`rules`, `exclude`); the imp rule set is always applied on
  top. See **[Linting](lint.md)**.
- **`test`** - testing options for `imp test` (`entry`, `browser`, `exclude`, and a `video` block
  for recording e2e specs as GIFs). See **[Testing](testing.md)**.
- **`preview`** - options for `imp preview`; `exclude` is an array of paths whose `*.preview.js`
  files are left out of discovery, `themes` is an array of paths to your own theme modules to offer
  in the preview theme switcher, and `translations` maps a language code to one of your translation
  files to offer in the preview language switcher. See **[`imp preview`](cli.md#imp-preview)**.
- **`pwa`** - describes your app as a Progressive Web App: `name` and `icon` (required), plus
  optional `shortName`, `themeColor`, `backgroundColor`, `display`, `startUrl`, and `scope`. It
  drives the manifest and icons injected automatically in `imp start`, and the full offline PWA
  emitted by `imp build --pwa`. See
  **[Progressive Web App](cli.md#progressive-web-app--imp-build---pwa)**.
- **`environments`** - named configuration sets you select with `--env`, each mapping an alias to a
  JSON file of values. Lets the same source ship against a different API URL per target without code
  edits. See _Environments_ below.
- **`flags`** - the feature flags your app may check, listed by name. Each environment says whether
  a flag is on, and `imp build` folds the answer into the code so a disabled feature is not shipped
  at all. See **[Feature flags](feature-flags.md)**.
- **`mocks`** - where your `*.mock.js` files live, and whether they answer by default: both `folder`
  and `enabled` are required, so a project always says outright which one it develops against.
  `--mock` / `--no-mock` override `enabled` for a single run, and `imp build` never copies the
  folder either way. See **[Mock responses](cli.md#mock-responses--mockjs)**.
- **`maxFileSize`** - the largest size, in bytes, any single committed file may reach before
  `imp lint` errors and `imp install` warns. Defaults to 200 kB (`204800`). See
  **[Linting](lint.md)**.
- **`maxFileSizeIgnore`** - an array of repo-relative paths exempt from `maxFileSize`; a file (or
  everything under a listed folder) never triggers the size check.
- **`maxLogEntries`** - how many of the most recent entries `imp start` keeps in its dev log file
  (`.imp/dev.log`). Defaults to 4000; older entries roll off once the limit is reached. See
  **[`imp start`](cli.md#imp-start)**.
- **`devServerPort`** - the port `imp start` listens on. Defaults to 4507; a `--port` flag on the
  command line overrides it. See **[`imp start`](cli.md#imp-start)**.

Two folders have fixed names and no key at all: `public/`, whose contents are copied verbatim to the
root of the built site (see **[The `public/` folder](cli.md#the-public-folder)**), and
`dependencies/`, holding your vendored bundles.

That is the whole footprint: your repository contains your code, at most one `imp.json`, and the
`dependencies/` folder holding your vendored dependencies - all of it source you commit. imp writes
no lock file, no cache folder, and no generated config into your project; registry downloads are
cached per-user, outside the project.

Instead of a lock file, reproducibility comes from what is committed: `imp.json` pins exact versions
(`npm:mitt@3.0.1`, never `npm:mitt@3`) and the committed bundle in `dependencies/` is the frozen
result of resolving that pin. `imp lint` enforces the model - see the `exact-dependency-versions`
rule in **[Linting](lint.md)**.

## Environments - per-target config

When the same app needs different configuration per target - a different API URL in dev and prod, a
feature on in staging - declare named environments in `imp.json` and select one when you serve or
build. Each alias points at a file holding that environment's values:

```json
{
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json",
    "default": "env/dev.json"
  }
}
```

Each referenced file may be either JSON or a `.env` file. A JSON file is a flat object of string,
number, and boolean values:

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "SUPPORT_EMAIL": "help@example.com"
}
```

A `.env` file (any path named `.env`, ending in `.env`, or starting with `.env.`) uses the familiar
`KEY=VALUE` syntax, with `#` comments, an optional `export` prefix, and single- or double-quoted
values. Every value in a `.env` file is a string:

```
API_URL=https://api.example.com
STRIPE_PUBLISHABLE_KEY=$env.STRIPE_PUBLISHABLE_KEY
# a number stays a string here
PAGE_SIZE=25
```

A value written as `$env.NAME` - in either format - is read from the shell environment when you
serve or build; every other string is a literal. Referencing a shell variable that is not set stops
the command with an error naming the environment, the key, and the missing variable - a
half-configured build never starts. Keep files that hold `$env.` secrets or per-developer values out
of the repo by adding them to `.gitignore` (a fresh `imp init` project already ignores `.env`
files).

Select an environment with `--env` on `imp start` or `imp build`:

```
imp start --env dev
imp build --env prod
```

With no `--env`, imp uses an alias literally named `default` if you defined one, or the `IMP_ENV`
shell variable if it is set (handy in CI, where `--env` always takes precedence over it); otherwise
it serves and builds with no environment at all. An alias you never declared stops the command and
lists the ones you did.

Read the selected values in your app through the `env` object exported by imp - the same code works
in development and production:

```js
import { env } from 'imp'

fetch(`${env.API_URL}/users`)
```

`env` is a frozen object; it is empty when no environment was selected.

A value that switches a feature on or off is a **[feature flag](feature-flags.md)** rather than an
env value: declare its name in `imp.json`'s `flags`, set it `true` or `false` per environment, and
read it with `flag('NAME')`. The difference matters at build time - `env` values are read as the app
runs, while a flag is resolved during `imp build` and the code behind a disabled flag is dropped
from the output. Declared flags are not part of `env`.

**Environment values are not secret.** Everything you put in an environment ships to the browser and
is fully readable by any visitor - `$env.` only keeps a value out of your repository, it does not
make it private. Put only publishable keys and public configuration here (the same rule other
frontend toolchains express with their `VITE_` / `NEXT_PUBLIC_` prefixes); never a server-side
secret or a private API key.

### Values imp reads itself

Two names in an environment file configure imp rather than your code (and are why a feature flag may
not be named with an `IMP_` prefix):

| Value           | What it does                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `IMP_LOG_LEVEL` | the log level the app runs at - `debug`, `info`, `warn`, `error`. See **[Logging](logging.md)**.           |
| `IMP_BASEPATH`  | the sub-path your app is served under, stripped and re-added by the router. See **[Routing](routing.md)**. |

Everything else in the file is yours and arrives through `env`.
