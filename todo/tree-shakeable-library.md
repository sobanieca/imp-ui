# Make the imp library tree-shakeable

**Do this last** — scheduled after all standard library components (`stdlib-components.md`) and the
other library growth items (`reactivity-signals.md`, `router.md`) are implemented, so the shakeable
export pattern and the size checks are applied once, over the complete library surface, instead of
being reworked with every addition.

`imp build` tree-shakes the whole graph (esbuild dead-code elimination,
`adr/production-bundling.md`), and app modules shake perfectly — but the imp library itself is
all-or-nothing. Measured: an entry importing only `isPlainObject` gets a 3.2 kB imp chunk; one
importing `div`, `h1`, `html`, and `mount` gets 3.6 kB. Importing anything from `imp` ships
essentially everything.

The cause is the tag-factory export in `src/render.js`:

```js
export const { div, p, span, ... } = Object.fromEntries(TAGS.map((t) => [t, (...args) => el(t, ...args)]))
```

esbuild cannot prove the `Object.fromEntries(...)` call side-effect-free, and destructured bindings
from one initializer are kept or dropped together — so every factory (and everything they reach)
survives any import of the module.

## Work

- Replace the destructured export with individually analyzable exports, one per tag
  (`export const div = (...args) => el('div', ...args)` and so on). Repetitive, but statically
  shakeable; a small generator script could emit the block if maintaining it by hand grates.
- Audit the rest of `imp.js`/`render.js` for top-level expressions that pin code into every bundle
  (module-scope calls, shared mutable setup) and keep new library code side-effect-free at module
  scope as a rule.
- Verify with a bundle-size check: an entry importing a single helper must not pull the tag
  factories; consider asserting rough chunk-size expectations in the bundle tests so regressions
  surface.
- Public API must not change — same names, same `import { div } from 'imp'` shape
  (`adr/element-factory-syntax.md`).

At ~3.2 kB minified the current cost is negligible; it becomes real as the library grows — signals,
the router, and the stdlib components would otherwise all ride along into every production bundle.
In the meantime, new library code should still avoid module-scope side effects so the eventual
conversion stays mechanical.
