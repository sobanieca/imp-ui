# form - a form whose values are ordinary imp state, addressed by field path

```js
import { form, submitForm, textField } from 'imp/std/inputs'
import { button } from 'imp/std'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

The call shape is `form(props?, ...children)`. The children are the fields and the buttons. imp lays
them out in a column.

`form` calls `initState(self, 'imp.form', initialValues ?? null)` on itself. So **the values of the
form are ordinary named state**, and they live at the position of the form in the tree. A control
inside the form names the field that it owns with a dot path. It reads and writes that state
directly. There is nothing to connect. When the form unmounts, the state goes with it.

| Prop            | Values                                   | Default      | Notes                                            |
| --------------- | ---------------------------------------- | ------------ | ------------------------------------------------ |
| `initialValues` | plain object                             | `null`       | Seeds `imp.form`; also what `resetForm` restores |
| `onSubmit`      | `(values) => void \| Promise`            | -            | Runs only when every field is valid              |
| `layout`        | `'vertical'`, `'horizontal'`, `'inline'` | `'vertical'` | Where each field's label sits                    |
| `gap`           | spacing step `0`-`6`                     | `4`          | Space between children                           |

## The states it owns

| State                 | Holds                                                  |
| --------------------- | ------------------------------------------------------ |
| `imp.form`            | The values - read it with `useState(self, 'imp.form')` |
| `imp.form.errors`     | `{ [path]: problem }` for the fields that fail         |
| `imp.form.touched`    | `{ [path]: true }` once a field has been left          |
| `imp.form.submitting` | `true` while an async `onSubmit` is in flight          |
| `imp.form.submits`    | How many times submit has been attempted               |
| `imp.form.validating` | `{ [path]: true }` for fields with a check in flight   |

`imp.form` and `imp.form.submitting` are the states for your code. The others are how the controls
and the form agree with each other.

## Submitting and resetting

`imp/std/inputs` exports two functions beside the components:

| Function             | Does                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `submitForm(source)` | Validates every field, then runs `onSubmit` when every field passes    |
| `resetForm(source)`  | Puts `initialValues` back, and clears the errors and the touched state |

`source` is the click event, or any node inside the form. So a plain `button` is the submit button:
`button({ events: { click: submitForm } }, 'Save')`. The function finds the form by position, at any
depth, so the button can sit inside a `flex`, a `card` or a component of yours.

- **Enter in any single-line field submits the form**, because imp implements the implicit submit
  itself. Enter in a multi-line `textField` does not submit.
- On a submit, imp validates every field again. If one field fails, `onSubmit` does not run, each
  bad field starts to show its message, and the focus moves to the first bad field.
- **When a field has an async check through `validateAsync`, the submit waits for it.**
  `imp.form.submitting` is `true` until every check settles, and then imp decides. With no async
  check, the submit happens in the same tick.
- **While `onSubmit` runs, a second submit is ignored.** Return the promise, so the form knows when
  the work finished.
- A `resetForm` does not ask first. Add your own confirmation when the loss of the edits matters.

Rules an agent gets wrong:

- **There is no native `<form>` submit to attach to.** Do not pass `events: { submit }`, and do not
  use a `type: 'submit'` button. `onSubmit` on the form and `submitForm` are the whole API.
- **There is no `submitButton` and no `resetButton` component.** A `button` from `imp/std` with
  `submitForm` or `resetForm` as its click handler is the button.
- **A spinner on the submit button is `imp.form.submitting`.** A plain button shows none. Write a
  small component that reads the state and passes it as `loading`, as in the example below.
- **`onSubmit` receives the values object**, already validated. Read the argument. Do not call
  `useState(self, 'imp.form')` again.
- **Use one form per `initialValues`.** Two forms on a page each own their own `imp.form`, and imp
  resolves each one by position. So in a nested form, the inner form wins for its own children.
- imp warns about `submitForm` or `resetForm` called with something that is not an event or a node,
  and about a call from a node that has no form around it. It warns about an unknown prop at mount,
  and about a `layout` outside the list, and falls back to the default.

```js
import { component } from 'imp'
import { useState } from 'imp/state'
import { button } from 'imp/std'
import { form, resetForm, select, submitForm, textField } from 'imp/std/inputs'
import { flex } from 'imp/std/layout'

const saveButton = component('myapp-save-button', {
  setup: (self) =>
    button(
      {
        variant: 'primary',
        loading: useState(self, 'imp.form.submitting'),
        events: { click: submitForm },
      },
      'Create account',
    ),
})

form(
  {
    initialValues: { email: '', plan: 'free' },
    onSubmit: async (values) => await post('/signup', values),
  },
  textField({ field: 'email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  flex(saveButton(), button({ variant: 'ghost', events: { click: resetForm } }, 'Start over')),
)
```

Related: imp skill std/button - the button that carries `submitForm`; imp skill state - `useState`
for `imp.form` and `imp.form.submitting`.
