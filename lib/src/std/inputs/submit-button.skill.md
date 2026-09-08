# submitButton - the button that submits the form it sits in

```js
import { submitButton } from 'imp/std/inputs'

submitButton('Save changes')
```

The call shape is `submitButton(props?, ...children)`. The children are the label.

The button finds the form around it by position. So it works at any depth, inside a `flex`, a grid
or anything else. A click validates every field. It runs the `onSubmit` of the form only when every
field passes. While an async `onSubmit` is in flight, the button shows a spinner and refuses another
click.

| Prop       | Values                                          | Default     | Notes                 |
| ---------- | ----------------------------------------------- | ----------- | --------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'primary'` | Visual weight         |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size |
| `disabled` | boolean, or a state holding one - **live**      | `false`     | Blocks interaction    |

Rules an agent gets wrong:

- **The button must be inside a `form`.** Anywhere else, imp reports an error that says so.
- **There is no `events: { click }` and no `onSubmit` on this button.** The handler belongs on the
  form. This button only asks the form to submit.
- **Do not disable the button while the form is invalid.** Let the click happen. Every bad field
  then starts to show its message, and that is how the person learns what is wrong.
- **The spinner is automatic**, from the submitting state of the form. Do not pass `loading`. It is
  not a prop here.
- Enter in any single-line field also submits. So this button is not the only way to submit.

```js
form(
  { initialValues: { email: '' }, onSubmit: save },
  textField({ field: 'email', label: 'Email', required: true }),
  flex({ gap: 2 }, submitButton('Save'), resetButton('Cancel')),
)
```
