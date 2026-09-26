# themeSelect - a light / dark / system menu that applies and remembers the theme

```js
import { themeSelect } from 'imp/std/shell'

themeSelect()
themeSelect({ themes: [{ value: 'brand-light', theme: brandLight }, 'imp-dark'] })
```

The call shape is `themeSelect(props?)`. It takes no content, and it renders one `menuButton` whose
trigger shows the current theme, and whose menu lists the choices with a check mark on the current
one.

| Prop       | Values                                      | Default                           | Notes                               |
| ---------- | ------------------------------------------- | --------------------------------- | ----------------------------------- |
| `themes`   | array of names or `{ value, label, theme }` | `system`, `imp-light`, `imp-dark` | The choices, in order               |
| `remember` | boolean                                     | `true`                            | Stores the choice in `localStorage` |
| `label`    | string, or a state - **live**               | "Theme: {theme}", through `t()`   | The accessible name of the trigger  |
| `variant`  | as on `button`                              | `'default'`                       | The look of the trigger             |
| `size`     | `'sm'`, `'md'`, `'lg'`                      | `'sm'`                            | The size of the trigger             |
| `events`   | event map                                   | -                                 | Handlers, such as `select`          |

A choice is a built-in theme name, or an object. In the object, `value` is what imp stores and
reports. `label` overrides the wording. `theme` is what reaches `applyTheme`, and it is a name or a
whole theme object. The `system` choice follows `prefers-color-scheme`, and applies the theme again
when that changes. The built-in choices carry a monitor, a sun and a moon icon. Another choice
carries a palette icon.

Rules an agent gets wrong:

- **This component owns the applied theme.** On mount it applies the remembered choice. With no
  remembered choice, it applies the first choice, but **only when the app has applied no theme**.
  Otherwise it shows the theme that is already in force. So an `applyTheme(brand)` at the entry
  point survives a first visit. A remembered choice does win, and that is the purpose of remembering
  it.
- **Put the object of a custom theme under `theme`**, not under `value`. `value` is a string,
  because it is a storage key.
- **The control is a menu, not a toggle**, because `system` is a real third choice. For a two-state
  switch, write your own control around `applyTheme`.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Each choice is a `menuitemradio`
  with `aria-checked`. The keys, the placement and the dismissal are the ones of every menu.
- **`remember: false` keeps the choice for the session only.** imp stores nothing, and the theme of
  the app wins on the next load.
- imp translates its own wording only, under the `imp.theme.*` keys. A `label` that you pass on a
  choice stays as you wrote it.

Related: imp skill theming - what a theme is; imp skill std/menuButton - the control it renders; imp
skill std/shell - the frame it usually sits in.
