# form - a form whose values are ordinary imp state, addressed by field path

```js
import { form, submitForm, textField } from 'imp/std/inputs'
import { button } from 'imp/std'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  button({ variant: 'primary', submit: true }, 'Save'),
)
```

The call shape is `form(props?, ...children)`. The children are the fields and the buttons. imp lays
them out in a column.

`form` calls `initState(self, 'imp.form', initialValues ?? null)` on itself. So **the values of the
form are ordinary named state**, and they live at the position of the form in the tree. A control
inside the form names the field that it owns with a dot path. It reads and writes that state
directly. There is nothing to connect. When the form unmounts, the state goes with it.

| Prop            | Values                                    | Default      | Notes                                          |
| --------------- | ----------------------------------------- | ------------ | ---------------------------------------------- |
| `initialValues` | plain object                              | `null`       | Seeds `imp.form`, and is the first clean state |
| `onSubmit`      | `(values, { intent }) => void \| Promise` | -            | Runs only when every field is valid            |
| `layout`        | `'vertical'`, `'horizontal'`, `'inline'`  | `'vertical'` | Where each field's label sits                  |
| `gap`           | spacing step `0`-`6`                      | `4`          | Space between children                         |

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
| `imp.form.intent`     | the intent of the last submit, or `null`               |

`imp.form`, `imp.form.submitting`, `imp.form.dirty` and `imp.form.formError` are the states for your
code. The others are how the controls and the form agree with each other. A state of the form
reaches only the subtree of the form. So read it from a component inside the form.

## Submitting and resetting

`imp/std/inputs` exports three functions and one error class beside the components:

| Export                               | Does                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `submitForm(source, intent?)`        | Validates every field, then runs `onSubmit` when every field passes                         |
| `useField(self, path)`               | One field of the form around `self`: `get`, `set`, `watch`, `text`, `view`                  |
| `resetForm(source)`                  | Puts the clean state back, and clears the errors, the touched state and the failure         |
| `resetForm(source, values)`          | Makes `values` the clean state, then does the same                                          |
| `new FormError(message)`             | An error from `onSubmit` whose message the form shows to the person                         |
| `new FormError(message, { fields })` | `fields` is `{ [path]: message }`; each message shows on its field, focus goes to the first |

`source` is the click event, or any node inside the form. The function finds the form by position, at
any depth, so the button can sit inside a `flex`, a `card` or a component of yours.

**The submit button is `button({ submit: true })`.** It submits the form around it, and it spins
while `imp.form.submitting` is `true`. `button({ submit: 'draft' })` submits with the intent
`'draft'`. Two buttons with two intents share one form:

```js
form(
  {
    initialValues,
    onSubmit: (values, { intent }) => (intent === 'draft' ? saveDraft(values) : publish(values)),
  },
  textField({
    field: 'title',
    label: 'Title',
    validate: (value, { intent }) => (intent === 'publish' && !value ? 'Add a title' : null),
  }),
  flex(
    { gap: 2 },
    button({ submit: 'draft' }, 'Save draft'),
    button({ variant: 'primary', submit: 'publish' }, 'Publish'),
  ),
)
```

`validate` and `validateAsync` of every control get `(value, { values, intent })`. `values` is the
whole form, for a check that compares two fields. `intent` is the intent of the submit that runs,
or of the last one. An Enter in a field submits with the intent `null`.

`useField(self, path)` gives a component inside the form one field as a state. Use it for a field
that follows another field:

```js
const teamPeople = component('myapp-team-people', {
  setup: (self, { teams }) => {
    const partners = useField(self, 'partners')
    useField(self, 'teamId').watch(self, (teamId) => {
      const team = teams.find((item) => item.id === teamId)
      if (team) partners.set(team.members)
    })
    return comboBox({ field: 'partners', label: 'People', multiple: true, custom: true })
  },
})
```

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
- **A `FormError` with `fields` maps a server error to its fields.** `fields` is
  `{ 'user.email': t('signup.emailTaken') }`. Each message goes into `imp.form.errors` under its
  path, its field shows it, and the focus moves to the first such field. With an empty message,
  `imp.form.formError` stays `null` and no notice shows. A change of the field clears its message.
  The next submit forgets every server message, so a path with no control never blocks a submit.
- **Only a mounted field can block a submit.** A field that leaves the page, such as a field on a
  tab that is not open, drops its error. Its value stays in `imp.form` and goes to `onSubmit`. To
  remove the value too, set the path to `undefined` yourself. When the field comes back, it
  validates again at the next submit.
- **A field path can index an array.** `items.0.name` reads and writes the first row of `items`. imp
  creates the array when it is missing. Render one control per row with `rows.each`, and put the
  index of the row in its path.
- **A successful submit makes the submitted values the clean state.** So `imp.form.dirty` is `false`
  after a save. An edit made while the save runs keeps the form dirty. A failed submit changes
  nothing.
- **`resetForm` puts the clean state back.** Before the first save, that is `initialValues`. A
  `resetForm` during `onSubmit` wins over the save. So an "add" form that clears itself in
  `onSubmit` is clean again.
- **`resetForm(source, values)` sets a new clean state.** Use it when data arrives after the mount,
  or to mark a save that happened outside `onSubmit`.
- A `resetForm` does not ask first. Add your own confirmation when the loss of the edits matters.
- **A field with `secret: true` keeps its value out of `imp.form`.** The form holds it in a private
  store, so no state and no debug log line contains it. `onSubmit` gets the values with the secret
  merged in at its path. The secret counts for `imp.form.dirty`. A successful submit and `resetForm`
  empty it. A failed submit keeps it. A secret field ignores its path in `initialValues`, and imp
  warns about such a value.

Rules an agent gets wrong:

- **There is no native `<form>` submit to attach to.** Do not pass `events: { submit }`, and do not
  use a `type: 'submit'` button. `onSubmit` on the form and `submitForm` are the whole API.
- **There is no `submitButton` and no `resetButton` component.** `button({ submit: true })` is the
  submit button. A `button` with `resetForm` as its click handler is the reset button.
- **Do not write a component only for the spinner.** A `button` with `submit` spins on its own.
- **Do not keep the pressed button in a state of your own.** Pass the intent to `submit`, and read
  `intent` in `onSubmit` and in `validate`.
- **Write one field with `useField(self, path).set(value)`**, not with a spread of the whole
  `imp.form`. `useField(self, path).watch(self, fn)` runs at once with the current value, then on
  each change of that field only.
- **`onSubmit` receives the values object**, already validated. Read the argument. Do not call
  `useState(self, 'imp.form')` again.
- **Put the buttons in the last child.** The failure notice goes above the last child. A row of
  buttons is one `flex`, so the notice sits above the whole row.
- **Do not catch the error in `onSubmit` to show it yourself.** To show a specific message, throw
  `new FormError(t('...'), { cause })`. An `HttpError` shows its `userMessage`, the text that the
  `userMessage` option of the HTTP client reads from the response. Any other error shows only the
  generic message, because its text is not written for a person.
- **Never read a password, a key or a token from `imp.form`.** Set `secret: true` on its field and
  read it from the argument of `onSubmit`. A plain field puts the value in a state, and the debug
  log prints every state value.
- **Use one form per `initialValues`.** Two forms on a page each own their own `imp.form`, and imp
  resolves each one by position. So in a nested form, the inner form wins for its own children.
- imp warns about `submitForm` or `resetForm` called with something that is not an event or a node,
  and about a call from a node that has no form around it. It warns about an unknown prop at mount,
  and about a `layout` outside the list, and falls back to the default.

```js
import { HttpError } from 'imp/http'
import { t } from 'imp/i18n'
import { button } from 'imp/std'
import { form, FormError, resetForm, select, textField } from 'imp/std/inputs'
import { flex } from 'imp/std/layout'

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
  flex(
    button({ variant: 'primary', submit: true }, 'Create account'),
    button({ variant: 'ghost', events: { click: resetForm } }, 'Start over'),
  ),
)
```

Related: imp skill std/button - the button with `submit`; imp skill state - `useState` for
`imp.form` and `imp.form.submitting`; imp skill http - `userMessage`.
