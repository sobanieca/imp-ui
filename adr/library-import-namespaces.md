# Library split into per-subject import namespaces

## Context

The library started as one bare specifier: `import { … } from 'imp'` gave you element factories,
`component`, `mount`, state, router, theming, logging and `env` - around a hundred names, roughly
eighty of them tag factories (`element-factory-syntax.md`). Two problems grew out of that. The
namespace is dominated by names nobody can list from memory, so the import line says nothing about
what a file does; and the standard component library (`standard-component-library.md`) deliberately
reuses natural names - `button`, `link`, `text` - which only works because it arrives through a
separate specifier, leaving the framework's own `button` as an unexplained special case inside a
namespace that holds everything else too.

Subpaths already existed for `imp/std` and `imp/test`, resolved from one shared table used by the
bundler, the dev server's import map and the `imp lint` specifier check alike, so splitting further
was a matter of deciding the cut, not building machinery.

## Decision

The library is **split by subject, one bare specifier per subject**, each backed by a curated barrel
module in `lib/src/api/` (`imp` itself stays `lib/src/imp.js`) that re-exports exactly the public
names - implementation modules stay internal and are no longer reachable from app code.

| Specifier    | Exports                                                            |
| ------------ | ------------------------------------------------------------------ |
| `imp`        | `component`, `mount`, `init`, `env`                                |
| `imp/html`   | `el`, `html`, one factory per HTML tag                             |
| `imp/state`  | `initState`, `useState`, `computed`                                |
| `imp/router` | `router`, `navigate`, `useRoute`, `area`, `url`                    |
| `imp/theme`  | `theme`, `applyTheme`                                              |
| `imp/i18n`   | `t`, `lang`, `setLang`                                             |
| `imp/log`    | `logger`, `createLogger`, `setLogLevel`, `logLevel`                |
| `imp/http`   | `initHttpClient`, `useHttpClient`, `createHttpClient`, `HttpError` |
| `imp/std`    | The standard component library, split by group                     |
| `imp/test`   | The test library                                                   |

- **`imp` keeps what defines an app rather than a subject**: `component` (the framework's
  centerpiece), `mount` and `init` (the entry point) and `env`. Everything with a subject of its own
  moves out. `init` reaches into theming and i18n to apply what an app is configured with, so both
  of those modules keep their state lazily initialized - an app that never calls `init` does not pay
  for either in its bundle.
- **One name, one home, no aliases.** Nothing is re-exported from a second specifier: there is one
  right import line for every name, which is what keeps generated code consistent.
- **A new lint rule, `imp/import-source`, names the home and repairs the line.** Importing a name
  from a sibling imp specifier is reported with the specifier it belongs to, instead of failing
  later as an opaque missing-export error, and `imp lint --fix` moves it - the framework assumes
  agents write the code, and an agent with no imp in its training data guesses the old flat
  namespace by default. The rule derives its table by reading the barrel modules' own exports, so it
  cannot drift from the library, and it only inspects imp's own specifiers, so app names that happen
  to match are never flagged.
- **Internals stopped being exported.** `isPlainObject`, `isStateShaped` and `componentNameProblem`
  reached app code through the old catch-all barrel; the CLI, which is the only real consumer,
  imports them from the implementation modules by path.
- **`imp/html` declares the tag factories one by one**, as a plain `export const` per tag, rather
  than re-exporting a generated map - each is then individually analyzable, so a bundle carries only
  the tags an app imports. The lint rules read the module's own export names instead of a separate
  tag list, so there is one list, not two.
- **Every future subject gets its own specifier**, named after the subject, registered in the same
  shared table. Planned work records the home it will land under in its `todo/` entry, so the name
  is decided once, in the open, rather than at merge time.

## Consequences

- An import line documents its file: `imp/router` and `imp/state` at the top of a module say what it
  does before the body is read. A typical screen names two or three specifiers.
- `button` from `imp/html` and `button` from `imp/std` read as what they are - the same name at two
  levels - and the collision needs no special explanation.
- The cost is more import lines per file, and one more thing to know when writing an import. The
  lint rule and the unknown-subpath error absorb most of that: both failure modes end in a message
  naming the specifier to use.
- Adding a subject means adding one row to the shared subpath table and one barrel module; the
  resolvers, the dev import map, the lint specifier check and the `import-source` table all follow
  from it.
- Tree-shaking improved twice over: importing `imp` no longer reaches the tag factories at all, and
  within `imp/html` unused factories are dropped from the bundle - an entry using two tags builds
  3.9 kB against 7.0 kB for one using all of them. Per-subject specifiers are the coarse half of
  that result; the fine half, which stops a subject from dragging in its neighbours, is
  `tree-shakeable-library.md`.
