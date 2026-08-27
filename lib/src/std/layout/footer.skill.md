# footer - the bar across the bottom of the app frame

```js
import { footer } from 'imp/std/layout'

footer({ label: 'Page footer', justify: 'between' }, copyright(), links())
```

Call shape: `footer(props?, ...children)` - the children lay out in a row. It renders a
`contentinfo` landmark and pins itself to the bottom of `app`; as a direct child of `app` it is a
region, anywhere else it is a plain bar.

| Prop      | Values                                                              | Default    | Notes                  |
| --------- | ------------------------------------------------------------------- | ---------- | ---------------------- |
| `label`   | string or state                                                     | -          | Names the landmark     |
| `gap`     | spacing step `0`-`6`                                                | `3`        | Space between children |
| `justify` | `'start'`, `'center'`, `'end'`, `'between'`, `'around'`, `'evenly'` | `'start'`  | Along the row          |
| `align`   | `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'`           | `'center'` | Across the row         |
| `wrap`    | boolean                                                             | `false`    | Let children wrap      |
| `events`  | `{ click: handler }`                                                | -          | Listeners on the bar   |

**Every prop above takes one value that applies at every width.** When a layout must genuinely
change shape, write a media query in your own component's `styles` - the width imp splits at is the
`--imp-breakpoint-desktop` token (`48rem`), though a media query needs the literal, since CSS cannot
read a custom property inside one.

Rules an agent gets wrong:

- **`footer` here is the app region, not the `<footer>` element factory.** `imp/html` exports a
  `footer` too; importing both in one file needs an alias.
- **It stays in view.** The footer sits outside the scrolling main region, so it is always on
  screen - do not put page-length content in it.
- **It is not a mobile tab bar.** For navigation that follows the thumb, put a `navMenu` in a
  `sidebar` and let it become a drawer.

```js
footer(
  { label: t('footer.label'), justify: 'between' },
  text({ size: 'sm', tone: 'secondary' }, t('footer.copyright')),
  link({ href: '/privacy' }, t('footer.privacy')),
)
```

Related: app (imp skill std/app), navbar (imp skill std/navbar)
