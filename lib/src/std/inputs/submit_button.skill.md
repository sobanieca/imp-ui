# submitButton — the button that submits the form it sits in

```js
import { submitButton } from 'imp/std/inputs'

submitButton('Save changes')
```

Call shape: `submitButton(props?, ...children)` — children are the label.

It finds the form around it by position, so it works at any depth — inside a `row`, a `stack`, or
anything else. Clicking it validates every field and runs the form's `onSubmit` only if they all
pass. While an async `onSubmit` is in flight it shows a spinner and refuses further clicks.

| Prop       | Values                                          | Default     | Notes                 |
| ---------- | ----------------------------------------------- | ----------- | --------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'primary'` | Visual weight         |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size |
| `disabled` | boolean, or a state holding one — **live**      | `false`     | Blocks interaction    |

Rules an agent gets wrong:

- **It must be inside a `form`.** Rendering one anywhere else is an error telling you so.
- **There is no `events: { click }` and no `onSubmit` here.** The handler belongs on the form; this
  button only asks the form to submit.
- **Do not disable it while the form is invalid.** Let the click happen so every bad field starts
  showing its message — that is how the user finds out what is wrong.
- **The spinner is automatic** from the form's submitting state; do not also pass `loading`, which
  is not a prop here.
- Enter in any single-line field submits too, so this button is not the only way in.

```js
form(
  { initialValues: { email: '' }, onSubmit: save },
  textField({ field: 'email', label: 'Email', required: true }),
  row({ gap: 2 }, submitButton('Save'), resetButton('Cancel')),
)
```
