# tabs — one strip of tabs over a set of panels, keyboard-operable and ARIA-wired

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

Call shape: `tabs(props)` — everything is passed as props. It takes **no children**; a child is
warned about and dropped.

| Prop          | Values                                            | Default            | Notes                                      |
| ------------- | ------------------------------------------------- | ------------------ | ------------------------------------------ |
| `items`       | array of `{ id, label, content, disabled }`       | `[]`               | Required in practice — see the table below |
| `selected`    | an item's `id`, or a state holding one — **live** | first enabled item | Which panel is showing                     |
| `orientation` | `'horizontal'`, `'vertical'`                      | `'horizontal'`     | Vertical puts the strip beside the panels  |
| `label`       | string, or a state holding one — **live**         | —                  | Accessible name for the tab strip          |
| `events`      | `{ select }`                                      | —                  | `select` fires on the host — see below     |

Each entry in `items`:

| Key        | Values                    | Default   | Notes                                          |
| ---------- | ------------------------- | --------- | ---------------------------------------------- |
| `id`       | string or number          | its index | What `selected` and `event.detail.id` refer to |
| `label`    | string, or a state — live | required  | The word on the tab                            |
| `content`  | any content               | empty     | The panel body — nodes, text, or an array      |
| `disabled` | boolean                   | `false`   | Not selectable and skipped by the arrow keys   |

Rules an agent gets wrong:

- **It imports from `imp/std/navigation`**, not from `imp/std`.
- **Panels are passed as `items`, not as children.** A tab and its panel are wired together by id
  (`aria-controls` / `aria-labelledby`), and those ids cannot cross a shadow root — so `tabs` must
  render both halves, which is why the API is one `items` array rather than composed children.
- **Selection is not a prop you keep writing.** With no `selected`, `tabs` selects the first enabled
  item and manages selection itself. Pass `selected` only to control it; pass a **state** to keep
  controlling it after mount, since a plain string is read once.
- **Listen with `events: { select }`, not `onSelect`.** It is a `CustomEvent` on the host with
  `detail: { id, index }`, and it fires only for a user's choice — never for a change driven by the
  `selected` state, so a state bound both ways cannot loop.
- **Every panel is rendered at mount** and hidden with `hidden`, so state inside a panel survives
  switching tabs. Do not pass content that is expensive to build for every tab at once.
- **`label` names the strip, not a tab.** The tabs name themselves from their own `label` text.
- Unknown props warn at mount, an out-of-range `orientation` warns and falls back, an item without a
  `label` is warned about and skipped, and a `selected` matching no item warns and is ignored.

Keyboard, which comes for free: Left/Right arrows when horizontal (mirrored under `dir="rtl"`),
Up/Down when vertical, Home and End for the first and last enabled tab. Selection follows focus, and
disabled items are skipped.

```js
import { initState } from 'imp/state'
import { tabs } from 'imp/std/navigation'

const openTab = initState('settings.tab', 'profile')

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
