# section - a band of page content with consistent vertical spacing

```js
import { section } from 'imp/std/layout'

section({ size: 'md', label: 'Pricing' }, heading({ level: 2 }, 'Pricing'), plans())
```

Call shape: `section(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. It renders a `<section>` element whose block padding comes
from the theme spacing scale, so consecutive bands of a page breathe the same way.

| Prop    | Values                 | Default | Notes                                        |
| ------- | ---------------------- | ------- | -------------------------------------------- |
| `size`  | `'sm'`, `'md'`, `'lg'` | `'md'`  | Block padding: `--imp-space-4` / `-5` / `-6` |
| `label` | string or state        | -       | `aria-label`; makes it a navigable `region`  |

**`section` also takes every prop in the shared box surface** - `padding`, `background`, `radius`,
`border`, `maxWidth`, `grow`, `hideBelow`, ... - see box (imp skill std/box). All of them, `size`
included, are responsive: pass one value or a per-breakpoint object.

Rules an agent gets wrong:

- **`size` only sets block (vertical) padding.** Inline padding is `paddingX`, and a passed
  `padding` or `paddingY` replaces `size` entirely (passing both warns).
- **A `<section>` is only a landmark once it has a name.** Without `label` it is an ordinary
  grouping element - which is fine for a visual band, but do not expect a screen reader to jump to
  it. Give it a `label` that matches the heading it contains.
- **It is not a page column.** Width capping is `container`; a section spans whatever it is given.

```js
section({ label: 'Features' }, heading({ level: 2 }, 'Features'), featureGrid())
section({ size: 'lg', background: 'sunken' }, testimonials())
section({ size: { xs: 'sm', md: 'lg' } }, callToAction())
```

Related: box (imp skill std/box), container (imp skill std/container), app (imp skill std/app)
