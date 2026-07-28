# heading — a section heading, rendered as the real `h1`–`h6` element

```js
import { heading } from 'imp/std'

heading({ level: 2 }, 'Recent activity')
```

Call shape: `heading(props?, ...children)` — the props object, when present, must be the **first**
argument; everything after it is the heading text.

| Prop    | Values                         | Default     | Notes                               |
| ------- | ------------------------------ | ----------- | ----------------------------------- |
| `level` | `1`–`6` (number)               | `1`         | The heading level, and the tag used |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted              |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment                      |

Rules an agent gets wrong:

- **`level` is a number, not a string** — `heading({ level: 2 }, …)`, not `level: 'h2'`.
- **Type size follows the level**, so there is no size prop: pick the level the document outline
  needs and the scale takes care of itself.
- **No outer margins.** The layout around it owns the spacing.
- Unknown props warn at mount, and an out-of-range `level`/`tone`/`align` warns and falls back.

```js
heading('Dashboard')
heading({ level: 2, tone: 'secondary' }, 'Last 30 days')
heading({ level: 3, align: 'center' }, 'Nothing to review')
```
