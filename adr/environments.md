# Environments: named JSON or `.env` files in `imp.json`, one injected global for dev and build

## Context

The same source often needs to ship against different configuration — a different API URL in dev,
stage, and prod — without editing code between targets. Frontend config is not secret (everything
reaches the browser), so the need is to select a named value set at build/serve time and expose it
to app code, not to hide it.

Two constraints shaped the mechanism:

- **`imp start` serves raw ES modules** with an injected import map and does no bundling, while
  `imp build` runs esbuild. A compile-time-only approach (esbuild `define` / `import.meta.env`)
  would work in the bundle but not in the raw dev server, forcing two divergent code paths and
  dev/prod skew.
- **Users only edit `imp.json`.** Following the hide-Deno translation model, environment selection
  and configuration must be expressed in imp's own config, not a Deno- or bundler-specific file.

## Decision

- **Named environments in `imp.json`.** An `environments` map pairs each alias with a path to an env
  file of values: `{ "dev": "env/dev.json", "prod": "env/prod.json" }`. `loadImpConfig` validates
  `environments` is an object of string paths; the referenced files are read and resolved only when
  an environment is actually selected.
- **JSON or `.env` files.** A referenced file whose name is `.env`, ends in `.env`, or starts with
  `.env.` is parsed as a dotenv file (`KEY=VALUE` lines, `#` comments, `export` prefixes, and
  single/double-quoted values), where every value is a string; any other path is parsed as JSON,
  which additionally carries number and boolean values. imp's dotenv parser deliberately does **no**
  `$VAR` expansion of its own, so a `$env.NAME` reference reaches the resolver verbatim and behaves
  identically in both formats.
- **Flat value bag, string/number/boolean.** Each env file is a flat set of values; nested objects
  and arrays (in JSON) are rejected. A string of the form `$env.NAME` resolves at build/serve time
  from the shell (`Deno.env.get`); any other string is a literal. Referencing an unset `$env.NAME`
  is a fail-fast error naming the alias, the key, and the variable — a half-populated environment is
  worse than a stopped build.
- **Selection precedence.** `--env <alias>` on `imp start`/`imp build` wins; otherwise the `IMP_ENV`
  shell variable (for CI); otherwise an alias literally named `default` if one is defined; otherwise
  no environment (empty object — today's behavior, no breakage for projects that never opt in). An
  unknown alias fails fast listing the defined aliases.
- **One runtime mechanism, dev == prod.** The resolved values are injected into the HTML head as
  `<script>globalThis.__IMP_ENV__ = { … }</script>`, ahead of the import map, identically by the dev
  server and the production build. The imp library exports a frozen `env` object read from that
  global (empty when nothing was injected), so app code writes `import { env } from 'imp'` and never
  touches the global directly.
- **Env files stay out of the build output.** Every file referenced by `environments` is excluded
  from the static copy into the build output directory — it is build-time config, like `imp.json`.

## Consequences

- One authoring API and one behavior across `imp start` and `imp build`; no bundler-vs-dev-server
  skew. If tree-shaking unused env keys out of production ever matters, an esbuild `define` layer
  can be added on top of the global without changing `import { env }`.
- Env values ship to the browser and are fully readable by any visitor. `$env.` keeps values out of
  the repo; it does not make them private. Only publishable keys and public config belong here.
- Env files holding `$env.` secrets or per-developer values should be git-ignored; they are read at
  build/serve time from wherever they sit on disk.
