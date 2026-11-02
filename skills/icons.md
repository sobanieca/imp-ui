# icons - the Lucide set as tree-shaken exports, drawn by icon

```js
import { icon } from 'imp/std'
import { luHouse, luStar, luUser } from 'imp/icons'

icon(luUser)
icon(luUser, { size: 'lg', color: 'primary', label: 'Account' })
```

`imp/icons` exports Lucide 1.38.0 as one plain-data name per icon. There are 1791 names. An icon is
the list of shapes that draws it, for example
`[['path', { d: '...' }], ['circle', { cx: '12', ... }]]`. The shapes sit on a 24x24 grid and take
the current colour. Only `icon` renders them.

## Naming

The export name is `lu` plus the Lucide icon name in PascalCase.

| Lucide name    | Export          |
| -------------- | --------------- |
| `house`        | `luHouse`       |
| `user-round`   | `luUserRound`   |
| `chart-column` | `luChartColumn` |
| `trash-2`      | `luTrash2`      |

Search the set at <https://lucide.dev/icons>. Read the name of the icon off the page and add the
prefix. There is one style. Lucide has no filled variant, no outline variant and no brand logo.

## How to draw one

`icon` comes from `imp/std`. It takes the icon positionally, or as the `icon` prop. It takes no
content. For the full prop table, run `imp skill std/icon`.

| Prop    | Values                                    | Default     |
| ------- | ----------------------------------------- | ----------- |
| `icon`  | an export from `imp/icons` - **required** | -           |
| `size`  | `'sm'`, `'md'`, `'lg'`, or any CSS length | `'md'`      |
| `color` | a theme colour name, or `'current'`       | `'current'` |
| `label` | string, or a state - **live**             | -           |

Rules an agent gets wrong:

- **Never write `import * as icons from 'imp/icons'`, and never index the module.** imp carries each
  name on its own and drops every name that you do not import. A namespace import or a computed
  lookup pins all 1791 icons into the app. For that reason there is no `icon('house')` string form.
  A namespace import, an `export *` re-export or a dynamic `import()` of `imp/icons` is an
  `imp/icons-by-name` lint error.
- **An old name is not the new name.** Lucide renames an icon between releases, and imp ships one
  release. So `luHome` does not exist. The name is `luHouse`, and the drop-down arrow is
  `luChevronDown`. An unknown name is an `imp/unknown-export` lint error that names the import, and
  a build error.
- **An icon imported from `imp` or another framework specifier** is an `imp/import-source` lint
  error. `imp lint --fix` moves the import to `imp/icons`.
- **A decorative icon takes no `label`.** A `label` makes the icon `role="img"`, and a screen reader
  announces it. Leave the label off beside a text label. Name an icon-only control on the
  **control** itself, with `button({ label })`. Do not name the icon inside it.
- **For an icon that Lucide does not draw, write your own inline `<svg>`.** Every icon prop in the
  library takes any DOM node. So nothing forces an icon through this module.

## Colour and size

`color` names a theme token, so the icon changes with the theme instead of holding a fixed colour.
The names are `'primary'`, `'secondary'`, `'text'`, `'border'`, `'danger'`, `'success'`, `'warning'`
and `'info'`, and every palette hue from [theming](theming.md), such as `'teal'`, `'violet'` and
`'amber'`. The default `'current'` takes the colour of the text around it, which is what a button or
a menu row needs. imp logs a colour outside that list and ignores it. To paint an icon in any other
colour, set `color` on the box around it and leave the icon on `'current'`.

Every Lucide icon is square, so `size` sets both axes. The three steps are `1rem`, `1.5rem` and
`2rem`. Lucide draws on a 24-unit grid, so `md` at the default root font size is 24px and its
strokes land on whole pixels. For any other size, pass a CSS length. The stroke width is the theme
token `icon-stroke-width`, `2` by default, in units of that grid. See [theming](theming.md).

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

Lucide uses the ISC licence. The icons that Lucide inherited from Feather use the MIT licence. Both
licences require you to ship the copyright notice with what you redistribute. `imp build` does this
for you. It writes the notice into `LICENSES.txt` in the output directory, and points every emitted
script at that file. Deploy the file with the rest of `dist/`. imp writes nothing when a build uses
no icon. See [build](build.md).

Related: [std](std.md), [theming](theming.md), [build](build.md).
