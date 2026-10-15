# langSelect - a language menu that calls setLang and remembers the choice

```js
import { langSelect } from 'imp/std/shell'

langSelect({ languages: ['en', 'pl', 'pt-BR'] })
langSelect({
  languages: [
    { value: 'en', label: 'English' },
    { value: 'pl', label: 'Polski' },
  ],
})
```

The call shape is `langSelect(props)`. It takes no content, and it renders one `menuButton` whose
trigger shows the current language, and whose menu lists the languages with a check mark on the
current one.

| Prop        | Values                                              | Default                               | Notes                               |
| ----------- | --------------------------------------------------- | ------------------------------------- | ----------------------------------- |
| `languages` | array of codes or `{ value, label }` - **required** | -                                     | The offered languages, in order     |
| `remember`  | boolean                                             | `true`                                | Stores the choice in `localStorage` |
| `label`     | string, or a state - **live**                       | "Language: {language}", through `t()` | The accessible name of the trigger  |
| `variant`   | as on `button`                                      | `'default'`                           | The look of the trigger             |
| `size`      | `'sm'`, `'md'`, `'lg'`                              | `'sm'`                                | The size of the trigger             |
| `events`    | event map                                           | -                                     | Handlers, such as `select`          |

Rules an agent gets wrong:

- **A code with no label takes its name in its own language**, through `Intl.DisplayNames`. So
  `'pl'` reads "polski", not "Polish". To override the name, pass `label`.
- **A choice calls `setLang`.** That call loads the translations of the language before the switch.
  So the page never shows a half-translated state. imp logs a failed load, and the language does not
  change.
- **Offer only the codes that your `init({ translations })` can load.** imp does not discover them.
  A code that loads nothing falls back to the first registered language.
- **The control follows the `lang` state.** When something else sets the `lang` of the document, the
  check mark moves as well. A code such as `pt-BR` matches an offered `pt`.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Each language is a `menuitemradio`
  with `aria-checked`. The keys, the placement and the dismissal are the ones of every menu.
- **`remember: false` keeps the choice for the session only.** On the next load, the language comes
  from the document or from the browser.

Related: imp skill i18n - t(), setLang and the translations loaders; imp skill std/menuButton - the
control it renders.
