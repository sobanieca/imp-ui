# imp-ui — Imports

Everything imp gives you arrives through a bare specifier that imp resolves for you — in development
through the import map `imp start` injects, in production through the bundle `imp build` produces.
There is nothing to install and nothing to configure.

The library is split by subject, so an import line says which part of imp a file leans on:

| Specifier    | What it holds                                                              | Page                                     |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------- |
| `imp`        | `component`, `mount`, `init`, `env`                                        | [Components](components.md)              |
| `imp/html`   | `el`, `html`, and one factory per HTML tag (`div`, `span`, `button`)       | [Rendering](rendering.md)                |
| `imp/state`  | `initState`, `useState`, `computed`                                        | [State](state.md)                        |
| `imp/router` | `router`, `navigate`, `useRoute`, `area`, `url`                            | [Routing](routing.md)                    |
| `imp/theme`  | `theme`, `applyTheme`                                                      | [Theming](theming.md)                    |
| `imp/i18n`   | `t`, `lang`, `dir`, `setLang`, `missingMessages`, `defaultMessages`        | [Translations](i18n.md)                  |
| `imp/log`    | `logger`, `createLogger`, `setLogLevel`, `logLevel`                        | [Logging](logging.md)                    |
| `imp/http`   | `initHttpClient`, `useHttpClient`, `createHttpClient`, `mock`, `HttpError` | [HTTP](http.md)                          |
| `imp/std`    | The standard component library, split by group                             | [Standard components](std-components.md) |
| `imp/test`   | `test`, `expect`, `spy`, `mockModule`, and the hooks                       | [Testing](testing.md)                    |

A typical screen imports from the two or three of them it actually uses:

```js
import { component } from 'imp'
import { button, div, h1 } from 'imp/html'
import { initState } from 'imp/state'
```

## Why it is split

- **The tag factories are most of the surface.** One factory per HTML tag is close to eighty names;
  keeping them behind `imp/html` leaves the framework itself small enough to hold in your head.
- **A name can mean two things at two levels.** `button` is both a plain `<button>` from `imp/html`
  and the styled component from `imp/std`. They never collide, because they arrive through different
  specifiers, and the import line says which one a file is using. When a file wants both, alias one:

  ```js
  import { button } from 'imp/html'
  import { button as styledButton } from 'imp/std'
  ```

- **Imports document a file.** Seeing `imp/router` and `imp/state` at the top of a module tells you
  what it does before you read a line of it.

## When you get it wrong

Importing a name from the wrong specifier is caught by `imp lint`, which names the one it belongs
to:

```
error[imp/import-source]: 'div' is not exported by 'imp' — it comes from 'imp/html': import { div } from 'imp/html'
```

`imp lint --fix` moves the name to the right import for you. An `imp/…` specifier that is not part
of the library at all fails with the list of the ones that are, so a typo never turns into a
mysterious missing module.

## Namespace imports

Every subpath can also be imported whole, which reads well for the tag factories in a file that uses
many of them:

```js
import * as h from 'imp/html'

export const card = (title) => h.article(h.h2(title), h.p('…'))
```
