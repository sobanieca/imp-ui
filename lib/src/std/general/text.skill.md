# text - body text, a paragraph by default or an inline span

```js
import { text } from 'imp/std'

text('Everything below is included in your plan.')
```

The call shape is `text(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is the content. A child can be another element or another
`text` call.

| Prop     | Values                           | Default     | Notes                                |
| -------- | -------------------------------- | ----------- | ------------------------------------ |
| `tone`   | `'default'`, `'secondary'`       | `'default'` | Full-strength or muted text          |
| `size`   | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                            |
| `weight` | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                          |
| `align`  | `'start'`, `'center'`, `'end'`   | `'start'`   | Text alignment                       |
| `inline` | boolean                          | `false`     | Render a `<span>` instead of a `<p>` |

Rules an agent gets wrong:

- **Emphasis inside a sentence is a nested `text` with `inline: true`.** A block `text` inside a
  paragraph breaks the line.
- **The component has no outer margin**, so two paragraphs do not space themselves. The container
  lays them out.
- imp warns about an unknown prop at mount. It warns about a `tone`, `size`, `weight` or `align`
  outside the list, and falls back to the default.

```js
text({ tone: 'secondary', size: 'sm' }, 'Prices exclude VAT.')
text(
  'You have ',
  text({ inline: true, weight: 'bold' }, '3 days'),
  ' left in your trial.',
)
```
