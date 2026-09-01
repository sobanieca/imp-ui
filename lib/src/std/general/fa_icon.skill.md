# faIcon - one Font Awesome Free icon, sized and coloured from the theme

```js
import { faIcon } from 'imp/std'
import { fabGithub, faTrash, faUser } from 'imp/icons'

faIcon(faUser)
faIcon(fabGithub, { size: 'lg', color: 'primary' })
faIcon(faTrash, { size: 'sm', label: 'Delete invoice' })
```

Call shape: `faIcon(icon)`, `faIcon(icon, props)` or `faIcon(props)` - it takes no content. The icon
itself comes from `imp/icons`, never from a string: run 'imp skill icons' for the naming scheme.

| Prop    | Values                                    | Default     | Notes                                                    |
| ------- | ----------------------------------------- | ----------- | -------------------------------------------------------- |
| `icon`  | an export from `imp/icons` - **required** | -           | Also accepted positionally; a missing one is logged      |
| `size`  | `'sm'`, `'md'`, `'lg'`, or any CSS length | `'md'`      | `1rem`, `1.25rem`, `1.5rem`; the width follows the glyph |
| `color` | a colour name below, or `'current'`       | `'current'` | `'current'` inherits the surrounding text colour         |
| `label` | string, or a state - **live**             | -           | Names the icon; without it it is decorative              |

`color` names a theme token, never a CSS colour: `'primary'`, `'secondary'`, `'text'`, `'link'`,
`'border'`, `'danger'`, `'success'`, `'warning'`, `'info'`, and every palette hue - `'gray'`,
`'mauve'`, `'slate'`, `'sage'`, `'olive'`, `'sand'`, `'tomato'`, `'red'`, `'ruby'`, `'crimson'`,
`'pink'`, `'plum'`, `'purple'`, `'violet'`, `'iris'`, `'indigo'`, `'blue'`, `'cyan'`, `'teal'`,
`'jade'`, `'green'`, `'grass'`, `'bronze'`, `'gold'`, `'brown'`, `'orange'`, `'amber'`, `'yellow'`,
`'lime'`, `'mint'`, `'sky'`.

Rules an agent gets wrong:

- **The icon is an imported name, not a string.** `faIcon('user')` draws nothing and logs. Import
  `faUser` from `imp/icons` and pass the value, so the bundler ships that one glyph.
- **Never `import * as icons from 'imp/icons'`** - a namespace import pins all 1.5 MB of icon data
  into the app. Import each name.
- **A decorative icon takes no `label`.** An icon-only control is named on the **control**
  (`button({ label })`), not on the icon inside it.
- **`color` is a token name.** An arbitrary CSS colour is logged and ignored - colour the box around
  the icon and leave it on `'current'`.
- **`size` sets the block size only.** The inline size follows the icon's own aspect ratio, so a
  wide glyph such as `fabXTwitter` stays wide. Do not set both.
- **Brand icons are trademarks of their owners** - use one only to refer to that company or product.
- **`icon` is the other component**, with a small hand-drawn set addressed by a `name` string. The
  two do not share names or data.

Related: imp skill icons - the export naming scheme and the whole set. imp skill std/icon - the
built-in glyph set. imp skill theming - where the colour names come from.
