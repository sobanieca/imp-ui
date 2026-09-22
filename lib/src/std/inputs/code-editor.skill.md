# codeEditor - a multi-line code input with syntax highlighting, bound to a form field or a state

```js
import { codeEditor } from 'imp/std/inputs'

codeEditor({ field: 'config', label: 'imp.json', language: 'json', rows: 8 })
codeEditor({ value: source, label: 'Script', language: 'js', lineNumbers: true })
```

The call shape is `codeEditor(props?)`. It takes no children. It is a multi-line `textField` with a
highlighted mirror behind the text, so every form rule of `textField` holds here. The mirror is the
code view of `codeBlock`, so both render a line the same way, with the same colours, the same number
rail and the same copy button.

| Prop          | Values                                     | Default  | Notes                                             |
| ------------- | ------------------------------------------ | -------- | ------------------------------------------------- |
| `field`       | dot path, e.g. `'settings.css'`            | -        | Binds to that path of the surrounding form        |
| `value`       | a state, or a plain string                 | -        | Standalone use, when there is no form             |
| `language`    | string                                     | `'text'` | Colours the code. Same names as `codeBlock`       |
| `rows`        | positive integer, or a state - **live**    | `10`     | The visible lines. The editor scrolls inside      |
| `lineNumbers` | boolean                                    | `false`  | Numbers every line in a rail beside the text      |
| `label`       | string, or a state holding one             | -        | Rendered as a real `<label>` for the control      |
| `ariaLabel`   | string                                     | -        | Names it when there is no visible label           |
| `help`        | string, or a state holding one             | -        | Hint under the control                            |
| `placeholder` | string                                     | -        | Shown while the value is empty                    |
| `readonly`    | boolean                                    | `false`  | The text is selectable and copyable, not editable |
| `required`    | boolean                                    | `false`  | Marks it and validates that it is filled in       |
| `disabled`    | boolean, or a state holding one - **live** | `false`  | Blocks interaction                                |

The validation props are `required`, `minLength`, `maxLength`, `pattern`, `validate` and
`validateAsync`, with the same rules as `textField`. `validate` returns a message string, or `null`.
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
- **The copy button is a tab stop of its own.** Escape, then Tab, moves the focus to it. The next
  Tab leaves the editor.
- **Set `rows`.** The editor has a fixed height of `rows` lines, and it scrolls inside. It does not
  grow with the text on its own. Pass a state as `rows` to resize it as the text changes. Long lines
  scroll sideways. Nothing wraps.
- **The copy button is always there.** It copies the current text, without the line numbers. Do not
  add a second one.
- **Line numbers are plain numbers here, not links.** `codeBlock` makes each number a link that
  writes `#L12` into the address. An editor has no stable line to link to, so it numbers the lines
  and nothing more.
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

Related: imp skill std/textField - the plain multi-line input; imp skill std/codeBlock - the
read-only listing that shares the code view; imp skill std/form - the form that a `field` binds to;
imp skill i18n - the wording of `imp.codeEditor.keys` and `imp.code.copy`.
