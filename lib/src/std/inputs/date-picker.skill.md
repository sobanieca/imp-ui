# datePicker - a form control for a date, a date range, or a date with a time

```js
import { datePicker } from 'imp/std/inputs'

datePicker({ field: 'dueDate', label: 'Due date' }) //            '2026-09-21'
datePicker({ field: 'stay', label: 'Stay', range: true }) //      { start: '2026-09-21', end: '2026-09-25' }
datePicker({ value: when, label: 'Starts at', time: true }) //    '2026-09-21T14:30'
datePicker({ field: 'day', label: 'Day', min: '2026-01-01', max: '2026-12-31' })
```

The call shape is `datePicker(props?)`. It takes no children. The control is a button that shows the
value in the active language. A press opens a panel with a month grid.

| Prop          | Values                                     | Notes                                        |
| ------------- | ------------------------------------------ | -------------------------------------------- |
| `field`       | dot path, e.g. `'trip.start'`              | Binds to that path of the surrounding form   |
| `value`       | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`       | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel`   | string                                     | Names it when there is no visible label      |
| `help`        | string, or a state holding one             | Hint under the control                       |
| `required`    | boolean                                    | Validates that a date is set; hides "clear"  |
| `disabled`    | boolean, or a state holding one - **live** | Blocks interaction and closes the panel      |
| `range`       | boolean                                    | The value is `{ start, end }`                |
| `time`        | boolean                                    | The value is `'YYYY-MM-DDTHH:mm'`            |
| `min`, `max`  | `'YYYY-MM-DD'`                             | Days outside cannot be chosen                |
| `placeholder` | string, or a state holding one             | Shown while no date is set                   |
| `validate`    | `(value) => message or null`               | Runs after the built-in checks               |

`validateAsync` has the same shape as `validate`, but it returns a promise. It runs when the panel
closes and on submit.

| Mode    | Value in the state or the form               | The panel closes                      |
| ------- | -------------------------------------------- | ------------------------------------- |
| default | `'2026-09-21'`                               | after the pick                        |
| `range` | `{ start: '2026-09-21', end: '2026-09-25' }` | after the second pick                 |
| `time`  | `'2026-09-21T14:30'`                         | on "Done", Escape, or a press outside |

Keys in the month grid: the arrow keys move by a day or a week, `Home` and `End` go to the start and
the end of the week, `PageUp` and `PageDown` move by a month, and with `Shift` by a year. `Enter` or
`Space` chooses the day. `Escape` closes the panel and the focus goes back to the control.

Rules an agent gets wrong:

- **Every value is an ISO string in local time, never a `Date`.** A state holds plain data. Write
  `'2026-09-21'`, not `new Date()`. imp warns about text that is not a date and shows none.
- **The empty value is `undefined`.** The clear button writes `undefined`. `required` removes the
  clear button.
- **A range is complete or absent.** The first pick only marks the start in the panel. imp writes
  `{ start, end }` after the second pick, and it swaps the two when the second day is earlier.
- **`range` and `time` do not combine.** imp warns and keeps `range`. Use two controls with `time`
  for a start and an end with times.
- **A time alone has no control.** `time: true` always includes the date. `textField` covers plain
  text only. A control for a time without a date is out of scope for now.
- **`min` and `max` are days.** In `time` mode they limit the day, not the hour. A value outside the
  limits that comes from the state fails validation with `imp.datePicker.min` or
  `imp.datePicker.max`.
- **The language decides the format and the first day of the week.** imp takes both from `Intl` for
  the active language. There is no format prop and no week-start prop.
- **`field` and `value` are alternatives.** Inside a form, use `field`. A `field` with no form
  around it is an error.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- **The words are `imp.datePicker.*` keys:** `choose`, `clear`, `time`, `done`, `previousMonth`,
  `nextMonth`, `min`, `max`. Translate those keys. The required message is `imp.form.required`.
- **The panel is a popover in the top layer.** Do not wrap the control in your own popover or dialog
  logic. Inside a `dialog` it works as it is.

```js
form(
  { initialValues: { title: '', day: undefined, stay: undefined }, onSubmit: save },
  textField({ field: 'title', label: 'Title', required: true }),
  datePicker({ field: 'day', label: 'Day', required: true, min: '2026-09-21' }),
  datePicker({ field: 'stay', label: 'Hotel stay', range: true, help: 'Optional' }),
  submitButton('Save'),
)
```

Related: imp skill std/form - the form that `field` binds to; imp skill std/calendar - shows events
on a month, a week or a day; imp skill i18n - the active language and the `imp.` keys.
