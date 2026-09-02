# imp - Feature flags

A feature flag turns part of your app on or off, per environment. The new checkout is on in
development and off in production, until the day when you turn it on. imp gives you one function for
that, and a promise about what happens at build time.

```js
import { flag } from 'imp'

if (flag('CHECKOUT_V2')) {
  mountNewCheckout()
}
```

In development, imp reads the flag while the app runs. In production, imp does not read it at all.
**`imp build` resolves every flag before it bundles, and folds the answer into the code.** So a flag
that is off takes its whole branch with it. That includes the call, the branch, the functions that
only the branch called, and any module that only the branch imported. What ships is the app as if
nobody had written the disabled feature.

That is the difference between a flag and a piece of configuration. Configuration is a value that
your app reads. A flag is a decision that you make before imp packages your app.

## How to declare a flag

You declare every flag in `imp.json`, in a list of names:

```json
{
  "flags": ["CHECKOUT_V2", "NEW_NAV"],
  "environments": {
    "dev": "env/dev.json",
    "prod": "env/prod.json"
  }
}
```

The list is the purpose of the declaration. A name that you never declared is an error, not a flag
that stays off forever with no message. So a spelling mistake such as `flag('CHEKOUT_V2')` stops the
build and names the flags that you did declare. It does not hide a feature that you meant to ship. A
flag name must not start with `IMP_`, which is reserved for the values that imp reads itself.

## How to turn a flag on

The state of a flag per environment lives in the file of that environment, beside your other values.
**[Configuration](config.md)** explains how imp selects an environment:

```json
{
  "API_URL": "https://api.example.com",
  "CHECKOUT_V2": false
}
```

imp accepts `true` and `false` only. In a `.env` file, write the strings `CHECKOUT_V2=true` and
`CHECKOUT_V2=false`. Any other value stops the command. **A declared flag that an environment does
not mention is off.** So the file needs only the flags that you turn on, and a new flag is safely
off everywhere until you change it.

A declared flag is a flag and nothing else. It is not part of the `env` object, and a read of
`env.CHECKOUT_V2` does not find it. There is one way to read a flag, and it is the way that the
build can fold.

## Development, production, and what the browser sees

`imp start` and `imp preview` read a flag while the page runs. So a change to a flag in an
environment file needs a reload, not a rebuild. A change of environment, with
`imp start --env prod`, shows you the app exactly as that environment has it.

`imp build` resolves the flags once, at the start. Every `flag()` call becomes the literal `true` or
`false` that it evaluated to. The minifier then drops what is now unreachable. The finished output
contains no flag machinery: no list of flag names, no values, and nothing for a visitor to read or
change. Each build prints what it decided, so a release tells you which gates it went out with:

```
built index.html -> dist/
  flags folded in - CHECKOUT_V2 off, NEW_NAV on
```

## How to write a flag that the build can fold

Write the flag name as a literal string at the call:

```js
flag('CHECKOUT_V2') // ✓
flag(name) // ✗ - the build stops and tells you why
```

This is the one rule, and it is what makes the guarantee complete. imp can remove a branch only when
it knows at build time which branch that is. When you really must look something up by a name that
you compute at runtime, that is configuration, not a flag. Put it in an environment value and read
it through `env`.

Everything else is ordinary JavaScript. A flag reads well anywhere that a boolean does:

```js
import { flag } from 'imp'
import { div } from 'imp/html'

const nav = () => flag('NEW_NAV') ? newNav() : classicNav()

export const page = () => div(nav(), flag('CHECKOUT_V2') && promoBanner())
```

To keep a large disabled feature out of the bundle completely, including the libraries that only it
uses, put it behind a dynamic `import()` inside the gate. When the flag is off, the branch
disappears, and imp never emits the chunk that the import would produce:

```js
if (flag('CHECKOUT_V2')) {
  const { mountNewCheckout } = await import('./checkout/new.js')
  mountNewCheckout()
}
```

## Flags in tests

A test runs your modules directly, not through a production build. So imp reads a flag at runtime,
and a test sets the flags that it wants to exercise:

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

imp decides a flag when it builds. When the answer must change while the app runs, it is data that
your app loads, not a flag, and it belongs in your own state. Examples are an answer per signed-in
user, an answer per A/B bucket, and an answer fetched from a service. A flag is for a shipping
decision: work in progress that is not ready, a feature that one environment has before another, or
a switch that you turn off and then deploy again.
