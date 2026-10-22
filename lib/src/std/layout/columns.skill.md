# columns - side-by-side columns that wrap into one column when the row is narrow

```js
import { columns, stack } from 'imp/std/layout'

columns(membersCard(), remindersCard())
columns({ weights: [2, 1] }, stack({ gap: 5 }, summary(), answers()), linksCard())
columns({ minInlineSize: '24rem', gap: 4 }, left, right)
```

The call shape is `columns(props?, ...children)`. **Each child is one column.** Put several blocks
in one column with a `stack`.

| Prop            | Values                        | Default   | Notes                                           |
| --------------- | ----------------------------- | --------- | ----------------------------------------------- |
| `weights`       | one positive number per child | all `1`   | `[2, 1]` makes the first column twice as wide   |
| `minInlineSize` | CSS length, such as `'20rem'` | `'18rem'` | The smallest width of a column of weight `1`    |
| `gap`           | spacing step `0`-`6`          | `5`       | Space between the columns, and between the rows |
| `verticalAlign` | `'top'`, `'stretch'`          | `'top'`   | `'stretch'` makes every column as tall as a row |

Rules an agent gets wrong:

- **Do not write a media query for a two-column page.** The columns sit side by side while each one
  gets its `minInlineSize` times its weight. Below that, they wrap, and each column takes the whole
  row.
- **A column of weight `2` has a minimum of twice `minInlineSize`.** So `weights: [2, 1]` with the
  default wraps below about 54rem plus the gap.
- **`weights` needs one number per child.** A list of another length warns, and imp uses equal
  columns.
- **This is not a grid.** The rows do not align across columns. A dense two-dimensional layout is CSS
  grid in your own component.
- imp warns about an unknown prop and about a value outside a list.

```js
import { columns, stack } from 'imp/std/layout'

columns(
  { weights: [1.6, 1] },
  stack({ gap: 5 }, summaryCard(), answersCard()),
  stack({ gap: 5 }, linksCard(), remindersCard()),
)
```

Related: imp skill std/stack - the column inside each column; imp skill std/flex - a row that does
not wrap into columns.
