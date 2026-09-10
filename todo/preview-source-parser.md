# Preview source parser - read metadata at runtime, parse the code panel with eslint

`cli/src/preview-source.js` is a hand-written tokenizer of about 600 lines. It reads the top-level
`import`, `export` and `const` statements of a preview file, with character spans. The state editor
of `imp preview` no longer scans source. It asks the running scenario for its states through the
provider lookup event, see `adr/component-preview.md`. The same move applies to the rest of what
this file reads, and the part that must stay textual has a better parser in the binary already.

## What the file produces today

`scanPreviewSource` and `scanGroupsModule` return three things per preview file:

- The scenario export names in file order, and the `name` and `group` metadata literals.
- The group module's `groups` object, as a map of key to `name`, read from the object literal text.
- The code panel per scenario. It slices the exported expression, strips a leading `() =>`, picks
  the `component:` property of a `{ scenario, component }` object, collects every identifier in that
  span, follows each to its import or helper declaration transitively, and prints imports, helpers
  and the call site.

The server uses the first two for two jobs: it sorts the catalog by group and name, and it warns
about a malformed `group` reference in `resolveGroupName` of `cli/src/preview.js`.

## Step 1 - move the metadata to the runtime

The browser imports the bundled preview module, so it holds the same facts:

- `Object.keys(module)` gives the scenario names. `cli/src/preview-runtime.js` reads them this way
  in `scenarioOrder` already, and uses the scanned `order` only to sort.
- `module.name` and `module.group` are values on the module.
- `readGroups` in the runtime reads the imported groups module already.

Move the catalog sort and the `group` warnings into the runtime. Then delete `scanGroupsModule`,
`readGroupNames`, `resolveGroupName`, and the metadata part of `scanPreviewSource`. Keep the warning
text. Print it in the browser console, or send it to the terminal through the dev server log.

## Step 2 - keep the code panel at build time, but parse with eslint

The call site must stay a build-time text job. The browser sees esbuild's reprint of the bundle, not
the author's text. Quotes are normalized, whitespace is rewritten, colliding names are renamed, and
imports are inlined. So no runtime route gives the panel what it shows:

- `Function.prototype.toString()` returns esbuild's output, not the file. It returns nothing for a
  value scenario such as `export const primary = button({ ... })`. It never includes the imports and
  the helpers.
- A copy of the raw file in the bundle, folded in like `impSkill`, gives the true text. But the
  slice still needs a parser, so the parser moves to the browser and costs bytes there for no gain.
- An import of the preview module in Deno is not possible. A scenario renders at module scope, and
  that needs the DOM.

Replace the tokenizer with the vendored eslint parser. `cli/src/dead-code.js` shows the pattern: a
`Linter` with one collector rule, run through `verify`. The AST gives every span the panel needs:

- `ExportNamedDeclaration` gives each scenario. `VariableDeclarator.init.range` gives the exact
  author text of its value. An `ObjectExpression` yields the range of its `component` property.
- `ImportDeclaration` and top-level declarations give the bindings with ranges.
- Scope analysis, `sourceCode.getScope(node).through`, lists the free identifiers of the expression.
  That replaces `identifiersIn`, the template-literal walker, and the property-name and object-key
  heuristics.

Only the rendering stays: slice the ranges, strip `() =>`, and join imports, helpers and the call
site with the current line-width rule for a long import.

## Outcome

The exact author text is kept. Most of `preview-source.js` goes away, with the class of bugs where
the hand tokenizer misreads a multi-line expression, a comment, or an object key. `imp preview` then
reads a scenario the same way twice: the running module for what it is, and the AST for how it was
written.

Update `adr/component-preview.md` in the same change, so it describes only the new design. Keep the
snapshots under `cli/test/snapshots/preview-*.txt` green. They pin the text of the code panel.
