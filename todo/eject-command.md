# `imp eject` - take a standard component into the project

A standard component is a closed box: a fixed prop set, sealed internals, styling reachable only
through tokens (`adr/standard-component-library.md`). That is the right default, and it is also a
dead end the moment an app needs a variant the props do not have - a third button size, a select
that renders an avatar next to each option, a form that submits on blur. Today the only way out is
to rewrite the component from scratch against the public kernel API, without the CSS, the ARIA
wiring, the responsive prop handling or the tests that the shipped one already has.

`imp eject` turns that dead end into a door. It copies a standard component's real source into the
project as ordinary app code the developer owns from then on - imports rewritten to public
specifiers, element name renamed, its skill and preview files alongside it - so the escape hatch
costs one command instead of a reimplementation.

```
imp eject <component> [--to <dir>] [--as <name>] [--rewrite-imports] [--dry-run]
```

`<component>` is written the way `imp skill` already names one - `std/button`, or just `button`. The
component's source is already inside the binary (`lib/src` is compiled in, which is how
`imp skill std/button` finds its sidecar), so eject reads the exact source of the version the user
is running - no download, no network, no second copy of the library to keep in sync.

## What it writes

```
imp eject std/button --to src/components

  src/components/button.js            the component, rewritten to app space
  src/components/button.skill.md      its manual, so 'imp skill ./src/components/button.js' works
  src/components/button.preview.js    its preview, so 'imp preview' renders it
```

The sidecars are the reason this feels finished rather than dumped: the project skill index already
lists every `*.skill.md` in the project, and `imp preview` already picks up every `*.preview.js`, so
an ejected component arrives with a manual an agent can read and a stage to develop it on. Both need
the same rewriting the source does - the skill's `import { button } from 'imp/std'` line and the
preview's imports are wrong the second the file lands.

## The hard part: what a component actually imports

`button.js` is 200 lines that import from seven places, and only one of those is a specifier an app
can write:

```js
import { defineComponent } from '../shared/define.js'
import { el, span } from '../../api/html.js'
import { bindValue, oneOf } from '../shared/args.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  hiddenRule,
  sizeRules,
  SIZES,
  token,
} from '../shared/css.js'
```

Three kinds of import, each needing a different answer:

1. **Kernel modules reached by path.** `../../api/html.js`, `../../api/state.js`,
   `../../api/i18n.js`, `../../router.js`, `../../theme.js`, `../../render.js`,
   `../../component.js`, `../../logger.js`. These are the public library seen from inside, so they
   rewrite to the public specifier by table:

   | Internal path                     | Ejected import                 |
   | --------------------------------- | ------------------------------ |
   | `api/html.js`, `render.js` (`el`) | `imp/html`                     |
   | `component.js`                    | `imp`                          |
   | `api/state.js`                    | `imp/state`                    |
   | `api/router.js`, `router.js`      | `imp/router`                   |
   | `api/i18n.js`                     | `imp/i18n`                     |
   | `api/theme.js`                    | `imp/theme`                    |
   | `logger.js` (`impLogger`)         | `imp/log`, renamed to `logger` |

   `impLogger` -> `logger` is a rename, not just a move: the `imp` prefix on every warning is imp's,
   and an ejected component's warnings are the app's. Two names in this group have **no public
   home** and are the reason the table is not the whole story: `defaultTokens` from `theme.js` (what
   `token()` reads its fallbacks from) and `isPlainObject` / `isStateShaped` / `splitArgsByType`
   from `render.js`, which `library-import-namespaces.md` deliberately stopped exporting.

2. **The shared authoring layer** - `std/shared/*.js`: `define.js` (`defineComponent`, `tagFor`),
   `args.js` (argument dispatch, prop validation, `bindValue` / `bindText`), `css.js` (`token`,
   `focusRing`, `forcedColors`, `hiddenRule`, size rules), `layout.js`, `declarations.js` (the
   prop-to-custom-property handling of `responsive-fluid-values-only.md`), `links.js`, `icons.js`,
   `fuzzy.js`, `path.js`. Every std component leans on this; none of it is reachable from app code.

3. **Sibling modules inside `std/`** - two sorts. Unexported implementation files that only exist to
   be shared by one family (`inputs/field.js`, `inputs/text_input.js`, `inputs/form_state.js`,
   `inputs/checkable.js`, `inputs/control_css.js`, `layout/bar.js`, `layout/frame.js`), and exported
   components a component composes (`submitButton` imports `general/button.js`).

## How the shared layer should be handled

Three options; the middle one is the recommendation.

- **Copy it into the project alongside the component.** Honest and dependency-free, but ejecting
  `button` drops five files the user never asked to own, ejecting a second component either
  duplicates them or silently shares an earlier copy, and edits to a copied `css.js` change every
  ejected component at once. It also does not work as stated: `args.js` needs `splitArgsByType` and
  `css.js` needs `defaultTokens`, so the copy would have to reach further into the kernel and drag
  parts of `render.js` and `theme.js` with it.

- **Promote it to a public specifier, `imp/kit`** - the component-authoring kit the standard library
  itself is built on: `defineComponent`, `token`, `focusRing`, `forcedColors`, `hiddenRule`,
  `oneOf`, `bindValue`, `bindText`, and the responsive prop resolver. Then an ejected component is
  **one file** whose imports are all public, which is what makes the result readable, diffable
  against the next imp version, and the same shape whether one component is ejected or ten. It earns
  its keep independently of eject: an app writing its own themed component today hand-writes
  `var(--imp-color-primary, #2563eb)` and its own focus ring, and would rather call `token()` and
  `focusRing()` - the same values, checked against the theme, impossible to typo. A new subject gets
  its own bare specifier (`library-import-namespaces.md`), so this is `imp/kit` rather than a
  subpath under `imp/std`, where `imp/std/<group>` means a catalog group.

  The cost is real and should be weighed when this is picked up: it is a public API surface that has
  to stay stable, with a `docs/` page, a `skills/` page, an `import-source` lint table entry, and
  `defineComponent` in particular being a design that was never written to be seen from outside.
  Keep the kit to what an ejected component provably needs - the closure above is small and
  mechanical to check.

- **Flatten everything into one bundled file.** Rejected: the whole point of ejecting is that the
  developer reads and edits the result, and an inlined 900-line file with the helpers of five
  modules pasted at the top is not that.

For group 3, **unexported family modules are copied** next to the component (they are that
component's implementation, not a shared layer), and **exported siblings keep importing `imp/std`**
so ejecting `submitButton` does not silently fork `button` too. `--deep` can eject a whole family
later, if anyone asks for it.

## Renaming is not optional

Two collisions make an unrenamed copy actively broken, and both are silent:

- **The element name.** `defineComponent` derives `imp-button` from the export name, and
  `component()` answers a second definition of a name it already holds with
  `component 'imp-button' is already
  defined - reusing it and ignoring the new definition`. So an
  app that ejects `button` and still imports anything from `imp/std` that renders a button gets
  whichever definition mounted first - the user edits their ejected file and sees no change. The
  ejected component must therefore define its own element name, and imp reserves the `imp-` prefix
  anyway. `--as <name>` sets both the export and the element name; without it, eject renames the tag
  but keeps the export name.

- **The message keys.** Every std component declares its own English wording under an `imp.` key
  through `defaultMessages`, and `defaultMessages` is last-writer-wins per key - so an ejected
  component that keeps `imp.form.checkFailed` fights the library's copy over one key, with load
  order deciding. Eject rewrites the key namespace along with the name.

## What makes it smooth

- **The call sites.** After ejecting, every `import { button } from 'imp/std'` in the project is
  still pointing at the library. Eject reports each one, and `--rewrite-imports` fixes them in place
  - the same AST-based rewriting `imp lint --fix` already does for `imp/import-source`. Off by
    default: a file importing both the element factory and the component needs a human eye.
- **The printed next step.** Eject ends by printing what it wrote, the new import line, the new
  element name, and the one sentence that matters: this file is yours now, `imp update` will not
  touch it, and it will not gain the fixes the shipped component gets.
- **`--dry-run`** prints the same report and writes nothing, so an agent can look before it leaps.
- **Refusing to overwrite.** An existing target file stops the command with the path named, rather
  than discarding edits the user made after their first eject.
- **Recording it.** An `ejected` map in `imp.json` (component -> path -> imp version it was taken
  from) is what a later `imp eject --diff` would need to show what changed upstream since. Worth
  writing from the start even if the diff view lands later; decide whether it is worth the config
  key when the command is designed.

## The guarantee

A test ejects **every** component in every `imp/std` barrel into a scratch project and builds it.
That is the only way the rewrite table stays honest as components land: a new component reaching for
one more kernel internal fails the test that day, naming the import, rather than producing a broken
eject a year later. It is the same enforcement shape as the test that fails when a barrel export
arrives without a skill file.

## Docs, skills and help

A user-facing command, so it lands with its `docs/cli.md` usage block and prose, a `skills/eject.md`
registered in `cli/src/skill.js`, and the CLI help entry. `docs/std-components.md` gains the escape
hatch paragraph - when to eject rather than request a prop - and `skills/std.md` gains the
mechanical version of it. If `imp/kit` lands with it, that is a `docs/` page and a `skills/` page of
its own, plus its row in the `import-source` table.

## ADR impact

Once it ships, `adr/standard-component-library.md` grows the eject seam - the closed prop set stays
closed precisely because there is a documented way out - and if `imp/kit` lands, its row belongs in
`adr/library-import-namespaces.md` and the shared-helper layer it exposes in the std ADR.

## Open questions

- **Where do ejected files go by default?** `src/components/` matches what `imp init` scaffolds, but
  nothing in imp knows a project's layout. Decide between a fixed default with `--to` to override,
  and a `components` key in `imp.json`.
- **What prefix does the renamed element get?** A fixed `app-`, the project folder name, or a
  configured prefix. This is the same question an app author answers when naming their own
  components, so whatever is decided should be what `skills/components.md` teaches.
- **Do the tests come too?** The standard components are covered by imp's own test suite, which the
  user does not get. Ejecting a component silently drops it out from under that coverage. Emitting a
  starting `*.test.js` with the role, accessible-name and keyboard assertions the accessibility
  baseline requires would keep the guarantee with the code - but those tests are written against
  imp's internal test layout, so this needs a look before promising it.
- **What else is ejectable?** A built-in theme (`imp eject theme imp-light` -> a token module to
  tweak, which is close to what the preview's theme editor exports) and the `imp init` templates are
  the obvious candidates. Keep the first release to components; the noun in the command leaves room.
