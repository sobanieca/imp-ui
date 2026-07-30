# resetButton — puts the form back to the values it started with

```js
import { resetButton } from 'imp/std/inputs'

resetButton('Start over')
```

Call shape: `resetButton(props?, ...children)` — children are the label.

It finds the form around it by position and restores the form's `initialValues`, clearing every
error and every field's touched state along with them.

| Prop       | Values                                          | Default     | Notes                 |
| ---------- | ----------------------------------------------- | ----------- | --------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'default'` | Visual weight         |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size |
| `disabled` | boolean, or a state holding one — **live**      | `false`     | Blocks interaction    |

Rules an agent gets wrong:

- **It must be inside a `form`.** Rendering one anywhere else is an error telling you so.
- **Reset means "back to `initialValues`", not "empty".** A form seeded with a record resets to that
  record. To clear it, pass empty `initialValues`.
- **It does not ask first.** Wire your own confirmation if losing the edits matters.
- **It is not a Cancel button.** Navigating away is a `link` or a plain `button` with your own
  handler.

```js
row({ gap: 2 }, submitButton('Save'), resetButton('Start over'))
```
