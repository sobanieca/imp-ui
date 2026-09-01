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

`imp lint` runs a whole-project pass alongside the per-file one, reporting three error-severity
findings: `imp/unreachable-module` for a module no import chain reaches, `imp/unused-export` for an
exported name no reachable module imports, and `imp/computed-import` for a dynamic `import()` whose
specifier imp cannot read. The pass parses every project module with the same embedded Linter (a
collector rule over the AST, no second parser), resolves relative specifiers with imp's own module
resolution, and walks the graph from starting points it discovers: module `<script>` tags in any
HTML page, `*.test.js` / `*.spec.js` / `*.preview.js` / `*.mock.js`, every script under `public/`
(which ships verbatim, so anything may load it), and `lint.publicExports` in imp.json. A project
with no starting point is skipped entirely. The pass always reads the whole project, even when paths
are given, because reachability is not a per-file fact.

The walk decides reachability and usage together: an import counts as a reference only when the
importing module is itself reached from a starting point. This is what makes the two findings
consistent with each other - a module reported unreachable cannot at the same time be keeping
another module's export alive, so deleting what the first finding names never surfaces a second
finding it had been hiding.

`lint.publicExports` is the escape hatch for code the project itself cannot use: a bare path makes a
whole file public, and `path.js#name` makes one export public while the rest of the file stays
checked.

Dynamic `import()` is followed as far as its specifier can be read, and no further:

- a **literal** specifier is a normal edge, and marks every export of the target used, since the
  names taken off a loaded module are usually computed;
- a **template with a literal folder prefix** marks that folder loaded and its exports used;
- a **computed** specifier is not followed. It is reported as `imp/computed-import`, naming the two
  ways out - a folder in the template, or the targets in `publicExports` - and the other two checks
  run as if the call loaded nothing.

`export * from './x.js'` is resolved name by name: a name imported from the barrel that the barrel
does not declare itself is looked for in each star target, so the origin module's exports are still
checked individually. Only `import * as ns` and a literal `import()` mark a module's exports used
wholesale.

A module that does not parse stops the pass for that run with a printed note: the per-file rules
already report the syntax error, and a file that cannot be read could import anything.

## Consequences

- Dead code fails CI at the same severity as imp's other rules, and the pass costs one extra parse
  of the project per run - acceptable at the scale of buildless projects imp targets.
- Uncertainty is always a finding, never a silent gap. A computed `import()` is an error rather than
  a reason to switch a check off, because the alternative - leaving one check running while another
  is suppressed by the same unknown - reports an inconsistent picture: an export the hidden module
  might well use is flagged, while the module itself is not. Naming the folder in a template is a
  small edit that gives imp the whole picture back, and it is what the message asks for.
- Precision over recall still holds: all exports used behind a dynamic import, a whole folder used
  behind a template, are approximations that under-report. imp never tells anyone to delete live
  code.
- Reachability is only as good as the discovered starting points, so any project loading code by a
  path imp cannot see must declare it in `publicExports`. That key is the single pressure valve for
  every false positive any of the three checks can produce.
