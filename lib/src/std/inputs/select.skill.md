# select — a dropdown of choices bound to a form field

```js
import { select } from 'imp/std/inputs'

select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] })
```

Call shape: `select(props?)` — the choices are the `options` prop, never children.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one — **live** | Blocks interaction                           |

Also: `options` — an array of plain strings, or of `{ value, label, disabled }` objects — and
`placeholder`, which adds a disabled first entry shown while nothing is chosen.

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
- **Choices go in `options`, not in children.** Passing children warns and renders nothing.
- **Values are compared as strings**, so an option value of `1` matches a form value of `'1'`.
- **`placeholder` is not an option** — picking it is impossible, and while it shows the field's
  value is `undefined`, which is what `required` checks.
- **It commits on `change`**, when the choice is actually made.

```js
select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'], required: true })
select({
  field: 'country',
  label: 'Country',
  placeholder: 'Choose a country',
  options: [{ value: 'pl', label: 'Poland' }, { value: 'gb', label: 'United Kingdom' }],
})
```
