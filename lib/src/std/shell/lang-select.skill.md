# langSelect - a language menu, bound to the lang state

```js
import { langSelect } from 'imp/std/shell'

langSelect()
langSelect({ languages: ['en', 'pl', 'pt-BR'] })
langSelect({
  languages: [
    { value: 'en', label: 'English' },
    { value: 'pl', label: 'Polski' },
  ],
})
```

The call shape is `langSelect(props?)`. It takes no content, and it renders one `menuButton` whose
trigger shows the current language, and whose menu lists the languages with a check mark on the
current one.

| Prop        | Values                               | Default                               | Notes                              |
| ----------- | ------------------------------------ | ------------------------------------- | ---------------------------------- |
| `languages` | array of codes or `{ value, label }` | the codes of `init({ translations })` | The offered languages, in order    |
| `label`     | string, or a state - **live**        | "Language: {language}", through `t()` | The accessible name of the trigger |
| `variant`   | as on `button`                       | `'default'`                           | The look of the trigger            |
| `size`      | `'sm'`, `'md'`, `'lg'`               | `'sm'`                                | The size of the trigger            |
| `events`    | event map                            | -                                     | Handlers, such as `select`         |

A choice calls `lang.set`. imp loads the translations of the language before the switch, so the
page never shows a half-translated state. With `init({ persist: true })`, imp stores the choice and
the next load starts in it. See i18n (imp skill i18n).

```js
// the entry point
await init({ translations, persist: true })

// the settings page, or the bar
langSelect()
```

Rules an agent gets wrong:

- **Do not keep the language in a state of your own.** The picker shows and sets the app-wide
  `lang` state. It takes no `value` and no `remember`.
- **Do not put a picker on every page only to restore the language.** `init` starts in the stored
  language before `mount`.
- **A code with no label takes its name in its own language**, through `Intl.DisplayNames`. So
  `'pl'` reads "polski", not "Polish". To override the name, pass `languages` with `label`.
- **Offer only the codes that your `init({ translations })` can load.** A code that loads nothing
  falls back to the first registered language. With no `languages` and no translations in `init`,
  the picker warns and shows no choice.
- **The control follows the `lang` state.** When something else sets the `lang` of the document,
  the check mark moves as well. A code such as `pt-BR` matches an offered `pt`.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Each language is a `menuitemradio`
  with `aria-checked`. The keys, the placement and the dismissal are the ones of every menu.
- imp logs a failed load, and the language does not change.

Related: imp skill i18n - the translations of `init` and the `lang` state; imp skill std/menuButton -
the control it renders.
