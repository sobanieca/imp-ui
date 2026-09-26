# richTextEditor - a WYSIWYG editor with a formatting toolbar, whose value is markdown

```js
import { richTextEditor, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

richTextEditor({ field: 'body', label: 'Body', rows: 8 })
richTextEditor({ value: note, label: 'Note', placeholder: 'Write here', imageSize: 800 })
```

The call shape is `richTextEditor(props?)`. It takes no children. It is a form control, so every
form rule of `textField` holds here. The person sees rich text. The value is a markdown string.

| Prop          | Values                                     | Default | Notes                                             |
| ------------- | ------------------------------------------ | ------- | ------------------------------------------------- |
| `field`       | dot path, e.g. `'post.body'`               | -       | Binds to that path of the surrounding form        |
| `value`       | a state, or a plain string                 | -       | Standalone use, when there is no form             |
| `rows`        | positive integer, or a state - **live**    | `6`     | The minimum height, in lines. The editor grows    |
| `imageSize`   | positive integer                           | `1280`  | The longest edge, in pixels, of an embedded image |
| `label`       | string, or a state holding one             | -       | Names the text box                                |
| `ariaLabel`   | string                                     | -       | Names it when there is no visible label           |
| `help`        | string, or a state holding one             | -       | Hint under the editor                             |
| `placeholder` | string                                     | -       | Shown while the editor is empty                   |
| `readonly`    | boolean                                    | `false` | No toolbar. The text is selectable, not editable  |
| `required`    | boolean                                    | `false` | Marks it and validates that it is filled in       |
| `disabled`    | boolean, or a state holding one - **live** | `false` | Blocks interaction                                |

The validation props are `required`, `minLength`, `maxLength`, `pattern`, `validate` and
`validateAsync`, with the same rules as `textField`. They see the markdown string.

The toolbar has these tools, in this order: bold, italic, strikethrough, code, heading 1 to 3,
quote, code block, bulleted list, numbered list, link, image, emoji, and align start, center and
end. Ctrl-B and Ctrl-I work as in every editor. Ctrl-Z undoes.

What the markdown holds:

| The person makes  | The value holds                                             |
| ----------------- | ----------------------------------------------------------- |
| Bold, italic      | `**bold**`, `_italic_`                                      |
| Strikethrough     | `~~struck~~`                                                |
| Code, code block  | `` `code` ``, a fenced block                                |
| Heading 1 to 3    | `#`, `##`, `###`                                            |
| Quote             | `>`                                                         |
| Lists             | `- item`, `1. item`, nested by two spaces                   |
| Link              | `[text](https://...)`                                       |
| Image             | `![name](data:image/png;base64,...)`                        |
| Emoji             | The character itself                                        |
| Shift-Enter       | A `\` at the end of the line                                |
| Aligned paragraph | `<p align="center">...</p>`, with inline HTML for the marks |

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **The value is markdown, on every keystroke.** It is not HTML. Render it with `markdown` from
  `imp/std/display`, which reads the same dialect. Never put the value into `innerHTML`.
- **An image is a data URL inside the markdown.** imp resizes the image in the browser to
  `imageSize` on its longest edge, encodes it as PNG or JPEG, and embeds it. There is no upload. A
  value with images is large. Raise `maxLength` or leave it out.
- **Images come from the toolbar, from a paste, or from a drop.** While imp resizes one, a
  placeholder marks its place, and the person keeps typing. The placeholder is not in the value.
- **A link or an image with a `javascript:` address is dropped.** Only `http`, `https`, `mailto` and
  `tel` links pass. An image passes with `http`, `https` or `data:image/`.
- **Alignment is the one thing markdown lacks.** An aligned block is written as an HTML block, so
  every markdown renderer that passes HTML through shows it. The `align` value is physical. "Align
  end" writes `right` in a left-to-right document and `left` in a right-to-left one.
- **Tab indents a list item, and nothing else.** Outside a list, Tab moves the focus on. Inside a
  list, a person presses Escape, then Tab, to leave. The editor tells assistive technology so,
  through `imp.richTextEditor.keys`. To leave a code block, press the code block tool again.
- **An error shows only after the person leaves the editor, or tries to submit.**
- **There is no underline, no table and no colour.** Markdown has no such marks.
- **Every colour comes from the theme.** There is no theme prop.
- **`label` names the text box inside this component.** Do not put your own label around it. Pass
  the state itself to `disabled`, not `disabled.get()`.

```js
import { form, richTextEditor, submitForm } from 'imp/std/inputs'

form(
  { initialValues: { body: '' }, onSubmit: publish },
  richTextEditor({ field: 'body', label: 'Post', rows: 10, required: true, imageSize: 1024 }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Publish'),
)
```

Related: imp skill std/markdown - the renderer for this value; imp skill std/textField - the plain
multi-line input; imp skill std/codeEditor - the code input with syntax highlighting; imp skill
std/form - the form that a `field` binds to; imp skill i18n - the wording of the tools and of
`imp.richTextEditor.keys`.
