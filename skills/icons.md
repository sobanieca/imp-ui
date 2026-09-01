# icons - the Font Awesome Free set as tree-shaken exports, drawn by faIcon

```js
import { faIcon } from 'imp/std'
import { fabGithub, farStar, faUser } from 'imp/icons'

faIcon(faUser)
faIcon(faUser, { size: 'lg', color: 'primary', label: 'Account' })
```

`imp/icons` exports Font Awesome Free 7.3.1 as one plain-data name per icon - 2163 icons plus 720 of
Font Awesome's own aliases. An icon is `[width, height, path]`; nothing renders it but `faIcon`.

## Naming

The export is the style prefix plus the Font Awesome icon name in PascalCase.

| Style   | Prefix | Font Awesome name | Export        |
| ------- | ------ | ----------------- | ------------- |
| Solid   | `fa`   | `user-group`      | `faUserGroup` |
| Regular | `far`  | `star`            | `farStar`     |
| Brands  | `fab`  | `x-twitter`       | `fabXTwitter` |

Only these three styles exist - they are the whole free set. Everything else on fontawesome.com
(Thin, Light, Duotone, Sharp) is Pro and imp does not ship it. Search the free set at
<https://fontawesome.com/search?ic=free>, then read the icon's name off the page and prefix it.

Solid is the general-purpose style and by far the largest (1422 icons); Regular is a 169-icon
outline subset of it; Brands is 572 third-party logos.

## Drawing one

`faIcon` comes from `imp/std`, takes the icon positionally or as the `icon` prop, and takes no
content. Full prop table: `imp skill std/faIcon`.

| Prop    | Values                                    | Default     |
| ------- | ----------------------------------------- | ----------- |
| `icon`  | an export from `imp/icons` - **required** | -           |
| `size`  | `'sm'`, `'md'`, `'lg'`, or any CSS length | `'md'`      |
| `color` | a theme colour name, or `'current'`       | `'current'` |
| `label` | string, or a state - **live**             | -           |

Rules an agent gets wrong:

- **Never `import * as icons from 'imp/icons'`, and never index the module.** Each name is carried
  on its own and everything unimported is dropped, but a namespace import or a computed lookup pins
  all 1.5 MB of path data into the app. There is no `faIcon('user')` string form for that reason.
- **The prefix is part of the name, not a prop.** There is no `style` or `variant` prop - `farStar`
  is the outline star and `faStar` is the filled one.
- **An unknown export is a build error, not a runtime warning.** `faRocketShip` does not exist, and
  the build fails naming the import. An icon imported from `imp` or another framework specifier is
  an `imp/import-source` lint error, and `imp lint --fix` moves it to `imp/icons`.
- **Aliases are Font Awesome's own** (`faUserAlt` is `faUser`, `fabGithubSquare` is
  `fabSquareGithub`). Either name works and costs the same.
- **A decorative icon takes no `label`.** Passing one makes it `role="img"` and announced; leave it
  off beside a text label. An icon-only control is named on the **control** (`button({ label })`),
  not on the icon inside it.
- **Brand icons are trademarks of their owners.** Use one only to refer to that company, product or
  service; imp shipping the artwork implies no endorsement in either direction.
- **`icon` is a different component** with a small hand-drawn set and a `name` string - see
  [std](std.md). `faIcon` does not read those names, and `icon` does not read these exports.

## Colour and size

`color` names a theme token, so the icon re-skins with the theme instead of being hardcoded:
`'primary'`, `'secondary'`, `'text'`, `'link'`, `'border'`, `'danger'`, `'success'`, `'warning'`,
`'info'`, and every palette hue (`'jade'`, `'violet'`, `'amber'`, ...) from [theming](theming.md).
The default `'current'` inherits the surrounding text colour, which is what a button or a menu row
wants. A colour outside that list is logged and ignored - to paint an icon an arbitrary colour, set
`color` on the box around it and leave the icon on `'current'`.

`size` sets the block size and the width follows the icon's own aspect ratio, so a wide glyph is not
squashed. The three steps are `1rem`, `1.25rem` and `1.5rem`; any CSS length is accepted for
anything else.

```js
import { flex } from 'imp/std/layout'
import { button, faIcon, text } from 'imp/std'
import { faCircleCheck, faTrash } from 'imp/icons'

flex(
  { verticalAlign: 'center', gap: 2 },
  faIcon(faCircleCheck, { color: 'success' }),
  text('Invoice paid'),
  button({ variant: 'danger', label: 'Delete invoice' }, faIcon(faTrash, { size: 'sm' })),
)
```

## Licensing

The icons are CC BY 4.0 and the attribution has to ship with your app. `imp build` does it for you:
it writes Font Awesome's notice into `LICENSES.txt` in the output directory and points every emitted
script at it. Deploy that file with the rest of `dist/`. Nothing is written when a build uses no
icon - see [build](build.md).
