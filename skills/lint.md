# lint - the imp rules and how to fix them

```
imp lint [...paths]          default: the whole project
imp lint --fix [...paths]    apply every available autofix
```

`imp lint` checks `.js`, `.mjs` and `.cjs` files, and an inline `<script>` block in an `.html` file.
It reports an inline block at its real line. It skips a script with a `src` attribute, and a script
with a type that is not JavaScript. imp lints the code as a modern browser ES module, with the
browser globals. imp always skips `.git`, `node_modules`, `dist` and the vendored `dependencies/`
folder. The command exits `1` when an **error** remains, and `0` when only warnings remain. **Run
`imp lint` and `imp fmt` after every batch of edits.**

The base is a standard recommended JavaScript rule set that uses the ESLint rule names. imp adds its
own rules. imp always applies them as errors, and you cannot reconfigure them.

| Rule                             | Flags                                                                                                                    | Fix                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `imp/no-capital-component`       | a function or function-valued variable whose name starts with a capital                                                  | imp components are lowercase functions; write `widget`                                 |
| `imp/single-props-object`        | more than one object literal passed to an element factory, `el`, or a standard component                                 | merge them into one object - at runtime later keys silently win                        |
| `imp/state-name-namespace`       | a literal state name without a namespace in `initState` or `useState`                                                    | use dot-separated segments: `myapp.user`                                               |
| `imp/http-client-name-namespace` | a literal http client name without a namespace in `createHttpClient`, `initHttpClient` or `useHttpClient`                | use dot-separated segments: `myapp.api`                                                |
| `imp/watch-with-self`            | a `.watch(fn)` in `setup`/`error`/`onMount` on a state, `lang`, `theme` or `useRoute()` whose stop is discarded          | pass `self` first: `theme.watch(self, fn)`, or keep the stop and call it in `onRemove` |
| `imp/self-first-argument`        | `initState`/`useState`/`initHttpClient`/`useHttpClient` with a literal, object, function or no first argument            | pass `self` first: `useState(self, 'myapp.user')`                                      |
| `imp/no-self-in-loading`         | a state or http resolution, `useRoute`, a `text`/`view`/`each`/`watch` or a bound handle inside `loading`                | render a plain value in `loading`; resolve and bind in `setup`                         |
| `imp/loading-with-async-setup`   | `loading` next to a `setup` that is not `async` and returns only DOM                                                     | make `setup` async or return a promise, or remove `loading`                            |
| `imp/on-remove-through-self`     | in `onRemove`: `useState`/`useHttpClient` of a name `setup` never resolved, `initState`, `initHttpClient`, `watch(self)` | resolve the name in `setup`, then reach it again in `onRemove`                         |
| `imp/no-self-at-module-scope`    | `self`, a property of `self` or a handle resolved through `self` assigned to a module-scope variable in a hook           | store it on `self`: `self.field = ...`                                                 |
| `imp/abort-check-after-await`    | a resolution through `self` after an `await` in an async `setup` with no `self.abortSignal` guard                        | check `self.abortSignal.aborted` after the `await`, or pass the signal to the call     |

A rule that names a hook (`setup`, `loading`, `error`, `onMount`, `onRemove`) looks only at an
object literal passed to `component(...)` from `imp` or `router(...)` from `imp/router`. A `setup`
key in any other object, such as a bundler plugin, is not a hook. | `imp/no-state-as-child` | a
state handle, `lang`, `dir`, `theme` or `useRoute()` passed as a child of an element or a standard
component | render it with `text()`, `view(fn)` or `each(fn)`, or bind a prop with the handle | |
`imp/no-get-in-binding` | `handle.get()` as a prop value of an element or a standard component |
pass the handle itself: `{ disabled: busy }` | | `imp/no-root-query-in-setup` |
`querySelector`/`querySelectorAll`/`getElementById` on `self.host.shadowRoot` inside `setup` | keep
the node you built in a variable, or query in `onMount` | | `imp/component-name` | a literal
`component()` name that is not lowercase-with-a-dash (or is HTML-reserved) | name it
`my-app-profile` | | `imp/import-source` | an imp export imported from the wrong specifier |
autofixed - the name is moved to the right import | | `imp/icons-by-name` | `import * as`,
`export *` or `import()` of `imp/icons` | import each icon by name:
`import { luHouse } from 'imp/icons'` | | `imp/exact-dependency-versions` | inexact pins in
`imp.json`, inline `npm:`/`jsr:` specifiers, undeclared bare imports, unknown `imp/...` subpaths |
pin exactly, or run the `imp install` command the message prints |

Each rule protects one subject. Read [components](components.md) for the component rules,
[state](state.md) for the state rules, [http](http.md) for the http client rules,
[rendering](rendering.md) for the props rule, [imports](imports.md) for `import-source`,
[icons](icons.md) for `icons-by-name`, and [dependencies](dependencies.md) for the pin rule.

imp does not check a name that you build dynamically, such as a variable or a template with an
expression. The runtime does the same validation, and a bad name throws there.

This is a sample of the output. Every finding carries its severity, its rule and its location:

```
error[imp/import-source]: 'div' is not exported by 'imp' - it comes from 'imp/html': import { div } from 'imp/html'
 --> src/app.js:1:21

Found 1 problem
Checked 8 files
```

## File-size check

`imp lint` also scans every file that git tracks. It reports an error for any single file that is
larger than `maxFileSize`. The default limit is 200 kB. So an oversized commit fails CI. To exempt a
file that must be large, give its path:

```json
{ "maxFileSize": 262144, "maxFileSizeIgnore": ["assets/hero.png"] }
```

An ignored path can be one file or a folder. Outside a git repository, imp skips the scan.

## Dead code (project-wide)

Three checks read the whole project, not one file. They run also when you give paths. The starting
points are these:

- any `<script src>` in an HTML page, both module and classic, and any inline module block;
- every `*.test.js`, `*.spec.js`, `*.preview.js` and `*.mock.js` file;
- the modules that `preview.themes`, `preview.translations` and `preview.groups` name in `imp.json`;
- every script under `public/`;
- every `publicExports` entry.

When there is no starting point anywhere, imp skips all three checks. imp follows an import only. So
a module that `new Worker(...)` or `new URL(..., import.meta.url)` loads is unreachable until you
list it in `publicExports`.

| Rule                     | Flags                                                  | Fix                                                                   |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `imp/unreachable-module` | a module no import chain reaches from a starting point | delete the file, or declare it in `publicExports`                     |
| `imp/unused-export`      | an export of a reachable module that nothing imports   | delete the export, or declare it in `publicExports`                   |
| `imp/computed-import`    | `import(path)` with a specifier imp cannot read        | name the folder in a template, or list the targets in `publicExports` |

imp never reports the exports of a starting point. imp still follows a path that you `exclude`, but
it never reports that path.

`publicExports` is the escape hatch for code that something outside the project uses. A bare path
makes the whole file public. A `#name` suffix makes one export public and leaves the rest checked:

```json
{ "lint": { "publicExports": ["src/sdk.js", "src/plugin.js#register"] } }
```

imp handles `import()` in three ways. It follows a literal specifier and marks every export of the
target as used. A template with a literal folder, such as `` `./locales/${code}.js` ``, marks that
folder as loaded and used. A computed specifier, such as `import(path)`, is the
`imp/computed-import` error. To fix it, name the folder in a template, or list what it loads in
`publicExports`. imp follows `export * from './x.js'` name by name, so it still reports an export
that nothing takes off the barrel. Only a reachable module counts as an importer, so the imports of
a dead file keep nothing alive. A file that does not parse stops all three checks for that run, and
imp prints a `note:` line.

```
error[imp/unreachable-module]: nothing imports src/orphan.js - no entry page, test, preview setting or public export reaches it; delete it, or add it to "publicExports" in imp.json if it is used from outside the project
 --> src/orphan.js:1:1

error[imp/unused-export]: 'unusedHelper' is exported by src/lib.js but nothing imports it - delete it, or add it to "publicExports" in imp.json if it is used from outside the project
 --> src/lib.js:3:14
```

## Configuration and suppression

The configuration lives under `lint` in `imp.json`, see [config](config.md):

```json
{
  "lint": {
    "rules": { "no-unused-vars": "off", "eqeqeq": "warn" },
    "exclude": ["legacy/"],
    "publicExports": ["src/sdk.js"]
  }
}
```

A severity is `"off"`, `"warn"` or `"error"`. An invalid `lint` block fails the command with an
explanation. imp's own rules ignore this block. To suppress one finding, put a comment on the line
above. You can list the rules there, by the bare name or by the full name:

```js
// imp-lint-ignore no-capital-component
const Widget = () => div('widget')
```

`// imp-lint-ignore-file` disables a whole file, from anywhere in the file. It also accepts rule
names.

## `--fix`

`--fix` rewrites a file in place with every available autofix. It works inside an HTML `<script>`
block as well. imp reports everything that needs a decision from a person. imp never fixes a finding
that an `imp-lint-ignore` comment suppresses, and it keeps the comments. Commit or stash your work
before a `--fix` run, so the rewrites are easy to review.

```
Fixed 1 file
Found 1 problem
Checked 8 files
```
