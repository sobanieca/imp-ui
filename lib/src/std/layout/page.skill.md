# page - the content column: theme padding and a readable measure, with no props

```js
import { page } from 'imp/std/layout'

page(heading({ level: 1 }, 'Invoices'), invoiceList())
```

Call shape: `page(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. It renders a block `<div>` with `margin-inline: auto`.

**A page needs no props.** Its padding comes from the theme's `--imp-space-page`, which is a fluid
value that grows with the viewport, and it caps itself at `--imp-content-lg` and centres what is
left. That is the correct result on every screen without you configuring anything.

| Prop   | Values                                   | Default | Notes                                  |
| ------ | ---------------------------------------- | ------- | -------------------------------------- |
| `size` | `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` | `'lg'`  | Max width from the theme content scale |

`sm` is `--imp-content-sm` (40rem), then `md` 48rem, `lg` 64rem, `xl` 80rem, and `full` removes the
cap - all themeable.

**`page` also takes the shared box surface** - `padding`, `background`, `radius`, `border`,
`shadow`, `grow`, `hideOnMobile`, ... - see std (imp skill std).

Rules an agent gets wrong:

- **Do not pass `padding`.** The theme already sizes the page gutter for every viewport; passing a
  step replaces a fluid value with a fixed one and is almost always a mistake.
- **`size` and `maxWidth` are alternatives.** `maxWidth` is a raw CSS length and wins when both are
  given (with a warning); `size` is the themed spelling and is what you normally want.
- **`app` already caps and pads its main region.** Inside an `app`, reach for `page` only when you
  want a narrower column than the frame's.
- **It is one column, not a layout.** Arranging what is inside it is `stack` or `grid`.

```js
page(heading({ level: 1 }, 'Invoices'), invoiceList())
page({ size: 'sm' }, article())
page({ size: 'full' }, dashboard())
page({ size: 'md', background: 'surface', border: true, radius: 'lg' }, signUpForm())
```

Related: stack (imp skill std/stack), grid (imp skill std/grid), app (imp skill std/app)
