# treeSelect - a dropdown field that picks many values from a searchable tree with tri-state boxes

```js
import { submitForm, treeSelect } from 'imp/std/inputs'
import { button } from 'imp/std'

treeSelect({ field: 'pages', label: 'Pages', items: PAGES, placeholder: 'All pages' })
treeSelect({ value: chosen, label: 'Pages', items: pagesState }) // both states, both live
```

The call shape is `treeSelect(props?)`. The tree is the `items` prop, never children. The control is
a button that shows the selection. A press opens a panel with a search input, the tree and a footer.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'filter.pages'`            | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain array                  | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | The `<label>` of the button, names the tree |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Validates that one value or more is chosen  |
| `disabled`  | boolean, or a state holding one - **live** | Blocks the button and closes the panel      |

| Prop                | Values                                      | Notes                               |
| ------------------- | ------------------------------------------- | ----------------------------------- |
| `items`             | `[{ value, label, children? }]`, or a state | **Live**. `value` is unique in tree |
| `placeholder`       | string, or a state holding one              | Shown while nothing is chosen       |
| `searchPlaceholder` | string, or a state holding one              | Shown in the empty search input     |
| `validate`          | `(value) => message or null`                | `validateAsync` is the promise form |

The value is an array of the chosen item values, in the order of the tree. The empty value is `[]`.
The button shows the placeholder, the one label, or `'{label} +{count}'` for more.

A press on a row, or Space or Enter on it, moves the row through its states:

| Row    | Before                           | After the press                              |
| ------ | -------------------------------- | -------------------------------------------- |
| parent | not chosen, or mixed             | `all`: the parent and every descendant       |
| parent | `all` (filled square)            | `self`: only the parent, descendants cleared |
| parent | `self` (check mark)              | the parent leaves, chosen descendants stay   |
| leaf   | not chosen / chosen (check mark) | chosen / not chosen                          |

`all` means the parent and every descendant are in the value. `self` means the parent is in the
value and one descendant or more is not. `mixed` (a dash) means the parent is not in the value but a
descendant is. `aria-checked` is `true` for `all`, `self` and a chosen leaf, `mixed` for `mixed`,
and `false` for the rest. A hidden description tells a screen reader `all` from `self`. For `self`,
it says `onlySelf` when no descendant is chosen, and `withSome` when some are. A press on `self`
removes only the parent. The chosen descendants stay chosen.

| Key                     | Where  | Effect                                                                          |
| ----------------------- | ------ | ------------------------------------------------------------------------------- |
| ArrowDown, Enter, Space | button | Open the panel. The focus goes to the search input                              |
| ArrowDown, Enter        | search | Move into the tree                                                              |
| ArrowUp, ArrowDown      | tree   | Move the active row. ArrowUp on the first row: search                           |
| ArrowRight / ArrowLeft  | tree   | Expand or go to the first child / collapse or go to the parent. Mirrored in RTL |
| Home, End               | tree   | First or last shown row                                                         |
| Space, Enter            | tree   | Apply the press cycle to the active row                                         |
| a letter                | tree   | Go back to the search input and type there                                      |
| Escape                  | panel  | Close the panel. The focus goes back to the button                              |
| Tab                     | panel  | Search, tree, then the footer. Out of the panel: close                          |

Rules an agent gets wrong:

- **The value is always an array.** Seed it with `[]` in `initialValues`. A choice of a parent with
  `all` puts every descendant value in the array too. Do not expand it yourself.
- **The search is a case-insensitive "contains" on the label.** It shows every match and its
  ancestors, expanded. It hides the rest. Empty text shows the full tree.
- **The press cycle of a parent has three steps.** There is no prop to turn it off. For a flat list
  of many values, use `comboBox({ multiple: true })`.
- **Parents start expanded.** There is no `expanded` prop. A filter expands the ancestors of a
  match.
- **A value that is not in `items` stays in the array.** The button shows it as it is, until `items`
  supplies a label for it.
- **`field` and `value` are alternatives.** Inside a form, use `field`. A `field` with no form
  around it is an error.
- **The panel is a popover in the top layer.** Do not wrap the control in your own popover. It opens
  below the button, and above it when there is no room.
- **imp compares the values as strings.**
- **The words are `imp.treeSelect.*` keys:** `search`, `noMatches`, `more` (`{label}` and
  `{count}`), `clear`, `selected` (`{count}`), `withChildren`, `onlySelf` and `withSome`. Translate
  those keys.

```js
form(
  { initialValues: { pages: [] }, onSubmit: applyFilter },
  treeSelect({
    field: 'pages',
    label: 'Pages',
    placeholder: 'All pages',
    items: [
      {
        value: '/users',
        label: '/users',
        children: [
          { value: '/users/{id}/details', label: '/users/{id}/details' },
          { value: '/users/invites', label: '/users/invites' },
        ],
      },
      { value: '/settings', label: '/settings' },
    ],
  }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Apply filter'),
)
```

Related: imp skill std/form - the form that `field` binds to; imp skill std/comboBox - many values
from a flat list; imp skill std/tree - a tree that shows data and picks one node; imp skill i18n -
how to translate the `imp.treeSelect.*` keys.
