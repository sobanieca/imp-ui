# menuButton - a button that opens a menu of actions

```js
import { button, menuButton } from 'imp/std'
import { flex } from 'imp/std/layout'

menuButton({ items: [{ id: 'draft', label: 'Save as draft', onClick: saveDraft }] })
menuButton({ trigger: 'arrow', items: exportFormats }, 'Export')
flex({ joined: true }, button({ variant: 'primary' }, 'Save'), menuButton({ items }))
```

The call shape is `menuButton(props?, ...children)`. The children are the text of the trigger. With
no children the trigger is a square icon: a triple-dot, or a chevron with `trigger: 'arrow'`.

| Prop       | Values                                                | Default     | Notes                                   |
| ---------- | ----------------------------------------------------- | ----------- | --------------------------------------- |
| `items`    | array of `{ id?, label, icon?, onClick?, disabled? }` | -           | The options of the menu                 |
| `trigger`  | `'more'`, `'arrow'`                                   | `'more'`    | Triple-dot or chevron                   |
| `variant`  | as on button                                          | `'default'` | The look of the trigger                 |
| `size`     | as on button                                          | `'md'`      | The size of the trigger                 |
| `disabled` | boolean, or a state - **live**                        | `false`     | Disables the trigger and shuts the menu |
| `label`    | string, or a state - **live**                         | -           | Replaces the name of the trigger        |
| `events`   | event map                                             | -           | Handlers on the host, such as `select`  |

Rules an agent gets wrong:

- **A menu item is data, not a child.** The menu needs `role="menuitem"` and a roving tabindex on
  each option, and those must sit in one component. So `items` is a prop. A child is the text of the
  trigger, never an option.
- **A split button is a joined row.** Write `flex({ joined: true }, button(...), menuButton(...))`.
  The action is the button. The menu button opens the menu and does nothing else. Give both the same
  `variant` and `size`. See flex (imp skill std/flex).
- **The trigger is named by its text, or by a built-in name when it has none.** A trigger with a
  child reads that child. An icon-only `'more'` reads "More actions" and `'arrow'` reads "Choose an
  action", through `t()`. Pass `label` when the row needs a more precise name, such as
  `Actions for Ada`. It replaces the name in both cases.
- **A choice fires a `select` event on the host** that you can cancel, with `detail: { id, item }`.
  imp then calls the `onClick({ id, item })` of that item. A call to `preventDefault()` on `select`
  stops the `onClick`.
- **`id` defaults to the index.** `label` is necessary. `icon` is a node.
- **The browser places the menu, not imp.** It opens under the trigger at the trailing edge, flips
  above it near the bottom of the screen, and flips to the other side near an edge. There is no
  `placement` prop.
- **The platform owns the dismissal and the layering.** A click away, or Escape, shuts the menu and
  returns the focus to the trigger. Do not add an outside-click handler.
- The arrow keys, `Home` and `End` walk the enabled options. imp skips a `disabled` option.
- imp warns about an unknown prop, about a `trigger` outside the list, and about an `items` array
  with no usable entry.

```js
flex(
  { joined: true },
  button({ variant: 'primary', events: { click: save } }, 'Save'),
  menuButton({
    variant: 'primary',
    items: [
      { id: 'draft', label: 'Save as draft', onClick: saveDraft },
      { id: 'template', label: 'Save as template', onClick: saveTemplate },
      { id: 'discard', label: 'Discard', disabled: true },
    ],
  }),
)

menuButton({ size: 'sm', label: `Actions for ${person.title}`, items: rowActions })
```

Related: button (imp skill std/button), flex (imp skill std/flex)
