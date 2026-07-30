# lint — the imp rules and how to fix them

```
imp lint [...paths]          default: the whole project
imp lint --fix [...paths]    apply every available autofix
```

Checks `.js`, `.mjs`, `.cjs`, and inline `<script>` blocks in `.html` (reported at their real line;
`src` scripts and non-JS types are skipped). Code is linted as modern browser ES modules with
browser globals. `.git`, `node_modules` and `dist` are always skipped. Exits `1` when any **error**
remains, `0` for warnings only. **Run `imp lint` and `imp fmt` after every batch of edits.**

The base is a standard recommended JavaScript rule set with ESLint's rule names. On top of it, imp's
own rules are always applied as errors and cannot be reconfigured.

| Rule                                 | Flags                                                                                                          | Fix                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `imp/no-capital-component`           | a function or function-valued variable whose name starts with a capital                                        | imp components are lowercase functions; write `widget`                                      |
| `imp/single-props-object`            | more than one object literal passed to an element factory, `el`, or a standard component                       | merge them into one object — at runtime later keys silently win                             |
| `imp/state-name-namespace`           | a literal state name without a namespace                                                                       | use dot-separated segments: `myapp.user`                                                    |
| `imp/state-setup-before-await`       | `initState`/`useState`, or `watch` on a state handle, after an `await` in an async `onMount`                   | resolve states before the first `await`; `set` and DOM built from the handles work after it |
| `imp/http-client-name-namespace`     | a literal http client name without a namespace                                                                 | use dot-separated segments: `myapp.api`                                                     |
| `imp/http-client-setup-before-await` | `initHttpClient`/`useHttpClient` after an `await` in an async `onMount`                                        | resolve the client before the first `await`; calls through the handle work after it         |
| `imp/no-root-query-in-mount`         | `querySelector`/`querySelectorAll`/`getElementById` on `instance.root` inside `onMount`                        | keep the node you built in a variable, or query in `instance.afterMount(cb)`                |
| `imp/component-name`                 | a literal `component()` name that is not lowercase-with-a-dash (or is HTML-reserved)                           | name it `my-app-profile`                                                                    |
| `imp/import-source`                  | an imp export imported from the wrong specifier                                                                | autofixed — the name is moved to the right import                                           |
| `imp/exact-dependency-versions`      | inexact pins in `imp.json`, inline `npm:`/`jsr:` specifiers, undeclared bare imports, unknown `imp/…` subpaths | pin exactly, or run the `imp install` command the message prints                            |

Each rule guards a subject: read [components](components.md) for the component rules,
[state](state.md) for the state rules, [http](http.md) for the http client rules,
[rendering](rendering.md) for the props rule, [imports](imports.md) for `import-source`, and
[dependencies](dependencies.md) for the pin rule.

Names built dynamically (a variable, a template with expressions) are not checked statically — the
same validation happens at runtime, where a bad name throws.

Sample output — every finding carries its severity, rule and location:

```
error[imp/import-source]: 'div' is not exported by 'imp' — it comes from 'imp/html': import { div } from 'imp/html'
 --> src/app.js:1:21

Found 1 problem
Checked 8 files
```

## File-size check

`imp lint` also scans every git-tracked file and errors on any single file larger than `maxFileSize`
(200 kB default), so oversized commits fail CI. Exempt legitimately large files by path:

```json
{ "maxFileSize": 262144, "maxFileSizeIgnore": ["assets/hero.png"] }
```

An ignored path may be an exact file or a folder. Outside a git repository the scan is skipped.

## Configuration and suppression

Under `lint` in `imp.json` — see [config](config.md):

```json
{ "lint": { "rules": { "no-unused-vars": "off", "eqeqeq": "warn" }, "exclude": ["legacy/"] } }
```

Severities are `"off"`, `"warn"`, `"error"`; an invalid `lint` block fails the command with an
explanation. imp's own rules ignore this block — suppress a one-off with a comment on the line
above, optionally listing rules (bare or fully qualified names both work):

```js
// imp-lint-ignore no-capital-component
const Widget = () => div('widget')
```

`// imp-lint-ignore-file` (optionally with rule names) disables a whole file, anywhere in it.

## `--fix`

Rewrites files in place with every available autofix, including inside HTML `<script>` blocks, and
leaves everything needing a human decision reported. Findings suppressed by `imp-lint-ignore` are
never fixed, and the comments are preserved. Commit or stash before a `--fix` run so the rewrites
are easy to review.

```
Fixed 1 file
Found 1 problem
Checked 8 files
```
