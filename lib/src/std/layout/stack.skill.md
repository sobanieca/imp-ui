# stack — a flex column that spaces its children, and turns into a row when you ask

```js
import { stack } from 'imp/std/layout'

stack({ gap: 4 }, heading('Billing'), text('Your plan renews on the 1st.'))
```

Call shape: `stack(props?, ...children)` — the props object, when present, must be the **first**
argument; everything after it is content.

`stack` lays its children out in a column. `row` is the identical component defaulting to a row.

| Prop        | Values                                                              | Default     | Notes                              |
| ----------- | ------------------------------------------------------------------- | ----------- | ---------------------------------- |
| `direction` | `'column'`, `'row'`, `'column-reverse'`, `'row-reverse'`            | `'column'`  | Main axis                          |
| `gap`       | spacing step `0`–`6`                                                | `3`         | Space between children             |
| `justify`   | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`   | Along the main axis                |
| `align`     | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'stretch'` | Across the main axis               |
| `wrap`      | boolean                                                             | `false`     | Lets children wrap onto more lines |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | —           | Hidden under that width            |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | —           | Hidden from that width up          |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object — a
breakpoint applies from its width upward:

```js
stack({ direction: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 5 } }, sidebar(), main())
```

Breakpoints: `xs` from 0, `sm` from 40rem, `md` from 48rem, `lg` from 64rem, `xl` from 80rem. They
are fixed — a theme cannot change them, because CSS cannot read a custom property inside a media
query.

Rules an agent gets wrong:

- **`gap` is a step on the theme spacing scale, not pixels.** `gap: 4` means `--imp-space-4`.
  `gap: '16px'` warns and falls back to `3`.
- **A missing breakpoint inherits the one below it**, it does not reset. `{ md: 'row' }` alone is a
  row from `md` up and the component default under it.
- **Children cannot be told to grow from here.** Wrap the one that should fill the space in `item`:
  `row(item({ grow: true }, searchField()), button('Go'))`.
- **Do not add margins to the children** to space them — that is what `gap` is for.
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
stack({ gap: 5, align: 'center' }, avatar(), heading('Ada Lovelace'))
stack({ direction: { xs: 'column', lg: 'row' }, gap: 4, justify: 'between' }, filters(), results())
stack({ hideBelow: 'md' }, desktopOnlySidebar())
```
