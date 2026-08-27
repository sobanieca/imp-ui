# form - a form whose values are ordinary imp state, addressed by field path

```js
import { form, submitButton, textField } from 'imp/std/inputs'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  submitButton('Save'),
)
```

Call shape: `form(props?, ...children)` - children are the fields and buttons, laid out in a column.

`form` calls `initState('imp.form', initialValues ?? null)` on itself, so **the form's values are
ordinary named state** living at the form's position in the tree. Controls inside it name the field
they own with a dot path and read and write that state directly. Nothing to wire up, and unmounting
the form disposes the state with it.

| Prop            | Values                                   | Default      | Notes                                        |
| --------------- | ---------------------------------------- | ------------ | -------------------------------------------- |
| `initialValues` | plain object                             | `null`       | Seeds `imp.form`; also what `reset` restores |
| `onSubmit`      | `(values) => void \| Promise`            | -            | Runs only when every field is valid          |
| `layout`        | `'vertical'`, `'horizontal'`, `'inline'` | `'vertical'` | Where each field's label sits                |
| `gap`           | spacing step `0`-`6`                     | `4`          | Space between children                       |

## The states it owns

| State                 | Holds                                                |
| --------------------- | ---------------------------------------------------- |
| `imp.form`            | The values - read it with `useState('imp.form')`     |
| `imp.form.errors`     | `{ [path]: problem }` for the fields that fail       |
| `imp.form.touched`    | `{ [path]: true }` once a field has been left        |
| `imp.form.submitting` | `true` while an async `onSubmit` is in flight        |
| `imp.form.submits`    | How many times submit has been attempted             |
| `imp.form.validating` | `{ [path]: true }` for fields with a check in flight |

Only `imp.form` is meant for your code; the rest are how the controls and the buttons agree with
each other.

## Submitting

- **`submitButton()` is the submit action.** It sits anywhere inside the form, and shows a spinner
  by itself while an async `onSubmit` runs.
- **Enter in any single-line field submits**, because imp implements implicit submission itself -
  Enter in a `textArea` does not.
- On submit every field re-validates. If anything fails, `onSubmit` never runs and each bad field
  starts showing its message.
- **If any field has an async check (`validateAsync`), submit waits for it** - the button spins
  until every check settles, then decides. With no async checks submit happens in the same tick.
- `resetButton()` puts `initialValues` back and clears errors and touched state.

Rules an agent gets wrong:

- **There is no native `<form>` submit to hook.** Do not pass `events: { submit }` or reach for a
  `type: 'submit'` button - `onSubmit` on the form and `submitButton()` are the whole story.
- **`onSubmit` receives the values object**, already validated. Read it from the argument rather
  than calling `useState('imp.form')` again.
- **Return the promise from an async `onSubmit`** so the form knows when it finished - that is what
  drives the submit button's spinner and stops double submits.
- **One form per `initialValues`.** Two forms on a page each own their own `imp.form`, resolved by
  position, so nesting one inside another makes the inner one win for its children.
- Unknown props warn at mount, and an out-of-range `layout` warns and falls back.

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
