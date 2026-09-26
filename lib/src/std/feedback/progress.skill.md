# progress - a bar, a ring or a gauge for a measured amount of work, with the value in view

```js
import { progress } from 'imp/std/feedback'

progress({ label: 'Uploading', value: 40 })
progress({ label: 'Storage', shape: 'ring', value: used, max: 512, showValue: true })
progress({ label: 'CPU', shape: 'gauge', value: load, color: 'amber' })
```

The call shape is `progress(props)`. It takes no children.

| Prop        | Values                        | Default     | Notes                                                     |
| ----------- | ----------------------------- | ----------- | --------------------------------------------------------- |
| `label`     | string or state               | none        | Live. The accessible name. Always pass it                 |
| `value`     | number or state               | none        | Live. How much is done. Always pass it                    |
| `max`       | number above 0                | `100`       | The value runs from `0` to `max`                          |
| `shape`     | `'bar'`, `'ring'`, `'gauge'`  | `'bar'`     | See the table below                                       |
| `size`      | `'sm'`, `'md'`, `'lg'`        | `'md'`      | The thickness of a bar, the diameter of a ring or a gauge |
| `color`     | a role name or a palette name | `'primary'` | Roles: `primary`, `success`, `warning`, `danger`, `info`  |
| `showValue` | boolean                       | `false`     | Shows the formatted value. A gauge always shows it        |
| `format`    | `(value, max) => string`      | a percent   | The default is a whole percent in the active language     |

| Shape   | Draws                         | Label                    | Value                          | Role          |
| ------- | ----------------------------- | ------------------------ | ------------------------------ | ------------- |
| `bar`   | the native `<progress>`       | shown above the bar      | at the inline end, `showValue` | `progressbar` |
| `ring`  | a circle that fills clockwise | the accessible name only | in the middle, `showValue`     | `progressbar` |
| `gauge` | a half circle                 | shown under the arc      | in the middle, always          | `meter`       |

The palette names are `gray`, `brown`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`,
`cyan`, `sky`, `blue`, `indigo`, `violet`, `purple` and `pink`.

Rules an agent gets wrong:

- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **`progress` is for a measured wait. It never spins.** A wait with no known end, such as a request
  in flight or a page that loads, is `loader`, see imp skill std/loader. imp warns about a
  `progress` with no `value`, and draws it empty.
- **There is no `statistic` component.** A gauge shows one number of a dashboard. It is a
  `role="meter"`, because it is a measurement and not a task that ends.
- **Always pass `label`.** A ring shows no text, so the label is its only name. imp warns when it is
  missing.
- **Pass a state as `value` to move it.** Do not render the component again. imp updates the element
  and every ARIA value in place. A state that holds `undefined` draws `0`.
- **`value` counts to `max`, not to 100.** Write `value: 412, max: 512`. Do not compute a percent.
  imp clamps a value outside `0` to `max`.
- **`format` changes the text, not the fill.** It gives the shown value and `aria-valuetext`. Use it
  for a unit, such as `format: (used) => used + ' GB'`.
- **A `sm` ring has no room for the value.** imp warns and draws the ring without it. Use `md` or
  `lg` with `showValue`.
- **`color` is a name, not a CSS colour.** Never write `'#00884d'` or `'color-green'`.
- **Do not set a width on a ring or a gauge.** `size` sets it. A bar fills the width of its parent.

```js
import { component } from 'imp'
import { initState } from 'imp/state'
import { progress } from 'imp/std/feedback'

export const migration = component('myapp-migration', {
  setup: (self) => {
    const done = initState(self, 'myapp.migration.done', 0)
    return progress({ label: 'Migrating records', value: done, max: 300, showValue: true })
  },
})
```

Related: imp skill std/loader - a wait with no measure, and the spinner of the theme; imp skill
std/skeleton - a placeholder for content that loads; imp skill theming - the colours behind the
`color` names.
