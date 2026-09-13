# codeEditor - a multi-line code input with syntax highlighting, bound to a form field or a state

```js
import { codeEditor } from 'imp/std/inputs'

codeEditor({ field: 'config', label: 'imp.json', language: 'json', rows: 8 })
codeEditor({ value: source, label: 'Script', language: 'js' })
```

The call shape is `codeEditor(props?)`. It takes no children. It is `textArea` with a highlighted
mirror behind the text, so every form rule of `textArea` holds here.

| Prop          | Values                                     | Default  | Notes                                             |
| ------------- | ------------------------------------------ | -------- | ------------------------------------------------- |
| `field`       | dot path, e.g. `'settings.css'`            | -        | Binds to that path of the surrounding form        |
| `value`       | a state, or a plain string                 | -        | Standalone use, when there is no form             |
| `language`    | string                                     | `'text'` | Colours the code. Same names as `codeBlock`       |
| `rows`        | positive integer                           | `10`     | The visible lines. The editor scrolls inside      |
| `label`       | string, or a state holding one             | -        | Rendered as a real `<label>` for the control      |
| `ariaLabel`   | string                                     | -        | Names it when there is no visible label           |
| `help`        | string, or a state holding one             | -        | Hint under the control                            |
| `placeholder` | string                                     | -        | Shown while the value is empty                    |
| `readonly`    | boolean                                    | `false`  | The text is selectable and copyable, not editable |
| `required`    | boolean                                    | `false`  | Marks it and validates that it is filled in       |
| `disabled`    | boolean, or a state holding one - **live** | `false`  | Blocks interaction                                |

The validation props are `required`, `minLength`, `maxLength`, `pattern`, `validate` and
`validateAsync`, with the same rules as `textArea`. `validate` returns a message string, or `null`.
The value is always the whole text, so a parse check goes in `validate`:

```js
const jsonProblem = (text) => {
  try {
    JSON.parse(text)
    return null
  } catch {
    return 'Enter valid JSON'
  }
}
codeEditor({ field: 'config', label: 'Config', language: 'json', validate: jsonProblem })
```

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **The value is the text, on every keystroke.** A state bound with `value` changes on each input.
  Parse it yourself, and treat a parse failure as "not yet".
- **An error shows only after the person leaves the editor, or tries to submit.** The text goes
  invalid on most keystrokes while somebody types, so a live error would flash.
- **Tab indents, and Enter keeps the indentation of the line.** Tab inserts two spaces, or indents
  every line of a selection. Shift-Tab outdents. A person presses Escape, then Tab, to move the
  focus out. The editor tells assistive technology so, through `imp.codeEditor.keys`. Escape also
  bubbles, so it closes a `dialog` or a `drawer` around the editor.
- **Set `rows`.** The editor has a fixed height of `rows` lines, and it scrolls inside. It does not
  grow with the text. Long lines scroll sideways. Nothing wraps.
- **There are no line numbers and no copy button.** For a read-only listing with those, use
  `codeBlock`.
- **Every colour comes from the theme.** The tokens read the palette of the theme. There is no theme
  prop.
- **`label` renders a real `<label>` inside this component.** Do not put your own label around the
  control. Pass the state itself to `disabled`, not `disabled.get()`.

```js
import { codeEditor, form, submitButton } from 'imp/std/inputs'

form(
  { initialValues: { css: '.card { padding: 1rem }' }, onSubmit: save },
  codeEditor({ field: 'css', label: 'Custom CSS', language: 'css', rows: 12 }),
  submitButton('Save'),
)
```

Related: imp skill std/textArea - the plain multi-line input; imp skill std/codeBlock - the
read-only listing with line numbers; imp skill std/form - the form that a `field` binds to; imp
skill i18n - the wording of `imp.codeEditor.keys`.
