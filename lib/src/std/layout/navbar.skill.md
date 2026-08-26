# navbar - the bar across the top of the app frame

```js
import { navbar } from 'imp/std/layout'

navbar({ label: 'Top bar', justify: 'between' }, brand(), searchField(), userMenu())
```

Call shape: `navbar(props?, ...children)` - the children lay out in a row. It renders a `banner`
landmark and pins itself to the top of `app`; as a direct child of `app` it is a region, anywhere
else it is a plain bar.

| Prop            | Values                                                              | Default    | Notes                  |
| --------------- | ------------------------------------------------------------------- | ---------- | ---------------------- |
| `label`         | string or state                                                     | -          | Names the landmark     |
| `gap`           | spacing step `0`-`6`                                                | `3`        | Space between children |
| `justify`       | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`  | Along the row          |
| `align`         | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'center'` | Across the row         |
| `wrap`          | boolean                                                             | `false`    | Let children wrap      |
| `hideOnMobile`  | boolean                                                             | `false`    | Hidden under 48rem     |
| `hideOnDesktop` | boolean                                                             | `false`    | Hidden from 48rem up   |
| `events`        | `{ click: handler }`                                                | -          | Listeners on the bar   |

**Every layout prop above is responsive** - one value, or `{ mobile, desktop }` like
`{ mobile: 'start', desktop: 'between' }`.

Rules an agent gets wrong:

- **It does not open the sidebars.** Each sidebar carries its own toggle, so do not put a menu
  button here and wire it up by hand - `aria-controls` cannot cross a component boundary anyway.
- **Give it a `label` when the page has more than one bar**, so the landmarks are told apart.
- **It does not scroll.** Too many children on a phone need `wrap: true`, or a `hideOnMobile` on the
  ones that can go.
- Content goes in as children; there are no `start`/`end` slot props. Use `justify: 'between'`, or a
  `flex({ grow: true })` child to push the rest along.

```js
navbar(
  { label: t('nav.top'), justify: 'between', wrap: { mobile: true, desktop: false } },
  heading({ level: 1 }, 'Acme'),
  flex({ grow: true }, searchField({ ariaLabel: t('nav.search') })),
  button({ variant: 'ghost' }, t('nav.signOut')),
)
```

Related: app (imp skill std/app), sidebar (imp skill std/sidebar), footer (imp skill std/footer)
