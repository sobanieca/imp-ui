# tag - a small colored label for a status, a category or a count

```js
import { tag } from 'imp/std/display'

tag('Draft')
tag({ color: 'green' }, 'Shipped')
tag({ color: 'red', size: 'sm' }, 'Overdue')
```

The call shape is `tag(props?, ...children)`. When a props object is present, it must be the
**first** argument. **Everything after it is the label**, so the text is a child, not a prop.

| Prop    | Values                                 | Default     | Notes                                   |
| ------- | -------------------------------------- | ----------- | --------------------------------------- |
| `color` | `'neutral'`, or any theme palette name | `'neutral'` | Tints the pill; the text stays readable |
| `size`  | `'sm'`, `'md'`, `'lg'`                 | `'md'`      | The type scale, as everywhere else      |

`color` accepts these 31 palette names, in palette order:

`gray`, `mauve`, `slate`, `sage`, `olive`, `sand`, `tomato`, `red`, `ruby`, `crimson`, `pink`,
`plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`,
`bronze`, `gold`, `brown`, `orange`, `amber`, `yellow`, `lime`, `mint`, `sky`.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **The label is a child, not a `text` prop.** Write `tag('Beta')`, or
  `tag({ color: 'blue' }, 'Beta')`. A state works as a child, so the word updates in place.
- **`color` is a palette name, not a CSS colour.** Write `color: 'green'`. Never write `'#00884d'`,
  and never write `'color-green'`. imp warns about an unknown name and falls back to `'neutral'`. To
  change the hue, retheme `color-green`. Do not pass a literal colour.
- **The pill is a tint of the colour, not the colour itself.** imp draws it at 30% over whatever is
  behind it, with the text colour of the theme on top. That is what keeps all 31 colours readable in
  a light theme and in a dark theme. So do not restyle the pill to a solid fill. A solid fill is
  readable for some hues and not for others.
- **A `shell` nav row takes the same value as plain data**, in `tag: { text, color }`, with no
  `size`. The row draws the tag small, to match its own type.
- **`neutral` is the default, and it is not a palette name.** It tints with `color-secondary`, which
  is the muted pill that a plain count needs.
- **The tag says nothing to a screen reader beyond its text.** A tag that reads `12` announces as
  `12`. Put the meaning in the text, or in the label of whatever the tag sits next to.
- **The tag is not interactive.** There is no click, no dismiss and no focus. A chip that a person
  can remove is a different component. A tag inside a link or a button is part of that control,
  never a control of its own.

```js
tag({ color: 'amber' }, 'Trial')
tag({ color: 'teal', size: 'sm' }, status.text())
shell({ sidebar: { items: [{ id: 'tasks', label: 'Tasks', href: '/tasks', tag: { text: 12 } }] } })
```

Related: imp skill std/shell - nav rows take the same tag as plain data; imp skill theming - the
palette the `color` names come from.
