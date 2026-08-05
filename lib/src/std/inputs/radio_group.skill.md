# radioGroup - one choice out of a few, bound to a form field

```js
import { radioGroup } from 'imp/std/inputs'

radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'] })
```

Call shape: `radioGroup(props?)` - the choices are the `options` prop, never children.

It renders a real `<fieldset>` with the label as its `<legend>`, so the group is announced as one
thing, and the radios share a name - arrow keys move between them for free.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The group's `<legend>`                      |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                          |

Also: `options` - plain strings or `{ value, label, disabled }` objects - `orientation`
(`'vertical'` default, or `'horizontal'`), and `validate`.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form use `field`; passing both warns and
  `field` wins. A `field` with no form around it is an error.
- **An error only shows once the field has been left or submit was attempted**, so a form does not
  shout at someone still filling in the first box.
- **The `label` becomes the `<legend>`** naming the whole group; each option gets its own label.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **Choices go in `options`, not in children.**
- **All of them are visible at once**, so keep it to a handful - use `select` past five or six.
- **Arrow keys move the choice, Tab leaves the group.** That is the native behaviour, and imp does
  not override it.

```js
radioGroup({ field: 'size', label: 'Size', options: ['small', 'medium', 'large'], required: true })
radioGroup({
  field: 'billing',
  label: 'Billing period',
  orientation: 'horizontal',
  options: [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }],
})
```
