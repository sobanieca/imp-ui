# Tree-shakeable library: nothing runs at module scope

## Context

`imp build` tree-shakes the whole graph with esbuild's dead-code elimination
(`production-bundling.md`), and application modules shake perfectly. The library did not. A bundler
may only drop a module when nothing in it runs on import, and it cannot prove that a call is safe to
skip: `const log = createLogger('imp')` at the top of a file might write to the console, register
something, or mutate a global. So the statement is kept - and with it the module, and every module
that one reaches.

Almost every library file opened with exactly that line, and the rest of the pattern was everywhere:
a memoized component factory assigned from a call, `Object.keys` over a table, an object spread that
merges shared tokens into a theme. The result was that importing anything pulled in nearly
everything. An entry that only mounted a `div` carried the state layer, the four built-in themes and
the i18n machinery at 17.3 kB; an entry using one standard component also carried every other
component in its group, including `link` and therefore the router.

None of this is visible to whoever writes it. The code is correct, the tests pass, and the cost
lands silently in every consuming app's bundle.

## Decision

**No library module does work when it is imported.** Module scope declares functions, constants and
plain data. Anything that has to be computed is computed on first use.

The rule is absolute rather than advisory, because the alternative - marking each call
`/* @__PURE__ */` so the bundler drops it - spreads a compiler directive through the source, is
invisible when it is missing, and is a claim about side effects that nothing checks. Restructuring
so the calls are not there is both cleaner to read and impossible to get half-right. The only calls
allowed at module scope are to globals that cannot reach another module: `Symbol`, `Set`, `Map`,
`WeakMap`, `WeakSet`, `Object.freeze`.

That rule shapes the code in four places:

- **One library logger, not one per module.** `logger.js` exports a ready-made `impLogger`, and
  every module imports it instead of calling `createLogger('imp')` at its top. `logger.js` is in
  every bundle anyway, so the object costs nothing where it is built - and the twenty-seven modules
  that log are no longer pinned by the act of logging.
- **A component export is a function, never a call.** Each one reads
  `(...args) => defineComponent(name, () => definition)(...args)`: an arrow function is inert, so
  the export is droppable, while `defineComponent` memoizes the element by name and builds the
  definition, the CSS string and the default messages the first time the component is actually
  rendered. This is also why the definition's `styles` is a **function**: one `token()` call at
  module scope would pin the theme into every bundle.
- **Token tables are assembled lazily.** An object spread runs getters, so a bundler must keep it;
  the built-in themes and the default token set are therefore built inside memoized functions. An
  app that never calls `applyTheme` pays for none of the four themes, and an app that uses standard
  components pays only for the default values they fall back to.
- **Derived constants are written, not derived.** A `Object.keys(TONE_TOKENS)` or
  `BREAKPOINTS.slice(1)` at module scope buys brevity and costs a pinned module; where the value is
  a short fixed list, it is spelled out.

**Two tests hold the line, at different distances from the cause.** One scans every library module
for a module-scope call outside the allowed globals, and for CSS built from tokens at module scope;
it fails on the line that broke the rule and is what actually catches a slip. The other builds real
entries with `imp build` and asserts what they may contain: a hello-world stays under 5 kB, all of
`imp/html` costs meaningfully more than two tags, and adding `link` to a `button`-only entry costs
meaningfully more than nothing. It measures the outcome rather than the rule, so it is the backstop
for a regression arriving some other way - a new dependency edge, a bundler upgrade - and it is
coarse: esbuild sometimes drops a module the rule would have kept, so a passing size test is not
evidence that the rule holds.

## Consequences

- An app pays for the parts of imp it imports. A hello-world builds 3.7 kB instead of 17.3 kB, one
  standard component 14.9 kB instead of 31.5 kB, a layout component 16.3 kB instead of 43.2 kB.
- The saving scales with how much of imp an app leaves unused and goes to zero for an app that uses
  all of it: the todo example, which touches every subject and most components, drops 6% of its
  library chunk. Gradual adopters and components published for an imp host
  (`production-bundling.md`) gain the most.
- Adding a library module that computes something at import time is a test failure rather than a
  silent cost, and the failure says which line did it.
- Work moves from import time to first use, which is the right place for it - a component's CSS
  string is built once, with its element registration, only if it is ever rendered.
- The cost is a little indirection where a value used to be a constant: `defaultTokens()` rather
  than `defaultTokens`, `sizeRules()` rather than `sizeRules`. The parentheses are the reminder that
  the value is built on demand.
