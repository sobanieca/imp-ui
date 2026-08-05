# imports - every bare specifier imp resolves

imp resolves these specifiers itself: in development through the import map `imp start` injects, in
production through `imp build`. Nothing to install, nothing to configure. Never import imp by a
relative path, a URL, or a version.

| Specifier            | Exports                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `imp`                | `component`, `mount`, `init`, `env`, `flag`                                                           |
| `imp/html`           | `el`, `html`, ~80 tag factories (`div`, `span`, `button`, `input`…)                                   |
| `imp/state`          | `initState`, `useState`, `computed`                                                                   |
| `imp/router`         | `router`, `area`, `navigate`, `useRoute`, `url`                                                       |
| `imp/http`           | `initHttpClient`, `useHttpClient`, `createHttpClient`, `HttpError`                                    |
| `imp/theme`          | `theme`, `applyTheme`                                                                                 |
| `imp/i18n`           | `t`, `lang`, `dir`, `setLang`, `missingMessages`, `defaultMessages`                                   |
| `imp/log`            | `logger`, `createLogger`, `setLogLevel`, `logLevel`                                                   |
| `imp/std`            | `button`, `heading`, `text`, `link`                                                                   |
| `imp/std/layout`     | `appShell`, `toolbar`, `stack`, `row`, `grid`, `item`, `container`, `spacer`, `divider`, `scrollArea` |
| `imp/std/inputs`     | `form`, `textField`, `select`, `checkbox`, `toggle`, `radioGroup`, …                                  |
| `imp/std/display`    | `emptyState`                                                                                          |
| `imp/std/navigation` | `tabs`, `navMenu`, `commandPalette`                                                                   |
| `imp/test`           | `test`, `expect`, `spy`, `mockModule`, `beforeAll`/`beforeEach`/…                                     |
| `imp/preview`        | `mockModule` (for `*.preview.js` files)                                                               |

```js
import { component } from 'imp'
import { button, div, h1 } from 'imp/html'
import { initState } from 'imp/state'
```

One subject per specifier, each with its own manual: [rendering](rendering.md) for `imp/html`,
[components](components.md) for `component`, [state](state.md) for `imp/state`,
[routing](routing.md) for `imp/router`, [http](http.md) for `imp/http`, [theming](theming.md) for
`imp/theme`, [i18n](i18n.md) for `imp/i18n`, [logging](logging.md) for `imp/log`, [std](std.md) for
`imp/std`, [testing](testing.md) for `imp/test`, and [feature-flags](feature-flags.md) for `flag`.

Rules an agent gets wrong:

- **A name has exactly one home.** `div` is not exported by `imp`; `component` is not exported by
  `imp/html`. Importing from the wrong specifier is an `imp/import-source` lint error naming the
  right one, and `imp lint --fix` moves it.
- **`button` exists twice on purpose** - the plain `<button>` from `imp/html` and the styled
  component from `imp/std`. They never collide because the specifiers differ; alias one when a file
  needs both: `import { button as styledButton } from 'imp/std'`.
- **No other `imp/…` subpath exists.** `imp/std/data`, `imp/utils`, … fail lint with the list of
  real specifiers.
- **Never `import mitt from 'npm:mitt@3.0.1'`.** Third-party packages are vendored first with
  `imp install` and imported by their bare alias - see [dependencies](dependencies.md).
- Namespace imports work on every subpath: `import * as h from 'imp/html'`, then `h.div(...)`.
