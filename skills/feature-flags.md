# feature-flags — `flag('NAME')`, declared in imp.json, folded away by `imp build`

```js
import { flag } from 'imp'

if (flag('CHECKOUT_V2')) mountNewCheckout()
```

`imp start` / `imp preview` / `imp test` read the flag at runtime. `imp build` resolves it before
bundling and replaces the call with the literal `true` or `false`, so the minifier drops the dead
branch, everything only it reached, and any chunk it would have produced. The built output contains
no flag names, no values and no `flag()` call.

## Setup — both halves are required

1. **Declare** every flag in `imp.json`. An undeclared name is a build error, not a false flag.
2. **Turn it on** in the environment file (see [config](config.md)); `true`/`false` only, and in a
   `.env` file the strings `NAME=true` / `NAME=false`. **Absent = off.**

```json
// imp.json
{ "flags": ["CHECKOUT_V2", "NEW_NAV"], "environments": { "prod": "env/prod.json" } }
```

```json
// env/prod.json — CHECKOUT_V2 is not listed, so it is off
{ "API_URL": "https://api.example.com", "NEW_NAV": true }
```

## Rules

- **The name is a string literal at the call site.** `flag(name)`, `flag(\`X\`)` where the template
  has a substitution, two arguments, or no argument all stop the build. Nothing folds unless imp can
  read the name.
- **Declared flags are not env values.** `flags` names are removed from `env`; `env.CHECKOUT_V2` is
  `undefined`. `flag()` is the only reader, and the only form the build can fold.
- **An undeclared flag throws at runtime too** (`imp start`, `imp preview`, `imp test`), naming the
  declared flags — the error is not build-only.
- **Flag names must not start with `IMP_`** — reserved for imp's own environment values
  (`IMP_LOG_LEVEL`, `IMP_BASEPATH`).
- **`flags` in `imp.json` is an array of names**, not an object of values. The values live per
  environment.
- **Runtime-varying answers are not flags.** Per-user, per-request or fetched toggles are data —
  load them into state. A flag is fixed for the whole build.
- **A flag the build could not fold fails the build**, naming the file, rather than shipping a
  bundle that reads flags at runtime. Nothing in a built app can check a flag.
- **In tests, set the global**: `globalThis.__IMP_FLAGS__ = { CHECKOUT_V2: true }`, and delete it in
  `afterEach`. Tests are not built, so nothing is folded.

## Dropping a feature's code entirely

A dynamic `import()` inside the gate keeps the feature's whole dependency tree out of a build where
the flag is off — the branch goes, and the chunk is never emitted:

```js
if (flag('CHECKOUT_V2')) {
  const { mountNewCheckout } = await import('./checkout/new.js')
  mountNewCheckout()
}
```

`imp build` prints what it resolved: `flags folded in — CHECKOUT_V2 off, NEW_NAV on` — see
[build](build.md).
