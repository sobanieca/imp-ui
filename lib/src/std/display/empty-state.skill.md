# emptyState - the placeholder for a list, table or search result with nothing in it

```js
import { emptyState } from 'imp/std/display'

emptyState()
```

The call shape is `emptyState(props?, ...children)`. When a props object is present, it must be the
**first** argument. The children are the actions. imp lays them out in a centered row under the
text.

| Prop          | Values                                    | Default   | Notes                                         |
| ------------- | ----------------------------------------- | --------- | --------------------------------------------- |
| `variant`     | `'empty'`, `'noResults'`                  | `'empty'` | Which of the two situations this is           |
| `title`       | string, or a state holding one - **live** | see below | The line saying there is nothing              |
| `description` | string, or a state holding one - **live** | -         | One sentence of explanation; omitted if unset |

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **The component already has words.** With no `title`, `variant: 'empty'` reads the message key
  `imp.state.empty` and falls back to "Nothing here yet". `'noResults'` reads `imp.state.noResults`
  and falls back to "No results". Translate those keys. Do not write a fixed title.
- **A `title` that you pass is plain text.** imp does not translate it. To follow the language, pass
  `computed([lang], () => t('invoices.empty'))`.
- imp warns about an unknown prop at mount. It warns about a `variant` outside the list, and falls
  back to the default.

```js
emptyState({ variant: 'noResults' })
emptyState(
  { title: 'No invoices', description: 'Invoices appear here once you send one.' },
  button({ variant: 'primary', events: { click: newInvoice } }, 'New invoice'),
)
```
