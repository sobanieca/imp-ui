# imp-ui - Imports

Everything imp gives you arrives through a bare specifier that imp resolves for you. In development
it uses the import map `imp start` injects. In production it uses the bundle `imp build` produces.
There is nothing to install and nothing to configure.

The library is split by subject, so an import line shows which part of imp a file uses:

| Specifier            | What it holds                                                                                                  | Page                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `imp`                | `component`, `mount`, `init`, `env`, `flag`, `appMap`, `interval`, `delay`                                     | [Components](components.md)              |
| `imp/html`           | `el`, `html`, and one factory per HTML tag (`div`, `span`, `button`, ...)                                      | [Rendering](rendering.md)                |
| `imp/state`          | `initState`, `useState`, `computed`                                                                            | [State](state.md)                        |
| `imp/router`         | `router`, `area`, `redirect`, `wait`, `navigate`, `safeNext`, `beforeLeave`, `useRoute`, `url`, `screenRegion` | [Routing](routing.md)                    |
| `imp/theme`          | `theme`, `applyTheme`, `colorSchemeOf`                                                                         | [Theming](theming.md)                    |
| `imp/i18n`           | `t`, `lang`, `dir`, `setLang`, `missingMessages`, `defaultMessages`                                            | [Translations](i18n.md)                  |
| `imp/log`            | `logger`, `createLogger`, `setLogLevel`, `logLevel`                                                            | [Logging](logging.md)                    |
| `imp/http`           | `initHttpClient`, `useHttpClient`, `createHttpClient`, `HttpError`                                             | [HTTP](http.md)                          |
| `imp/icons`          | `luHouse`, `luUser`, `luStar`, ... from the Lucide icon set                                                    | [Standard components](std-components.md) |
| `imp/service-worker` | `startDevMode`, `precacheBuild`, for a service worker of your own                                              | [CLI](cli.md#your-own-service-worker)    |
| `imp/analytics`      | `onAnalytics`, `batch`, `zone`, `track`                                                                        | [Analytics](analytics.md)                |
| `imp/analytics/aly`  | `alySink`, a sink that sends the records to your imp-aly servers                                               | [Analytics](analytics.md#imp-aly)        |
| `imp/std`            | The standard component library, split by group                                                                 | [Standard components](std-components.md) |
| `imp/test`           | `test`, `expect`, `spy`, `mockModule`, and the hooks                                                           | [Testing](testing.md)                    |
| `imp/preview`        | `mockModule`, for a `*.preview.js` file                                                                        | [CLI](cli.md#imp-preview)                |
| `imp/fake`           | `fake`, generated data for a mock file, a test or a preview                                                    | [CLI](cli.md#generated-data)             |

A typical screen imports from the two or three specifiers it uses:

```js
import { component } from 'imp'
import { button, div, h1 } from 'imp/html'
import { initState } from 'imp/state'
```

## Why the library is split

- **The tag factories are most of the surface.** One factory per HTML tag is nearly eighty names.
  They stay behind `imp/html`, so the framework itself stays small enough to remember.
- **A name can mean two things at two levels.** `button` is a plain `<button>` from `imp/html`, and
  it is also the styled component from `imp/std`. The two never collide, because they arrive through
  different specifiers, and the import line shows which one a file uses. When a file wants both,
  give one an alias:

  ```js
  import { button } from 'imp/html'
  import { button as styledButton } from 'imp/std'
  ```

- **The imports document a file.** When you see `imp/router` and `imp/state` at the top of a module,
  you know what the module does before you read a single line.

## When you get an import wrong

`imp lint` catches a name from the wrong specifier, and names the correct one:

```
error[imp/import-source]: 'div' is not exported by 'imp' - it comes from 'imp/html': import { div } from 'imp/html'
```

`imp lint --fix` moves the name to the correct import for you. An `imp/...` specifier outside the
library fails, and the error lists the real specifiers. A spelling mistake never turns into a
missing module you cannot explain.

## Namespace imports

You can also import every subpath as a whole. This reads well for the tag factories, in a file that
uses many of them:

```js
import * as h from 'imp/html'

export const card = (title) => h.article(h.h2(title), h.p('...'))
```
