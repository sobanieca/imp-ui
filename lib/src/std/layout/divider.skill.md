# divider — a rule between two sections, with an optional label

```js
import { divider } from 'imp/std/layout'

divider()
divider('or')
```

Call shape: `divider(props?, ...children)` — children, when present, are the label drawn in the
middle of the rule. A horizontal divider with no children renders a real `<hr>`.

| Prop          | Values                         | Default        | Notes                         |
| ------------- | ------------------------------ | -------------- | ----------------------------- |
| `orientation` | `'horizontal'`, `'vertical'`   | `'horizontal'` | Which way the rule runs       |
| `spacing`     | spacing step `0`–`6`           | `4`            | Space either side of the rule |
| `hideBelow`   | `'sm'`, `'md'`, `'lg'`, `'xl'` | —              | Hidden under that width       |
| `hideAbove`   | `'sm'`, `'md'`, `'lg'`, `'xl'` | —              | Hidden from that width up     |

**`spacing`, `hideBelow` and `hideAbove` are responsive**: pass one value, or a per-breakpoint
object. `orientation` is not — it picks which element is rendered, which happens once at mount.
Breakpoints: `xs` from 0, `sm` from 40rem, `md` from 48rem, `lg` from 64rem, `xl` from 80rem.

Rules an agent gets wrong:

- **A vertical divider only works inside a `row`**, where it stretches to the row's height. In a
  block parent it has nothing to stretch against.
- **A vertical divider takes no label** — content passed with `orientation: 'vertical'` is ignored
  with a warning.
- **`spacing` runs along the rule's short axis**: block margins for a horizontal rule, inline
  margins for a vertical one. There is no separate prop for each.
- **Do not use it as a spacer.** `spacing: 6` with an invisible rule is still a rule; use `spacer`.
- A label makes it `role="separator"` rather than an `<hr>`, so it is still announced as a
  separator; the label text is the app's to translate.
- Unknown props warn at mount, and an out-of-range value warns and falls back.

```js
stack(section(), divider(), section())
stack(passwordForm(), divider('or'), ssoButtons())
row({ align: 'center' }, breadcrumbs(), divider({ orientation: 'vertical' }), actions())
```
