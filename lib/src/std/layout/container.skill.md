# container - caps content at a readable width and centres it

```js
import { container } from 'imp/std/layout'

container({ size: 'md', paddingX: 4 }, article())
```

Call shape: `container(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is content. It renders a block `<div>` with `margin-inline: auto`, so
it centres itself in whatever it sits in.

| Prop   | Values                         | Default | Notes                                  |
| ------ | ------------------------------ | ------- | -------------------------------------- |
| `size` | `'sm'`, `'md'`, `'lg'`, `'xl'` | `'lg'`  | Max width from the theme content scale |

`sm` is `--imp-content-sm` (40rem), then `md` 48rem, `lg` 64rem, `xl` 80rem - all themeable.

**`container` also takes every prop in the shared box surface** - `padding`, `paddingX`, `radius`,
`background`, `border`, `shadow`, `grow`, `hideBelow`, ... - see box (imp skill std/box). All of
them, `size` included, are responsive: pass one value or a per-breakpoint object.

Rules an agent gets wrong:

- **`size` and `maxWidth` are alternatives.** `maxWidth` is a raw CSS length and wins when both are
  given (with a warning); `size` is the themed spelling and is what you normally want.
- **A container has no padding of its own.** Text sitting flush against a phone's screen edge is the
  missing `paddingX`, not a container bug.
- **`app` already caps its main region** through its own `maxWidth` prop - do not wrap the page in a
  second container inside an `app` unless you want a narrower column than the frame's.

```js
container(pageContent())
container({ size: 'sm' }, loginForm())
container({ size: { xs: 'sm', lg: 'xl' }, paddingX: { xs: 3, md: 5 } }, dashboard())
```

Related: box (imp skill std/box), section (imp skill std/section), app (imp skill std/app)
