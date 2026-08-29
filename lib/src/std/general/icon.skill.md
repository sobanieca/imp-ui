# icon - one glyph from imp's built-in set, drawn in the current text color

```js
import { icon } from 'imp/std'

icon({ name: 'home' })
icon({ name: 'trash', size: 'sm', label: 'Delete invoice' })
```

Call shape: `icon(props)` - it takes no content.

| Prop    | Values                            | Default | Notes                                        |
| ------- | --------------------------------- | ------- | -------------------------------------------- |
| `name`  | a glyph name below - **required** | -       | An unknown name is logged and draws nothing  |
| `size`  | `'sm'`, `'md'`, `'lg'`            | `'md'`  | `1rem`, `1.25rem`, `1.5rem` square           |
| `label` | string, or a state - **live**     | -       | Names the glyph; without it it is decorative |

The set, all 24x24 line glyphs stroked in `currentColor`:

| Group      | Names                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| App        | `home`, `search`, `settings`, `grid`, `chart`, `folder`, `file`, `box`, `tag` |
| People     | `user`, `users`, `bell`, `mail`, `credit-card`                                |
| Actions    | `plus`, `edit`, `trash`, `check`, `close`, `menu`, `filter`, `refresh`        |
| Movement   | `chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`, `more`         |
| Links      | `link`, `external-link`, `download`, `upload`                                 |
| Account    | `log-in`, `log-out`, `lock`, `eye`                                            |
| Appearance | `sun`, `moon`, `globe`                                                        |
| Time       | `calendar`, `clock`                                                           |
| Status     | `info`, `help`, `warning`, `star`, `heart`                                    |

Rules an agent gets wrong:

- **A decorative icon takes no `label`.** Passing one makes it `role="img"` and announced; leave it
  off beside a text label, which is the usual case. An icon-only control is named on the **control**
  (`button({ label })`), not on the icon inside it.
- **The set is deliberately small and fixed.** There is no `src`, no icon font and no sprite sheet.
  A glyph imp does not ship is your own inline `<svg>` - every prop that takes an icon in this
  library takes **any DOM node**, so `icon()` is a convenience, not a requirement.
- **It inherits the text color** and never takes a color prop. Color it by coloring the box around
  it.
- **Sizes are the three steps.** For a glyph that must track a font size, wrap it and set
  `inline-size` yourself.
- Importing `icon` costs the whole glyph table (one module of path data), so a component that needs
  one glyph internally draws it itself.

Related: imp skill std/navMenu - nav items take an `icon` per destination.
