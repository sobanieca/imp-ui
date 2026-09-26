# loader - the spinner of the theme, for a wait with no known end

```js
import { loader } from 'imp/std/feedback'

loader({ label: 'Loading' })
loader({ label: 'Loading the report', size: 'lg' })
loader({ label: 'Saving', size: 'sm', client: 'myapp.api' })
```

The call shape is `loader(props)`. It takes no children.

| Prop     | Values                                    | Default     | Notes                                                        |
| -------- | ----------------------------------------- | ----------- | ------------------------------------------------------------ |
| `label`  | string or state                           | none        | Live. What a screen reader announces. Always pass it         |
| `size`   | `'sm'`, `'md'`, `'lg'`                    | `'md'`      | `1rem`, `2rem` or `3rem` square                              |
| `color`  | a role name or a palette name             | `'primary'` | Roles: `primary`, `success`, `warning`, `danger`, `info`     |
| `client` | the name of an HTTP client, or the client | none        | Shows the component only while that client has calls pending |

The palette names are `gray`, `brown`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`,
`cyan`, `sky`, `blue`, `indigo`, `violet`, `purple` and `pink`.

Rules an agent gets wrong:

- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **`loader` is for a wait with no measure. `progress` is for a measured one.** A request in flight,
  a page that loads, a search that runs: `loader`. An upload at 40%, a migration of 120 out of 300
  records: `progress({ value, max })`. `progress` never spins.
- **The theme decides the shape.** The `loader` token of the theme is `spinner`, `dots`, `bar` or
  `pulse`, see imp skill theming. This component draws that shape. There is no prop for it.
- **Always pass `label`.** The component shows no text. imp renders the label visually hidden, in a
  `role="status"` region, so a screen reader announces it when the loader appears. imp warns when it
  is missing.
- **The words beside the loader are yours.** Write `flex(loader({ label }), text('Loading...'))`.
  Then pass the same words as `label`, so a screen reader says them once.
- **`client` hides the component while no call is in flight.** It takes no space then. Pass
  `api.tracked('users.save')` as `client` to follow one tracked call.
- **`client` as a name resolves from the position of the component.** An ancestor must call
  `initHttpClient` for that name. If none did, imp logs an error and the component stays hidden.
- **`color` is a name, not a CSS colour.** Never write `'#00884d'`.
- **A `button` has its own `loading` prop.** Do not put a `loader` inside a button.
- **A region that loads content is `skeleton`**, see imp skill std/skeleton. A `loader` is for a
  wait that nothing takes the place of.

```js
import { component } from 'imp'
import { useHttpClient } from 'imp/http'
import { button } from 'imp/std'
import { loader } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'

export const saveBar = component('myapp-save-bar', {
  setup: (self) => {
    const api = useHttpClient(self, 'myapp.api')
    const save = () => api.post('/invoices', { body: { total: 120 } })
    return flex(
      { gap: 3, verticalAlign: 'center' },
      button({ variant: 'primary', events: { click: save } }, 'Save'),
      loader({ label: 'Saving', size: 'sm', client: 'myapp.api' }),
    )
  },
})
```

Related: imp skill std/progress - a wait with a measure; imp skill std/skeleton - a placeholder for
content that loads; imp skill http - `pending`, `tracked()` and where a client lives; imp skill
theming - the `loader` token that selects the shape.
