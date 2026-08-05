# item - the placement wrapper for one child of a stack, row or grid

```js
import { item, row } from 'imp/std/layout'

row(item({ grow: true }, searchField()), button('Go'))
```

Call shape: `item(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content.

A layout parent cannot reach through a component to size it, so **per-child placement lives here**:
wrap the child in `item` and put the placement props on the wrapper. `grow` applies inside `stack`
and `row`; `span`, `start` and `rowSpan` apply inside `grid`; `order` and `align` apply in both.

| Prop        | Values                                                    | Default         | Notes                                         |
| ----------- | --------------------------------------------------------- | --------------- | --------------------------------------------- |
| `grow`      | boolean, or a whole number `0` or more                    | `false`         | Share of the leftover space in a flex parent  |
| `span`      | whole number `1`-`12`, or `'full'`                        | `1`             | Grid columns covered                          |
| `start`     | column line `1`-`12`                                      | auto            | Pins the item to a column                     |
| `rowSpan`   | whole number `1`-`12`                                     | `1`             | Grid rows covered                             |
| `order`     | whole number, may be negative                             | `0`             | Reorders visually                             |
| `align`     | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'` | inherits parent | Overrides the parent's `align` for this child |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`                            | -               | Hidden under that width                       |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`                            | -               | Hidden from that width up                     |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object - a
breakpoint applies from its width upward. Breakpoints: `xs` from 0, `sm` from 40rem, `md` from
48rem, `lg` from 64rem, `xl` from 80rem.

Rules an agent gets wrong:

- **`grow: true` is the answer to "make this field fill the row."** Putting `grow` on the parent
  `row` warns as an unknown prop; it belongs on the child's wrapper.
- **Only wrap the children that need placement.** An `item` around every child is noise - plain
  children already lay out correctly.
- **`span` counts the parent grid's columns**, so it only makes sense inside `grid`, and never
  larger than the parent's `columns`.
- **`order` moves the box, not the tab order.** Keyboard and screen-reader order stay in DOM order,
  so do not use it to build a different reading sequence - reorder the calls instead.
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
row({ gap: 2 }, item({ grow: true }, textField()), button({ variant: 'primary' }, 'Search'))
grid(
  { columns: 12, gap: 4 },
  item({ span: { xs: 'full', lg: 8 } }, chart()),
  item({ span: { xs: 'full', lg: 4 } }, legend()),
)
stack(
  { direction: { xs: 'column', md: 'row' } },
  item({ order: { xs: 1, md: 0 } }, aside()),
  main(),
)
```
