# appLogo - the brand block at the top of a sidebar, rail or header

```js
import { appLogo } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox } from 'imp/icons'

appLogo({ label: 'Acme', tagline: 'Operations', icon: icon(luBox) })
appLogo({ label: 'Acme', src: '/logo.svg' })
```

Call shape: `appLogo(props)` - it takes no content.

| Prop      | Values                        | Default | Notes                                        |
| --------- | ----------------------------- | ------- | -------------------------------------------- |
| `label`   | string, or a state - **live** | -       | The app name, beside the mark                |
| `tagline` | string, or a state - **live** | -       | A second, muted line under the name          |
| `href`    | string, or `null`             | `'/'`   | Where the logo goes; `null` renders no link  |
| `src`     | string                        | -       | An image mark; wins over `icon`              |
| `alt`     | string                        | `''`    | Alt text for `src` - empty beside a `label`  |
| `icon`    | DOM, or a string              | -       | A mark drawn in the primary color            |
| `compact` | boolean                       | `false` | Mark only; the name stays for screen readers |
| `events`  | event map                     | -       | Handlers, as on any element                  |

Rules an agent gets wrong:

- **It is a link by default**, to `/`. An in-app path is routed by imp on a plain left-click and
  left to the browser on a modifier-click; `href: null` makes it a plain box for a page that is
  already home.
- **`compact` hides the words visually, not from assistive tech**, so a rail logo is still named.
  Use it for `shell`'s `rail` region.
- **`alt` stays empty when a `label` is present** - the name is already text beside the image, and
  repeating it makes a screen reader say it twice.
- **It has no size props.** The mark is `1.75rem`; a bigger brand block is your own DOM in the
  region.

Related: imp skill std/shell - the frame this sits in.
