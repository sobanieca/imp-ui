# icon - one Lucide icon, sized and coloured from the theme

```js
import { icon } from 'imp/std'
import { luHouse, luTrash, luUser } from 'imp/icons'

icon(luHouse)
icon(luUser, { size: 'lg', color: 'primary' })
icon(luTrash, { size: 'sm', label: 'Delete invoice' })
```

The call shape is `icon(drawing)`, `icon(drawing, props)` or `icon(props)`. The component takes no
content. The icon comes from `imp/icons`, never from a string. Run 'imp skill icons' for the naming
scheme.

| Prop    | Values                                    | Default     | Notes                                               |
| ------- | ----------------------------------------- | ----------- | --------------------------------------------------- |
| `icon`  | an export from `imp/icons` - **required** | -           | Also accepted positionally; a missing one is logged |
| `size`  | `'sm'`, `'md'`, `'lg'`, or any CSS length | `'md'`      | `1rem`, `1.5rem`, `2rem` square                     |
| `color` | a colour name below, or `'current'`       | `'current'` | `'current'` inherits the surrounding text colour    |
| `label` | string, or a state - **live**             | -           | Names the icon; without it it is decorative         |

`color` names a theme token, never a CSS colour. The names are `'primary'`, `'secondary'`, `'text'`,
`'border'`, `'danger'`, `'success'`, `'warning'` and `'info'`, and every palette hue: `'gray'`,
`'brown'`, `'red'`, `'orange'`, `'amber'`, `'yellow'`, `'lime'`, `'green'`, `'teal'`, `'cyan'`,
`'sky'`, `'blue'`, `'indigo'`, `'violet'`, `'purple'` and `'pink'`.

Rules an agent gets wrong:

- **The icon is an imported name, not a string.** `icon('home')` draws nothing and logs an error.
  Import `luHouse` from `imp/icons` and pass the value. The bundler then ships that one drawing.
- **Never write `import * as icons from 'imp/icons'`.** A namespace import pins all 1791 icons into
  the app. Import each name.
- **A decorative icon takes no `label`.** Name an icon-only control on the **control** itself, with
  `button({ label })`. Do not name the icon inside it.
- **`color` is a token name.** imp logs any other CSS colour and ignores it. To use another colour,
  colour the box around the icon and leave the icon on `'current'`.
- **Every icon is a 24x24 square** stroked in the current colour. So `size` sets both axes, and a
  drawing is never squashed. Do not set `inline-size` yourself.
- **Every icon prop in the library accepts any DOM node.** So an icon that Lucide does not draw is
  your own inline `<svg>`. `icon()` is a convenience, not a requirement.

Related: imp skill icons - the export naming scheme and the whole set. imp skill std/shell - nav
rows take an `icon` per destination. imp skill theming - where the colour names come from.
