# grid - a CSS grid whose column count changes per breakpoint

```js
import { grid } from 'imp/std/layout'

grid({ columns: { xs: 1, md: 2, lg: 3 }, gap: 4 }, ...cards)
```

Call shape: `grid(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. Children fill the cells in order, one cell each, unless
they are wrapped in `item` to span more.

| Prop           | Values                                      | Default     | Notes                                            |
| -------------- | ------------------------------------------- | ----------- | ------------------------------------------------ |
| `columns`      | whole number `1`-`12`                       | `1`         | Equal-width columns                              |
| `minItemWidth` | CSS length, e.g. `'16rem'`                  | -           | Fits as many columns as fit; wins over `columns` |
| `gap`          | spacing step `0`-`6`                        | `3`         | Space between cells, both axes                   |
| `align`        | `'start'`, `'center'`, `'end'`, `'stretch'` | `'stretch'` | Cell content down the block axis                 |
| `justify`      | `'start'`, `'center'`, `'end'`, `'stretch'` | `'stretch'` | Cell content across the inline axis              |
| `hideBelow`    | `'sm'`, `'md'`, `'lg'`, `'xl'`              | -           | Hidden under that width                          |
| `hideAbove`    | `'sm'`, `'md'`, `'lg'`, `'xl'`              | -           | Hidden from that width up                        |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object - a
breakpoint applies from its width upward. Breakpoints: `xs` from 0, `sm` from 40rem, `md` from
48rem, `lg` from 64rem, `xl` from 80rem. They are fixed - a theme cannot change them, because CSS
cannot read a custom property inside a media query.

Rules an agent gets wrong:

- **`minItemWidth` needs no breakpoints at all.** `grid({ minItemWidth: '18rem' })` already reflows
  from one column on a phone to as many as fit on a desktop - reach for it before writing a
  `columns` ladder. Passing both warns and uses `minItemWidth`.
- **`columns` is a count, not a template.** `columns: 3` means three equal columns; there is no
  `'1fr 2fr'` spelling. Uneven layouts come from `item({ span })` inside a larger count.
- **A child spans one cell.** To span more, wrap it: `grid({ columns: 12 }, item({ span: 8 }, …))`.
- **`gap` is a step on the theme spacing scale, not pixels.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
grid({ minItemWidth: '20rem', gap: 4 }, ...products)
grid(
  { columns: { xs: 1, md: 12 }, gap: 5 },
  item({ span: { md: 8 } }, article()),
  item({ span: { md: 4 } }, aside()),
)
grid({ columns: 2, gap: 2, align: 'center' }, label(), value())
```
