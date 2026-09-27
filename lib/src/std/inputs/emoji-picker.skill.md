# emojiPicker - an emoji input with a searchable panel

```js
import { emojiPicker } from 'imp/std/inputs'

emojiPicker({ field: 'icon', label: 'Project icon' })
```

The call shape is `emojiPicker(props?)`. It renders a button that shows the chosen emoji and its
name. The button opens a panel with a search field, category tabs, a grid of emoji and a preview
line. A click on an emoji commits it and closes the panel.

| Prop          | Values                                                | Notes                                       |
| ------------- | ----------------------------------------------------- | ------------------------------------------- |
| `field`       | dot path, e.g. `'channel.icon'`                       | Binds to that path of the surrounding form  |
| `value`       | a state, or a plain string                            | Standalone use, when there is no form       |
| `label`       | string, or a state holding one                        | Rendered as a real `<label>` for the button |
| `ariaLabel`   | string                                                | Names it when there is no visible label     |
| `help`        | string, or a state holding one                        | Hint under the control                      |
| `placeholder` | string, or a state holding one                        | Text on the button when nothing is chosen   |
| `emojis`      | array of emoji strings or `{ emoji, name, keywords }` | The set to offer. Default: the built-in set |
| `required`    | boolean                                               | Removes the clear button, validates it      |
| `disabled`    | boolean, or a state holding one - **live**            | Blocks the button                           |
| `validate`    | `(value) => message \| null`                          | `validateAsync` is the promise form         |

Rules an agent gets wrong:

- **The value is the emoji string itself**, such as `'\u{1F680}'`. The empty value is `undefined`.
  There is no id and no code point number.
- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins.
- **The built-in set has 482 emoji in eight categories.** It has no flags and no skin tones. To
  offer another emoji, pass it in `emojis`.
- **`emojis` replaces the built-in set.** The panel then shows one grid with no categories. A string
  that the built-in set knows keeps its name and its keywords. Give `name` and `keywords` to
  describe your own entries, in the language of your app.
- **The search field shows only when the set holds more than 16 emoji.** Search matches every word
  of the text against the name and the keywords. Enter in the search field picks the first match.
- **The built-in names and keywords are English.** They are data, not `imp.*` messages. A screen
  reader names each emoji in the language of the person.
- **Write an emoji in source as an escape**, `'\u{1F44D}'`, not as the glyph. The repo is ASCII.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about an unknown prop.

Keys: arrows move in the grid, Home and End go to the first and the last emoji. Arrow Up in the top
row returns to the search field. Arrow Down in the search field enters the grid. Escape closes the
panel.

```js
form(
  { initialValues: { health: undefined }, onSubmit: save },
  emojiPicker({
    field: 'health',
    label: 'Project health',
    required: true,
    emojis: [
      { emoji: '\u{1F7E2}', name: 'On track', keywords: ['good'] },
      { emoji: '\u{1F534}', name: 'Blocked', keywords: ['stop'] },
    ],
  }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/reactions - the
reaction bar that uses the same panel; imp skill i18n - how to translate the `imp.emoji.*` and
`imp.emojiPicker.*` keys.
