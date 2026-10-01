# build-flags - `flag('NAME')`, declared in imp.json, folded away by `imp build`

```js
import { flag } from 'imp'

if (flag('CHECKOUT_V2')) mountNewCheckout()
```

`imp start`, `imp preview` and `imp test` read the flag at runtime. `imp build` resolves the flag
before it bundles. It replaces the call with the literal `true` or `false`. The minifier then
removes the dead branch, everything that only the branch reached, and any chunk that the branch
would produce. The built output contains no flag name, no value and no `flag()` call.

## Setup - both halves are necessary

1. **Declare** every flag in `imp.json`. An undeclared name is a build error, not a false flag.
2. **Turn the flag on** in the environment file, see [config](config.md). The values are `true` and
   `false` only. In a `.env` file, write the strings `NAME=true` or `NAME=false`. **An absent flag
   is off.**

```json
// imp.json
{ "flags": ["CHECKOUT_V2", "NEW_NAV"], "environments": { "prod": "env/prod.json" } }
```

```json
// env/prod.json - CHECKOUT_V2 is not listed, so it is off
{ "API_URL": "https://api.example.com", "NEW_NAV": true }
```

## Rules

- **The name must be a string literal at the call site.** These forms stop the setup: `flag(name)`,
  `flag(\`X\`)` where the template has a substitution, a call with two arguments, and a call with no
  argument. imp folds the call only when it can read the name.
- **A declared flag is not an env value.** imp removes every `flags` name from `env`, so
  `env.CHECKOUT_V2` is `undefined`. `flag()` is the only reader, and the only form that the build
  can fold.
- **An undeclared flag also throws at runtime**, in `imp start`, `imp preview` and `imp test`. The
  error names the declared flags. It is not a build-only error.
- **A flag name must not start with `IMP_`.** That prefix is reserved for imp's own environment
  values, such as `IMP_LOG_LEVEL` and `IMP_BASEPATH`.
- **`flags` in `imp.json` is an array of names**, not an object of values. The values live in each
  environment.
- **An answer that varies at runtime is not a flag.** A per-user, per-request or fetched toggle is
  data. Load it into state. A flag is fixed for the whole build.
- **A flag that the build cannot fold fails the build**, and the error names the file. imp does not
  ship a bundle that reads a flag at runtime. Nothing in a built app can check a flag.
- **In a test, set the global**: `globalThis.__IMP_FLAGS__ = { CHECKOUT_V2: true }`. Delete it in
  `afterEach`. imp does not build a test, so it folds nothing.

## How to drop the code of a feature completely

Put a dynamic `import()` inside the gate. The whole dependency tree of the feature then stays out of
a build where the flag is off. imp removes the branch and emits no chunk:

```js
if (flag('CHECKOUT_V2')) {
  const { mountNewCheckout } = await import('./checkout/new.js')
  mountNewCheckout()
}
```

`imp build` prints what it resolved: `flags folded in - CHECKOUT_V2 off, NEW_NAV on`. See
[build](build.md).
