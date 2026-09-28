# imports - every bare specifier imp resolves

imp resolves these specifiers itself. In development it uses the import map that `imp start`
injects. In production `imp build` resolves them. There is nothing to install and nothing to
configure. Never import imp by a relative path, by a URL, or with a version.

| Specifier            | Exports                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `imp`                | `component`, `mount`, `init`, `env`, `flag`, `appMap`                                       |
| `imp/html`           | `el`, `html`, ~80 tag factories (`div`, `span`, `button`, `input`...)                       |
| `imp/state`          | `initState`, `useState`, `computed`                                                         |
| `imp/router`         | `router`, `area`, `redirect`, `guard`, `wait`, `navigate`, `beforeLeave`, `useRoute`, `url` |
| `imp/http`           | `initHttpClient`, `useHttpClient`, `createHttpClient`, `HttpError`                          |
| `imp/theme`          | `theme`, `applyTheme`, `colorSchemeOf`                                                      |
| `imp/i18n`           | `t`, `lang`, `dir`, `setLang`, `missingMessages`, `defaultMessages`                         |
| `imp/log`            | `logger`, `createLogger`, `setLogLevel`, `logLevel`                                         |
| `imp/icons`          | `luHouse`, `luUser`, `luStar`, ... - the Lucide icon set                                    |
| `imp/service-worker` | `startDevMode`, `precacheBuild`, called from a service worker of your own                   |
| `imp/analytics`      | `onAnalytics`, `batch`, `zone`, `track`                                                     |
| `imp/std`            | `button`, `menuButton`, `heading`, `text`, `link`, `icon`                                   |
| `imp/std/layout`     | `flex`, `stack`, `tabs`, `dialog`, `drawer`                                                 |
| `imp/std/inputs`     | `form`, `textField`, `select`, `datePicker`, `comboBox`, `segmented`, ...                   |
| `imp/std/display`    | `card`, `avatar`, `accordion`, `descriptionList`, `tag`, `steps`, ...                       |
| `imp/std/shell`      | `shell`, `appLogo`, `breadcrumbs`, `userCard`, `orgSelect`, `themeSelect`, ...              |
| `imp/std/feedback`   | `loader`, `progress`, `notice`, `skeleton`, `toast`, `notify`, `dismiss`, ...               |
| `imp/std/data`       | `table`, `list`, `tree`, `chart`, `gantt`, `calendar`, `map`                                |
| `imp/test`           | `test`, `expect`, `spy`, `mockModule`, `beforeAll`/`beforeEach`/...                         |
| `imp/preview`        | `mockModule` (for `*.preview.js` files)                                                     |

```js
import { component } from 'imp'
import { button, div, h1 } from 'imp/html'
import { initState } from 'imp/state'
```

Each specifier is one subject, and each subject has a manual. Read [rendering](rendering.md) for
`imp/html`, [components](components.md) for `component`, [state](state.md) for `imp/state`,
[routing](routing.md) for `imp/router`, [http](http.md) for `imp/http`, [theming](theming.md) for
`imp/theme`, [i18n](i18n.md) for `imp/i18n`, [logging](logging.md) for `imp/log`, [std](std.md) for
`imp/std`, [icons](icons.md) for `imp/icons`, [service-worker](service-worker.md) for
`imp/service-worker`, [analytics](analytics.md) for `imp/analytics`, [testing](testing.md) for
`imp/test`, and [feature-flags](feature-flags.md) for `flag`.

Rules an agent gets wrong:

- **A name has exactly one home.** `imp` does not export `div`. `imp/html` does not export
  `component`. An import from the wrong specifier is an `imp/import-source` lint error, and the
  error names the correct specifier. `imp lint --fix` moves the import.
- **`button` exists twice on purpose.** `imp/html` gives the plain `<button>`, and `imp/std` gives
  the styled component. The two never collide, because the specifiers differ. When a file needs
  both, give one an alias: `import { button as styledButton } from 'imp/std'`.
- **No other `imp/...` subpath exists.** A specifier such as `imp/std/charts` or `imp/utils` fails
  lint, and the error lists the real specifiers.
- **Never write `import mitt from 'npm:mitt@3.0.1'`.** Vendor a third-party package first with
  `imp install`, then import it by its bare alias. See [dependencies](dependencies.md).
- A namespace import works on every subpath: `import * as h from 'imp/html'`, then `h.div(...)`.
