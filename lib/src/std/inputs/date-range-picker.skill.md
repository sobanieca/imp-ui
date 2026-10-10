# dateRangePicker - a form control for a range of dates or times, with optional relative presets

```js
import { dateRangePicker, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

dateRangePicker({ field: 'stay', label: 'Stay' }) //                    { start, end } days only
dateRangePicker({ field: 'period', label: 'Period', presets: PRESETS }) // or { preset: '30d' }
dateRangePicker({ value: span, label: 'Window', presets, time: true }) // days and times
```

The call shape is `dateRangePicker(props?)`. It takes no children. The control is a button that
shows the range. A press opens a panel. With `presets`, the panel has two tabs, "Relative" and
"Custom". With no presets, the panel shows only the custom content, with no tabs and no mode badge.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'report.period'`           | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Validates that a range is set                |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction and closes the panel      |

| Prop                           | Values                                              | Notes                               |
| ------------------------------ | --------------------------------------------------- | ----------------------------------- |
| `presets`                      | `[{ value, label, range? }]`, or a state - **live** | The rows of the "Relative" tab      |
| `time`                         | boolean                                             | Adds a start time and an end time   |
| `min`, `max`                   | `'YYYY-MM-DD'`                                      | Days outside cannot be picked       |
| `placeholder`                  | string, or a state holding one                      | Shown while no range is set         |
| `relativeLabel`, `customLabel` | string, or a state holding one                      | Replace the names of the tabs       |
| `validate`                     | `(value) => message or null`                        | `validateAsync` is the promise form |

`range` of a preset is `{ start, end }` that your app computed. Each edge is a day, `'2026-10-07'`,
or a moment, `'2026-10-07T14:55'` or `'2026-10-07T14:59:30'`. imp shows it as muted text next to the
preset, in the button and in the list. A moment shows its time, and seconds show when they are set.
imp does not compute the range.

| Mode     | Value in the state or the form                           | Written when                     |
| -------- | -------------------------------------------------------- | -------------------------------- |
| relative | `{ preset: '5m' }`                                       | a press on a preset row          |
| custom   | `{ start: '2026-09-08', end: '2026-10-07' }`             | a press on Apply after two picks |
| `time`   | `{ start: '2026-09-08T09:00', end: '2026-10-07T17:30' }` | a press on Apply after two picks |
| empty    | `undefined`                                              | never, only as the initial value |

The panel opens on the tab of the value. The focus goes to the chosen preset, or to the day of the
month grid. In the grid the first pick sets "From" and the second pick sets "To". Apply is disabled
until both are set. A preset range or a custom range seeds the grid. With `time`, a time input sits
under each day. They start at `00:00` and `23:59`, or at the times of the seed. Apply is disabled
while the end is before the start.

| Key                   | Where   | Effect                                                     |
| --------------------- | ------- | ---------------------------------------------------------- |
| Enter, Space          | button  | Open the panel                                             |
| ArrowLeft, ArrowRight | tabs    | Switch the tab. Mirrored in RTL. Home and End go to an end |
| Arrow keys, Home, End | presets | Move the focus and the check                               |
| Enter, Space          | presets | Write the preset and close                                 |
| keys of `datePicker`  | grid    | Move by day, week, month and year. Enter or Space picks    |
| Escape                | panel   | Close without a change. The focus goes back to the button  |
| Tab                   | panel   | Tabs, then the content of the tab. Out of the panel: close |

Rules an agent gets wrong:

- **The value is plain data, never a `Date`.** Write `{ preset: '30d' }` or
  `{ start: '2026-09-08', end: '2026-10-07' }`. imp warns about any other shape and shows none.
- **imp resolves no preset.** Your app turns `{ preset }` into dates when it queries. Pass the same
  dates as `range` so the person sees them.
- **A preset is written at once. A custom range waits for Apply.** Cancel, Escape and a press
  outside keep the old value.
- **No `presets` means no tabs.** Leave `presets` out, or pass `[]`, for a plain range picker.
- **Without `time`, Apply writes days only.** A seed with times shows its days, and Apply drops the
  times.
- **`min` and `max` are days.** Days outside cannot be picked in the grid. A preset whose `range`
  goes outside is disabled. A preset with no `range` stays enabled, because imp cannot know its
  dates. A value outside the limits fails validation with `imp.dateRangePicker.min` or
  `imp.dateRangePicker.max`. They do not limit a time.
- **The language decides the format of the dates and the first day of the week.**
- **`field` and `value` are alternatives.** Inside a form, use `field`. A `field` with no form
  around it is an error.
- **The panel is a popover in the top layer.** Do not wrap the control in your own popover.
- **The words are `imp.dateRangePicker.*` keys:** `relative`, `custom`, `from`, `to`, `apply`,
  `cancel`, `choose`, `pickDay`, `startTime`, `endTime`, `min` (`{min}`) and `max` (`{max}`). The
  month buttons use `imp.datePicker.previousMonth` and `imp.datePicker.nextMonth`. Translate those
  keys.

```js
const PRESETS = [
  {
    value: '5m',
    label: 'Last 5 minutes',
    range: { start: '2026-10-07T14:55', end: '2026-10-07T15:00' },
  },
  {
    value: '24h',
    label: 'Last 24 hours',
    range: { start: '2026-10-06T15:00', end: '2026-10-07T15:00' },
  },
  { value: '7d', label: 'Last 7 days', range: { start: '2026-10-01', end: '2026-10-07' } },
]

form(
  { initialValues: { window: { preset: '5m' } }, onSubmit: searchLogs },
  dateRangePicker({ field: 'window', label: 'Log window', presets: PRESETS, time: true }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Search'),
)
```

Related: imp skill std/datePicker - one date, or one date with a time; imp skill std/form - the form
that `field` binds to; imp skill i18n - how to translate the `imp.dateRangePicker.*` keys.
