# markdown - renders markdown text as themed prose

```js
import { markdown } from 'imp/std/display'

markdown({ text: '# Release notes\n\nThe **fast** path is now the only path.' })
markdown({ text: notes })
```

The call shape is `markdown(props)`. The text is the `text` prop: **one string, or one state that
holds a string**. A state is live: the prose re-renders when it changes. The component takes no
children.

| Prop   | Values                        | Default | Notes                |
| ------ | ----------------------------- | ------- | -------------------- |
| `text` | string, or a state - **live** | `''`    | The markdown to show |

Syntax: headings (`#` to `######`), paragraphs, `**bold**`, `_italic_`, `~~strikethrough~~`,
`` `code` ``, fenced code blocks, links, images, bullet lists, numbered lists, nested lists, block
quotes, horizontal rules, hard line breaks, and `<p align="center">` for an aligned block. A
markdown table is not supported.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **Pass the text as the `text` prop, not as a child.** A child is logged and ignored.
- **The text is markdown, never HTML.** imp builds the nodes itself and never assigns `innerHTML`,
  so a `<script>` in the text is text. A link or an image with an unsafe scheme loses its address.
  So untrusted markdown is safe to render.
- **A fenced code block is a plain `pre`.** There is no syntax highlighting here. Use `codeBlock`
  for highlighted code.
- **A `#` heading is an `h1`.** Start at `##` when the prose sits under a heading of the page, so
  the outline stays correct.
- **Every colour and every space comes from the theme.** There is no style prop and no class prop.
- **It is the reader half of `richTextEditor`.** Both read the same markdown, and both render it
  with the same rules, so a draft and its published form look alike.

```js
import { component } from 'imp'
import { card, markdown } from 'imp/std/display'
import { initState } from 'imp/state'

export const releaseNotes = component('app-release-notes', {
  setup: (self, { source = '' } = {}) => {
    const notes = initState(self, 'release.notes', source)
    return card({ header: 'Release notes' }, markdown({ text: notes }))
  },
})
```

Related: imp skill std/richTextEditor - the editor that writes this markdown; imp skill
std/codeBlock - highlighted code; imp skill std/card - a panel to put the prose in; imp skill
theming - the tokens the prose takes.
