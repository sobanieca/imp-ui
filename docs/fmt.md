# imp - Formatting

```
imp fmt [...paths]
imp fmt --check [...paths]
```

`imp fmt` formats your whole project with one command - JavaScript, JSON, Markdown, CSS, HTML, SVG,
XML, SQL, and YAML, all with consistent options. The formatter is built into the `imp` binary:
nothing to install, works offline, and a given imp release formats the same way on every machine, so
a team never disagrees about formatting because of tool versions.

Given paths (files or directories) are formatted in place; with no paths, the whole project is. The
command exits with an error if a given path does not exist. Directories named `.git`,
`node_modules`, `dist`, and `.imp` are always skipped, as is the vendored `dependencies/` folder;
additional paths can be skipped with `exclude` (see _Options_ below).

## Supported languages

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

HTML is formatted inside-out: inline `<script>` and `<style>` blocks are formatted with the
JavaScript and CSS formatters, honouring the same options as standalone files. SVG and XML are
formatted by the same markup formatter as HTML.

TypeScript is deliberately not supported - imp is buildless, and imp apps are plain JavaScript that
runs directly in the browser.

## Options

Options live under `fmt` in `imp.json`. Every option has a default, so the block is optional:

```json
{
  "fmt": {
    "lineWidth": 100,
    "indentWidth": 2,
    "useTabs": false,
    "singleQuote": true,
    "semiColons": false,
    "exclude": ["vendor/"]
  }
}
```

- **`lineWidth`** (default `100`) - the line length the formatter aims for.
- **`indentWidth`** (default `2`) - spaces per indentation level.
- **`useTabs`** (default `false`) - indent with tabs instead of spaces.
- **`singleQuote`** (default `true`) - prefer single quotes in JavaScript.
- **`semiColons`** (default `false`) - write JavaScript with semicolons; by default they are omitted
  where the language allows.
- **`exclude`** - project-relative paths to skip.

`singleQuote` and `semiColons` apply to JavaScript (including inline `<script>` blocks in HTML); the
other options apply to every language.

## `--check` mode

`imp fmt --check` reports files that would change without writing them, shows the lines that differ,
and exits non-zero when formatting is needed - useful as a CI gate:

```
from src/app.js:
3 | -const x=1
3 | +const x = 1

error: Found 1 not formatted file in 12 files
```

## Keeping hand-crafted layout

To keep a deliberately formatted node (an aligned matrix, a carefully wrapped expression), mark it
with an ignore comment in the language's own comment syntax:

```js
// imp-fmt-ignore
const matrix = [1, 0, 0, 1]
```

```css
/* imp-fmt-ignore */
.grid {
  grid-template-areas: "nav  main";
}
```

```html
<!-- imp-fmt-ignore -->
<pre>   ascii   art   </pre>
```

```yaml
# imp-fmt-ignore
matrix: [1, 0, 0, 1]
```

To exempt a whole file, put `imp-fmt-ignore-file` in a comment at the top of the file (JavaScript,
CSS, HTML/SVG/XML, and Markdown).

In Markdown, `imp-fmt-ignore-start` / `imp-fmt-ignore-end` comments fence off a region:

```markdown
<!-- imp-fmt-ignore-start -->

| a | deliberately | ragged | table |

<!-- imp-fmt-ignore-end -->
```

## Output and exit code

In write mode, each reformatted file is printed as a project-relative path, followed by a summary:

```
src/app.js
src/styles.css
Checked 12 files
```

A file the formatter cannot parse (a syntax error) is reported and skipped; the rest of the files
are still formatted.

The command exits `0` when everything succeeded, and `1` when a file failed to format - or, in
`--check` mode, when at least one file needs formatting.
