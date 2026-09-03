# form - a form whose values are ordinary imp state, addressed by field path

```js
import { form, submitButton, textField } from 'imp/std/inputs'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  submitButton('Save'),
)
```

The call shape is `form(props?, ...children)`. The children are the fields and the buttons. imp lays
them out in a column.

`form` calls `initState(self, 'imp.form', initialValues ?? null)` on itself. So **the values of the
form are ordinary named state**, and they live at the position of the form in the tree. A control
inside the form names the field that it owns with a dot path. It reads and writes that state
directly. There is nothing to connect. When the form unmounts, the state goes with it.

| Prop            | Values                                   | Default      | Notes                                        |
| --------------- | ---------------------------------------- | ------------ | -------------------------------------------- |
| `initialValues` | plain object                             | `null`       | Seeds `imp.form`; also what `reset` restores |
| `onSubmit`      | `(values) => void \| Promise`            | -            | Runs only when every field is valid          |
| `layout`        | `'vertical'`, `'horizontal'`, `'inline'` | `'vertical'` | Where each field's label sits                |
| `gap`           | spacing step `0`-`6`                     | `4`          | Space between children                       |

## The states it owns

| State                 | Holds                                                  |
| --------------------- | ------------------------------------------------------ |
| `imp.form`            | The values - read it with `useState(self, 'imp.form')` |
| `imp.form.errors`     | `{ [path]: problem }` for the fields that fail         |
| `imp.form.touched`    | `{ [path]: true }` once a field has been left          |
| `imp.form.submitting` | `true` while an async `onSubmit` is in flight          |
| `imp.form.submits`    | How many times submit has been attempted               |
| `imp.form.validating` | `{ [path]: true }` for fields with a check in flight   |

`imp.form` is the only state for your code. The others are how the controls and the buttons agree
with each other.

## Submitting

- **`submitButton()` is the submit action.** It can sit anywhere inside the form. It shows a spinner
  itself while an async `onSubmit` runs.
- **Enter in any single-line field submits the form**, because imp implements the implicit submit
  itself. Enter in a `textArea` does not submit.
- On a submit, imp validates every field again. If one field fails, `onSubmit` does not run, and
  each bad field starts to show its message.
- **When a field has an async check through `validateAsync`, the submit waits for it.** The button
  spins until every check settles, and then imp decides. With no async check, the submit happens in
  the same tick.
- `resetButton()` puts `initialValues` back. It also clears the errors and the touched state.

Rules an agent gets wrong:

- **There is no native `<form>` submit to attach to.** Do not pass `events: { submit }`, and do not
  use a `type: 'submit'` button. `onSubmit` on the form and `submitButton()` are the whole API.
- **`onSubmit` receives the values object**, already validated. Read the argument. Do not call
  `useState(self, 'imp.form')` again.
- **Return the promise from an async `onSubmit`**, so the form knows when the work finished. That
  promise drives the spinner of the submit button, and it stops a double submit.
- **Use one form per `initialValues`.** Two forms on a page each own their own `imp.form`, and imp
  resolves each one by position. So in a nested form, the inner form wins for its own children.
- imp warns about an unknown prop at mount. It warns about a `layout` outside the list, and falls
  back to the default.

```js
form(
  {
    initialValues: { email: '', plan: 'free' },
    onSubmit: async (values) => await post('/signup', values),
  },
  textField({ field: 'email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  flex(submitButton('Create account'), resetButton('Start over')),
)
```
