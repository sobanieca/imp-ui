# codeBlock - source code with syntax highlighting, a copy button and linkable line numbers

```js
import { codeBlock } from 'imp/std/display'

codeBlock({ language: 'js', code: source })
codeBlock({ language: 'bash', lineNumbers: true, id: 'install', code: script })
codeBlock({ language: 'json', label: 'imp.json', code: config })
codeBlock({ code: plainText })
```

The call shape is `codeBlock(props)`. The code is the `code` prop: **one string, or one state that
holds a string**. A state is live: the block re-renders the lines when it changes. The component
takes no children.

| Prop          | Values                        | Default  | Notes                                                                   |
| ------------- | ----------------------------- | -------- | ----------------------------------------------------------------------- |
| `code`        | string, or a state - **live** | `''`     | The code to show                                                        |
| `language`    | string                        | `'text'` | The language of the code. An unknown name is logged and shown as text   |
| `lineNumbers` | boolean                       | `false`  | Numbers every line. Each number is a link that selects the line         |
| `id`          | string                        | -        | Names the block in the URL fragment, so several blocks can share a page |
| `label`       | string                        | -        | The accessible name of the block, such as the file name                 |

Languages: `javascript`, `typescript`, `json`, `html`, `css`, `scss`, `markdown`, `diff`, `bash`,
`python`, `ruby`, `php`, `go`, `rust`, `java`, `kotlin`, `swift`, `dart`, `scala`, `c`, `cpp`,
`csharp`, `sql`, `yaml`, `toml`, `ini`, `dockerfile`, `makefile`, `powershell`, `perl`, `lua`, `r`,
`elixir`, `haskell`, `clojure`, `graphql`, `hcl` and `text`. The usual short names work: `js`, `ts`,
`jsx`, `tsx`, `sh`, `shell`, `zsh`, `py`, `rb`, `rs`, `kt`, `cs`, `c++`, `yml`, `md`, `xml`, `svg`,
`vue`, `svelte`, `docker`, `terraform`, `plaintext`. `html` highlights the code inside a `<script>`
and a `<style>` element. `markdown` highlights a fenced block in the language of its fence.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **Pass the code as the `code` prop, not as a child.** A child is logged and ignored.
- **A template literal is the usual source.** imp drops one line break at the start and one at the
  end, so the literal can open and close on its own line. It does not remove indentation.
- **Escape a backtick and a `${` inside a template literal.** Write `` \` `` and `\${`, or use a
  string that is not a template literal.
- **The copy button is always there.** It copies the whole code, without the line numbers. Do not
  add a second one.
- **Line numbers are links.** A click on a number selects the line and writes `#L12` into the
  address in place. A Shift-click extends the selection to a range, `#L12-L20`. A page that opens
  with such a fragment highlights the lines and scrolls to them. With `id: 'install'` the fragment
  is `#install-L12`, so give every numbered block on a page an `id`.
- **The block does not wrap long lines.** It scrolls sideways, and the line numbers stay in view.
- **Every colour comes from the theme.** The tokens read the palette of the theme, so a new theme
  recolours the code. There is no theme prop and no colour prop.
- **The block is not an editor.** The text is selectable and copyable, and nothing else.

```js
import { codeBlock } from 'imp/std/display'

const install = `
#!/usr/bin/env bash
set -euo pipefail

curl -fsSL https://imp.dev/install.sh | bash
imp --version
`

codeBlock({
  language: 'bash',
  lineNumbers: true,
  id: 'install',
  label: 'install.sh',
  code: install,
})
```

Related: imp skill std/card - a panel to put a block in; imp skill theming - the tokens the colours
come from; imp skill i18n - the wording of the copy button.
