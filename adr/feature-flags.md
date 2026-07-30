# Feature flags: declared in `imp.json`, read as `flag('NAME')`, folded out by `imp build`

## Context

Environment values are read at runtime from the injected `__IMP_ENV__` global
(`adr/environments.md`), which is what keeps `imp start` and `imp build` on one mechanism. The cost
is that no bundler can see through a property read: an app gating a feature on an environment value
still ships every line behind the gate. The disabled feature is inert but present — readable in the
bundle, and switchable by anyone who sets the global before the entry module runs — so a gate meant
to hold a feature back does not actually hold it back.

Making the bundler see through `env` was tried and rejected. `env` is used as an object
(`import { env } from 'imp'`, then `env.X`), and esbuild's `define` does not substitute a name bound
by an import, so folding would have required stripping the import from user source and defining the
bare identifier `env` build-wide — hijacking that name in every bundled file including third-party
code. Worse, it could only ever be partial: `env.X` folds only for keys the selected environment
defines, so _omitting_ a key left the branch in the bundle, which is the opposite of what someone
turning a feature off expects.

A flag is a different thing from a configuration value, and the difference is what makes it
foldable: its domain is boolean, and an absent flag is off rather than undefined.

## Decision

- **Flags are declared in `imp.json`** as an array of names: `"flags": ["CHECKOUT_V2"]`. The
  declaration is an allowlist, so an undeclared name is an error rather than a flag that is silently
  off forever. Names may not start with `IMP_`, reserved for imp's own environment values.
- **State per environment comes from the environment file**, as `true`/`false` (or the strings
  `"true"`/`"false"`, since every value in a `.env` file is a string). Any other value fails the
  command. **A declared flag the selected environment does not mention is off**, so a new flag is
  safely off everywhere until an environment says otherwise.
- **A declared flag is not an env value.** Flag names are removed from the values injected as
  `__IMP_ENV__`, so `env.CHECKOUT_V2` is `undefined` and `flag()` is the only reader — there is no
  second, unfoldable door to the same switch.
- **One reader, `flag('NAME')`, exported from `imp`.** `imp start`, `imp preview` and `imp test`
  resolve it at runtime against a `__IMP_FLAGS__` global holding every declared flag with its value,
  injected beside `__IMP_ENV__`; an undeclared name throws, naming the declared flags. So a typo
  fails in development as loudly as it does in a build.
- **`imp build` folds every call.** Before bundling, each `flag('NAME')` in project sources, inline
  page scripts and vendored dependencies is replaced with the literal `true` or `false` for the
  selected environment, and the minifier drops what became unreachable — the branch, whatever only
  it reached, and any chunk a dynamic `import()` inside it would have produced. The build injects no
  `__IMP_FLAGS__` global: nothing in the output reads one.
- **The name must be a string literal at the call site.** A computed name fails the build rather
  than falling back to a runtime lookup, which is what makes the guarantee unconditional: after
  `imp build`, no flag check survives anywhere in the output.
- **The build verifies its own guarantee.** Before writing anything, it fails if a bundle still
  reads the flags global — which is the only way an unfolded reader can reach the output, since the
  library module holding it is otherwise tree-shaken. A form the rewrite cannot see (a minified
  dependency, say) is therefore a build error, never an app that throws in production.
- **Folding is not conditional on the entry kind.** An HTML page, a JS module, and a module built
  for an imp host are all folded with the environment selected for that build; a published component
  therefore carries no flag machinery and needs nothing declared by whoever consumes it.

## Consequences

- A disabled feature is absent from production rather than inert in it, so a flag is usable as a
  release gate and not merely as a runtime switch. Combined with a dynamic `import()` inside the
  gate, an entire feature's dependency tree stays out of the build.
- Development and production diverge by design here, and only here: `imp start` reads flags as the
  page runs (so flipping one in an environment file is a reload, not a rebuild) while a build
  answers them once. The values are identical; only the timing differs.
- The build must rewrite source before esbuild sees it. The rewrite reuses the comment- and
  string-aware call scanner already used for `mockModule`, and applies only to files that import
  `flag` from `imp` (following the local name when the import is renamed), so an unrelated function
  named `flag` is untouched.
- Flags cannot answer anything that varies per user, request or session — that is data an app loads
  into state, not a flag. imp does not offer a runtime-evaluated flag; a project needing one reads a
  plain environment value or fetches it.
- Every flag is a fork in the source that has to be removed by hand once the feature ships. imp
  makes the state of each one visible — `imp build` prints `flags folded in — CHECKOUT_V2 off` — but
  does not track a flag's age or warn when one has been on everywhere for a year.
