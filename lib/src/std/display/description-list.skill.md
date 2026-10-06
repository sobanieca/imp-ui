# descriptionList - the key-value block of a details page, as a real dl

```js
import { descriptionList, tag } from 'imp/std/display'

descriptionList({
  items: [
    { term: 'Customer', details: 'Acme Inc.' },
    { term: 'Status', details: tag({ color: 'green' }, 'Paid') },
    { term: 'Notes', details: notes },
  ],
})
```

The call shape is `descriptionList(props)`. You pass everything as props. The component takes **no
children**. imp warns about a child and drops it.

| Prop      | Values                       | Default        | Notes                                          |
| --------- | ---------------------------- | -------------- | ---------------------------------------------- |
| `items`   | array of `{ term, details }` | `[]`           | Required in practice - see the table below     |
| `layout`  | `'horizontal'`, `'vertical'` | `'horizontal'` | The term beside the details, or above them     |
| `columns` | `1`, `2`, `3`                | `1`            | How many pairs sit side by side, when they fit |

Each entry in `items` has these keys:

| Key       | Values                                            | Default  | Notes                 |
| --------- | ------------------------------------------------- | -------- | --------------------- |
| `term`    | string, or a state - live                         | required | The name of the value |
| `details` | text, a node, a state - live, or an array of them | empty    | The value             |

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **Pass the pairs in `items`, not as children.** imp renders a `<dl>` with one `<div>` group of
  `<dt>` and `<dd>` per item. So a screen reader announces each value with its term.
- **Pass a state as `details`, not `state.get()`.** The text then updates in place. A component as
  `details`, such as `tag` or `link`, works too.
- **In the horizontal layout all terms share one column.** The column is as wide as the longest
  term, up to 40% of the list. Do not pad a term to align the values.
- **The list adapts to its own width, not to the screen.** Below 24rem a horizontal list puts each
  term above its details. Below 40rem it uses one column. Below 60rem three columns become two. Do
  not write a media query for it. The host fills the width of its container, also in a flex row.
- **`columns` is a number, not a string.** Write `columns: 2`. imp warns about another value and
  uses `1`.
- **The list has no border, no title and no padding.** Put it in a `card` for a framed panel.
- **Missing `details` render an empty value.** To show a placeholder, pass one, such as
  `details: phone ?? '-'`.
- **This component is not a table.** It has no column headings and no rows of records.
- imp warns about an unknown prop, about a `layout` outside the list, about `items` that is not an
  array, and about an item with no `term`, which it skips.

```js
import { card, descriptionList, tag } from 'imp/std/display'
import { heading, link } from 'imp/std'

card(
  { header: heading({ level: 2 }, 'Invoice INV-2026-0142') },
  descriptionList({
    columns: 2,
    items: [
      { term: 'Customer', details: 'Acme Inc.' },
      { term: 'Status', details: tag({ color: 'green', dot: true }, 'Paid') },
      {
        term: 'Contact',
        details: link({ href: 'mailto:billing@acme.example' }, 'billing@acme.example'),
      },
      { term: 'Notes', details: notes },
    ],
  }),
)
```

Related: imp skill std/card - the frame around a list; imp skill std/tag - a status as the details.
