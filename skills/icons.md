# icons - the Lucide set as tree-shaken exports, drawn by icon

```js
import { icon } from 'imp/std'
import { luHouse, luStar, luUser } from 'imp/icons'

icon(luUser)
icon(luUser, { size: 'lg', color: 'primary', label: 'Account' })
```

`imp/icons` exports Lucide 1.38.0 as one plain-data name per icon - 1791 of them. An icon is the
list of shapes that draws it, `[['path', { d: '...' }], ['circle', { cx: '12', ... }]]`, on a 24x24
grid stroked in the current colour; nothing renders it but `icon`.

## Naming

The export is `lu` plus the Lucide icon name in PascalCase.

| Lucide name    | Export          |
| -------------- | --------------- |
| `house`        | `luHouse`       |
| `user-round`   | `luUserRound`   |
| `chart-column` | `luChartColumn` |
| `trash-2`      | `luTrash2`      |

Search the set at <https://lucide.dev/icons>, read the icon's name off the page and prefix it. There
is one style - Lucide has no filled or outline variants, and no brand logos.

## Drawing one

`icon` comes from `imp/std`, takes the icon positionally or as the `icon` prop, and takes no
content. Full prop table: `imp skill std/icon`.

| Prop    | Values                                    | Default     |
| ------- | ----------------------------------------- | ----------- |
| `icon`  | an export from `imp/icons` - **required** | -           |
| `size`  | `'sm'`, `'md'`, `'lg'`, or any CSS length | `'md'`      |
| `color` | a theme colour name, or `'current'`       | `'current'` |
| `label` | string, or a state - **live**             | -           |

Rules an agent gets wrong:

- **Never `import * as icons from 'imp/icons'`, and never index the module.** Each name is carried
  on its own and everything unimported is dropped, but a namespace import or a computed lookup pins
  all 1791 icons into the app. There is no `icon('house')` string form for that reason.
- **The old name is not the new one.** Lucide renames icons between releases and imp ships one
  release, so `luHome` does not exist - it is `luHouse`, and the drop-down arrow is `luChevronDown`.
  An unknown export is a build error naming the import, not a runtime warning.
- **An icon imported from `imp` or another framework specifier** is an `imp/import-source` lint
  error, and `imp lint --fix` moves it to `imp/icons`.
- **A decorative icon takes no `label`.** Passing one makes it `role="img"` and announced; leave it
  off beside a text label. An icon-only control is named on the **control** (`button({ label })`),
  not on the icon inside it.
- **An icon Lucide does not draw is your own inline `<svg>`.** Every icon-taking prop in the library
  takes any DOM node, so nothing forces an icon through this module.

## Colour and size

`color` names a theme token, so the icon re-skins with the theme instead of being hardcoded:
`'primary'`, `'secondary'`, `'text'`, `'link'`, `'border'`, `'danger'`, `'success'`, `'warning'`,
`'info'`, and every palette hue (`'jade'`, `'violet'`, `'amber'`, ...) from [theming](theming.md).
The default `'current'` inherits the surrounding text colour, which is what a button or a menu row
wants. A colour outside that list is logged and ignored - to paint an icon an arbitrary colour, set
`color` on the box around it and leave the icon on `'current'`.

Every Lucide icon is square, so `size` sets both axes. The three steps are `1rem`, `1.25rem` and
`1.5rem`; any CSS length is accepted for anything else.

```js
import { flex } from 'imp/std/layout'
import { button, icon, text } from 'imp/std'
import { luCircleCheck, luTrash } from 'imp/icons'

flex(
  { verticalAlign: 'center', gap: 2 },
  icon(luCircleCheck, { color: 'success' }),
  text('Invoice paid'),
  button({ variant: 'danger', label: 'Delete invoice' }, icon(luTrash, { size: 'sm' })),
)
```

## Licensing

Lucide is ISC, and the icons it inherited from Feather are MIT; both require the copyright notice to
ship with what you redistribute. `imp build` does it for you: it writes the notice into
`LICENSES.txt` in the output directory and points every emitted script at it. Deploy that file with
the rest of `dist/`. Nothing is written when a build uses no icon - see [build](build.md).

Related: [std](std.md), [theming](theming.md), [build](build.md).
