# text - body text, a paragraph by default or an inline span

```js
import { text } from 'imp/std'

text('Everything below is included in your plan.')
```

Call shape: `text(props?, ...children)` - the props object, when present, must be the **first**
argument; everything after it is the content, and children may be other elements or `text` calls.

| Prop     | Values                           | Default     | Notes                                |
| -------- | -------------------------------- | ----------- | ------------------------------------ |
| `tone`   | `'default'`, `'secondary'`       | `'default'` | Full-strength or muted text          |
| `size`   | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                            |
| `weight` | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                          |
| `align`  | `'start'`, `'center'`, `'end'`   | `'start'`   | Text alignment                       |
| `inline` | boolean                          | `false`     | Render a `<span>` instead of a `<p>` |

Rules an agent gets wrong:

- **Emphasis inside a sentence is a nested `text` with `inline: true`** - a block `text` inside a
  paragraph would break the line.
- **No outer margins**, so paragraphs do not space themselves: the container lays them out.
- Unknown props warn at mount, and an out-of-range `tone`/`size`/`weight`/`align` warns and falls
  back.

```js
text({ tone: 'secondary', size: 'sm' }, 'Prices exclude VAT.')
text(
  'You have ',
  text({ inline: true, weight: 'bold' }, '3 days'),
  ' left in your trial.',
)
```
