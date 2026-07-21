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

imp components are lowercase functions — element factories and `component()` factories alike — and
there is no JSX, so a capitalized function name signals a habit from another framework. The rule
flags function declarations and function-valued variables whose name starts with a capital letter:

```js
const Widget = () => div('widget')
```

```
error[imp/no-capital-component]: 'Widget' starts with a capital letter — imp components are lowercase functions (write 'widget')
 --> src/widget.js:1:7
```

### `imp/single-props-object`

An element takes at most one props object; everything else you pass is a child. Passing a second
object literal to an element factory is almost always a mistake — at runtime the objects are merged
and later keys silently win. The rule flags any call to a built-in element factory (`div`, `span`,
…, and the generic `el`) that receives more than one object literal:

```js
div({ class: 'card' }, { onclick: open }, 'Open')
```

```
error[imp/single-props-object]: multiple props objects passed to 'div' — pass a single props object; later keys win
 --> src/app.js:1:26
```

Merge the properties into one object instead. For `el`, the leading tag argument is ignored, so only
the object literals after it are counted.

### `imp/state-name-namespace`

State names must carry a namespace: at least two non-empty dot-separated segments, like `myapp.user`
(see **[State](state.md)**). The rule checks every `initState`/`useState` call whose name is written
literally:

```js
const user = initState('user', { name: 'Ada' })
```

```
error[imp/state-name-namespace]: state name 'user' must include a namespace — use dot-separated segments like 'myapp.user'
 --> src/app.js:1:24
```

Names built dynamically (a variable, a template with expressions) are not checked statically — the
same validation then happens at runtime, where a bad name throws.

### `imp/state-setup-before-await`

In an async `onMount`, state resolution must happen **before the first `await`** (see
**[State](state.md)**). Past it, the mounting component is out of reach and `initState`, `useState`,
and `watch` all throw at runtime — this rule catches them earlier, as you write them. It flags
`initState`/`useState` calls placed after an `await` in an async `onMount`, and `watch` called there
on a handle the file created with `initState`, `useState`, or `computed` (tracking the handle keeps
unrelated third-party `.watch()` methods out of the reports):

```js
const orders = component('my-app-orders', {
  onMount: async () => {
    const totals = initState('myapp.totals', [])
    const data = await fetch('/api/orders').then((response) => response.json())
    const orders = initState('myapp.orders', data)
    totals.watch((current) => console.log(current))
    return ul(orders.each((order) => li(order.title), (order) => order.id))
  },
})
```

```
error[imp/state-setup-before-await]: 'initState' runs after an await in an async onMount — past the first await the mounting component is out of reach and the call throws; resolve states before the first await (set() and DOM built from the handles work after it)
 --> src/orders.js:5:20

error[imp/state-setup-before-await]: 'totals.watch' runs after an await in an async onMount — past the first await there is no mounting component to own the subscription and the call throws; call watch before the first await, or bind the state to DOM with text/view/each or a state-valued prop instead
 --> src/orders.js:6:5
```

Initialize the state with an empty value first, `await` the data, then `set` it in — the handle
lives on in the closure, and reads and writes are allowed anywhere. Only resolution and `watch` are
position-sensitive: the DOM you build from the handles (`text`/`view`/`each`, bound props) can come
after the `await` and goes live when the component mounts it.

### `imp/component-name`

Component names become real element tags, so they must be lowercase with at least one dash, like
`my-app-profile` (see **[Components](components.md)**) — that is what makes them valid custom
element names, and the leading segment doubles as your app's namespace. The rule checks every
`component` call whose name is written literally:

```js
export const profile = component('profile', { onMount: () => div('…') })
```

```
error[imp/component-name]: component name 'profile' must be lowercase with at least one dash — like 'my-app-profile'
 --> src/profile.js:1:34
```

A handful of names reserved by the HTML standard (`font-face`, `missing-glyph`, …) are also
rejected. Dynamically built names are validated at runtime instead, where a bad name throws.

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
  URL, `imp` itself, or `imp/test`) must match a declared dependency alias:

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
