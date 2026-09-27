# checkbox - a single boolean bound to a form field

```js
import { checkbox } from 'imp/std/inputs'

checkbox({ field: 'terms', label: 'I accept the terms', required: true })
```

The call shape is `checkbox(props?)`. The text beside the box is the `label` prop, not a child.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The text beside the box                     |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                          |

The other props are `validate`, and `validateAsync` for a check that runs on blur and on submit.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **An error shows only after the person changes the field and leaves it, or tries to submit.** A
  Tab through an untouched field shows nothing. A field back at its first value shows nothing until
  a submit.
- **The label sits beside the box, not above it.** A click on the label toggles the box.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **`required` means that the person must tick the box.** That is what a terms checkbox needs.
- **The value is a boolean.** For one choice out of several, use `radioGroup`. Do not bind a row of
  checkboxes to one field.

```js
checkbox({ field: 'terms', label: 'I accept the terms', required: true })
checkbox({ field: 'settings.alerts', label: 'Email me about outages' })
```
