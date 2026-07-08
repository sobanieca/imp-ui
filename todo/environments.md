# Environments — `--env` build/start targeting from `imp.json`

Let a project define named environments (dev, stage, prod, …) and select one when building or
serving, so the same source ships against different config without code edits:

```
imp start --env dev
imp build --env prod
```

Values flow from per-environment JSON files, resolvable from the shell so secrets need not be
committed. One selection, one mechanism, identical behavior in dev and production.

## Config — `environments` block in `imp.json`

Following the "hide Deno" translation model, users only edit `imp.json`. An `environments` map pairs
each alias with a JSON file that holds that environment's values:

```json
{
  "environments": {
    "dev": "env/dev.json",
    "stage": "env/stage.json",
    "prod": "env/prod.json"
  }
}
```

Each referenced file is a flat JSON object of values (string / number / boolean):

```json
{
  "API_URL": "https://api.example.com",
  "STRIPE_PUBLISHABLE_KEY": "$env.STRIPE_PUBLISHABLE_KEY",
  "FEATURE_ANALYTICS": true
}
```

- **`$env.NAME` references** resolve at build/serve time from the shell environment
  (`Deno.env.get('NAME')`). Any other string is a literal. This is the only bit of syntax to learn.
- Referencing a `$env.NAME` that is unset is a **fail-fast error** naming the alias, the key, and
  the missing variable — a half-populated environment is worse than a stopped build.
- `loadImpConfig` (`cli/src/config.js`) validates `environments` as an object of string paths,
  alongside `dependencies`/`fmt`/`lint`/`test`. File contents are read and resolved only when an
  `--env` is actually selected, not on every config load.

Keep env files out of the repo when they hold `$env.` secrets or per-developer values — document a
`.gitignore` suggestion. (The values still ship to the browser; see the security note below.)

## `--env` flag on `start` and `bundle`

- `imp start --env <alias>` and `imp build --env <alias>` select the environment.
- **No `--env` given:** if an environment named `default` exists, use it; otherwise run with an
  empty env object (today's behavior — no breakage for projects that never opt in).
- **Unknown alias:** fail fast listing the aliases defined in `imp.json`.
- Parse the flag in `cli/src/main.js` argument handling and thread the resolved env object into
  `bundle()` (`cli/src/bundle.js`) and the start server (`cli/src/start.js`).

## How code reads it — one runtime mechanism, dev == prod

The key constraint: `imp start` serves **raw ES modules** with an injected import map and does no
bundling (`cli/src/start.js`, `buildHeadInjection`), while `imp build` runs esbuild. A
compile-time-only approach (esbuild `define` / `import.meta.env`) would work in the bundle but not
in the raw dev server, forcing two divergent code paths. Avoid that.

Instead expose env as a **runtime global injected into the HTML head**, identically in both
commands:

- `start` extends `buildHeadInjection` to emit `<script>globalThis.__IMP_ENV__ = { … }</script>`
  ahead of the import map, using the resolved env object for the selected alias.
- `bundle` injects the same script into the built HTML head (the head-injection path already exists
  for the import map / client script).
- The imp library exports a typed accessor so user code never touches the global directly:

  ```js
  import { env } from 'imp'
  fetch(`${env.API_URL}/users`)
  ```

  `env` is a frozen object read from `globalThis.__IMP_ENV__` (empty object when nothing was
  injected). Add it under `lib/src/` next to the other `imp` exports.

This gives one mechanism, one behavior, and no bundler-vs-dev-server skew. If tree-shaking unused
env keys out of production ever matters, an esbuild `define` layer can be added later **on top of**
the global without changing the authoring API.

## Security note — frontend env is not secret

Everything injected ships to the browser and is fully readable by any visitor. `$env.` only keeps
values out of the repo; it does **not** make them private. Document this plainly (mirroring the
industry `VITE_`/`NEXT_PUBLIC_` framing): put only publishable keys and public config here, never
server secrets. Worth a short, blunt callout in the docs so no one pastes a private API key into an
env file.

## Docs

Document the `environments` block, the env-file format and `$env.` resolution, the `--env` flag on
`start`/`bundle`, the `import { env } from 'imp'` accessor, and the security note in `docs/cli.md`
under the `imp.json` section (cross-link from the bundle docs).

## ADR impact

Record an `environments.md` ADR (named env files in `imp.json`, `$env.` shell resolution, single
injected-global mechanism shared by `start` and `bundle`, `import { env } from 'imp'` API) and
update the ADR table in `adr/README.md`.

## Open questions

- **Default alias.** Is `default` the right convention for the no-flag case, or should the first
  declared environment win, or should no-flag stay strictly empty?
- **Value types.** Restrict to string/number/boolean, or allow nested objects/arrays? Flat is
  simpler to reason about and to inject; nesting invites config sprawl.
- **`$env.` fallbacks.** Support `$env.NAME ?? "literal"` default syntax, or keep resolution strict
  (unset ⇒ error) initially? Strict is safer to start.
- **Env-driven import maps.** Should an environment be able to swap a dependency specifier (e.g. a
  mock API client in `test`), or is env strictly a value bag? Keep it a value bag first.
- **`IMP_ENV` variable.** Also honor an `IMP_ENV` shell variable as an alternative to `--env` for
  CI, with the flag taking precedence?
