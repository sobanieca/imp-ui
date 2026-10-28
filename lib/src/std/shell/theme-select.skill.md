# themeSelect - a menu of the themes of the app, bound to the theme state

```js
import { themeSelect } from 'imp/std/shell'

themeSelect()
themeSelect({ variant: 'ghost' })
```

The call shape is `themeSelect(props?)`. It takes no content, and it renders one `menuButton` whose
trigger shows the current theme, and whose menu lists the choices with a check mark on the current
one.

| Prop      | Values                        | Default                         | Notes                              |
| --------- | ----------------------------- | ------------------------------- | ---------------------------------- |
| `label`   | string, or a state - **live** | "Theme: {theme}", through `t()` | The accessible name of the trigger |
| `variant` | as on `button`                | `'default'`                     | The look of the trigger            |
| `size`    | `'sm'`, `'md'`, `'lg'`        | `'sm'`                          | The size of the trigger            |
| `events`  | event map                     | -                               | Handlers, such as `select`         |

The choices are the `themes` of `init`, in their order. Without them, the choices are System,
Light and Dark. A choice calls `theme.set`. imp applies the theme, follows the device for
`'system'`, and stores the choice when `init` has `persist`. See theming (imp skill theming).

```js
// the entry point
await init({ themes: ['system', brandLight, brandDark], theme: 'system', persist: true })

// the settings page, or the bar
themeSelect()
```

Each choice shows the `label` of its theme. A built-in theme without `label` takes its translated
name, and any other theme shows its `name`. The icon follows the choice: a monitor for `'system'`,
a sun for a light theme, a moon for a dark theme, and a palette for a theme with no `color-scheme`.

Rules an agent gets wrong:

- **List the choices in `init({ themes })`, not on the picker.** `themeSelect` takes no `themes`,
  no `value` and no `remember`.
- **Every picker shows the same state.** Two pickers, such as one in the bar and one on the settings
  page, always agree. A change of `theme` from code moves the check mark too.
- **Do not put a picker on every page only to restore the theme.** `init` applies the stored choice
  before `mount`.
- **The control is a menu, not a toggle**, because `system` is a real third choice. For a two-state
  switch, write your own control that calls `theme.set`.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Each choice is a `menuitemradio`
  with `aria-checked`. The keys, the placement and the dismissal are the ones of every menu.
- **A choice reports `select` first.** The event is cancelable, as on every menu. A cancelled choice
  does not reach `theme`.
- imp translates its own wording only, under the `imp.theme.*` keys. A `label` of a theme stays as
  you wrote it.

Related: imp skill theming - the themes of `init` and the `theme` state; imp skill std/menuButton - the
control it renders; imp skill std/shell - the frame it usually sits in.
