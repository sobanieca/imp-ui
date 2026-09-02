# searchField - a search input bound to a form field or a plain state

```js
import { searchField } from 'imp/std/inputs'

searchField({ value: query, ariaLabel: 'Search invoices', placeholder: 'Search...' })
```

The call shape is `searchField(props?)`. It takes no children. It is `textField` with
`type="search"`, so the browser draws its own clear control.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                           |

The other props are `placeholder`, `readonly` and `autocomplete`.

The validation props are `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, which is a
RegExp, and `validate`. `validate` is a function. It returns a message string, or `null` when the
value is correct. The messages come from the `imp.form.*` keys. Translate those keys. Do not write
fixed wording.

`validateAsync` has the same shape, but it returns a **promise** of a message or of `null`. It runs
on **blur and on submit** only, never on a keystroke. A synchronous failure skips it. A submit waits
for it. A rejected promise reports `imp.form.checkFailed`, and the value does not pass.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **An error shows only after the person leaves the field, or tries to submit.** So the form does
  not report a problem while the person still fills in the first box.
- **`label` renders a real `<label>` inside this component.** Do not put your own label around the
  control. A label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop at mount. It warns about a value outside the list, and falls back
  to the default.
- **The field is usually standalone.** It filters a list from a `value` state, instead of sitting in
  a form.
- **The field commits on every keystroke.** Debounce in your own watcher when each change costs a
  request.
- **Give the field an `ariaLabel` when it has no visible label.** A search box on its own has no
  name.

```js
const query = initState('invoices.query', '')

searchField({ value: query, ariaLabel: 'Search invoices', placeholder: 'Search...' })
searchField({ field: 'term', label: 'Find' })
```
