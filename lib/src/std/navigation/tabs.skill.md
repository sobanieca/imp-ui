# tabs - one strip of tabs over a set of panels, keyboard-operable and ARIA-wired

```js
import { tabs } from 'imp/std/navigation'

tabs({
  label: 'Account sections',
  items: [
    { id: 'overview', label: 'Overview', content: overviewPanel() },
    { id: 'billing', label: 'Billing', content: billingPanel() },
  ],
})
```

The call shape is `tabs(props)`. You pass everything as props. The component takes **no children**.
imp warns about a child and drops it.

| Prop          | Values                                            | Default            | Notes                                      |
| ------------- | ------------------------------------------------- | ------------------ | ------------------------------------------ |
| `items`       | array of `{ id, label, content, disabled }`       | `[]`               | Required in practice - see the table below |
| `selected`    | an item's `id`, or a state holding one - **live** | first enabled item | Which panel is showing                     |
| `orientation` | `'horizontal'`, `'vertical'`                      | `'horizontal'`     | Vertical puts the strip beside the panels  |
| `foldable`    | boolean                                           | `false`            | Vertical only: a button folds the strip    |
| `folded`      | boolean, or a state holding one - **live**        | `false`            | Whether the strip is folded - see below    |
| `label`       | string, or a state holding one - **live**         | -                  | Accessible name for the tab strip          |
| `events`      | `{ select, fold }`                                | -                  | Both fire on the host - see below          |

Each entry in `items` has these keys:

| Key        | Values                    | Default   | Notes                                          |
| ---------- | ------------------------- | --------- | ---------------------------------------------- |
| `id`       | string or number          | its index | What `selected` and `event.detail.id` refer to |
| `label`    | string, or a state - live | required  | The word on the tab                            |
| `content`  | any content               | empty     | The panel body - nodes, text, or an array      |
| `disabled` | boolean                   | `false`   | Not selectable and skipped by the arrow keys   |

Rules an agent gets wrong:

- **Import the component from `imp/std/navigation`**, not from `imp/std`.
- **Pass a panel in `items`, not as a child.** A tab and its panel connect by id, through
  `aria-controls` and `aria-labelledby`, and an id cannot cross a shadow root. So `tabs` must render
  both halves. That is why the API is one `items` array, and not composed children.
- **The selection is not a prop that you keep writing.** With no `selected`, `tabs` selects the
  first enabled item and manages the selection itself. Pass `selected` only to control it. Pass a
  **state** to keep control after mount, because imp reads a plain string once.
- **Listen with `events: { select }`, not with `onSelect`.** `select` is a `CustomEvent` on the
  host, with `detail: { id, index }`. It fires only for a choice by the person, never for a change
  that the `selected` state drives. So a state that is bound in both directions cannot loop. A
  `select` from a component inside a panel, such as nested `tabs`, does not reach `events.select`.
  The same holds for `fold`.
- **imp renders every panel at mount** and hides it with `hidden`. So state inside a panel survives
  a change of tab. Do not pass content that is expensive to build for every tab at once.
- **`label` names the strip, not a tab.** Each tab names itself from its own `label` text.
- **`foldable` needs `orientation: 'vertical'`.** It adds a button at the foot of the strip that
  folds the tabs away, so the panel gets the width. The button carries `aria-expanded` and a
  translated label. A folded strip is `inert`, so unfold it to switch tabs. imp warns about
  `foldable` on a horizontal strip, and about `folded` without `foldable`, and ignores both.
- **`folded` works like `selected`.** A plain boolean sets the start. A writable state keeps control
  after mount, and a tap on the button writes it back. `fold` fires on the host with
  `detail: { folded }`, for a tap only, never for a change that the state drives.
- **The parent sets the height.** The strip is as tall as the host. Give the host a `block-size`,
  and the fold button sits at the foot, at the inline end of the strip, with the free space between
  the tabs and the button.
- **A folded strip moves the button to the head.** A tall panel scrolls, and the button stays where
  the reader starts to read, so the tabs come back with one tap.
- imp warns about an unknown prop at mount. It warns about an `orientation` outside the list and
  falls back. It warns about an item with no `label` and skips it. It warns about a `selected` that
  matches no item, and ignores it.

The keyboard support is included. The Left and Right arrows work when the strip is horizontal, and
they mirror under `dir="rtl"`. The Up and Down arrows work when the strip is vertical. `Home` and
`End` go to the first and the last enabled tab. The selection follows the focus, and imp skips a
disabled item.

```js
import { initState } from 'imp/state'
import { tabs } from 'imp/std/navigation'

const openTab = initState(self, 'settings.tab', 'profile')

tabs({
  label: 'Settings',
  selected: openTab,
  items: [
    { id: 'profile', label: 'Profile', content: profileForm() },
    { id: 'security', label: 'Security', content: securityForm() },
    { id: 'audit', label: 'Audit log', content: auditLog(), disabled: !isAdmin },
  ],
  events: { select: (event) => openTab.set(event.detail.id) },
})
```
