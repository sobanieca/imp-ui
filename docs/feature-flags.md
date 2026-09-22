# imp - Feature flags

A feature flag turns part of your app on or off, per environment. The new checkout can be on in
development and off in production, until the day you turn it on. imp gives you one function for
that, and a guarantee about what happens at build time.

```js
import { flag } from 'imp'

if (flag('CHECKOUT_V2')) {
  mountNewCheckout()
}
```

In development, imp reads the flag while the app runs. In production, imp does not read it at all.
**`imp build` resolves every flag before it bundles, and folds the answer into the code.** A flag
that is off takes its whole branch with it: the call, the branch, the functions only that branch
called, and any module only that branch imported. What ships is the app as if nobody had written the
disabled feature.

That is the difference between a flag and a piece of configuration. Configuration is a value your
app reads. A flag is a decision you make before imp packages your app.

## How to declare a flag

Declare every flag in `imp.json`, in a list of names:

```json
{
  "flags": ["CHECKOUT_V2", "NEW_NAV"],
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json"
  }
}
```

A name you never declared is an error, not a flag that silently stays off. A spelling mistake such
as `flag('CHEKOUT_V2')` stops the build and lists the flags you did declare. It never hides a
feature you meant to ship. A flag name must not start with `IMP_`, which is reserved for the values
imp reads itself.

## How to turn a flag on

The state of a flag per environment lives in the file for that environment, beside your other
values. **[Configuration](config.md)** explains how imp selects an environment:

```json
{
  "API_URL": "https://api.example.com",
  "CHECKOUT_V2": false
}
```

imp accepts only `true` and `false`. In a `.env` file, write the strings `CHECKOUT_V2=true` and
`CHECKOUT_V2=false`. Any other value stops the command. **A declared flag that an environment does
not mention is off.** So a file needs only the flags you turn on, and a new flag stays safely off
everywhere until you change it.

A declared flag is a flag, and nothing else. It is not part of the `env` object, and a read of
`env.CHECKOUT_V2` never finds it. There is one way to read a flag: the way the build can fold.

## Development, production, and what the browser sees

`imp start` and `imp preview` read a flag while the page runs. A change to a flag in an environment
file needs a reload, not a rebuild. A change of environment, with `imp start --env prod`, shows you
the app exactly as that environment has it.

`imp build` resolves the flags once, at the start. Every `flag()` call becomes the literal `true` or
`false` it evaluated to, and the minifier drops what is now unreachable. The finished output has no
flag machinery: no list of flag names, no values, nothing for a visitor to read or change. Each
build prints what it decided, so a release tells you which gates it shipped with:

```
built index.html -> dist/
  flags folded in - CHECKOUT_V2 off, NEW_NAV on
```

## How to write a flag the build can fold

Write the flag name as a literal string at the call:

```js
flag('CHECKOUT_V2') // ok
flag(name) // fails - the build stops and tells you why
```

This is the one rule that makes the guarantee complete. imp can remove a branch only when it knows
at build time which branch that is. When you must look something up by a name you compute at
runtime, that is configuration, not a flag. Put it in an environment value and read it through
`env`.

Everything else is ordinary JavaScript. A flag reads well anywhere a boolean does:

```js
import { flag } from 'imp'
import { div } from 'imp/html'

const nav = () => flag('NEW_NAV') ? newNav() : classicNav()

export const page = () => div(nav(), flag('CHECKOUT_V2') && promoBanner())
```

To keep a large disabled feature, and any library only it uses, out of the bundle, put it behind a
dynamic `import()` inside the gate. When the flag is off, the branch disappears, and imp never emits
the chunk that import would produce:

```js
if (flag('CHECKOUT_V2')) {
  const { mountNewCheckout } = await import('./checkout/new.js')
  mountNewCheckout()
}
```

## Flags in tests

A test runs your modules directly, not through a production build. imp reads a flag at runtime, so a
test can set the flags it wants to exercise:

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

imp decides a flag when it builds. When the answer must change while the app runs, that is data your
app loads, not a flag. Put it in your own state instead. Examples are an answer per signed-in user,
an answer per A/B bucket, or an answer fetched from a service.

A flag is for a shipping decision: work in progress that is not ready, a feature one environment has
before another, or a switch you turn off and deploy again.
