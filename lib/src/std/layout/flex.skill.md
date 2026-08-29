# flex - a row of children laid out with CSS flexbox

```js
import { flex } from 'imp/std/layout'

flex({ horizontalAlign: 'right', gap: 4 }, button('Cancel'), button('Save'))
```

Call shape: `flex(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is a child of the row.

| Prop              | Values                                       | Default     | Notes                                    |
| ----------------- | -------------------------------------------- | ----------- | ---------------------------------------- |
| `horizontalAlign` | `'left'`, `'right'`, `'center'`, `'justify'` | `'left'`    | Along the row; `'justify'` spreads apart |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'stretch'` | `'stretch'` | Across the row                           |
| `wrap`            | boolean                                      | `false`     | Lets the row break onto more lines       |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children, from the theme   |

Rules an agent gets wrong:

- **`gap` is a step number, not a length** - `gap: 4`, never `gap: '1rem'`. A bad value warns and
  falls back to step `3`. The scale is fluid, so one step is correct at every screen width.
- **`horizontalAlign` moves children along the row, `verticalAlign` across it.** In a `stack` it is
  the other way round, because the axes swap - that is the only difference between the two props.
- **`left` always means left, even under `dir="rtl"`.** The row reverses its flex direction so the
  first child stays on the left and `horizontalAlign: 'left'` stays on the left; only the text
  inside each child mirrors. To mirror an arrangement for a right-to-left language, reverse the
  children yourself against `dir.get()` from `imp/i18n`.
- **`'justify'` only spreads the children apart** (`space-between`); it does not stretch them.
- **Nothing else is a prop.** There is no padding, background, width, direction or grow prop, and no
  `grid` component: a box that needs those is a `div` your own component styles.
- **Spacing lives here, not on the children.** No standard component carries an outer margin, so a
  gap is the only way to separate two of them.
- A layout that must change shape below some width is a media query you write in your own
  component's `styles` - no prop varies by screen size.

```js
flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Invoices'), button('New'))
flex({ wrap: true, gap: 2 }, ...labels.map((label) => text(label)))
flex(stack({ gap: 1 }, heading('Title'), text('Subtitle')), button('Edit'))
```

Related: imp skill std/stack - the same primitive stacking its children vertically.
