# searchField - a search input bound to a form field or a plain state

```js
import { searchField } from 'imp/std/inputs'

searchField({ value: query, ariaLabel: 'Search invoices', placeholder: 'Search…' })
```

Call shape: `searchField(props?)` - it takes no children. It is `textField` with `type="search"`, so
browsers render their own clear affordance.

| Prop        | Values                                     | Notes                                        |
| ----------- | ------------------------------------------ | -------------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`              | Binds to that path of the surrounding form   |
| `value`     | a state, or a plain value                  | Standalone use, when there is no form        |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the control |
| `ariaLabel` | string                                     | Names it when there is no visible label      |
| `help`      | string, or a state holding one             | Hint under the control                       |
| `required`  | boolean                                    | Marks it and validates that it is filled in  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks interaction                           |

Also: `placeholder`, `readonly`, `autocomplete`.

Validation props: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern` (a RegExp) and
`validate` - a function returning a message string, or `null` when the value is fine. Messages come
from the `imp.form.*` keys, so translate those rather than hardcoding wording.

`validateAsync` takes the same shape but returns a **promise** of a message or `null`, and runs only
on **blur and submit** - never on every keystroke. A sync failure skips it, submit waits for it, and
a rejected promise reports `imp.form.checkFailed` rather than letting the value through.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form use `field`; passing both warns and
  `field` wins. A `field` with no form around it is an error.
- **An error only shows once the field has been left or submit was attempted**, so a form does not
  shout at someone still filling in the first box.
- **`label` renders a real `<label>` inside this component.** Do not wrap the control in your own
  label - a label outside cannot reach the input across the shadow boundary.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.
- **It is most often used standalone**, filtering a list from a `value` state rather than sitting in
  a form.
- **It commits on every keystroke.** Debounce in your own watcher if each change costs a request.
- **Give it an `ariaLabel` when it has no visible label** - a bare search box is otherwise unnamed.

```js
const query = initState('invoices.query', '')

searchField({ value: query, ariaLabel: 'Search invoices', placeholder: 'Search…' })
searchField({ field: 'term', label: 'Find' })
```
