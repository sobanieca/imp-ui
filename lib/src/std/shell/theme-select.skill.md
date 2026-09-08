# themeSelect - a light / dark / system picker that applies and remembers the theme

```js
import { themeSelect } from 'imp/std/shell'

themeSelect()
themeSelect({ themes: [{ value: 'brand-light', theme: brandLight }, 'imp-dark'] })
```

The call shape is `themeSelect(props?)`. It takes no content, and it renders one `<select>`.

| Prop       | Values                                      | Default                           | Notes                               |
| ---------- | ------------------------------------------- | --------------------------------- | ----------------------------------- |
| `themes`   | array of names or `{ value, label, theme }` | `system`, `imp-light`, `imp-dark` | The choices, in order               |
| `remember` | boolean                                     | `true`                            | Stores the choice in `localStorage` |
| `label`    | string, or a state - **live**               | `t()` default                     | Names the control                   |
| `events`   | event map                                   | -                                 | Handlers, as on any element         |

A choice is a built-in theme name, or an object. In the object, `value` is what imp stores and shows
as the value of the option. `label` overrides the wording. `theme` is what reaches `applyTheme`, and
it is a name or a whole theme object. The `system` choice follows `prefers-color-scheme`, and
applies the theme again when that changes.

Rules an agent gets wrong:

- **This component owns the applied theme.** On mount it applies the remembered choice. With no
  remembered choice, it applies the first choice, but **only when the app has applied no theme**.
  Otherwise it shows the theme that is already in force. So an `applyTheme(brand)` at the entry
  point survives a first visit. A remembered choice does win, and that is the purpose of remembering
  it.
- **Put the object of a custom theme under `theme`**, not under `value`. `value` is a string,
  because it is an option value and a storage key.
- **The control is a `<select>`, not a toggle**, because `system` is a real third choice. For a
  two-state switch, write your own control around it.
- **`remember: false` keeps the choice for the session only.** imp stores nothing, and the theme of
  the app wins on the next load.
- imp translates its own wording only, under the `imp.theme.*` keys. A `label` that you pass on a
  choice stays as you wrote it.

Related: imp skill theming - what a theme is | imp skill std/shell - the frame it usually sits in.
