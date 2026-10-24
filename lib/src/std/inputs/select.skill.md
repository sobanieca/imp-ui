# select - a dropdown of choices bound to a form field

```js
import { select } from 'imp/std/inputs'

select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] })
```

The call shape is `select(props?)`. The choices are the `options` prop, never children.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                           |

The other props are `options` and `placeholder`. `options` is an array of plain strings, or an array
of `{ value, label, disabled }` objects. `placeholder` adds a disabled first entry. imp shows that
entry while nothing is chosen.

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
- **The choices go in `options`, not in the children.** imp warns about a child and renders nothing.
- **The field gets the option value as you wrote it.** `{ value: 4 }` writes the number `4`, and
  `{ value: null, label: 'No team' }` writes `null`. Do not convert the value in `onSubmit`. imp
  matches the field to an option by its text, so a form value of `'4'` still selects `{ value: 4 }`.
- **`placeholder` is not an option.** A person cannot select it. While it shows, the value of the
  field is `undefined`, and that is what `required` checks. Do not combine a `placeholder` with an
  option whose value is `null`: both show for an empty field.
- **The control commits on `change`**, when the person makes the choice.

```js
select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'], required: true })
select({
  field: 'country',
  label: 'Country',
  placeholder: 'Choose a country',
  options: [
    { value: 'pl', label: 'Poland' },
    { value: 'gb', label: 'United Kingdom' },
  ],
})
```
