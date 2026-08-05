# fmt - formatting every file type with one command

```
imp fmt [...paths]           format in place; default: the whole project
imp fmt --check [...paths]   report what would change, write nothing, exit non-zero if any
```

The formatter is built into the binary - nothing to install, offline, and a given imp release
formats identically on every machine. `.git`, `node_modules`, `dist` and the vendored
`dependencies/` folder are always skipped; a path that does not exist is an error. **Run `imp fmt`
(and `imp lint`) after every batch of edits.**

| Files                    | Language   |
| ------------------------ | ---------- |
| `.js .mjs .cjs`          | JavaScript |
| `.json .jsonc`           | JSON       |
| `.md .markdown`          | Markdown   |
| `.css .scss .sass .less` | CSS        |
| `.html`                  | HTML       |
| `.svg`                   | SVG        |
| `.xml`                   | XML        |
| `.sql`                   | SQL        |
| `.yaml .yml`             | YAML       |

HTML is formatted inside-out: inline `<script>` and `<style>` blocks go through the JavaScript and
CSS formatters with the same options. **TypeScript is deliberately unsupported** - imp apps are
plain JavaScript that runs directly in the browser.

## Options - under `fmt` in `imp.json`, see [config](config.md)

| Option        | Default | Applies to                                      |
| ------------- | ------- | ----------------------------------------------- |
| `lineWidth`   | `100`   | every language                                  |
| `indentWidth` | `2`     | every language                                  |
| `useTabs`     | `false` | every language                                  |
| `singleQuote` | `true`  | JavaScript (including inline `<script>` blocks) |
| `semiColons`  | `false` | JavaScript - semicolons are omitted by default  |
| `exclude`     | -       | project-relative paths to skip                  |

```json
{ "fmt": { "lineWidth": 100, "singleQuote": true, "semiColons": false } }
```

## Keeping hand-crafted layout

An ignore comment in the language's own syntax protects the next node - `// imp-fmt-ignore`,
`/* imp-fmt-ignore */`, `<!-- imp-fmt-ignore -->`, `# imp-fmt-ignore`. `imp-fmt-ignore-file` at the
top exempts a whole file (JavaScript, CSS, HTML/SVG/XML, Markdown). In Markdown,
`<!-- imp-fmt-ignore-start -->` / `<!-- imp-fmt-ignore-end -->` fence off a region.

## Output and exit code

Write mode prints each reformatted file, then `Checked N files`. `--check` prints a diff of the
offending lines:

```
from src/app.js:
3 | -const x=1
3 | +const x = 1

error: Found 1 not formatted file in 12 files
```

A file with a syntax error is reported and skipped; the rest are still formatted. Exit `0` on
success, `1` when a file failed to format or (in `--check`) needs formatting.
