# heading - a section heading, rendered as the real `h1`-`h6` element

```js
import { heading } from 'imp/std'

heading({ level: 2 }, 'Recent activity')
```

The call shape is `heading(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is the heading text.

| Prop    | Values                         | Default     | Notes                               |
| ------- | ------------------------------ | ----------- | ----------------------------------- |
| `level` | `1`-`6` (number)               | `1`         | The heading level, and the tag used |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted              |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment                      |

Rules an agent gets wrong:

- **`level` is a number, not a string.** Write `heading({ level: 2 }, ...)`, not `level: 'h2'`.
- **The type size follows the level**, so there is no size prop. Select the level that the document
  outline needs. The scale then follows.
- **The heading has no outer margin.** The layout around it owns the spacing.
- imp warns about an unknown prop at mount. It warns about a `level`, `tone` or `align` outside the
  list, and falls back to the default.

```js
heading('Dashboard')
heading({ level: 2, tone: 'secondary' }, 'Last 30 days')
heading({ level: 3, align: 'center' }, 'Nothing to review')
```
