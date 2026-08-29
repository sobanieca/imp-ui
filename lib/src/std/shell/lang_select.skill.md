# langSelect - a language picker that calls setLang and remembers the choice

```js
import { langSelect } from 'imp/std/shell'

langSelect({ languages: ['en', 'pl', 'pt-BR'] })
langSelect({ languages: [{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' }] })
```

Call shape: `langSelect(props)` - it takes no content and renders one `<select>`.

| Prop        | Values                                              | Default       | Notes                               |
| ----------- | --------------------------------------------------- | ------------- | ----------------------------------- |
| `languages` | array of codes or `{ value, label }` - **required** | -             | The offered languages, in order     |
| `remember`  | boolean                                             | `true`        | Stores the choice in `localStorage` |
| `label`     | string, or a state - **live**                       | `t()` default | Names the control                   |
| `events`    | event map                                           | -             | Handlers, as on any element         |

Rules an agent gets wrong:

- **A code with no label is named in its own language** through `Intl.DisplayNames` - `'pl'` reads
  "polski", not "Polish". Pass `label` to override it.
- **Choosing calls `setLang`**, which loads that language's translations before the switch, so the
  page never flashes half-translated. A failed load is logged and the language stays put.
- **The offered codes must be the ones your `init({ translations })` can load.** imp does not
  discover them, and a code that loads nothing falls back to the first registered language.
- **It follows the `lang` state**: setting the document's `lang` elsewhere moves the control too. A
  code like `pt-BR` matches an offered `pt`.
- **`remember: false` makes it session-only** - the language then comes from the document or the
  browser on the next load.

Related: imp skill i18n - t(), setLang and the translations loaders.
