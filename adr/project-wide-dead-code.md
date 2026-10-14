# Project-wide dead code - a module graph pass inside imp lint

## Context

The recommended lint rules already report dead code inside one file. `no-unused-vars` reports a
local or an import that nothing reads. `no-unreachable` reports a statement after a `return`. What
that set cannot report is dead code between two files. It cannot report an export that nothing
imports, or a module that nothing loads. Every core rule sees one file at a time, and it has no
notion that other files exist.

Nothing that exists closes that gap here. The `no-unused-modules` rule of `eslint-plugin-import`
needs a Node process, and a resolver with the semantics of Node. The linter of imp runs on the oxc
parser inside the binary, see `native-toolchain.md`. imp also resolves `imp/...`, the vendored `dependencies/`, and an alias from `imp.json`, by its own
rules. A separate tool such as knip would be a second Node process. That contradicts a binary that
works offline, with nothing installed.

## Decision

`imp lint` runs a pass over the whole project, beside the pass over each file. It reports three
findings, each at error severity. `imp/unreachable-module` reports a module that no chain of imports
reaches. `imp/unused-export` reports an exported name that no reachable module imports.
`imp/computed-import` reports a dynamic `import()` whose specifier imp cannot read.

The pass parses every module of the project with the same oxc parser that the lint rules use. It
walks the AST, and there is no second parser. It resolves a relative specifier with the module
resolution of imp. It then walks the graph, from the starting points that it discovers. The starting
points are these. Every `<script>` tag in an HTML page. Every `*.test.js`, `*.spec.js`,
`*.preview.js` and `*.mock.js` file. The modules that `preview.themes`, `preview.translations` and
`preview.groups` name in `imp.json`. Every script under `public/`. Every entry of
`lint.publicExports` in `imp.json`. A preview module is a starting point because nothing in the app
imports a groups module, and `imp preview` bundles it. A script under `public/` ships without a
change, so anything can load it. imp skips the pass completely for a project with no starting point.
The pass always reads the whole project, also when you give paths, because reachability is not a
fact about one file.

The walk decides reachability and usage together. An import counts as a reference only when a
starting point reaches the importing module. That is what makes the two findings consistent with
each other. A module that imp reports as unreachable cannot at the same time keep the export of
another module alive. So when you delete what the first finding names, no second finding appears
that the first one had hidden.

`lint.publicExports` is the escape hatch for code that the project itself cannot use. A bare path
makes a whole file public. A `path.js#name` entry makes one export public, and imp still checks the
rest of the file. A grant marks its exports as used the same way an import does, so it follows
`export *`. A bare path on a barrel makes every export public that the barrel takes from a star
target. imp's own library uses this for `api/icons.js`, which re-exports the whole icon set.

imp follows a dynamic `import()` as far as it can read the specifier, and no further:

- A **literal** specifier is a normal edge. It marks every export of the target as used, because the
  names that you take off a loaded module are usually computed.
- A **template with a literal folder in front** marks that folder as loaded, and its exports as
  used.
- imp does not follow a **computed** specifier. It reports `imp/computed-import`, and names the two
  ways out, which are a folder in the template, and the targets in `publicExports`. The other two
  checks then run as if the call loaded nothing.

imp resolves `export * from './x.js'` name by name. When you import a name from a barrel, and the
barrel does not declare that name itself, imp looks for the name in each star target. So imp still
checks the exports of the origin module one by one. Only `import * as ns`, and a literal `import()`,
mark the exports of a module as used as a whole.

A module that does not parse stops the pass for that run, and imp prints a note. The rules that read
one file already report the syntax error, and a file that imp cannot read could import anything.

## Consequences

- Dead code fails CI at the same severity as the other rules of imp. The pass costs one extra parse
  of the project per run. That is acceptable at the scale of the buildless projects that imp
  targets.
- Uncertainty is always a finding, and never a silent gap. A computed `import()` is an error, and
  not a reason to turn a check off. The alternative would leave one check running while the same
  unknown suppressed another check. That reports an inconsistent picture. imp would report an export
  that the hidden module may well use, and it would not report the module itself. To name the folder
  in a template is a small edit, and it gives imp the whole picture back. That is what the message
  asks for.
- Precision still comes before recall. To mark every export as used behind a dynamic import, and to
  mark a whole folder as used behind a template, are approximations that report too little. imp
  never tells a person to delete live code.
- Reachability is only as good as the starting points that imp discovers. So a project that loads
  code by a path that imp cannot see must declare that path in `publicExports`. That key is the one
  release valve for every false positive that the three checks can produce.
