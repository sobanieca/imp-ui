# table - a data table with sorting, a filter, row selection and infinite scroll

```js
import { table } from 'imp/std/data'

table({
  label: 'Invoices',
  columns: [
    { key: 'number', label: 'Number', sortable: true },
    {
      key: 'total',
      label: 'Total',
      align: 'end',
      sortable: true,
      render: (row) => money(row.total),
    },
  ],
  rows: invoices,
})
```

The call shape is `table(props)`. It takes **no children**. imp warns about a child and drops it.

| Prop         | Values                                              | Default  | Notes                                          |
| ------------ | --------------------------------------------------- | -------- | ---------------------------------------------- |
| `label`      | string, or a state - **live**                       | -        | Necessary. The caption and the name of the box |
| `columns`    | array of columns - see below                        | `[]`     | Read once at mount                             |
| `rows`       | array of objects, or a state holding one - **live** | `[]`     | Plain data. Each row needs a unique key        |
| `rowKey`     | string                                              | `'id'`   | The row property that holds the key            |
| `filter`     | string, or a state - **live**                       | `''`     | Keeps the rows where a cell includes the text  |
| `selection`  | `'none'`, `'single'`, `'multiple'`                  | `'none'` | Adds the column of radios or checkboxes        |
| `selected`   | array of row keys, or a writable state - **live**   | `[]`     | The table writes the state back                |
| `hasMore`    | boolean, or a state - **live**                      | -        | More rows exist. Necessary with `onLoadMore`   |
| `onLoadMore` | `async () => void`                                  | -        | Loads the next rows. Append them to `rows`     |
| `events`     | `{ rowSelect, sort }`                               | -        | Both fire on the host - see below              |

Each column has these keys:

| Key         | Values                         | Default   | Notes                                             |
| ----------- | ------------------------------ | --------- | ------------------------------------------------- |
| `key`       | string                         | required  | The row property. Also the id of the column       |
| `label`     | string, or a state - live      | the `key` | The header text, and the label of a stacked cell  |
| `align`     | `'start'`, `'center'`, `'end'` | `'start'` | Use `'end'` for numbers                           |
| `sortable`  | boolean                        | `false`   | Puts a real `<button>` in the header              |
| `sortValue` | `(row) => value`               | -         | The value to sort by, when it is not `row[key]`   |
| `render`    | `(row) => content`             | -         | Any content. Without it the cell shows `row[key]` |

Events:

| Event       | `detail`                 | Fires when                                 |
| ----------- | ------------------------ | ------------------------------------------ |
| `rowSelect` | `{ key, row, selected }` | The person selects or clears one row       |
| `sort`      | `{ key, direction }`     | The person clicks a header. **Cancelable** |

`direction` is `'ascending'`, `'descending'` or `'none'`. A click goes through them in that order.

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **A table row cannot skip its rendering.** Containment does not apply to a `<tr>`, so the table
  layout renders every row. The card layout on a narrow container has `content-visibility: auto` per
  row. For thousands of rows, page with `hasMore` and `onLoadMore`.
- **There is no pagination.** Paging is infinite scroll. Pass `hasMore` and `onLoadMore`, and append
  the new rows to the `rows` state. imp calls `onLoadMore` when the end of the rows comes into view.
- **`onLoadMore` needs `hasMore`.** Without it imp warns and loads nothing. Set the state to `false`
  when the last page arrives. imp never calls `onLoadMore` while a call is pending.
- **A rejected `onLoadMore` shows a retry button.** imp logs the error. Do not catch the error to
  show your own message.
- **Sorting is client-side, over the rows that are loaded.** Numbers compare as numbers. All other
  values compare as text in the active language, with digits in numeric order.
- **For server-side sorting, call `event.preventDefault()` in `sort`**, then reload `rows` in the
  order that the server gives. The header keeps its arrow and its `aria-sort`.
- **`filter` reads `row[key]` of every column, not the text that `render` draws.** A total of `1200`
  matches `'1200'`, and it does not match `'1,200.00'`. The match ignores case.
- **Pass a state as `rows`, `filter` and `selected` to change them after mount.** imp reads a plain
  value once.
- **A row is plain data.** Do not put a node or a function in a row. Build the nodes in `render`.
- **imp redraws a row only when its object changes.** Keep the objects of the loaded rows when you
  append a page: `rows.set((loaded) => [...loaded, ...page])`.
- **`selected` holds row keys, with the type that the rows use.** For `'single'` it holds one key or
  none. Read the choice from the state. Select all writes the state and fires no `rowSelect`.
- **Select all covers the rows that show**, so it follows the filter.
- **A click on a row selects it, when `selection` is on.** A click on a link, a button or an input
  in a cell does not. With `selection: 'none'` a row is not a control. To open a record, render a
  `link` or a `button` in a cell.
- **The table does not scroll by default, and the page does.** Set `--imp-table-max-block-size` on
  the host to make the table scroll in its own box. The header is sticky in that box only.
- **A narrow container turns each row into a card**, with the column label before each value. This
  is a CSS container query, so the parent must give the table its width. There is no prop for it.
- imp warns about a missing `label`, a column with no `key`, a row with no key, an unknown
  `selection` or `align`, and `selected` without a `selection`.

```js
import { initState } from 'imp/state'
import { table } from 'imp/std/data'
import { tag } from 'imp/std/display'

const rows = initState(self, 'invoices.rows', [])
const hasMore = initState(self, 'invoices.hasMore', true)
const selected = initState(self, 'invoices.selected', [])

const invoices = table({
  label: 'Invoices',
  columns: [
    { key: 'number', label: 'Number', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'status', label: 'Status', render: (row) => tag({ color: 'green' }, row.status) },
  ],
  rows,
  filter: query,
  selection: 'multiple',
  selected,
  hasMore,
  onLoadMore: async () => {
    const page = await loadInvoices({ after: rows.get().length })
    rows.set((loaded) => [...loaded, ...page.items])
    hasMore.set(page.hasMore)
  },
})
invoices.style.setProperty('--imp-table-max-block-size', '30rem')
```

Related: imp skill std/list - rich rows with the same infinite scroll; imp skill std/emptyState -
what the table shows with no rows; imp skill std/tag - a status in a cell.
