# stack - a vertical stack of children laid out with CSS flexbox

```js
import { stack } from 'imp/std/layout'

stack({ gap: 4 }, heading('Billing'), text('Your plan renews on the 1st.'))
```

The call shape is `stack(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is a child of the stack.

| Prop              | Values                                       | Default     | Notes                                      |
| ----------------- | -------------------------------------------- | ----------- | ------------------------------------------ |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'stretch'`  | `'stretch'` | Across the stack                           |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'justify'` | `'top'`     | Along the stack; `'justify'` spreads apart |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children, from the theme     |

Rules an agent gets wrong:

- **`gap` is a step number, not a length.** Write `gap: 4`, never `gap: '1rem'`. imp warns about a
  bad value and falls back to step `3`. The scale is fluid, so one step is correct at every screen
  width.
- **`horizontalAlign` is the cross axis here.** So it sizes and places each child sideways.
  `'stretch'` makes every child as wide as the stack, and that is why it is the default.
- **`start` and `end` follow the reading direction. They are not `left` and `right`.** A stack that
  is aligned `'start'` sits on the left in English, and on the right under `dir="rtl"`. So one call
  is correct in both directions. imp warns about `'left'` or `'right'` and falls back.
- **`verticalAlign` needs spare room.** A stack is as tall as its children until a parent gives the
  host a `block-size`. Then the stack fills that height, and `verticalAlign` places the children in
  the spare room. `'justify'` only spreads them apart, with `space-between`. It does not stretch
  them.
- **Nothing else is a prop.** There is no padding, background, width or grow prop, and there is no
  `grid` component. A box that needs those is a `div` that your own component styles.
- A layout that must change shape below some width needs a media query in the `styles` of your own
  component. No prop varies with the size of the screen.

```js
stack({ gap: 5 }, heading('Settings'), form({ onSubmit: save }, textField({ field: 'name' })))
stack({ horizontalAlign: 'center', gap: 2 }, heading('Nothing here'), button('Add the first'))
stack({ gap: 0 }, ...rows.map((row) => text(row.label)))
stack({ verticalAlign: 'justify' }, navLinks(), button('Sign out'))
```

Related: imp skill std/flex - the same primitive laying its children out in a row.
