# radioGroup - one choice out of a few, bound to a form field

```js
import { radioGroup } from 'imp/std/inputs'

radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'] })
```

The call shape is `radioGroup(props?)`. The choices are the `options` prop, never children.

The component renders a real `<fieldset>`, with the label as its `<legend>`. So a screen reader
announces the group as one control. The radios share a name, so the arrow keys move between them
without extra code.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The group's `<legend>`                      |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                          |

The other props are `options`, `orientation` and `validate`. `options` is an array of plain strings,
or of `{ value, label, disabled }` objects. `orientation` is `'vertical'`, the default, or
`'horizontal'`.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **An error shows only after the person changes the field and leaves it, or tries to submit.** A
  Tab through an untouched field shows nothing. A field back at its first value shows nothing until
  a submit.
- **The `label` becomes the `<legend>`**, and it names the whole group. Each option gets its own
  label.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- **The field gets the option value as you wrote it.** `{ value: 4 }` writes the number `4`, and
  `{ value: null, label: 'No team' }` writes `null`. Do not convert the value in `onSubmit`. imp
  matches the field to an option by its text, so a form value of `'4'` still selects `{ value: 4 }`.
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **The choices go in `options`, not in the children.**
- **Every option is visible at the same time.** So keep the list short. Above five or six options,
  use `select`.
- **The arrow keys move the choice. Tab leaves the group.** That is the native behaviour, and imp
  does not override it.

```js
radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'], required: true })
radioGroup({
  field: 'billing',
  label: 'Billing period',
  orientation: 'horizontal',
  options: [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ],
})
```
