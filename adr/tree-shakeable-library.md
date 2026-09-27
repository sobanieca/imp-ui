# Tree-shakeable library: nothing runs at module scope

## Context

`imp build` shakes the whole graph with the dead-code elimination of esbuild, see
`production-bundling.md`. A module of an app shakes perfectly. The library did not. A bundler can
drop a module only when nothing in the module runs at import. It cannot prove that a call is safe to
skip. `const log = createLogger('imp')` at the top of a file could write to the console, register
something, or change a global. So the bundler keeps the statement. It then keeps the module, and
every module that the statement reaches.

Nearly every library file started with exactly that line, and the rest of the pattern was
everywhere. There was a memoized component factory, assigned from a call. There was an `Object.keys`
over a table. There was an object spread that merged shared tokens into a theme. The result was that
an import of anything pulled in nearly everything. An entry that only mounted a `div` carried the
state layer, the four built-in themes and the i18n machinery, at 17.3 kB. An entry that used one
standard component also carried every other component of its group, including `link`, and so the
router.

The person who writes such a line sees none of this. The code is correct, the tests pass, and the
cost lands in the bundle of every consuming app, with no message.

## Decision

**No library module does work when somebody imports it.** Module scope declares a function, a
constant and plain data. imp computes anything else on first use.

The rule is absolute, and it is not advice. The alternative was to mark each call `/* @__PURE__ */`,
so the bundler drops it. That spreads a compiler directive through the source. It is invisible when
it is missing. It is also a claim about a side effect that nothing checks. To restructure the code,
so that the calls are not there, is cleaner to read, and it is impossible to do half way. At module
scope, imp allows a call only to a global that cannot reach another module. Those are `Symbol`,
`Set`, `Map`, `WeakMap`, `WeakSet` and `Object.freeze`.

That rule shapes the code in four places:

- **There is one library logger, and not one per module.** `logger.js` exports a ready-made
  `impLogger`. Every module imports it, in place of a call to `createLogger('imp')` at the top.
  Every bundle holds `logger.js` in any case. So the object costs nothing where imp builds it, and
  the twenty-seven modules that log are not pinned by the act of logging.
- **A component export is a function, and never a call.** Each one reads
  `(...args) => defineComponent(name, () => definition)(...args)`. An arrow function is inert, so a
  bundler can drop the export. `defineComponent` memoizes the element by name. It builds the
  definition, the CSS string and the default messages the first time when somebody renders the
  component. That is also why the `styles` of a definition is a **function**. One `token()` call at
  module scope would pin the theme into every bundle.
- **imp assembles a token table lazily.** An object spread runs a getter, so a bundler must keep it.
  So imp builds the built-in themes, and the default set of tokens, inside a memoized function. An
  app that never calls `applyTheme` pays for none of the four themes. An app that uses a standard
  component pays only for the default values that the component falls back to.
- **imp writes a derived constant. It does not derive it.** An `Object.keys(TONE_TOKENS)` call, or a
  `BREAKPOINTS.slice(1)` call, at module scope, buys brevity and costs a pinned module. Where the
  value is a short fixed list, imp writes the list out.
- **`imp build` writes only the chunks that an entry can reach.** esbuild makes a chunk for every
  `import()` that it reads, also when it then drops the module that holds the call. Without a check,
  an app that imports only `list` from `imp/std/data` ships 1.1 MB of `map` world data. After the
  bundle, imp follows the imports from each entry through the output files. It removes each chunk
  that nothing reaches, with its license notices.

**Two tests hold the line, at different distances from the cause.** The first scans every library
module for a call at module scope, outside the allowed globals, and for CSS that a module builds
from tokens at module scope. It fails on the line that broke the rule, and it is what really catches
a mistake. The second builds real entries with `imp build`, and asserts what each one can contain. A
hello-world entry stays under 5 kB. All of `imp/html` costs meaningfully more than two tags. To add
`link` to an entry that uses `button` only costs meaningfully more than nothing. That test measures
the outcome, and not the rule. So it is the backstop for a regression that arrives another way, such
as a new dependency edge, or an update of the bundler. It is also coarse. esbuild sometimes drops a
module that the rule would keep. So a size test that passes is not evidence that the rule holds.

## Consequences

- An app pays for the parts of imp that it imports. A hello-world entry builds 3.7 kB, in place of
  17.3 kB. One standard component builds 14.9 kB, in place of 31.5 kB. A layout component builds
  16.3 kB, in place of 43.2 kB.
- The saving grows with how much of imp an app leaves unused. It falls to zero for an app that uses
  all of imp. The todo example touches every subject, and most components, and its library chunk
  falls by 6%. An app that adopts imp gradually gains the most, and so does a component published
  for an imp host, see `production-bundling.md`.
- A new library module that computes something at import time is a test failure, and not a silent
  cost. The failure says which line did it.
- Work moves from import time to first use, which is the correct place for it. imp builds the CSS
  string of a component once, with the registration of its element, and only when somebody renders
  the component.
- The cost is a little indirection where a constant would read better. You write `defaultTokens()`
  in place of `defaultTokens`, and `sizeRules()` in place of `sizeRules`. The parentheses remind you
  that imp builds the value on demand.
