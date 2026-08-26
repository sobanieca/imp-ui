# navMenu - a nav landmark of links, grouped, with the current one marked

```js
import { navMenu } from 'imp/std/navigation'

navMenu({
  label: 'Sections',
  selected: 'reports',
  groups: [{ id: 'work', label: 'Work', badge: 2 }],
  items: [
    { id: 'reports', group: 'work', label: 'Reports', href: '/reports' },
    { id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks', badge: 12 },
    { id: 'settings', label: 'Settings', href: '/settings' },
  ],
})
```

Call shape: `navMenu(props)` - everything is passed as props. It takes **no children**; a child is
warned about and dropped.

| Prop        | Values                                   | Default    | Notes                                           |
| ----------- | ---------------------------------------- | ---------- | ----------------------------------------------- |
| `items`     | array of `{ id, label, href, … }` - live | `[]`       | Pass a state to rebuild the menu after mount    |
| `groups`    | array of `{ id, label, badge }`          | derived    | Orders and names the sections                   |
| `selected`  | an item's `id`, or a state - **live**    | none       | Gets `aria-current="page"`                      |
| `label`     | string, or a state holding one - live    | -          | Names the `<nav>`; give one when a page has two |
| `direction` | `'column'`, `'row'` - **responsive**     | `'column'` | `column` for a sidebar, `row` for a navbar      |
| `gap`       | spacing step `0`-`6` - **responsive**    | `1`        | Between items, and between groups               |
| `events`    | `{ select }`                             | -          | `select` fires on the host - see below          |

Also takes `hideOnMobile` / `hideOnDesktop` like every layout component.

Each entry in `items`:

| Key        | Values                    | Default   | Notes                                          |
| ---------- | ------------------------- | --------- | ---------------------------------------------- |
| `label`    | string, or a state - live | required  | The word in the menu                           |
| `id`       | string or number          | its index | What `selected` and `event.detail.id` refer to |
| `href`     | string                    | -         | Without one the row is inert text, not a link  |
| `group`    | a group's `id`            | -         | Ungrouped items render as one unlabelled list  |
| `badge`    | string or number          | -         | A count at the end of the row                  |
| `disabled` | boolean                   | `false`   | Rendered, not focusable, not activatable       |

Rules an agent gets wrong:

- **It imports from `imp/std/navigation`**, not from `imp/std`.
- **Mark the current page with `selected`, not with a class or a styled item.** It writes
  `aria-current="page"`, which is what a screen reader announces and what the styling keys off. Pass
  a state to keep it in step with the route.
- **A group is a string id on the item, not nesting.** Items keep their order inside a group; groups
  appear in `groups` order, then in first-seen order for any group not declared there. A group title
  is not a heading - it labels its list through `aria-labelledby`, so dropping the menu anywhere in
  a page cannot break that page's heading outline.
- **It renders one flat level.** There are no submenus and no expanding items; for a menu of actions
  rather than destinations, that is a different component.
- **`direction: 'row'` is how the same menu becomes a bar rather than a list** - put the column one
  in a `sidebar` and the row one straight in the `navbar` (`imp skill std/app`).
- **Listen with `events: { select }`, not `onSelect`.** It is a cancelable `CustomEvent` on the host
  with `detail: { id, item }`; the link is followed unless you call `preventDefault()`. Modifier and
  middle clicks are left to the browser, so a link still opens in a new tab.
- Links are ordinary anchors, so **do not add your own keyboard handling** - Tab and Enter already
  work, and a roving-focus menu would take the links out of the tab order for no gain.

Related: imp skill std/commandPalette - searching the same destinations instead of browsing them.
