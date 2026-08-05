# spacer - empty space inside a stack or row, flexible or fixed

```js
import { row, spacer } from 'imp/std/layout'

row(logo(), spacer(), button('Sign in'))
```

Call shape: `spacer(props?)` - it takes no content.

With no `size` it **absorbs all the leftover space**, pushing what follows to the far end. With a
`size` it is a fixed gap of that many spacing steps.

| Prop        | Values                         | Default | Notes                                   |
| ----------- | ------------------------------ | ------- | --------------------------------------- |
| `size`      | spacing step `0`-`6`           | -       | Fixed space; omit it to absorb the rest |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'` | -       | Hidden under that width                 |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'` | -       | Hidden from that width up               |

**Both props are responsive**: `size: { xs: 2, md: 5 }` grows the gap on wider screens. Breakpoints:
`xs` from 0, `sm` from 40rem, `md` from 48rem, `lg` from 64rem, `xl` from 80rem.

Rules an agent gets wrong:

- **It only works inside a `stack` or `row`.** It sizes itself along the parent's main axis, so in a
  plain block parent it collapses to nothing.
- **It is not the way to space a list.** Use the parent's `gap`; a spacer is for pushing one group
  away from another.
- **It takes no children** - content passed to it is ignored with a warning.
- It is `aria-hidden`, so it never reaches the accessibility tree.
- Unknown props warn at mount, and an out-of-range `size` warns and falls back.

```js
row({ align: 'center' }, heading('Invoices'), spacer(), button({ variant: 'primary' }, 'New'))
stack(header(), spacer({ size: 6 }), footer())
row(back(), spacer({ hideBelow: 'md' }), next())
```
