# buttonGroup - a seamless row of controls, with an optional menu of more actions

```js
import { button, buttonGroup } from 'imp/std'

buttonGroup(
  { items: [{ id: 'draft', label: 'Save as draft', onClick: saveDraft }] },
  button({ variant: 'primary', events: { click: save } }, 'Save'),
)
```

The call shape is `buttonGroup(props?, ...children)`. The **children are the visible controls**,
joined side by side with no gap. `items` adds a square trigger control at the end of the row, and
the trigger opens the items as a menu over the page. Pass children only, `items` only, or both.

| Prop       | Values                                                | Default     | Notes                                        |
| ---------- | ----------------------------------------------------- | ----------- | -------------------------------------------- |
| `items`    | array of `{ id?, label, icon?, onClick?, disabled? }` | -           | Adds the trigger and the menu                |
| `trigger`  | `'more'`, `'arrow'`                                   | `'more'`    | Triple-dot or chevron. Needs `items`         |
| `variant`  | as on button                                          | `'default'` | Applies to the trigger only                  |
| `size`     | as on button                                          | `'md'`      | Applies to the trigger and to a text segment |
| `disabled` | boolean, or a state - **live**                        | `false`     | Disables the trigger only                    |
| `label`    | string, or a state - **live**                         | -           | `aria-label` on the `role="group"`           |
| `events`   | event map                                             | -           | Handlers on the group, such as `select`      |

A child is one of two kinds:

| Child      | Renders as                                                    |
| ---------- | ------------------------------------------------------------- |
| Any node   | As it is, joined to its neighbours. `button(...)` is the norm |
| Plain text | A read-only segment, such as `'100%'` or `zoom.text(...)`     |

Rules an agent gets wrong:

- **Every child carries its own props.** A group sets no `variant`, `size` or `disabled` on a child.
  Write `button({ variant: 'primary' }, ...)` for each button that must be primary. The `variant`
  and `size` of the group style the trigger, so give them the same values as the buttons.
- **A menu item is data, not a child.** The menu needs `role="menuitem"` and a roving tabindex on
  each option, and those must sit in one component. So `items` is a prop. A child never goes into
  the menu.
- **A group has no primary.** The trigger opens the menu. Nothing else in the row does. To make a
  button open the menu on a click, give it its own `popoverTarget`. See button (imp skill
  std/button).
- **A choice fires a `select` event on the host** that you can cancel, with `detail: { id, item }`.
  imp then calls the `onClick({ id, item })` of that item. A call to `preventDefault()` on `select`
  stops the `onClick`.
- **`id` defaults to the index.** `label` is necessary. `icon` is a node.
- **The browser places the menu, not imp.** It opens under the row at the trailing edge, flips above
  it near the bottom of the screen, and flips to the other side near an edge. There is no
  `placement` prop.
- **The platform owns the dismissal and the layering.** A click away, or Escape, shuts the menu and
  returns the focus to the trigger. Do not add an outside-click handler.
- The arrow keys, `Home` and `End` walk the enabled options. imp skips a `disabled` option.
- **A joined control squares only the corners that face a neighbour**, in logical properties, so LTR
  and RTL both read correctly. Every std button and every std input reads the seam. A third-party
  component keeps its own rounded corners.
- **A text segment is read-only.** It takes the `size` of the group. For a live value pass a state
  text. The example below shows one.
- Name the group with `label` when the row is a unit of its own, such as a zoom control or a pager.

```js
buttonGroup(
  {
    variant: 'primary',
    items: [
      { id: 'draft', label: 'Save as draft', onClick: saveDraft },
      { id: 'template', label: 'Save as template', onClick: saveTemplate },
      { id: 'discard', label: 'Discard', disabled: true },
    ],
  },
  button({ variant: 'primary', events: { click: save } }, 'Save'),
)

buttonGroup({ trigger: 'arrow', items: exportFormats })

const zoom = initState(self, 'canvas.zoom', 100)

buttonGroup(
  { label: 'Zoom' },
  button({ label: 'Zoom out', square: true, events: { click: zoomOut } }, icon(luMinus)),
  zoom.text((value) => `${value}%`),
  button({ label: 'Zoom in', square: true, events: { click: zoomIn } }, icon(luPlus)),
)

buttonGroup(
  { label: 'Go to page' },
  button({ label: 'Previous page', square: true, events: { click: back } }, icon(luChevronLeft)),
  textField({ value: page, ariaLabel: 'Page number' }),
  button({ label: 'Next page', square: true, events: { click: forward } }, icon(luChevronRight)),
)
```

Related: button (imp skill std/button), link (imp skill std/link)
