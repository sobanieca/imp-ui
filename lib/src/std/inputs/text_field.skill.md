# textField - a single-line text input bound to a form field

```js
import { textField } from 'imp/std/inputs'

textField({ field: 'user.email', label: 'Email', type: 'email', required: true })
```

The call shape is `textField(props?)`. It takes no children.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                           |

The other props are `type`, which is `'text'`, `'email'`, `'tel'` or `'url'` and defaults to
`'text'`, and `placeholder`, `readonly` and `autocomplete`.

The validation props are `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, which is a
RegExp, and `validate`. `validate` is a function. It returns a message string, or `null` when the
value is correct. The messages come from the `imp.form.*` keys. Translate those keys. Do not write
fixed wording.

`validateAsync` has the same shape, but it returns a **promise** of a message or of `null`. It runs
on **blur and on submit** only, never on a keystroke. A synchronous failure skips it. A submit waits
for it. A rejected promise reports `imp.form.checkFailed`, and the value does not pass.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **An error shows only after the person leaves the field, or tries to submit.** So the form does
  not report a problem while the person still fills in the first box.
- **`label` renders a real `<label>` inside this component.** Do not put your own label around the
  control. A label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **`type` sets the keyboard and the autofill of the browser. It does not validate.**
  `type: 'email'` does not check the address. Add `pattern` or `validate` for that.
- **The control commits on every keystroke**, so the form state is always current. imp updates the
  input in place, so the caret never jumps.

```js
textField({ field: 'name', label: 'Full name', required: true })
textField({ field: 'user.email', label: 'Email', type: 'email', help: 'We never share it' })
textField({ field: 'code', label: 'Code', minLength: 6, maxLength: 6 })
```
