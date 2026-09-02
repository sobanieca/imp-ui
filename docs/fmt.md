# imp - Formatting

```
imp fmt [...paths]
imp fmt --check [...paths]
```

`imp fmt` formats your whole project with one command. It formats JavaScript, JSON, Markdown, CSS,
HTML, SVG, XML, SQL and YAML, all with the same options. The formatter is part of the `imp` binary.
There is nothing to install, it works offline, and one imp release formats the same way on every
machine. So a team never disagrees about formatting because of a tool version.

imp formats the paths that you give in place. A path can be a file or a directory. With no path, imp
formats the whole project. The command exits with an error when a path does not exist. imp always
skips the directories `.git`, `node_modules`, `dist` and `.imp`, and the vendored `dependencies/`
folder. To skip more paths, use `exclude`. See _Options_ below.

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

imp formats HTML from the inside out. It formats an inline `<script>` block with the JavaScript
formatter and an inline `<style>` block with the CSS formatter. Both use the same options as a file
of that language. The same markup formatter handles SVG and XML.

imp does not support TypeScript, on purpose. imp is buildless, and an imp app is plain JavaScript
that runs directly in the browser.

## Options

The options live under `fmt` in `imp.json`. Every option has a default, so the block is optional:

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

- **`lineWidth`**, default `100`. The line length that the formatter aims for.
- **`indentWidth`**, default `2`. The number of spaces per indentation level.
- **`useTabs`**, default `false`. Indent with tabs in place of spaces.
- **`singleQuote`**, default `true`. Prefer a single quote in JavaScript.
- **`semiColons`**, default `false`. Write JavaScript with semicolons. By default imp omits them
  where the language allows it.
- **`exclude`**. The project-relative paths to skip.

`singleQuote` and `semiColons` apply to JavaScript, and to an inline `<script>` block in HTML. The
other options apply to every language.

## `--check` mode

`imp fmt --check` reports the files that would change, and writes nothing. It shows the lines that
differ, and exits with a non-zero code when a file needs formatting. This is useful as a CI gate:

```
from src/app.js:
3 | -const x=1
3 | +const x = 1

error: Found 1 not formatted file in 12 files
```

## How to keep a hand-made layout

To keep a node that you formatted on purpose, such as an aligned matrix or a carefully wrapped
expression, mark it with an ignore comment. Write the comment in the syntax of the language:

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

To exempt a whole file, put `imp-fmt-ignore-file` in a comment at the top of the file. This works in
JavaScript, CSS, HTML, SVG, XML and Markdown.

In Markdown, an `imp-fmt-ignore-start` comment and an `imp-fmt-ignore-end` comment enclose a region:

```markdown
<!-- imp-fmt-ignore-start -->

| a | deliberately | ragged | table |

<!-- imp-fmt-ignore-end -->
```

## Output and exit code

In write mode, imp prints each reformatted file as a project-relative path, and then a summary:

```
src/app.js
src/styles.css
Checked 12 files
```

imp reports a file that the formatter cannot parse, because of a syntax error, and skips it. It
still formats the other files.

The command exits `0` when everything succeeded. It exits `1` when a file failed to format, or, in
`--check` mode, when at least one file needs formatting.
