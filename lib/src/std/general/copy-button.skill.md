# copyButton - a button that copies a text to the clipboard and confirms it

```js
import { copyButton } from 'imp/std'

copyButton({ value: inviteUrl })
copyButton({ value: inviteUrl, variant: 'primary' }, 'Copy link')
copyButton({ value: link, label: `Copy the link of ${person.name}`, size: 'sm', variant: 'ghost' })
```

The call shape is `copyButton(props?, ...children)`. The children are the text of the button. With
no children, the button is a square copy icon with a tooltip that shows its name.

| Prop       | Values                                     | Default     | Notes                                        |
| ---------- | ------------------------------------------ | ----------- | -------------------------------------------- |
| `value`    | string, or a state holding one - **live**  | -           | The text that a click copies                 |
| `label`    | string, or a state holding one             | "Copy"      | The accessible name, needed for a bare icon  |
| `variant`  | as on `button`                             | `'default'` | The look of the button                       |
| `size`     | as on `button`                             | `'md'`      | The size of the button                       |
| `disabled` | boolean, or a state holding one - **live** | `false`     | Blocks the click                             |
| `events`   | `{ copyResult }`                           | -           | `detail: { value, copied }` after each click |

After a copy, the icon turns into a check mark for 1.5 seconds. A status region announces "Copied"
to a screen reader. Without a `label`, the name of the button also changes to "Copied".

Rules an agent gets wrong:

- **Do not write a `navigator.clipboard` helper.** This button is the copy action, also in a list
  row or next to a read-only `textField`.
- **The clipboard can refuse the text**, for example on a page that is not served over https. The
  button then fires `copyResult` with `copied: false`. Show the text another way there, such as in a
  `notify`.
- **A bare icon needs a precise `label` in a list.** Write `label: 'Copy the link of Ada'`, not one
  "Copy" per row.
- **Put it beside a read-only field with a joined row:**
  `flex({ joined: true }, textField({ value: url, ariaLabel: 'Link', readonly: true }), copyButton({ value: url }, 'Copy'))`.
- The words are `imp.copy.copy` and `imp.copy.copied`. Override them in your translations.

```js
import { copyButton } from 'imp/std'
import { notify } from 'imp/std/feedback'

copyButton(
  {
    value: link,
    events: {
      copyResult: (event) =>
        event.detail.copied
          ? notify({ kind: 'success', title: 'Link copied' })
          : notify({ title: 'Link', description: event.detail.value }),
    },
  },
  'Copy link',
)
```

Related: imp skill std/button - the button it renders; imp skill std/codeBlock - code with a copy
button of its own.
