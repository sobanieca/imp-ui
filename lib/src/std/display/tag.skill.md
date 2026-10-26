# tag - a small colored label for a status, a category or a count, or a bare status dot

```js
import { tag } from 'imp/std/display'

tag('Draft')
tag({ color: 'green' }, 'Shipped')
tag({ color: 'red', size: 'sm' }, 'Overdue')
tag({ color: 'green', dot: true }, 'Online')
tag({ color: 'red', dot: true, label: 'Offline' })
```

The call shape is `tag(props?, ...children)`. When a props object is present, it must be the
**first** argument. **Everything after it is the label**, so the text is a child, not a prop.

| Prop    | Values                                 | Default     | Notes                                           |
| ------- | -------------------------------------- | ----------- | ----------------------------------------------- |
| `color` | `'neutral'`, or any theme palette name | `'neutral'` | Tints the pill; the text stays readable         |
| `size`  | `'sm'`, `'md'`, `'lg'`                 | `'md'`      | The height of the pill                          |
| `dot`   | boolean                                | `false`     | A filled circle in the colour, before the label |
| `label` | string, or a state - **live**          | -           | Accessible name of a dot with no text           |

`color` accepts these 16 palette names, in palette order:

`gray`, `brown`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `sky`, `blue`,
`indigo`, `violet`, `purple`, `pink`.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **The label is a child, not a `text` prop.** Write `tag('Beta')`, or
  `tag({ color: 'blue' }, 'Beta')`. A state works as a child, so the word updates in place.
- **`color` is a palette name, not a CSS colour.** Write `color: 'green'`. Never write `'#00884d'`,
  and never write `'color-green'`. imp warns about an unknown name and falls back to `'neutral'`. To
  change the hue, retheme `color-green`. Do not pass a literal colour.
- **The pill is a tint of the colour, not the colour itself.** imp draws a faint fill and a border
  in the colour, and it mixes the colour into the text colour of the theme. That is what keeps all
  16 colours readable in a light theme and in a dark theme. So do not restyle the pill to a solid
  fill. A solid fill is readable for some hues and not for others.
- **A tag stays on one line.** A label that is wider than the container ends with an ellipsis. A
  screen reader still reads the full text.
- **A count renders as a compact pill.** Each size has a fixed height, and a short label such as `4`
  is at least as wide as it is tall. The corners follow `radius-item` of the theme. Do not pad the
  text to make it wider.
- **A `shell` nav row takes the same value as plain data**, in `tag: { text, color }`, with no
  `size`. The row draws the tag small, to match its own type.
- **`dot: true` with no children is a bare status dot.** imp draws the circle only, with no pill.
  Colour alone says nothing to a screen reader, so pass `label`. The dot is then `role="img"` with
  that `aria-label`. imp warns about a bare dot with no `label`.
- **`label` is for the bare dot only.** A tag with text is named by its text. imp warns about a
  `label` on a tag with text, and ignores it.
- **A count bubble is a small tag next to the thing that it counts.** Write
  `tag({ color: 'red', size: 'sm' }, 12)` after the label. imp has no `badge` component, and no
  badge that overlaps the corner of another component.
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
flex({ gap: 1, verticalAlign: 'center' }, text('Inbox'), tag({ color: 'red', size: 'sm' }, 12))
flex(
  { gap: 2, verticalAlign: 'center' },
  tag({ color: 'green', dot: true, label: health }),
  text(host),
)
shell({ map: app, nav: { [app.tasks]: { tag: { text: 12 } } } }, router({ map: app, screens }))
```

Related: imp skill std/shell - a nav row takes the same tag through `nav`; imp skill theming - the
palette the `color` names come from.
