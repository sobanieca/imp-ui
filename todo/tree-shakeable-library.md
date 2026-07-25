# Make the rest of the imp library tree-shakeable

`imp build` tree-shakes the whole graph (esbuild dead-code elimination,
`adr/production-bundling.md`), and app modules shake perfectly. Two of the three obstacles on the
library side are gone: per-subject specifiers (`adr/library-import-namespaces.md`) mean an app never
pays for a subject it does not import, and `imp/html` now declares one analyzable export per tag, so
an entry using two tags builds 3.8 kB against 6.1 kB for one using all seventy-seven.

What is left is everything a subject's module pulls in wholesale once you import **anything** from
it: state, the router, theming and the std groups are each all-or-nothing, because their exports
reach shared internals and, in places, run work at module scope.

**Schedule this after the standard library components land** (`stdlib-components.md`), so the
remaining audit is done once over the complete surface rather than reworked with every addition.

## Work

- Audit every module for top-level expressions that pin code into a bundle — module-scope calls
  (`createState` at import time in `theme.js` is one), shared mutable setup — and keep new library
  code side-effect-free at module scope as a rule.
- Check the `api/` barrels stay pure re-exports so importing one name from a subject cannot drag the
  rest of it in.
- Verify with bundle-size assertions in the CLI tests: an entry importing one helper from a subject
  must not carry the whole subject, and the tag-shaking result above must not regress.
- Public API must not change — same names, same specifiers (`adr/element-factory-syntax.md`,
  `adr/library-import-namespaces.md`).

The cost is small today and grows with the library: without this, the router, theming and every std
component ride along into a production bundle that touched one export from their module.
