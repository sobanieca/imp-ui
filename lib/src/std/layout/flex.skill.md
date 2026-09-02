# flex - a row of children laid out with CSS flexbox

```js
import { flex } from 'imp/std/layout'

flex({ horizontalAlign: 'end', gap: 4 }, button('Cancel'), button('Save'))
```

The call shape is `flex(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is a child of the row.

| Prop              | Values                                       | Default     | Notes                                    |
| ----------------- | -------------------------------------------- | ----------- | ---------------------------------------- |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'justify'`  | `'start'`   | Along the row; `'justify'` spreads apart |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'stretch'` | `'stretch'` | Across the row                           |
| `wrap`            | boolean                                      | `false`     | Lets the row break onto more lines       |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children, from the theme   |

Rules an agent gets wrong:

- **`gap` is a step number, not a length.** Write `gap: 4`, never `gap: '1rem'`. imp warns about a
  bad value and falls back to step `3`. The scale is fluid, so one step is correct at every screen
  width.
- **`horizontalAlign` moves the children along the row. `verticalAlign` moves them across it.** In a
  `stack` the two are the other way round, because the axes swap. That is the only difference
  between the two props.
- **`start` and `end` follow the reading direction. They are not `left` and `right`.** Under
  `dir="rtl"` the row lays its children out from the right, and `horizontalAlign: 'start'` is the
  right edge. So a toolbar that you write once is correct in both directions. imp warns about
  `'left'` or `'right'` and falls back. `verticalAlign` keeps `top` and `bottom`, because direction
  never mirrors the vertical axis.
- **`'justify'` only spreads the children apart**, with `space-between`. It does not stretch them.
- **Nothing else is a prop.** There is no padding, background, width, direction or grow prop, and
  there is no `grid` component. A box that needs those is a `div` that your own component styles.
- **The spacing lives here, not on the children.** No standard component has an outer margin. So a
  gap is the only way to separate two of them.
- A layout that must change shape below some width needs a media query in the `styles` of your own
  component. No prop varies with the size of the screen.

```js
flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Invoices'), button('New'))
flex({ wrap: true, gap: 2 }, ...labels.map((label) => text(label)))
flex(stack({ gap: 1 }, heading('Title'), text('Subtitle')), button('Edit'))
```

Related: imp skill std/stack - the same primitive stacking its children vertically.
