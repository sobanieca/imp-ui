# appLogo - the brand block at the head of a navbar or sidebar

```js
import { appLogo } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox } from 'imp/icons'

appLogo({ label: 'Acme', tagline: 'Operations', icon: icon(luBox) })
appLogo({ label: 'Acme', src: '/logo.svg' })
appLogo({ label: 'Acme', src: { light: '/logo-light.svg', dark: '/logo-dark.svg' } })
appLogo({ label: 'Acme', image: '/acme-wordmark.svg' })
```

The call shape is `appLogo(props)`. It takes no content.

| Prop      | Values                        | Default | Notes                                        |
| --------- | ----------------------------- | ------- | -------------------------------------------- |
| `label`   | string, or a state - **live** | -       | The app name, beside the mark                |
| `tagline` | string, or a state - **live** | -       | A second, muted line under the name          |
| `href`    | string, or `null`             | `'/'`   | Where the logo goes; `null` renders no link  |
| `src`     | string, or `{ light, dark }`  | -       | An image mark; wins over `icon`              |
| `alt`     | string                        | `''`    | Alt text for `src` - empty beside a `label`  |
| `icon`    | DOM, or a string              | -       | A mark drawn in the primary color            |
| `image`   | string, or `{ light, dark }`  | -       | The whole logo as one picture; no words      |
| `compact` | boolean                       | `false` | Mark only; the name stays for screen readers |
| `events`  | event map                     | -       | Handlers, as on any element                  |

Rules an agent gets wrong:

- **The logo is a link by default**, to `/`. imp routes an in-app path on a plain left-click, and
  leaves a click with a modifier key to the browser. `href: null` makes the logo a plain box. Use
  that on a page that is already the home page.
- **`src` as `{ light, dark }` follows the colour scheme of the active theme.** imp reads the scheme
  from the lightness of the `color-surface` token, see `imp skill theming`. The dark image shows
  under a dark surface, the light one otherwise. The name of the theme plays no part. One entry
  alone serves both schemes. `applyTheme` swaps the image, so no re-render is needed.
- **`image` is the whole logo, with the name drawn inside the picture.** Use it when the brand sets
  its name in a font of its own, as an SVG or a PNG. imp renders one `<img>` and no words. `label`
  becomes its `alt`, so pass it. `src`, `icon` and `tagline` are ignored beside `image`, and imp
  warns about them. The picture is `2rem` tall and keeps its ratio. Set `--imp-app-logo-block-size`
  on the page for another height. `{ light, dark }` follows the colour scheme, as `src` does.
- **`compact` hides the words visually, not from assistive technology.** So a logo with a mark only
  still has a name. Use it where the brand block has no room for words.
- **Keep `alt` empty when a `label` is present.** The name is already text beside the image. A
  repeat makes a screen reader say the name twice.
- **The component has no size prop.** The mark is `1.75rem`, and a whole `image` is `2rem` tall. For
  a larger brand block, put your own DOM in the region.

Related: imp skill std/shell - the frame this sits in, as its `logo` prop.
