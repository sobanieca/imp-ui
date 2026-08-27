# stack - the one layout box: a column, a row, or a column that becomes a row

```js
import { stack } from 'imp/std/layout'

stack({ direction: 'row', gap: 4 }, filters(), results())
```

Call shape: `stack(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. Children lay out in order along the axis `direction`
names, in reading order, so a row mirrors under `dir="rtl"` on its own.

**A stack needs no props.** It is a column, its gap is `--imp-space-4` from the theme - a fluid
value that grows with the viewport - its children stretch to its full inline size, and it wraps
rather than overflowing.

| Prop        | Values                                                              | Default     | Notes                             |
| ----------- | ------------------------------------------------------------------- | ----------- | --------------------------------- |
| `direction` | `'column'`, `'row'`                                                 | `'column'`  | The axis children lay out along   |
| `gap`       | spacing step `0`-`6`                                                | `4`         | Space between children            |
| `align`     | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'stretch'` | Across the axis                   |
| `justify`   | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`   | Along the axis                    |
| `wrap`      | boolean                                                             | `true`      | Let children wrap onto more lines |

**`stack` also takes the shared box surface** - `padding`, `width`, `maxWidth`, `radius`, `shadow`,
`background`, `border`, `ratio`, `grow`, `scroll` - see std (imp skill std).

**Every prop above takes one value that applies at every width.** When a layout must genuinely
change shape, write a media query in your own component's `styles` - the width imp splits at is the
`--imp-breakpoint-desktop` token (`48rem`), though a media query needs the literal, since CSS cannot
read a custom property inside one.

Rules an agent gets wrong:

- **Reach for a media query last.** Spacing is fluid, a stack wraps, and `grid` fits as many columns
  as the width allows - most layouts need no breakpoint at all.
- **A stack plus the box surface is a card.** There is no separate card component:
  `stack({ padding: 4, background: 'surface', border: true, radius: 'lg' }, ...)` is one.
- **There is no `'row-reverse'` or `'column-reverse'`.** Reading order is the axis and it already
  mirrors in RTL; a reversed stack would fight that. Order the children instead.
- **`justify` on a column only does something once the column has a height** - give it `height`,
  `grow: true`, or a parent that stretches it.
- **`grow` belongs to the child that grows**, not to the stack. Wrap anything that is not a layout
  component in a `stack` to give it `grow: true`.
- **Space between children is `gap`, never a margin.** No std component has an outer margin.

```js
stack(...fields)
stack({ direction: 'row', justify: 'between' }, heading('Invoices'), button('New'))
stack({ padding: 4, background: 'surface', border: true, radius: 'lg' }, ...cardBody)
stack({ direction: 'row' }, stack({ direction: 'row', grow: true }, search()), button('Go'))
```

Related: page (imp skill std/page), grid (imp skill std/grid), section (imp skill std/section), app
(imp skill std/app)
