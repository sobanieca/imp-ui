# resetButton - puts the form back to the values it started with

```js
import { resetButton } from 'imp/std/inputs'

resetButton('Start over')
```

The call shape is `resetButton(props?, ...children)`. The children are the label.

The button finds the form around it by position. It restores the `initialValues` of the form. It
also clears every error, and the touched state of every field.

| Prop       | Values                                          | Default     | Notes                 |
| ---------- | ----------------------------------------------- | ----------- | --------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'default'` | Visual weight         |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size |
| `disabled` | boolean, or a state holding one - **live**      | `false`     | Blocks interaction    |

Rules an agent gets wrong:

- **The button must be inside a `form`.** Anywhere else, imp reports an error that says so.
- **A reset returns the form to `initialValues`. It does not empty the form.** A form that starts
  from a record resets to that record. To clear the form, pass empty `initialValues`.
- **The button does not ask first.** Add your own confirmation when the loss of the edits matters.
- **The button is not a Cancel button.** To navigate away, use a `link`, or a plain `button` with
  your own handler.

```js
flex({ gap: 2 }, submitButton('Save'), resetButton('Start over'))
```
