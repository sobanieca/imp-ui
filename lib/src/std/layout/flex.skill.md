# flex - a flexbox row or column whose direction and gap change per breakpoint

```js
import { flex } from 'imp/std/layout'

flex({ direction: { xs: 'column', md: 'row' }, gap: 4 }, left(), right())
```

Call shape: `flex(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content.

| Prop        | Values                                                              | Default     | Notes                                  |
| ----------- | ------------------------------------------------------------------- | ----------- | -------------------------------------- |
| `direction` | `'row'`, `'column'`, `'row-reverse'`, `'column-reverse'`            | `'row'`     | Main axis                              |
| `gap`       | spacing step `0`-`6`                                                | `3`         | Space between children                 |
| `justify`   | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`   | Along the main axis                    |
| `align`     | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'stretch'` | Across the main axis                   |
| `wrap`      | boolean                                                             | `false`     | Let children wrap                      |
| `grow`      | boolean or whole number `0`+                                        | `false`     | How this box grows in its own parent   |
| `scroll`    | boolean                                                             | `false`     | Scroll its overflow instead of growing |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | -           | Hidden under that width                |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | -           | Hidden from that width up              |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object - a
breakpoint applies from its width upward. Breakpoints: `xs` from 0, `sm` from 40rem, `md` from
48rem, `lg` from 64rem, `xl` from 80rem. They are fixed - a theme cannot change them, because CSS
cannot read a custom property inside a media query.

Rules an agent gets wrong:

- **`grow` is a prop of the child, not the parent.** To make one box take the leftover room, give
  that box `grow: true` - `flex({ gap: 3 }, flex({ grow: true }, main()), aside())`. There is no
  wrapper component for this and no `grow` on arbitrary children: only `flex` and `grid` carry it,
  so wrap anything else in a `flex`.
- **`gap` is a step on the theme spacing scale, not pixels.** `gap: 4` is `--imp-space-4`;
  `gap: '16px'` warns and falls back.
- **A row is the default**, and a column is `direction: 'column'` - one component covers both.
- **Empty space is a `justify` or a `grow`, never an empty element.**
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
flex({ justify: 'between', align: 'center' }, heading({ level: 2 }, 'Cart'), button('Checkout'))
flex({ direction: 'column', gap: 2, scroll: true }, ...messages)
flex({ wrap: true, gap: 2 }, ...tags)
```

Related: grid (imp skill std/grid), app (imp skill std/app)
