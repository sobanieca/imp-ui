# textArea - a multi-line text input bound to a form field

```js
import { textArea } from 'imp/std/inputs'

textArea({ field: 'note', label: 'Notes', rows: 5 })
```

Call shape: `textArea(props?)` - it takes no children.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                           |

Also: `rows` (visible lines), `placeholder`, `readonly`.

Validation props: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern` (a RegExp) and
`validate` - a function returning a message string, or `null` when the value is fine. Messages come
from the `imp.form.*` keys, so translate those rather than hardcoding wording.

`validateAsync` takes the same shape but returns a **promise** of a message or `null`, and runs only
on **blur and submit** - never on every keystroke. A sync failure skips it, submit waits for it, and
a rejected promise reports `imp.form.checkFailed` rather than letting the value through.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form use `field`; passing both warns and
  `field` wins. A `field` with no form around it is an error.
- **An error only shows once the field has been left or submit was attempted**, so a form does not
  shout at someone still filling in the first box.
- **`label` renders a real `<label>` inside this component.** Do not wrap the control in your own
  label - a label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **Enter inserts a newline and does not submit the form.** That is deliberate - implicit submission
  skips multi-line fields.
- **It only resizes vertically**, so a long note never breaks the form's column width.

```js
textArea({ field: 'note', label: 'Notes', rows: 5, maxLength: 500 })
textArea({ field: 'bio', label: 'Bio', help: 'A sentence or two is plenty' })
```
