# toggle - a switch for a boolean that takes effect immediately

```js
import { toggle } from 'imp/std/inputs'

toggle({ field: 'notifications', label: 'Notifications' })
```

The call shape is `toggle(props?)`. The text beside the switch is the `label` prop, not a child.

The component is `checkbox`, drawn as a switch and announced as a switch, with `role="switch"`. Use
it in settings, where a change of the switch is the action. Use `checkbox` in a form that the person
submits.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The text beside the switch                  |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                          |

The other props are `validate`, and `validateAsync` for a check that runs on blur and on submit.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **An error shows only after the person leaves the field, or tries to submit.** So the form does
  not report a problem while the person still fills in the first box.
- **The label sits beside the switch.** A click on the label changes the switch.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **A switch tells the person that the change applies immediately.** When the change applies on
  submit only, use `checkbox`.
- **The control is still a checkbox underneath.** So Tab reaches it, and Space changes it.

```js
toggle({ field: 'notifications', label: 'Notifications' })
toggle({ value: darkMode, label: 'Dark mode' })
```
