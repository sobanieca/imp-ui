# accordion - a list of titled sections that open and close, built on native details

```js
import { accordion } from 'imp/std/display'

accordion({
  items: [
    { id: 'shipping', title: 'Shipping', content: shippingPanel(), open: true },
    { id: 'returns', title: 'Returns', content: 'Send it back within 30 days.' },
  ],
})
```

The call shape is `accordion(props)`. You pass everything as props. The component takes **no
children**. imp warns about a child and drops it.

| Prop       | Values                                  | Default | Notes                                          |
| ---------- | --------------------------------------- | ------- | ---------------------------------------------- |
| `items`    | array of `{ id, title, content, open }` | `[]`    | Required in practice - see the table below     |
| `multiple` | boolean                                 | `false` | `false`: to open one section closes the others |
| `events`   | `{ toggle }`                            | -       | Fires on the host with `detail: { id, open }`  |

Each entry in `items` has these keys:

| Key       | Values                    | Default   | Notes                                       |
| --------- | ------------------------- | --------- | ------------------------------------------- |
| `id`      | string or number          | its index | What `event.detail.id` refers to            |
| `title`   | string, or a state - live | required  | The words on the row that opens the section |
| `content` | any content               | empty     | The body - nodes, text, or an array         |
| `open`    | boolean                   | `false`   | Whether the section starts open. Read once  |

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **Pass a section in `items`, not as a child.** Each item renders a native `<details>` with a
  `<summary>`. The browser owns the toggle, the Enter and Space keys, and the semantics.
- **`open` is a start value, not a controlled prop.** imp reads it once. After mount the person
  opens and closes the sections. Do not pass a state as `open`.
- **Without `multiple`, only one section is open.** The browser closes the other sections. When
  several items have `open: true`, imp keeps the first one and warns. Pass `multiple: true` to keep
  them all.
- **Listen with `events: { toggle }`, not with `onToggle`.** `toggle` is a `CustomEvent` on the
  host, with `detail: { id, open }`. It fires for each section that changes. So in the exclusive
  mode one click can fire two events: one section closes and one section opens. A `toggle` from an
  accordion inside a section does not reach `events.toggle`.
- **imp renders every `content` at mount.** A closed section is hidden, not removed. So state inside
  a section survives. Do not pass content that is expensive to build for every section at once.
- **The height does not animate.** Only the chevron turns, and it does not turn under
  `prefers-reduced-motion`.
- **The accordion has its own border and dividers.** Do not put it in a `card` to get a frame.
- For a small number of views that replace each other, use `tabs`, not an accordion.
- imp warns about an unknown prop, about `items` that is not an array, and about an item with no
  `title`, which it skips.

```js
import { accordion } from 'imp/std/display'

accordion({
  multiple: true,
  items: [
    { id: 'profile', title: 'Profile', content: profileForm(), open: true },
    { id: 'security', title: 'Security', content: securityForm() },
    { id: 'billing', title: planName, content: billingPanel() },
  ],
  events: { toggle: (event) => track('section', event.detail.id, event.detail.open) },
})
```

Related: imp skill std/tabs - views that replace each other; imp skill std/card - a framed panel
with no toggle.
