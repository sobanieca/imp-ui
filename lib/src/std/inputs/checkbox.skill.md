# checkbox - a single boolean bound to a form field

```js
import { checkbox } from 'imp/std/inputs'

checkbox({ field: 'terms', label: 'I accept the terms', required: true })
```

Call shape: `checkbox(props?)` - the text beside the box is the `label` prop, not children.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The text beside the box                     |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                          |

Also: `validate`, and `validateAsync` for a check that runs on blur and submit.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form use `field`; passing both warns and
  `field` wins. A `field` with no form around it is an error.
- **An error only shows once the field has been left or submit was attempted**, so a form does not
  shout at someone still filling in the first box.
- **The label sits beside the box, not above it**, and clicking it toggles the box.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **`required` means "must be ticked"**, which is what a terms checkbox wants.
- **The value is a boolean.** For one choice out of several use `radioGroup`, not a row of
  checkboxes bound to one field.

```js
checkbox({ field: 'terms', label: 'I accept the terms', required: true })
checkbox({ field: 'settings.alerts', label: 'Email me about outages' })
```
