# colorPicker - a hex colour input with a native picker beside it

```js
import { colorPicker, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

colorPicker({ field: 'brand', label: 'Brand colour' })
```

The call shape is `colorPicker(props?)`. It renders a text input for the hex value, and a native
`<input type="color">` as a swatch beside it. The swatch opens the colour picker of the browser.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'theme.primary'`           | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain string                 | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the input  |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Marks it and validates that it is filled in |
| `disabled`  | boolean, or a state holding one - **live** | Blocks the text and the swatch              |
| `validate`  | `(value) => message \| null`               | `validateAsync` is the promise form         |

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **The value is a hex string, `'#rrggbb'` or `'#rgb'`.** The swatch commits `'#rrggbb'` in lower
  case. The text input commits what the person types, on every keystroke. An empty text commits
  `undefined`.
- **A text that is not a hex colour fails validation.** The message is `imp.form.color`. It shows
  after the person leaves the field, or tries to submit. Read the value only when it is a hex
  colour, or wait for the submit.
- **The swatch follows the value.** It shows the last hex colour that the value held. A value that
  is not a hex colour leaves the swatch as it was.
- **The swatch has its own name.** It is `imp.colorPicker.pick` with the `label` as `{label}`.
  Translate that key.
- **There is no alpha, no named colour and no `rgb()` value.** The native picker returns an opaque
  colour. Pass a hex value, or `undefined`.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop.

```js
form(
  { initialValues: { brand: '#3b6fe0' }, onSubmit: save },
  colorPicker({ field: 'brand', label: 'Brand colour', required: true }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/textField - text that
is not a colour; imp skill i18n - how to translate the `imp.colorPicker.pick` key.
