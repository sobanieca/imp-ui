# emptyState — the placeholder for a list, table or search result with nothing in it

```js
import { emptyState } from 'imp/std/display'

emptyState()
```

Call shape: `emptyState(props?, ...children)` — the props object, when present, must be the
**first** argument; children are the actions, laid out in a centered row under the text.

| Prop          | Values                                    | Default   | Notes                                         |
| ------------- | ----------------------------------------- | --------- | --------------------------------------------- |
| `variant`     | `'empty'`, `'noResults'`                  | `'empty'` | Which of the two situations this is           |
| `title`       | string, or a state holding one — **live** | see below | The line saying there is nothing              |
| `description` | string, or a state holding one — **live** | —         | One sentence of explanation; omitted if unset |

Rules an agent gets wrong:

- **It imports from `imp/std/display`**, not from `imp/std`.
- **It already has words.** With no `title`, `variant: 'empty'` reads the message key
  `imp.state.empty` (falling back to "Nothing here yet") and `'noResults'` reads
  `imp.state.noResults` ("No results") — translate those keys instead of hardcoding a title.
- **A `title` you pass is plain text**: imp does not translate it. To follow the language, pass
  `computed([lang], () => t('invoices.empty'))`.
- Unknown props warn at mount, and an out-of-range `variant` warns and falls back.

```js
emptyState({ variant: 'noResults' })
emptyState(
  { title: 'No invoices', description: 'Invoices appear here once you send one.' },
  button({ variant: 'primary', events: { click: newInvoice } }, 'New invoice'),
)
```
