# imp - Feature flags

A feature flag turns part of your app on or off per environment: the new checkout is on in
development, off in production, until the day you flip it. imp gives you one function for that - and
a promise about what happens at build time.

```js
import { flag } from 'imp'

if (flag('CHECKOUT_V2')) {
  mountNewCheckout()
}
```

In development the flag is read as you run. In production it is not read at all: **`imp build`
resolves every flag before bundling and folds the answer into the code**, so a flag that is off
takes its whole branch with it - the call, the branch, the functions only that branch called, and
any module it was the only one importing. What ships is the app as if the disabled feature had never
been written.

That is the difference between a flag and a piece of configuration. Configuration is a value your
app reads; a flag is a decision made before your app is packaged.

## Declaring a flag

Every flag is declared in `imp.json`, in a list of names:

```json
{
  "flags": ["CHECKOUT_V2", "NEW_NAV"],
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json"
  }
}
```

The list is the point of the declaration: a name you never declared is an error rather than a flag
that is quietly off forever, so a typo - `flag('CHEKOUT_V2')` - stops the build and names the flags
you did declare, instead of silently hiding a feature you meant to ship. Flag names cannot start
with `IMP_`, which is reserved for the values imp reads itself.

## Turning a flag on

A flag's state per environment lives in that environment's file, next to your other values - see
**[Configuration](config.md)** for how environments are selected:

```json
{
  "API_URL": "https://api.example.com",
  "CHECKOUT_V2": false
}
```

Only `true` and `false` are accepted (in a `.env` file, the strings `CHECKOUT_V2=true` and
`CHECKOUT_V2=false`); anything else stops the command. **A declared flag an environment does not
mention is off.** So the file only needs the flags you are turning on, and a new flag is safely off
everywhere until you say otherwise.

A declared flag is a flag and nothing else: it is not part of the `env` object, and reading
`env.CHECKOUT_V2` will not find it. There is one way to read a flag, and it is the one the build can
fold.

## Development, production, and what the browser sees

`imp start` and `imp preview` read flags as the page runs, so flipping one in an environment file is
a reload rather than a rebuild - and switching environments (`imp start --env prod`) shows you the
app exactly as that environment has it.

`imp build` resolves them once, up front. Every `flag()` call becomes the literal `true` or `false`
it evaluated to, the minifier drops what is now unreachable, and the finished output contains no
flag machinery at all: no list of flag names, no values, nothing for a visitor to read or flip. Each
build prints what it decided, so a release tells you which gates it went out with:

```
built index.html → dist/
  flags folded in - CHECKOUT_V2 off, NEW_NAV on
```

## Writing a flag the build can fold

The flag name must be a literal string written at the call:

```js
flag('CHECKOUT_V2') // ✓
flag(name) // ✗ - the build stops and tells you why
```

This is the one rule, and it is what makes the guarantee unconditional: imp can only remove a branch
if it knows at build time which branch it is. If you genuinely need to look something up by a name
computed at runtime, that is configuration, not a flag - put it in an environment value and read it
through `env`.

Everything else is ordinary JavaScript. A flag reads well anywhere a boolean does:

```js
import { flag } from 'imp'
import { div } from 'imp/html'

const nav = () => flag('NEW_NAV') ? newNav() : classicNav()

export const page = () => div(nav(), flag('CHECKOUT_V2') && promoBanner())
```

To keep a large disabled feature out of the bundle entirely - including the libraries only it uses -
put it behind a dynamic `import()` inside the gate. When the flag is off the branch disappears, and
the chunk that import would have produced is never even emitted:

```js
if (flag('CHECKOUT_V2')) {
  const { mountNewCheckout } = await import('./checkout/new.js')
  mountNewCheckout()
}
```

## Flags in tests

Tests run your modules directly rather than through a production build, so a flag is read at
runtime, and a test sets the flags it wants to exercise:

```js
import { flag } from 'imp'
import { afterEach, expect, test } from 'imp/test'

afterEach(() => {
  delete globalThis.__IMP_FLAGS__
})

test('the new checkout is gated', () => {
  globalThis.__IMP_FLAGS__ = { CHECKOUT_V2: true }
  expect(flag('CHECKOUT_V2')).toEqual(true)
})
```

## When a flag is the wrong tool

A flag is decided when you build. If the answer has to change while the app is running - per signed
in user, per A/B bucket, fetched from a service - that is data your app loads, not a flag, and it
belongs in your own state. Flags are for shipping decisions: work in progress that is not ready, a
feature enabled for one environment ahead of another, a kill switch you flip and redeploy.
