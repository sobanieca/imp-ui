# textField - the one text input: text, email, password, search, number, or multi-line

```js
import { textField } from 'imp/std/inputs'

textField({ field: 'user.email', label: 'Email', type: 'email', required: true })
textField({ field: 'age', label: 'Age', type: 'number', min: 0, step: 1 })
textField({ field: 'note', label: 'Notes', rows: 5 })
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
| `secret`    | boolean                                    | With `field`: keeps the value out of state   |

| Prop           | Values                                                                      | Default  | Notes                                           |
| -------------- | --------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| `type`         | `'text'`, `'email'`, `'tel'`, `'url'`, `'password'`, `'search'`, `'number'` | `'text'` | The `type` of the `<input>`                     |
| `rows`         | number                                                                      | -        | Renders a `<textarea>` with that many lines     |
| `step`         | number                                                                      | -        | Type `'number'` only. The step of the spinner   |
| `stepper`      | boolean                                                                     | `false`  | Type `'number'` only. A minus and a plus button |
| `placeholder`  | string                                                                      | -        | Shown while the control is empty                |
| `readonly`     | boolean                                                                     | `false`  | The value shows, and the person cannot edit it  |
| `autocomplete` | string                                                                      | -        | The autofill hint, such as `'new-password'`     |

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
- **An error shows only after the person changes the field and leaves it, or tries to submit.** A
  Tab through an untouched field shows nothing. A field back at its first value shows nothing until
  a submit.
- **`label` renders a real `<label>` inside this component.** Do not put your own label around the
  control. A label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **This is the only text input.** imp has no separate component for a password, a search, a number
  or a multi-line text. Set `type`, or set `rows`.
- **`rows` makes the field multi-line, and `type` makes it something else. Do not pass both.** imp
  warns, ignores `type`, and renders the `<textarea>`.
- **Type `'number'` commits a number, not a string.** An empty control commits `undefined`. Text
  that is not a number fails with `imp.form.number`. `min` and `max` compare the number. `step`
  applies to this type only.
- **`stepper` joins a minus and a plus button to the number input.** Each click steps the native
  input by `step` and stays inside `min` and `max`. The buttons read "Decrease" and "Increase"
  through `t()`. A `readonly` or `disabled` field disables them. Use it for a count, a quantity or a
  zoom level. Do not build the row from `button` and a text.
- **Enter in a multi-line field inserts a newline. It does not submit the form.** Enter in a
  single-line field submits.
- **A multi-line field resizes vertically only.** So a long note never breaks the column width.
- **`type` sets the keyboard and the autofill of the browser. It does not validate.**
  `type: 'email'` does not check the address. Add `pattern` or `validate` for that.
- **A password, an API key or a token needs `secret: true` as well as `type: 'password'`.** `type`
  only hides the characters on the screen. `secret` keeps the value out of the `imp.form` state and
  out of every debug log line. `onSubmit` still gets the value at its path. The field empties after
  a successful submit and after `resetForm`. It ignores its path in `initialValues`. `secret` works
  with `field` only. With `value`, imp warns, and the value stays in your state.
- **Type `'password'` has no reveal button.** Set `autocomplete` to `'current-password'` or
  `'new-password'`, so a password manager fills the right value.
- **The control commits on every keystroke**, so the form state is always current. imp updates the
  input in place, so the caret never jumps.

```js
textField({ field: 'name', label: 'Full name', required: true })
textField({ field: 'user.email', label: 'Email', type: 'email', help: 'We never share it' })
textField({ field: 'code', label: 'Code', minLength: 6, maxLength: 6 })
textField({ field: 'password', label: 'Password', type: 'password', secret: true })
textField({ field: 'apiKey', label: 'API key', type: 'password', secret: true, required: true })
textField({ value: query, ariaLabel: 'Search invoices', type: 'search', placeholder: 'Search' })
textField({ field: 'seats', label: 'Seats', type: 'number', min: 1, max: 50, step: 1 })
textField({ value: zoom, ariaLabel: 'Zoom', type: 'number', stepper: true, step: 25 })
textField({ field: 'bio', label: 'Bio', rows: 4, maxLength: 500 })
```
