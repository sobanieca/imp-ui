# box - the plain layout box every other layout component is built from

```js
import { box } from 'imp/std/layout'

box({ padding: 4, background: 'surface', border: true, radius: 'lg', shadow: 'sm' }, content())
```

Call shape: `box(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. It renders a plain block `<div>` with no styling of its
own beyond the props below.

**This table is the shared box surface: `flex`, `grid`, `container` and `section` accept every prop
on it too**, on top of their own. Learn it once.

| Prop                      | Values                                             | Default  | Notes                                       |
| ------------------------- | -------------------------------------------------- | -------- | ------------------------------------------- |
| `padding`                 | spacing step `0`-`6`                               | `0`      | Inside space on both axes                   |
| `paddingX`                | spacing step `0`-`6`                               | -        | Inline sides only; wins over `padding`      |
| `paddingY`                | spacing step `0`-`6`                               | -        | Block sides only; wins over `padding`       |
| `width` / `height`        | CSS length, e.g. `'20rem'`, `'100%'`, `'auto'`     | `auto`   | Written as `inline-size` / `block-size`     |
| `minWidth` / `maxWidth`   | CSS length                                         | -        | `min-` / `max-inline-size`                  |
| `minHeight` / `maxHeight` | CSS length                                         | -        | `min-` / `max-block-size`                   |
| `radius`                  | `'none'`, `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` | `'none'` | Corner rounding from the theme radius scale |
| `shadow`                  | `'none'`, `'sm'`, `'md'`, `'lg'`                   | `'none'` | Theme shadow scale                          |
| `background`              | `'none'`, `'surface'`, `'sunken'`                  | `'none'` | Panel colour / page colour from the theme   |
| `border`                  | boolean                                            | `false`  | Theme border width and colour               |
| `ratio`                   | aspect ratio, e.g. `'16/9'`                        | -        | Keeps the box at that shape                 |
| `grow`                    | boolean or whole number `0`+                       | `false`  | How this box grows in its own parent        |
| `scroll`                  | boolean                                            | `false`  | Scroll its overflow instead of growing      |
| `hideBelow`               | `'sm'`, `'md'`, `'lg'`, `'xl'`                     | -        | Hidden under that width                     |
| `hideAbove`               | `'sm'`, `'md'`, `'lg'`, `'xl'`                     | -        | Hidden from that width up                   |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object - a
breakpoint applies from its width upward. Breakpoints: `xs` from 0, `sm` from 40rem, `md` from
48rem, `lg` from 64rem, `xl` from 80rem. They are fixed - a theme cannot change them, because CSS
cannot read a custom property inside a media query.

Rules an agent gets wrong:

- **Padding is a step on the theme spacing scale, not pixels.** `padding: 4` is `--imp-space-4`;
  `padding: '16px'` warns and is ignored. Sizes (`width`, `maxHeight`, ...) are the opposite: they
  are plain CSS lengths, because a page width is not spacing.
- **`radius`, `shadow` and `background` are theme steps, not colours.** There is no
  `background: '#fff'` - point a theme at the colour you want and use `'surface'` or `'sunken'`.
- **There are no margin props.** Space between siblings is the parent's `gap`; a standard component
  never pushes on the space around it.
- **Reach for `box` only when nothing more specific fits.** A row or column is `flex`, a centred
  page column is `container`, a band of page content is `section` - each is a `box` with its one
  extra prop.
- Unknown props warn at mount, and an out-of-range value warns and is ignored.

```js
box({ padding: 4, background: 'surface', border: true, radius: 'lg' }, cardBody())
box({ ratio: '16/9', background: 'sunken', radius: 'md' }, video())
box({ maxWidth: '32rem', paddingX: 4 }, article())
box({ padding: { xs: 2, md: 5 }, shadow: { xs: 'none', md: 'md' } }, panel())
```

Related: flex (imp skill std/flex), grid (imp skill std/grid), container (imp skill std/container),
section (imp skill std/section)
