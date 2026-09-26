# segmented - a choice drawn as a joined row of buttons, one value or many

```js
import { segmented, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

segmented({ field: 'view', label: 'View', options: ['List', 'Board', 'Calendar'] })
segmented({ field: 'formats', label: 'Format', multiple: true, options: FORMATS })
```

The call shape is `segmented(props?)`. The choices are the `options` prop, never children.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The `<legend>` of the group                 |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the row                          |
| `required`  | boolean                                    | Marks it and validates that a choice exists |
| `disabled`  | boolean, or a state holding one - **live** | Blocks every segment                        |

| Prop       | Values                                           | Default | Notes                                   |
| ---------- | ------------------------------------------------ | ------- | --------------------------------------- |
| `options`  | strings, or `{ value, label, icon?, disabled? }` | -       | `icon` is an icon from `imp/icons`      |
| `multiple` | boolean                                          | `false` | The value becomes an array              |
| `size`     | `'sm'`, `'md'`, `'lg'`                           | `'md'`  | The same heights as `button`            |
| `block`    | boolean                                          | `false` | The segments share the full inline size |
| `validate` | `(value) => message \| null`                     | -       | `validateAsync` is the promise form     |

| Mode       | Value                        | Semantics                                                    |
| ---------- | ---------------------------- | ------------------------------------------------------------ |
| single     | the option `value`, a string | `radiogroup` of `radio` buttons, one tab stop                |
| `multiple` | an array, in option order    | a group of toggle buttons with `aria-pressed`, all tab stops |

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **`segmented` is one component for both modes.** There is no `toggleGroup`. Pass `multiple: true`.
- **In `multiple` mode the value is always an array.** Seed it with `[]` in `initialValues`.
  `required` fails on an empty array.
- **In single mode a second click does not clear the choice.** That is how a radio works.
- **An option with `icon` shows the icon only.** Its `label` is still necessary. It becomes the
  accessible name and the native tooltip. Do not wrap the control in `tooltip`.
- **The arrow keys move the focus and select in single mode.** Left and Right mirror under
  `dir="rtl"`. In `multiple` mode, Tab moves between the segments, and Space or Enter toggles one.
- **imp compares the values as strings.** An option value of `1` matches a form value of `'1'`.
- **Every option is visible at the same time.** Above five options, use `select` or `comboBox`.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- **The choices go in `options`, not in the children.** imp warns about a child.
- imp warns about an unknown prop. It warns about a `size` outside the list and uses `'md'`.

```js
import { luBold, luItalic } from 'imp/icons'

form(
  { initialValues: { view: 'List', formats: [] }, onSubmit: save },
  segmented({ field: 'view', label: 'View', options: ['List', 'Board', 'Calendar'] }),
  segmented({
    field: 'formats',
    label: 'Format',
    multiple: true,
    options: [
      { value: 'bold', label: 'Bold', icon: luBold },
      { value: 'italic', label: 'Italic', icon: luItalic },
    ],
  }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/radioGroup - the same
choice as a list of radios; imp skill std/flex - a joined row of actions, not a value.
