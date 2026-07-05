# imp — Linting

```
imp lint [...paths]
imp lint --fix [...paths]
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

Dependencies are vendored: declared under `dependencies` in `imp.json` and bundled into your
project's `dependencies/` folder by `imp install` (see
**[Managing dependencies](dependencies.md)**). This rule enforces that model in all three places a
dependency can appear:

- **Pins in `imp.json` must be exact.** Every `dependencies` entry must be an `npm:`/`jsr:`
  specifier with an exact version (`npm:mitt@3.0.1` — never `npm:mitt@3`, `npm:mitt@^3.0.1`, or a
  bare `npm:mitt`). There is no lock file: the exact pin plus the committed bundle are what make
  resolution reproducible.

  ```
  error[imp/exact-dependency-versions]: dependency 'dayjs': 'npm:dayjs@1' must pin an exact version ('1' is not an exact version) — the vendored bundle in dependencies/ is built from this pin (e.g. 'npm:dayjs@1.0.0'); run 'imp install' to re-resolve and re-pin it
   --> imp.json:1:1
  ```

- **No inline `npm:`/`jsr:` specifiers in code.** Dependencies are installed, not imported by URL:

  ```js
  import mitt from 'npm:mitt@3.0.1'
  ```

  ```
  error[imp/exact-dependency-versions]: 'npm:mitt@3.0.1' is an inline dependency specifier — dependencies are vendored: run 'imp install mitt@3.0.1' and import 'mitt' instead
   --> src/app.js:1:18
  ```

- **Bare imports must be declared.** A bare specifier (anything that is not relative, absolute, a
  URL, or `imp` itself) must match a declared dependency alias:

  ```js
  import confetti from 'canvas-confetti'
  ```

  ```
  error[imp/exact-dependency-versions]: 'canvas-confetti' is not a declared dependency — run 'imp install canvas-confetti' to vendor it and add it to 'dependencies' in imp.json
   --> src/app.js:1:22
  ```

The rule checks static imports, re-exports, and dynamic `import()` calls with a literal specifier.

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

## Applying fixes

Many rules know how to repair the code they flag. Run `imp lint --fix` to apply every available
autofix and rewrite the affected files in place:

```
imp lint --fix
```

Only problems with a known fix are changed; anything that needs a human decision (an imp rule
violation, an unused variable, …) is left untouched and still reported. In `.html` files the inline
`<script>` blocks are fixed just like standalone modules. Problems you have silenced with an
`imp-lint-ignore` comment are never fixed, and the ignore comments themselves are preserved exactly
as written.

After a fix run, the summary counts the files that changed alongside the problems that remain:

```
Fixed 1 file
Found 1 problem
Checked 8 files
```

The exit code follows the same rule as a plain run: `1` if any error remains after fixing, `0`
otherwise. It is good practice to commit or stash your work before a `--fix` run so the rewrites are
easy to review.

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
