# passwordField — a masked single-line input bound to a form field

```js
import { passwordField } from 'imp/std/inputs'

passwordField({ field: 'password', label: 'Password', required: true, minLength: 12 })
```

Call shape: `passwordField(props?)` — it takes no children. It is `textField` with `type="password"`
and no `type` prop.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one — **live** | Blocks interaction                           |

Also: `placeholder`, `readonly`, `autocomplete` — pass `autocomplete: 'new-password'` on a sign-up
form and `'current-password'` on a sign-in form so password managers behave.

Validation props: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern` (a RegExp) and
`validate` — a function returning a message string, or `null` when the value is fine. Messages come
from the `imp.form.*` keys, so translate those rather than hardcoding wording.

`validateAsync` takes the same shape but returns a **promise** of a message or `null`, and runs only
on **blur and submit** — never on every keystroke. A sync failure skips it, submit waits for it, and
a rejected promise reports `imp.form.checkFailed` rather than letting the value through.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form use `field`; passing both warns and
  `field` wins. A `field` with no form around it is an error.
- **An error only shows once the field has been left or submit was attempted**, so a form does not
  shout at someone still filling in the first box.
- **`label` renders a real `<label>` inside this component.** Do not wrap the control in your own
  label — a label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **Strength rules are yours to write.** `minLength` is the only built-in; anything about character
  classes goes in `validate`.
- **Never seed it from `initialValues` you fetched from a server** — the value lives in ordinary
  state that anything in the subtree can read.

```js
passwordField({ field: 'password', label: 'Password', autocomplete: 'new-password', minLength: 12 })
passwordField({
  field: 'password',
  label: 'Password',
  validate: (value) => /\d/.test(value ?? '') ? null : 'Include at least one digit',
})
```
