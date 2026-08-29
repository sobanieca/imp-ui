# tag - a small colored label for a status, a category or a count

```js
import { tag } from 'imp/std/display'

tag('Draft')
tag({ color: 'green' }, 'Shipped')
tag({ color: 'red', size: 'sm' }, 'Overdue')
```

Call shape: `tag(props?, ...children)` - the props object, when present, must be the **first**
argument. **Everything after it is the label**, so the text is a child, not a prop.

| Prop    | Values                                 | Default     | Notes                                   |
| ------- | -------------------------------------- | ----------- | --------------------------------------- |
| `color` | `'neutral'`, or any theme palette name | `'neutral'` | Tints the pill; the text stays readable |
| `size`  | `'sm'`, `'md'`, `'lg'`                 | `'md'`      | The type scale, as everywhere else      |

The 31 palette names `color` accepts, in palette order:

`gray`, `mauve`, `slate`, `sage`, `olive`, `sand`, `tomato`, `red`, `ruby`, `crimson`, `pink`,
`plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`,
`bronze`, `gold`, `brown`, `orange`, `amber`, `yellow`, `lime`, `mint`, `sky`.

Rules an agent gets wrong:

- **It imports from `imp/std/display`**, not from `imp/std`.
- **The label is a child, not a `text` prop.** `tag('Beta')`, or `tag({ color: 'blue' }, 'Beta')`. A
  state works as a child, so the word updates in place.
- **`color` is a palette name, not a CSS color.** `color: 'green'`, never `'#00884d'` and never
  `'color-green'`. An unknown name warns and falls back to `'neutral'`. To move the hue, retheme
  `color-green` rather than passing a literal.
- **The pill is a tint of the color, not the color itself**, drawn at 30% over whatever is behind it
  with the theme's own text color on top. That is what keeps every one of the 31 readable in both a
  light and a dark theme - so do not restyle it to a solid fill, which is legible for some hues and
  not others.
- **A `navMenu` item takes the same thing as plain data** - `tag: { text, color }`, no `size`; the
  row draws it small to match its own type.
- **`neutral` is the default and is not a palette name** - it tints with `color-secondary`, which is
  the muted pill a plain count wants.
- **It says nothing to a screen reader beyond its text.** A tag reading `12` announces as `12`; put
  the meaning in the text, or in the label of whatever it sits next to.
- **It is not interactive.** No click, no dismiss, no focus - a removable chip is a different
  component, and a tag inside a link or a button is part of that control, never its own.

```js
tag({ color: 'amber' }, 'Trial')
tag({ color: 'teal', size: 'sm' }, status.text())
navMenu({ items: [{ id: 'tasks', label: 'Tasks', href: '/tasks', tag: { text: 12 } }] })
```

Related: imp skill std/navMenu - nav rows take the same tag as plain data; imp skill theming - the
palette the `color` names come from.
