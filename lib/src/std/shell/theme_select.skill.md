# themeSelect - a light / dark / system picker that applies and remembers the theme

```js
import { themeSelect } from 'imp/std/shell'

themeSelect()
themeSelect({ themes: [{ value: 'brand-light', theme: brandLight }, 'imp-dark'] })
```

Call shape: `themeSelect(props?)` - it takes no content and renders one `<select>`.

| Prop       | Values                                      | Default                           | Notes                               |
| ---------- | ------------------------------------------- | --------------------------------- | ----------------------------------- |
| `themes`   | array of names or `{ value, label, theme }` | `system`, `imp-light`, `imp-dark` | The choices, in order               |
| `remember` | boolean                                     | `true`                            | Stores the choice in `localStorage` |
| `label`    | string, or a state - **live**               | `t()` default                     | Names the control                   |
| `events`   | event map                                   | -                                 | Handlers, as on any element         |

A choice is a built-in theme name, or an object: `value` is what is stored and shown as the option's
value, `label` overrides the wording, and `theme` is what reaches `applyTheme` - a name or a whole
theme object. The `system` choice follows `prefers-color-scheme` and re-applies when it changes.

Rules an agent gets wrong:

- **This component owns the applied theme.** On mount it applies the remembered choice; with none it
  applies the first choice **only if the app has applied no theme yet**, otherwise it just shows the
  theme already in force. So `applyTheme(brand)` at the entry point is not clobbered on a first
  visit - but a remembered choice does win, which is the point of remembering it.
- **A custom theme needs its object under `theme`**, not under `value`: `value` is a string, since
  it is an option value and a storage key.
- **It is a `<select>`, not a toggle**, because `system` is a real third choice. Wrap it if you want
  a two-state switch.
- **`remember: false` makes it session-only** - nothing is stored, and the app's own theme wins on
  the next load.
- Only imp's own wording (`imp.theme.*`) is translated; a `label` you pass on a choice is yours.

Related: imp skill theming - what a theme is | imp skill std/shell - the frame it usually sits in.
