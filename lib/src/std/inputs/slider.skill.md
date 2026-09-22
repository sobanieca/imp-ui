# slider - a native range input bound to a number

```js
import { slider } from 'imp/std/inputs'

slider({ field: 'volume', label: 'Volume', min: 0, max: 100, step: 5 })
```

The call shape is `slider(props?)`. It renders `<input type="range">`, so the keyboard, the touch
handling and the mirror under `dir="rtl"` are those of the browser.

| Prop        | Values                                     | Notes                                      |
| ----------- | ------------------------------------------ | ------------------------------------------ |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form |
| `value`     | a state, or a plain number                 | Standalone use, when there is no form      |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the input |
| `ariaLabel` | string                                     | Names it when there is no visible label    |
| `help`      | string, or a state holding one             | Hint under the track                       |
| `required`  | boolean                                    | Fails while the value is `undefined`       |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                         |

| Prop        | Values                       | Default | Notes                                         |
| ----------- | ---------------------------- | ------- | --------------------------------------------- |
| `min`       | number                       | `0`     | The start of the range                        |
| `max`       | number                       | `100`   | The end of the range                          |
| `step`      | number above 0               | `1`     | The distance between two values               |
| `showValue` | boolean                      | `true`  | Prints the value at the end of the label row  |
| `format`    | `(value) => string`          | -       | Shapes the printed value and `aria-valuetext` |
| `validate`  | `(value) => message \| null` | -       | `validateAsync` is the promise form           |

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **The value is a number, not a string.** The control commits on every `input` event, so a bound
  text follows the thumb while it moves.
- **`min` and `max` set the range. They are not validation rules here.** The thumb cannot leave the
  range, so there is no `imp.form.min` message. Use `validate` for a rule inside the range.
- **Seed the value.** With `undefined`, the thumb rests at `min`, but the field stays `undefined`
  until the person moves the thumb. `required` reports that.
- **Pass `format` for a unit**, such as `(value) => value + '%'`. Do not render your own text beside
  the control. A screen reader hears the formatted text too.
- **Do not restyle the track.** The control takes the primary colour of the theme through
  `accent-color`.
- **There is no vertical slider and no range with two thumbs.**
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop. It warns when `min` is not less than `max`, and uses 0 and 100.

```js
form(
  { initialValues: { volume: 40 }, onSubmit: save },
  slider({
    field: 'volume',
    label: 'Volume',
    step: 5,
    format: (value) => `${value}%`,
    validate: (value) => (value > 80 ? 'Keep the volume at 80% or less' : null),
  }),
  submitButton('Save'),
)
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/textField - a number
that the person types.
