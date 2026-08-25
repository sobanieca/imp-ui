# button - the standard button, rendered as a real `<button>`

```js
import { button } from 'imp/std'

button({ variant: 'primary', events: { click: save } }, 'Save changes')
```

Call shape: `button(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content.

| Prop       | Values                                                    | Default     | Notes                                                  |
| ---------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Visual weight and intent                               |
| `size`     | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                                  |
| `disabled` | boolean, or a state holding one - **live**                | `false`     | Blocks interaction                                     |
| `loading`  | boolean, or a state holding one - **live**                | `false`     | Shows a spinner, disables the button, sets `aria-busy` |
| `block`    | boolean                                                   | `false`     | Fills the width of its container                       |
| `label`    | string, or a state holding one - **live**                 | -           | `aria-label` on the button - names an icon-only one    |
| `events`   | event map, e.g. `{ click: handler }`                      | -           | Handlers, exactly as on any element                    |

Rules an agent gets wrong:

- **There is no `type` prop and no submit button.** A button acts on its `click` handler; do the
  submitting there. Passing `type` warns about an unknown prop.
- **`loading` implies disabled**, so an in-flight request cannot be fired twice. Do not also pass
  `disabled`.
- **A live prop takes the state itself, not its value** - `disabled: saving`, never
  `disabled: saving.get()`, which would freeze at the value read during mount.
- **No outer margins.** Spacing between buttons belongs to whatever lays them out.
- The accessible name is the button's content. An icon-only button needs `label`; there is no
  `aria-label` prop, which warns as unknown.
- **`variant: 'link'` is a button that looks like a link** - use it for an action written in running
  text. A place a person can go to is link (imp skill std/link), which needs an `href`.
- **The host forwards focus**, so a component that composes `button` keeps the returned element and
  calls `.focus()` on it - never reach into its `shadowRoot`.
- Unknown props warn at mount, and an out-of-range `variant`/`size` warns and falls back.

```js
const sending = initState('contact.sending', false)

button({ variant: 'primary', loading: sending, events: { click: send } }, 'Send')
button({ variant: 'danger', size: 'sm', events: { click: remove } }, 'Delete')
button({ block: true, events: { click: next } }, 'Continue')
button({ variant: 'link', events: { click: showDetails } }, 'What is this?')
```

Related: link (imp skill std/link)
