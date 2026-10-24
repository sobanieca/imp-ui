# Library split into per-subject import namespaces

## Context

The library started as one bare specifier. `import { ... } from 'imp'` gave you the element
factories, `component`, `mount`, the state, the router, the theming, the logging and `env`. That is
about a hundred names, and about eighty of them are tag factories, see `element-factory-syntax.md`.
Two problems grew out of that. First, names that nobody can list from memory dominate the namespace.
So the import line says nothing about what a file does. Second, the standard component library, see
`standard-component-library.md`, deliberately uses a natural name again, such as `button`, `link`
and `text`. That works only because the library arrives through a separate specifier. It left the
`button` of the framework as a special case with no explanation, inside a namespace that also held
everything else.

A subpath already existed for `imp/std` and for `imp/test`. imp resolved both from one shared table,
which the bundler, the import map of the dev server, and the specifier check of `imp lint` all use.
So a further split was a decision about where to cut, and not a construction of machinery.

## Decision

The library is **split by subject, with one bare specifier per subject**. A curated barrel module in
`lib/src/api/` backs each specifier, and `imp` itself stays `lib/src/imp.js`. A barrel re-exports
exactly the public names. An implementation module stays internal, and app code cannot reach it.

| Specifier            | Exports                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `imp`                | `component`, `mount`, `init`, `env`, `flag`                               |
| `imp/html`           | `el`, `html`, one factory per HTML tag                                    |
| `imp/state`          | `initState`, `useState`, `computed`                                       |
| `imp/router`         | `router`, `area`, `route`, `guard`, `wait`, `navigate`, `useRoute`, `url` |
| `imp/theme`          | `theme`, `applyTheme`, `colorSchemeOf`                                    |
| `imp/i18n`           | `t`, `lang`, `dir`, `setLang`, `missingMessages`, `defaultMessages`       |
| `imp/log`            | `logger`, `createLogger`, `setLogLevel`, `logLevel`                       |
| `imp/http`           | `initHttpClient`, `useHttpClient`, `createHttpClient`, `HttpError`        |
| `imp/icons`          | One export per Lucide icon, see `bundled-icon-set.md`                     |
| `imp/service-worker` | `startDevMode` and `precacheBuild`, see `service-worker-dev-mode.md`      |
| `imp/analytics`      | `onAnalytics`, `batch`, `zone`, `track`, see `product-analytics.md`       |
| `imp/analytics/aly`  | `alySink`, the sink for imp-aly servers, see `imp-aly-sink.md`            |
| `imp/std`            | The standard component library, split by group                            |
| `imp/test`           | The test library, resolved by `imp test` only                             |
| `imp/preview`        | `mockModule` for a preview file, resolved by `imp preview` only           |

- **`imp` keeps what defines an app, and not what defines a subject.** That is `component`, which is
  the centre of the framework, `mount` and `init`, which are the entry point, `env` and `flag`,
  which read the build configuration, see `environments.md` and `build-flags.md`. Everything with a
  subject of its own moves out. `init` reaches into theming and i18n, to apply what an app is
  configured with. So both of those modules initialize their state lazily. An app that never calls
  `init` pays for neither one in its bundle.
- **One name has one home, and there is no alias.** imp re-exports nothing from a second specifier.
  There is one correct import line for every name, and that is what keeps generated code consistent.
- **A new lint rule, `imp/import-source`, names the home and repairs the line.** When you import a
  name from a sibling imp specifier, imp reports the specifier that the name belongs to. The import
  does not fail later, as a missing-export error that explains nothing. `imp lint --fix` moves the
  name. The framework assumes that an agent writes the code, and an agent with no imp in its
  training data guesses a flat namespace by default. The rule derives its table by reading the
  exports of the barrel modules. So the table cannot fall behind the library. The rule inspects the
  specifiers of imp only. So it never reports an app name that happens to match.
- **imp does not export its internals.** `isPlainObject`, `isStateShaped` and `componentNameProblem`
  are in no barrel. The CLI is the only real consumer, and it imports them from the implementation
  modules, by path.
- **`imp/html` declares the tag factories one by one**, as a plain `export const` per tag. It does
  not re-export a generated map. So a bundler can analyze each one on its own, and a bundle carries
  only the tags that an app imports. The lint rules read the export names of the module, in place of
  a separate list of tags. So there is one list, and not two.
- **Every future subject gets its own specifier**, named after the subject, and registered in the
  same shared table. Planned work records the home that it will land under, in its todoer todo. So
  somebody decides the name once, in the open, and not at the moment of a merge.

## Consequences

- An import line documents its file. `imp/router` and `imp/state` at the top of a module say what
  the module does, before you read the body. A typical screen names two or three specifiers.
- The `button` of `imp/html`, and the `button` of `imp/std`, read as what they are. They are the
  same name at two levels, and the collision needs no special explanation.
- The cost is more import lines per file, and one more thing to know when you write an import. The
  lint rule, and the error for an unknown subpath, absorb most of that cost. Both failures end in a
  message that names the specifier to use.
- To add a subject means to add one row to the shared table of subpaths, and one barrel module. The
  resolvers, the import map of the dev server, the specifier check of the lint, and the table of
  `import-source`, all follow from that.
- The tree-shaking works at two levels. An import of `imp` does not reach the tag factories at all.
  Inside `imp/html`, a bundler drops an unused factory. An entry that uses two tags builds 3.9 kB,
  against 7.0 kB for an entry that uses all of them. A specifier per subject is the coarse half of
  that result. The fine half stops a subject from bringing in its neighbours, and that is
  `tree-shakeable-library.md`.
