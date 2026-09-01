# Project-wide dead code - a module graph pass inside imp lint

## Context

ESLint's recommended set already reports dead code inside a file: `no-unused-vars` for a local or an
import nothing reads, `no-unreachable` for a statement after a `return`. What it cannot report is
dead code between files - an export nothing imports, a module nothing loads - because every core
rule sees one file at a time and has no notion that other files exist.

Nothing off the shelf closes that gap here. `eslint-plugin-import`'s `no-unused-modules` needs real
filesystem access and a Node-semantics resolver, while imp embeds `eslint/universal` - the
filesystem-free `Linter` (`in-process-toolchain.md`) - and resolves `imp/...`, vendored
`dependencies/`, and imp.json aliases by its own rules. A standalone tool like knip would be a
second Node process, contradicting a binary that works offline with nothing installed.

## Decision

`imp lint` runs a whole-project pass alongside the per-file one, reporting two error-severity
findings: `imp/unreachable-module` for a module no import chain reaches, and `imp/unused-export` for
an exported name no other module imports. The pass parses every project module with the same
embedded Linter (a collector rule over the AST, no second parser), resolves relative specifiers with
imp's own module resolution, and walks the graph from starting points it discovers: module
`<script>` tags in any HTML page, `*.test.js` / `*.spec.js` / `*.preview.js` / `*.mock.js`, every
script under `public/` (which ships verbatim, so anything may load it), and `lint.publicExports` in
imp.json. A project with no starting point is skipped entirely. The pass always reads the whole
project, even when paths are given, because reachability is not a per-file fact.

`lint.publicExports` is the escape hatch for code the project itself cannot use: a bare path makes a
whole file public, and `path.js#name` makes one export public while the rest of the file stays
checked.

Dynamic `import()` decides how far the graph can be trusted, so each shape is handled explicitly:

- a **literal** specifier is a normal edge, and marks every export of the target used, since the
  names taken off a loaded module are usually computed;
- a **template with a literal folder prefix** marks that folder loaded and its exports used;
- a **computed** specifier makes reachability unknowable, so `imp/unreachable-module` is switched
  off for that run and the reason is printed.

`export * from './x.js'` marks every export of `x` used rather than resolving the names through it.

## Consequences

- Dead code fails CI at the same severity as imp's other rules, and the pass costs one extra parse
  of the project per run - acceptable at the scale of buildless projects imp targets.
- The two checks fail differently, which is why only one is switched off by a computed `import()`:
  deleting an export flagged in error breaks the build loudly, while deleting a module that only a
  computed import loads breaks a route silently.
- The approximations - all exports used behind a dynamic import, `export *` not resolved through -
  cost recall, never precision. imp under-reports dead code rather than telling anyone to delete
  live code.
- Reachability is only as good as the discovered starting points, so any project loading code by a
  path imp cannot see must declare it in `publicExports`. That key is the single pressure valve for
  every false positive either check can produce.
