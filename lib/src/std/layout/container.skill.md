# container - centers a page's content and caps how wide it gets

```js
import { container } from 'imp/std/layout'

container({ size: 'lg' }, stack({ gap: 5 }, header(), article()))
```

Call shape: `container(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content.

| Prop        | Values                                   | Default | Notes                              |
| ----------- | ---------------------------------------- | ------- | ---------------------------------- |
| `size`      | `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` | `'lg'`  | Cap on the content width           |
| `padding`   | spacing step `0`-`6`                     | `4`     | Breathing room on the inline edges |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`           | -       | Hidden under that width            |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`           | -       | Hidden from that width up          |

Widths come from theme tokens - `--imp-container-sm` 40rem, `-md` 48rem, `-lg` 64rem, `-xl` 80rem -
so a theme can change them. `'full'` removes the cap and keeps the padding.

**Every prop above is responsive**: pass one value, or a per-breakpoint object such as
`padding: { xs: 3, lg: 6 }`. Breakpoints: `xs` from 0, `sm` from 40rem, `md` from 48rem, `lg` from
64rem, `xl` from 80rem.

Rules an agent gets wrong:

- **`size` names a token, it is not a width.** `size: '900px'` warns and falls back to `'lg'`.
- **A container centers, it does not space its children.** Put a `stack` inside for vertical rhythm.
- **One container per page region.** Nesting containers narrows the content twice over.
- **The size names are not the breakpoint names** even though they read alike - `size: 'md'` is a
  48rem cap, not "at the md breakpoint".
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
container(article())
container({ size: 'sm' }, loginForm())
container({ size: 'full', padding: { xs: 2, md: 5 } }, dashboard())
```
