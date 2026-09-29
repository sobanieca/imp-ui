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

| Prop            | Values                                   | Default      | Notes                                          |
| --------------- | ---------------------------------------- | ------------ | ---------------------------------------------- |
| `initialValues` | plain object                             | `null`       | Seeds `imp.form`, and is the first clean state |
| `onSubmit`      | `(values) => void \| Promise`            | -            | Runs only when every field is valid            |
| `layout`        | `'vertical'`, `'horizontal'`, `'inline'` | `'vertical'` | Where each field's label sits                  |
| `gap`           | spacing step `0`-`6`                     | `4`          | Space between children                         |

## The states it owns

| State                 | Holds                                                  |
| --------------------- | ------------------------------------------------------ |
| `imp.form`            | The values - read it with `useState(self, 'imp.form')` |
| `imp.form.errors`     | `{ [path]: problem }` for the fields that fail         |
| `imp.form.touched`    | `{ [path]: true }` once a field was changed and left   |
| `imp.form.submitting` | `true` while an async `onSubmit` is in flight          |
| `imp.form.submits`    | How many times submit has been attempted               |
| `imp.form.validating` | `{ [path]: true }` for fields with a check in flight   |
| `imp.form.dirty`      | `true` while the values differ from the clean state    |
| `imp.form.formError`  | `null`, the message of a `FormError`, or `''`          |

`imp.form`, `imp.form.submitting`, `imp.form.dirty` and `imp.form.formError` are the states for your
code. The others are how the controls and the form agree with each other. A state of the form
reaches only the subtree of the form. So read it from a component inside the form.

## Submitting and resetting

`imp/std/inputs` exports two functions and one error class beside the components:

| Export                      | Does                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `submitForm(source)`        | Validates every field, then runs `onSubmit` when every field passes                 |
| `resetForm(source)`         | Puts the clean state back, and clears the errors, the touched state and the failure |
| `resetForm(source, values)` | Makes `values` the clean state, then does the same                                  |
| `new FormError(message)`    | An error from `onSubmit` whose message the form shows to the person                 |

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
- **When `onSubmit` throws, or its promise rejects, the form shows the failure.** An error `notice`
  above the **last child** of the form shows it, and a screen reader announces it. The next submit
  and `resetForm` clear it.
- **Only a `FormError` shows its own message.** The form writes the first line of its message into
  `imp.form.formError`. Any other error shows the translated `imp.form.submitFailed`, and
  `imp.form.formError` is `''`. imp logs the original error with its logger.
- **A successful submit makes the submitted values the clean state.** So `imp.form.dirty` is `false`
  after a save. An edit made while the save runs keeps the form dirty. A failed submit changes
  nothing.
- **`resetForm` puts the clean state back.** Before the first save, that is `initialValues`. A
  `resetForm` during `onSubmit` wins over the save. So an "add" form that clears itself in
  `onSubmit` is clean again.
- **`resetForm(source, values)` sets a new clean state.** Use it when data arrives after the mount,
  or to mark a save that happened outside `onSubmit`.
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
- **Put the buttons in the last child.** The failure notice goes above the last child. A row of
  buttons is one `flex`, so the notice sits above the whole row.
- **Do not catch the error in `onSubmit` to show it yourself.** To show a specific message, throw
  `new FormError(t('...'), { cause })`. A plain `Error`, an `HttpError` or a `TypeError` shows only
  the generic message, because its text is not written for a person.
- **Use one form per `initialValues`.** Two forms on a page each own their own `imp.form`, and imp
  resolves each one by position. So in a nested form, the inner form wins for its own children.
- imp warns about `submitForm` or `resetForm` called with something that is not an event or a node,
  and about a call from a node that has no form around it. It warns about an unknown prop at mount,
  and about a `layout` outside the list, and falls back to the default.

```js
import { component } from 'imp'
import { HttpError } from 'imp/http'
import { t } from 'imp/i18n'
import { useState } from 'imp/state'
import { button } from 'imp/std'
import { form, FormError, resetForm, select, submitForm, textField } from 'imp/std/inputs'
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
    onSubmit: async (values) => {
      try {
        await post('/signup', values)
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          throw new FormError(t('signup.emailTaken'), { cause: error })
        }
        throw error
      }
    },
  },
  textField({ field: 'email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  flex(saveButton(), button({ variant: 'ghost', events: { click: resetForm } }, 'Start over')),
)
```

Related: imp skill std/button - the button that carries `submitForm`; imp skill state - `useState`
for `imp.form` and `imp.form.submitting`.
