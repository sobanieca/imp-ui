# progress - a bar, a ring or a gauge, with a known value or with none; also the spinner

```js
import { progress } from 'imp/std/feedback'

progress({ label: 'Uploading', value: 40 })
progress({ label: 'Loading' })
progress({ label: 'Loading', shape: 'ring' })
progress({ label: 'Storage', shape: 'ring', value: used, max: 512, showValue: true })
progress({ label: 'CPU', shape: 'gauge', value: load, color: 'amber' })
progress({ label: 'Saving', client: 'myapp.api' })
```

The call shape is `progress(props)`. It takes no children.

| Prop        | Values                                    | Default     | Notes                                                        |
| ----------- | ----------------------------------------- | ----------- | ------------------------------------------------------------ |
| `label`     | string or state                           | none        | Live. The accessible name. Always pass it                    |
| `value`     | number or state                           | `undefined` | Live. `undefined` or `null` means no known value             |
| `max`       | number above 0                            | `100`       | The value runs from `0` to `max`                             |
| `shape`     | `'bar'`, `'ring'`, `'gauge'`              | `'bar'`     | See the table below                                          |
| `size`      | `'sm'`, `'md'`, `'lg'`                    | `'md'`      | The thickness of a bar, the diameter of a ring or a gauge    |
| `color`     | a role name or a palette name             | `'primary'` | Roles: `primary`, `success`, `warning`, `danger`, `info`     |
| `showValue` | boolean                                   | `false`     | Shows the formatted value. A gauge always shows it           |
| `format`    | `(value, max) => string`                  | a percent   | The default is a whole percent in the active language        |
| `client`    | the name of an HTTP client, or the client | none        | Shows the component only while that client has calls pending |

| Shape   | Draws                         | Label                    | Value                          | Role          |
| ------- | ----------------------------- | ------------------------ | ------------------------------ | ------------- |
| `bar`   | the native `<progress>`       | shown above the bar      | at the inline end, `showValue` | `progressbar` |
| `ring`  | a circle that fills clockwise | the accessible name only | in the middle, `showValue`     | `progressbar` |
| `gauge` | a half circle                 | shown under the arc      | in the middle, always          | `meter`       |

The palette names are `gray`, `brown`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`,
`cyan`, `sky`, `blue`, `indigo`, `violet`, `purple` and `pink`.

Rules an agent gets wrong:

- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **There is no `spinner` component.** A ring with no `value` is the spinner. Write
  `progress({ label: 'Loading', shape: 'ring' })`. A `button` has its own `loading` prop.
- **The theme decides the shape of the spinner.** The `loader` token of the theme is `spinner`,
  `dots`, `bar` or `pulse`, see imp skill theming. A ring with no `value` draws that shape, at the
  size of the ring. There is no prop for it.
- **There is no `statistic` component.** A gauge shows one number of a dashboard. It is a
  `role="meter"`, because it is a measurement and not a task that ends.
- **Always pass `label`.** A ring shows no text, so the label is its only name. imp warns when it is
  missing.
- **Pass a state as `value` to move it.** Do not render the component again. imp updates the element
  and every ARIA value in place.
- **`value` counts to `max`, not to 100.** Write `value: 412, max: 512`. Do not compute a percent.
  imp clamps a value outside `0` to `max`.
- **`format` changes the text, not the fill.** It gives the shown value and `aria-valuetext`. Use it
  for a unit, such as `format: (used) => used + ' GB'`.
- **A gauge needs a `value`.** It has no look for an unknown value. With none, the arc stays empty.
- **A `sm` ring has no room for the value.** imp warns and draws the ring without it. Use `md` or
  `lg` with `showValue`.
- **`client` hides the component while no call is in flight.** It takes no space then. With `client`
  and no `value`, the component has no known value. Pass `api.tracked('users.save')` as `client` to
  follow one tracked call.
- **`client` as a name resolves from the position of the component.** An ancestor must call
  `initHttpClient` for that name. If none did, imp logs an error and the component stays hidden.
- **`color` is a name, not a CSS colour.** Never write `'#00884d'` or `'color-green'`.
- **Do not set a width on a ring or a gauge.** `size` sets it. A bar fills the width of its parent.

```js
import { component } from 'imp'
import { useHttpClient } from 'imp/http'
import { button } from 'imp/std'
import { progress } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'

export const saveBar = component('myapp-save-bar', {
  setup: (self) => {
    const api = useHttpClient(self, 'myapp.api')
    const save = () => api.post('/invoices', { body: { total: 120 } })
    return flex(
      { gap: 3, verticalAlign: 'center' },
      button({ variant: 'primary', events: { click: save } }, 'Save'),
      progress({ label: 'Saving', shape: 'ring', size: 'sm', client: 'myapp.api' }),
    )
  },
})
```

Related: imp skill http - `pending`, `tracked()` and where a client lives; imp skill theming - the
`loader` token that selects the shape of the spinner; imp skill std/notice - the last error of the
same client; imp skill std/skeleton - a placeholder for content that loads; imp skill theming - the
colours behind the `color` names.
