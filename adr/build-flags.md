# Build flags: declared in `imp.json`, read as `flag('NAME')`, folded out by `imp build`

## Context

imp reads an environment value at runtime, from the injected `__IMP_ENV__` global, see
`adr/environments.md`. That is what keeps `imp start` and `imp build` on one mechanism. The cost is
that no bundler can see through a read of a property. So an app that gates a feature on an
environment value still ships every line behind the gate. The disabled feature is inert, and it is
present. A person can read it in the bundle. A person can also turn it on, by setting the global
before the entry module runs. So a gate that must hold a feature back does not hold it back.

imp tried to make the bundler see through `env`, and rejected that. An app uses `env` as an object.
It writes `import { env } from 'imp'`, and then `env.X`. The `define` option of esbuild does not
substitute a name that an import binds. So a fold would need imp to remove the import from user
source, and to define the bare identifier `env` across the build. That takes over the name in every
bundled file, and that includes third-party code. Worse, the fold could only ever be partial.
`env.X` folds only for a key that the selected environment defines. So when somebody _leaves out_ a
key, the branch stays in the bundle. That is the opposite of what a person who turns a feature off
expects.

A flag is a different thing from a configuration value, and that difference is what makes it
foldable. Its domain is boolean, and a flag that is absent is off, and not undefined.

## Decision

- **You declare a flag in `imp.json`**, as an array of names, such as `"flags": ["CHECKOUT_V2"]`.
  The declaration is a list of what is allowed. So an undeclared name is an error, and not a flag
  that is off forever with no message. A name must not start with `IMP_`, which is reserved for the
  environment values of imp.
- **The state per environment comes from the environment file**, as `true` or `false`. In a `.env`
  file it comes as the string `"true"` or `"false"`, because every value in such a file is a string.
  Any other value fails the command. **A declared flag that the selected environment does not
  mention is off.** So a new flag is safely off everywhere, until an environment says otherwise.
- **A declared flag is not an env value.** imp removes a flag name from the values that it injects
  as `__IMP_ENV__`. So `env.CHECKOUT_V2` is `undefined`, and `flag()` is the only reader. There is
  no second door to the same switch, and no door that imp cannot fold.
- **There is one reader, `flag('NAME')`, and `imp` exports it.** `imp start`, `imp preview` and
  `imp test` resolve it at runtime, against a `__IMP_FLAGS__` global. That global holds every
  declared flag with its value, and imp injects it beside `__IMP_ENV__`. An undeclared name throws,
  and the error names the declared flags. So a spelling mistake fails in development as loudly as it
  fails in a build.
- **`imp build` folds every call.** Before it bundles, imp replaces each `flag('NAME')` with the
  literal `true` or `false` for the selected environment. It does that in the sources of the
  project, in an inline page script, and in a vendored dependency. The minifier then drops what
  became unreachable. That is the branch, whatever only the branch reached, and any chunk that a
  dynamic `import()` inside the branch would produce. The build injects no `__IMP_FLAGS__` global,
  because nothing in the output reads one.
- **The name must be a string literal at the call site.** A computed name fails the build. imp does
  not fall back to a lookup at runtime. That is what makes the guarantee complete. After
  `imp build`, no check of a flag survives anywhere in the output.
- **The build verifies its own guarantee.** Before it writes anything, the build fails when a bundle
  still reads the global of the flags. That is the only way in which a reader that imp did not fold
  can reach the output, because a bundler otherwise shakes out the library module that holds the
  reader. So a form that the rewrite cannot see, such as a minified dependency, is a build error. It
  is never an app that throws in production.
- **The fold does not depend on the kind of entry.** imp folds an HTML page, a JS module, and a
  module built for an imp host, with the environment that you selected for that build. So a
  published component carries no machinery for a flag, and the person who consumes it declares
  nothing.

## Consequences

- A disabled feature is absent from production, and not inert in it. So a flag works as a release
  gate, and not only as a switch at runtime. With a dynamic `import()` inside the gate, the whole
  dependency tree of a feature stays out of the build.
- Development and production differ by design here, and only here. `imp start` reads a flag while
  the page runs. So a change to a flag in an environment file is a reload, and not a rebuild. A
  build answers a flag once. The values are the same. Only the moment differs.
- The build must rewrite the source before esbuild sees it. The rewrite reuses the call scanner that
  imp already uses for `mockModule`, which understands a comment and a string. imp applies the
  rewrite only to a file that imports `flag` from `imp`, and it follows the local name when the
  import is renamed. So an unrelated function named `flag` stays as it is.
- A flag cannot answer anything that varies per user, per request or per session. That is data that
  an app loads into a state, and it is not a flag. imp offers no flag that it evaluates at runtime.
  A project that needs one reads a plain environment value, or fetches the answer.
- Every flag is a fork in the source, and somebody must remove it by hand when the feature ships.
  imp makes the state of each flag visible, because `imp build` prints
  `flags folded in - CHECKOUT_V2 off`. imp does not track the age of a flag, and it does not warn
  when a flag has been on everywhere for a year.
