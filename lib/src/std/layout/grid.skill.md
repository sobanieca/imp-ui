# grid - a CSS grid that fits as many equal columns as the width allows

```js
import { grid } from 'imp/std/layout'

grid({ minItemWidth: '18rem' }, ...cards)
```

Call shape: `grid(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. Children fill the cells in order, one cell each.

| Prop           | Values                                      | Default     | Notes                                            |
| -------------- | ------------------------------------------- | ----------- | ------------------------------------------------ |
| `columns`      | whole number `1`-`12`                       | `1`         | Equal-width columns                              |
| `minItemWidth` | CSS length, e.g. `'16rem'`                  | -           | Fits as many columns as fit; wins over `columns` |
| `gap`          | spacing step `0`-`6`                        | `3`         | Space between cells, both axes                   |
| `align`        | `'start'`, `'center'`, `'end'`, `'stretch'` | `'stretch'` | Cell content down the block axis                 |
| `justify`      | `'start'`, `'center'`, `'end'`, `'stretch'` | `'stretch'` | Cell content across the inline axis              |

**`grid` also takes every prop in the shared box surface** - `padding`, `width`, `maxWidth`,
`radius`, `shadow`, `background`, `border`, `ratio`, `grow`, `scroll`, `hideOnMobile`,
`hideOnDesktop` - see std (imp skill std).

**Every prop above is responsive.** Pass one value, or `{ mobile, desktop }`. `mobile` is under
48rem, `desktop` is 48rem and up. The two stops are fixed - a theme cannot change them, because CSS
cannot read a custom property inside a media query.

Rules an agent gets wrong:

- **`minItemWidth` needs no breakpoints at all.** `grid({ minItemWidth: '18rem' })` already reflows
  from one column on a phone to as many as fit on a desktop - reach for it before writing a
  `columns` ladder. Passing both warns and uses `minItemWidth`.
- **`columns` is a count, not a template.** `columns: 3` means three equal columns; there is no
  `'1fr 2fr'` spelling and no per-cell span - a child always fills exactly one cell. An uneven
  layout is a `flex` with a `grow` on the wide side, or two nested grids.
- **`gap` is a step on the theme spacing scale, not pixels.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
grid({ minItemWidth: '20rem', gap: 4 }, ...products)
grid({ columns: { mobile: 1, desktop: 3 }, gap: 5 }, ...cards)
grid({ columns: 2, gap: 2, align: 'center' }, label(), value())
```

Related: stack (imp skill std/stack), page (imp skill std/page)
