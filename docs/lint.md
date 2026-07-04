# imp — Linting

```
imp lint [...paths]
```

`imp lint` checks your code with a standard recommended rule set plus imp's own rules. The linter is
built into the `imp` binary — there is nothing to install or configure, it works offline, and a
given imp release lints the same way on every machine.

Given paths (files or directories) are checked; with no paths, the whole project is. The command
exits with an error if a given path does not exist.

## What gets linted

`imp lint` checks `.js`, `.mjs`, and `.cjs` files — and `.html` files too: inline `<script>` blocks
are linted like any other module, with problems reported at their real line in the HTML file.
Scripts with a `src` attribute are skipped (the file they point to is linted on its own), as are
scripts whose `type` is neither a JavaScript type nor `module`.

Code is linted as modern browser code: ES modules, current JavaScript syntax, and browser globals
(`document`, `fetch`, `localStorage`, …) are all recognized.

Directories named `.git`, `node_modules`, and `dist` are always skipped. Additional paths can be
skipped with `exclude` (see _Configuration_ below).

## The rule set

The base is a standard recommended rule set for JavaScript. Rule names follow the widely used ESLint
naming, so any rule you know from that ecosystem is spelled the same here.

On top of the base set, imp's own rules are always applied as errors:

### `imp/no-capital-component`

imp components are lowercase functions — there is no framework component concept and no JSX, so a
capitalized function name signals a habit from another framework. The rule flags function
declarations and function-valued variables whose name starts with a capital letter:

```js
const Widget = () => div('widget')
```

```
error[imp/no-capital-component]: 'Widget' starts with a capital letter — imp components are lowercase functions (write 'widget')
 --> src/widget.js:1:7
```

### `imp/exact-dependency-versions`

Every `npm:`/`jsr:` specifier must pin an exact version (`npm:mitt@3.0.1` — never `npm:mitt@3`,
`npm:mitt@^3.0.1`, or a bare `npm:mitt`). imp has no lock file: the versions written in your code
are what make dependency resolution reproducible across machines, so ranges and missing versions are
reported.

The rule checks every place a dependency can be declared: static imports, re-exports, dynamic
`import()` calls with a literal specifier, and the `imports` aliases in `imp.json`. Inline
`npm:`/`jsr:` specifiers are how imp apps declare dependencies — no rule forbids them, only the
version pinning applies.

```js
import mitt from 'npm:mitt@3'
```

```
error[imp/exact-dependency-versions]: 'npm:mitt@3' must pin an exact version ('3' is not an exact version) — imp has no lock file, so exact versions (e.g. 'npm:mitt@3.0.0') keep dependency resolution reproducible
 --> src/app.js:1:18
```

## Configuration

Extra lint configuration lives under `lint` in `imp.json` and is layered on top of the base set:

```json
{
  "lint": {
    "rules": { "no-unused-vars": "off", "eqeqeq": "warn" },
    "exclude": ["legacy/"]
  }
}
```

- **`rules`** — per-rule severities: `"off"`, `"warn"`, or `"error"`. Warnings are reported but do
  not fail the command; errors make it exit non-zero.
- **`exclude`** — project-relative paths to skip.

imp's own rules are always applied as errors and cannot be reconfigured — for a deliberate one-off
exception, use an ignore comment (below).

An invalid `lint` block (an unknown rule, a bad severity) fails the command with a message
explaining what is wrong:

```
error: invalid lint configuration in imp.json — Key "rules": Key "eqeqeq": Expected severity of "off", 0, "warn", 1, "error", or 2.
```

## Suppressing findings in code

To suppress a finding, put an ignore comment on the line above. A rule list is optional and
comma-separated; without one, everything on that line is ignored:

```js
// imp-lint-ignore no-capital-component
const Widget = () => div('widget')
```

To disable linting for a whole file (optionally only for the listed rules), put the file-level
directive anywhere in the file:

```js
// imp-lint-ignore-file
```

imp rule names can be written bare (`no-capital-component`) or fully qualified
(`imp/no-capital-component`) — both work.

## Output and exit code

Each finding is printed with its severity, rule name, and location:

```
warning[eqeqeq]: Expected '===' and instead saw '=='.
 --> src/app.js:12:11

Found 1 problem
Checked 8 files
```

The command exits `0` when there are no findings or only warnings, and `1` when there is at least
one error.
