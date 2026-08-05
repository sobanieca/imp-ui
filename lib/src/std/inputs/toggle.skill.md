# toggle - a switch for a boolean that takes effect immediately

```js
import { toggle } from 'imp/std/inputs'

toggle({ field: 'notifications', label: 'Notifications' })
```

Call shape: `toggle(props?)` - the text beside the switch is the `label` prop, not children.

It is `checkbox` drawn as a switch and announced as one (`role="switch"`). Reach for it in settings,
where flipping it _is_ the action; reach for `checkbox` in a form the user submits.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The text beside the switch                  |
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
- **The label sits beside the switch**, and clicking it flips the switch.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **A switch implies it applies at once.** If the change only lands on submit, use `checkbox`.
- **It is still a checkbox underneath**, so it is reached with Tab and flipped with Space.

```js
toggle({ field: 'notifications', label: 'Notifications' })
toggle({ value: darkMode, label: 'Dark mode' })
```
