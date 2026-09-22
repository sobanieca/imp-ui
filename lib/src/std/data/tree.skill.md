# tree - a keyboard-operable tree of nested items with one selection

```js
import { luFolder } from 'imp/icons'
import { tree } from 'imp/std/data'

tree({
  label: 'Folders',
  items: [
    { id: 'src', label: 'src', icon: luFolder, children: [{ id: 'main', label: 'main.js' }] },
    { id: 'readme', label: 'README.md' },
  ],
})
```

The call shape is `tree(props)`. It takes **no children**. imp warns about a child and drops it.

| Prop       | Values                                                | Default | Notes                                      |
| ---------- | ----------------------------------------------------- | ------- | ------------------------------------------ |
| `label`    | string, or a state - **live**                         | -       | Necessary. The accessible name of the tree |
| `items`    | array of items, or a state holding one - **live**     | `[]`    | Plain data - see below                     |
| `selected` | an item `id`, or a writable state - **live**          | -       | The selected item                          |
| `expanded` | array of ids, `'all'`, or a writable state - **live** | `[]`    | The open parents. Nothing is open at first |
| `events`   | `{ select }`                                          | -       | `detail: { id, item }`, on the host        |

Each item has these keys:

| Key        | Values                   | Notes                                         |
| ---------- | ------------------------ | --------------------------------------------- |
| `id`       | string or number         | Necessary, and unique in the whole tree       |
| `label`    | string                   | Necessary. The text, and the name of the item |
| `icon`     | an icon from `imp/icons` | Optional, before the label                    |
| `children` | array of items           | Makes the item a parent that can expand       |

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **The tree is data, not composed children.** The roving focus and the ARIA roles must sit in one
  component. So every level goes into `items`.
- **An item is plain data.** Do not put a node or a function in an item.
- **`'all'` is a plain start value of `expanded`.** It opens every parent at mount. To control the
  open parents after mount, pass a writable state that holds an array of ids.
- **The tree writes both states back.** A choice writes `selected`. An expand or a collapse writes
  `expanded`. With a plain value the tree keeps the state itself.
- **`select` fires for a choice by the person only**, never for a change that the state drives. So a
  state that is bound in both directions cannot loop.
- **A click or `Enter` on a parent selects it and toggles it.** A click on the chevron only toggles
  it. To ignore the selection of a parent, check `event.detail.item.children` in `select`.
- **One item is in the tab order.** It is the selected item at mount, and then the item that had the
  focus last.
- A live update of `items` rebuilds the rows. The open parents, the selection and the focus stay
  when their ids still exist.
- The indent of a level is `--imp-tree-indent`, `1.25rem` by default. Set it on the host.
- imp warns about a missing `label`, an item with no `id` or no `label`, a duplicate `id`, and an
  `expanded` that is not an array or `'all'`.

The keyboard support is included:

| Key              | Action                                                     |
| ---------------- | ---------------------------------------------------------- |
| `Up`, `Down`     | Move through the items that show                           |
| `Right`          | Expand a closed parent, or move to its first child         |
| `Left`           | Collapse an open parent, or move to the parent of the item |
| `Home`, `End`    | Move to the first or the last item that shows              |
| `Enter`, `Space` | Select the item                                            |
| a letter         | Move to the next item that starts with it                  |

`Left` and `Right` swap under `dir="rtl"`, and the chevron mirrors.

```js
import { initState } from 'imp/state'
import { tree } from 'imp/std/data'

const current = initState(self, 'files.current', 'src/main.js')
const open = initState(self, 'files.open', ['src'])

tree({
  label: 'Project files',
  items: files,
  selected: current,
  expanded: open,
  events: { select: (event) => openFile(event.detail.id) },
})
```

Related: imp skill std/list - a flat list of records; imp skill icons - the icons for `icon`.
