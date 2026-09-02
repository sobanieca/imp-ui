# fmt - formatting every file type with one command

```
imp fmt [...paths]           format in place; default: the whole project
imp fmt --check [...paths]   report what would change, write nothing, exit non-zero if any
```

The formatter is part of the binary. There is nothing to install, it works offline, and one imp
release formats the same way on every machine. imp always skips `.git`, `node_modules`, `dist` and
the vendored `dependencies/` folder. A path that does not exist is an error. **Run `imp fmt` and
`imp lint` after every batch of edits.**

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

imp formats HTML from the inside out. It sends an inline `<script>` block to the JavaScript
formatter and an inline `<style>` block to the CSS formatter, with the same options. **imp does not
support TypeScript, on purpose.** An imp app is plain JavaScript that runs directly in the browser.

## Options - under `fmt` in `imp.json`, see [config](config.md)

| Option        | Default | Applies to                                      |
| ------------- | ------- | ----------------------------------------------- |
| `lineWidth`   | `100`   | every language                                  |
| `indentWidth` | `2`     | every language                                  |
| `useTabs`     | `false` | every language                                  |
| `singleQuote` | `true`  | JavaScript, and an inline `<script>` block      |
| `semiColons`  | `false` | JavaScript. imp omits the semicolon by default. |
| `exclude`     | -       | project-relative paths to skip                  |

```json
{ "fmt": { "lineWidth": 100, "singleQuote": true, "semiColons": false } }
```

## How to keep a hand-made layout

An ignore comment protects the next node. Write it in the syntax of the language:
`// imp-fmt-ignore`, `/* imp-fmt-ignore */`, `<!-- imp-fmt-ignore -->` or `# imp-fmt-ignore`. To
exempt a whole file, put `imp-fmt-ignore-file` at the top. This works in JavaScript, CSS, HTML, SVG,
XML and Markdown. In Markdown, `<!-- imp-fmt-ignore-start -->` and `<!-- imp-fmt-ignore-end -->`
enclose a region.

## Output and exit code

Write mode prints each reformatted file, then `Checked N files`. `--check` prints a diff of the
lines that are not formatted:

```
from src/app.js:
3 | -const x=1
3 | +const x = 1

error: Found 1 not formatted file in 12 files
```

imp reports a file that has a syntax error and skips it. It still formats the other files. The exit
code is `0` on success. It is `1` when a file failed to format, or when `--check` finds a file that
needs formatting.
