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
`border`, `maxWidth`, `grow`, ... - see std (imp skill std).

**Every prop above takes one value that applies at every width.** When a layout must genuinely
change shape, write a media query in your own component's `styles` - the width imp splits at is the
`--imp-breakpoint-desktop` token (`48rem`), though a media query needs the literal, since CSS cannot
read a custom property inside one.

Rules an agent gets wrong:

- **`size` only sets block (vertical) padding.** Inline padding is `paddingX`, and a passed
  `padding` or `paddingY` replaces `size` entirely (passing both warns).
- **A `<section>` is only a landmark once it has a name.** Without `label` it is an ordinary
  grouping element - which is fine for a visual band, but do not expect a screen reader to jump to
  it. Give it a `label` that matches the heading it contains.
- **It is not a page column.** Width capping is `page`; a section spans whatever it is given.

```js
section({ label: 'Features' }, heading({ level: 2 }, 'Features'), featureGrid())
section({ size: 'lg', background: 'sunken' }, testimonials())
section({ size: 'lg' }, callToAction())
```

Related: page (imp skill std/page), stack (imp skill std/stack), app (imp skill std/app)
