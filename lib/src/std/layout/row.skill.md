# row — a flex row that spaces its children, and stacks into a column when you ask

```js
import { row } from 'imp/std/layout'

row({ gap: 3, align: 'center' }, avatar(), text('Ada Lovelace'), spacer(), button('Edit'))
```

Call shape: `row(props?, ...children)` — the props object, when present, must be the **first**
argument; everything after it is content.

`row` is `stack` with `direction` defaulting to `'row'`. Same props, same behaviour.

| Prop        | Values                                                              | Default     | Notes                              |
| ----------- | ------------------------------------------------------------------- | ----------- | ---------------------------------- |
| `direction` | `'row'`, `'column'`, `'row-reverse'`, `'column-reverse'`            | `'row'`     | Main axis                          |
| `gap`       | spacing step `0`–`6`                                                | `3`         | Space between children             |
| `justify`   | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`   | Along the main axis                |
| `align`     | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'stretch'` | Across the main axis               |
| `wrap`      | boolean                                                             | `false`     | Lets children wrap onto more lines |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | —           | Hidden under that width            |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`                                      | —           | Hidden from that width up          |

**Every prop above is responsive.** Pass one value for all sizes, or a per-breakpoint object — a
breakpoint applies from its width upward:

```js
row({ direction: { xs: 'column', md: 'row' }, wrap: { xs: false, md: true } }, ...cards)
```

Breakpoints: `xs` from 0, `sm` from 40rem, `md` from 48rem, `lg` from 64rem, `xl` from 80rem. They
are fixed — a theme cannot change them, because CSS cannot read a custom property inside a media
query.

Rules an agent gets wrong:

- **A row does not wrap by default.** Long toolbars overflow unless you pass `wrap: true`.
- **`gap` is a step on the theme spacing scale, not pixels** — `gap: 3` means `--imp-space-3`.
- **Push things apart with `spacer()` or `justify: 'between'`**, not with margins.
- **Children cannot be told to grow from here.** Wrap the one that should fill the space in `item`.
- **For a row that becomes a column on phones, set `direction`**, do not render two trees.
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
row({ gap: 2 }, button('Cancel'), button({ variant: 'primary' }, 'Save'))
row({ justify: 'between', align: 'center' }, heading('Invoices'), button('New'))
row({ direction: { xs: 'column', sm: 'row' }, gap: 4 }, item({ grow: true }, field()), button('Go'))
```
