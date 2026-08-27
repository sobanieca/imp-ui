# column - a vertical stack of children laid out with CSS flexbox

```js
import { column } from 'imp/std/layout'

column({ gap: 4 }, heading('Billing'), text('Your plan renews on the 1st.'))
```

Call shape: `column(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is a child of the stack.

| Prop              | Values                                       | Default     | Notes                                  |
| ----------------- | -------------------------------------------- | ----------- | -------------------------------------- |
| `horizontalAlign` | `'left'`, `'right'`, `'center'`, `'stretch'` | `'stretch'` | Across the stack                       |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children, from the theme |

Rules an agent gets wrong:

- **`gap` is a step number, not a length** - `gap: 4`, never `gap: '1rem'`. A bad value warns and
  falls back to step `3`. The scale is fluid, so one step is correct at every screen width.
- **`horizontalAlign` is the cross axis here**, so it sizes and places each child sideways;
  `'stretch'` makes every child as wide as the stack, which is why it is the default.
- **`left` always means left, even under `dir="rtl"`.** The alignment is physical, so a column
  aligned `left` stays on the left whichever way the document reads; only the text inside each child
  mirrors.
- **There is no `verticalAlign`.** A stack is as tall as its children; use `flex` when you need to
  place things along an axis that has spare room.
- **Nothing else is a prop.** There is no padding, background, width or grow prop, and no `grid`
  component: a box that needs those is a `div` your own component styles.
- A layout that must change shape below some width is a media query you write in your own
  component's `styles` - no prop varies by screen size.

```js
column({ gap: 5 }, heading('Settings'), form({ onSubmit: save }, textField({ field: 'name' })))
column({ horizontalAlign: 'center', gap: 2 }, heading('Nothing here'), button('Add the first'))
column({ gap: 0 }, ...rows.map((row) => text(row.label)))
```

Related: imp skill std/flex - the same primitive laying its children out in a row.
