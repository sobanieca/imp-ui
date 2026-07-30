# numberField — a numeric input that commits a number, not a string

```js
import { numberField } from 'imp/std/inputs'

numberField({ field: 'quantity', label: 'Quantity', min: 1, max: 99 })
```

Call shape: `numberField(props?)` — it takes no children.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one — **live** | Blocks interaction                           |

Also: `step`, `placeholder`, `readonly`.

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
- **The committed value is a `number`**, and an empty field commits `undefined` — so the form state
  never holds `'42'` as a string. Something unparseable reports the `imp.form.number` message.
- **`min` and `max` compare numbers; `minLength` and `maxLength` count characters.** For a numeric
  range you want `min`/`max`.
- **`step` is the stepper's increment, not a validation rule.**

```js
numberField({ field: 'quantity', label: 'Quantity', min: 1, max: 99, required: true })
numberField({ field: 'price', label: 'Price', step: 0.01, min: 0 })
```
