# commandPalette - one search field that fuzzy-filters a list of destinations

```js
import { commandPalette } from 'imp/std/navigation'

commandPalette({
  label: 'Search components',
  placeholder: 'Search components…',
  shortcut: 'ctrl+p',
  items: [
    { id: 'general/button', group: 'general', label: 'button', href: '/preview/button.js' },
    { id: 'layout/stack', group: 'layout', label: 'stack', href: '/preview/stack.js' },
  ],
})
```

Call shape: `commandPalette(props)` - everything is passed as props. It takes **no children**; a
child is warned about and dropped. It fills its container's inline size, so put it in the layout box
you want it to be as wide as.

| Prop           | Values                                    | Default        | Notes                                             |
| -------------- | ----------------------------------------- | -------------- | ------------------------------------------------- |
| `items`        | array of `{ id, label, group, … }` - live | `[]`           | Pass a state to refill the list after mount       |
| `label`        | string, or a state holding one - live     | `'Search'`     | Accessible name for the field and the result list |
| `placeholder`  | string, or a state holding one - live     | `'Search'`     | The ghost text in the empty field                 |
| `shortcut`     | `'ctrl+p'`, `'ctrl+k'`, `'alt+s'`, …      | -              | Focuses and selects the field from anywhere       |
| `limit`        | whole number                              | `50`           | How many matches are rendered at once             |
| `emptyMessage` | string                                    | `'No matches'` | Shown when nothing matches                        |
| `events`       | `{ select }`                              | -              | `select` fires on the host - see below            |

Each entry in `items`:

| Key           | Values           | Default   | Notes                                               |
| ------------- | ---------------- | --------- | --------------------------------------------------- |
| `label`       | string           | required  | The name of the destination                         |
| `id`          | string or number | its index | What `event.detail.id` reports                      |
| `group`       | string           | -         | Shown dimmed as `group/label`, and searched with it |
| `description` | string           | -         | Secondary text at the end of the row - not searched |
| `href`        | string           | -         | Makes the row a real link, followed on activation   |
| `disabled`    | boolean          | `false`   | Not activatable, skipped by the arrow keys          |

Rules an agent gets wrong:

- **It imports from `imp/std/navigation`**, not from `imp/std`.
- **The query is matched against `group/label`, not the description.** A `group` is therefore how a
  user searches by category - `inp` finds every item in the `inputs` group. Matching is fuzzy (`tf`
  matches `text_field`), a match on the label outranks one on the group, and the matched characters
  are highlighted in the row.
- **Filtering is the component's job, not yours.** Give it the whole list once; do not re-render it
  in response to typing. `items` is live, so a state holding a list refills it - use that for a list
  that arrives from the network, not for filtering.
- **`shortcut` names one key with optional modifiers**, lowercase, joined with `+`. `ctrl` matches
  **Ctrl and ⌘**, so one spelling works on every platform, and the hint in the field renders as
  `Ctrl P` or `⌘P` accordingly. The shortcut is captured on the window and preventDefault-ed, so it
  wins over the browser's own binding.
- **An item with an `href` is followed on activation** - through the router (`imp skill routing`)
  for an in-app path, and by a full page load for an absolute URL. To do something else instead,
  call `event.preventDefault()` in the `select` handler and navigate yourself.
- **Listen with `events: { select }`, not `onSelect`.** It is a cancelable `CustomEvent` on the host
  with `detail: { id, item }`, where `item` is the normalized entry.
- The field is a `role="combobox"` over a `role="listbox"`, so **do not wrap it in your own combobox
  markup** or add a `<label>` for it - the ids that wire the two together cannot cross a shadow
  root, which is why this is one component and not a field plus a list.

Keyboard, which comes for free: the shortcut focuses and selects the field, Up/Down move through the
matches and wrap, Enter opens the highlighted one, Escape clears a non-empty query and then closes
the list. The result count is announced through a live region on every keystroke.

```js
import { commandPalette } from 'imp/std/navigation'
import { navigate } from 'imp/router'

commandPalette({
  label: 'Go to',
  shortcut: 'ctrl+k',
  items: pages.map((page) => ({ id: page.id, group: page.section, label: page.title })),
  events: { select: (event) => navigate(`/pages/${event.detail.id}`) },
})
```

Related: imp skill std/navMenu - the always-visible list of the same destinations.
