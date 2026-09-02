# `imp eject` - take a standard component into the project

A standard component is a closed box. It has a fixed set of props, sealed internals, and styling
that you reach through a token only, see `adr/standard-component-library.md`. That is the correct
default. It is also a dead end, the moment when an app needs a variant that the props do not have.
Three examples are a third size of a button, a select that renders an avatar beside each option, and
a form that submits on a blur. Today the only way out is to write the component again, from nothing,
against the public API of the kernel. You then have no CSS, no wiring of ARIA, no handling of a
responsive prop, and none of the tests that the shipped component already has.

`imp eject` turns that dead end into a door. It copies the real source of a standard component into
the project, as ordinary app code, which the developer owns from then on. It rewrites the imports to
a public specifier. It renames the element. It puts the skill file, and the preview file, beside the
component. So the escape hatch costs one command, in place of a new implementation.

```
imp eject <component> [--to <dir>] [--as <name>] [--rewrite-imports] [--dry-run]
```

You write `<component>` in the way that `imp skill` already names one. That is `std/button`, or just
`button`. The source of the component is already inside the binary, because imp compiles `lib/src`
in. That is how `imp skill std/button` finds its sidecar. So eject reads the exact source of the
version that the user runs. There is no download, no network, and no second copy of the library to
keep in step.

## What it writes

```
imp eject std/button --to src/components

  src/components/button.js            the component, rewritten to app space
  src/components/button.skill.md      its manual, so 'imp skill ./src/components/button.js' works
  src/components/button.preview.js    its preview, so 'imp preview' renders it
```

The sidecars are the reason why this feels finished, in place of dumped. The skill index of the
project already lists every `*.skill.md` file in the project. `imp preview` already finds every
`*.preview.js` file. So an ejected component arrives with a manual that an agent can read, and with
a stage to develop it on. Both files need the same rewriting as the source. The
`import { button } from 'imp/std'` line of the skill, and the imports of the preview, are wrong the
moment when the file lands.

## The hard part: what a component actually imports

`button.js` is 200 lines. It imports from seven places, and only one of those is a specifier that an
app can write:

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

There are three kinds of import, and each one needs a different answer:

1. **A module of the kernel that a path reaches.** Those are `../../api/html.js`,
   `../../api/state.js`, `../../api/i18n.js`, `../../router.js`, `../../theme.js`,
   `../../render.js`, `../../component.js` and `../../logger.js`. Each one is the public library,
   seen from inside. So each one rewrites to a public specifier, through a table:

   | Internal path                     | Ejected import                 |
   | --------------------------------- | ------------------------------ |
   | `api/html.js`, `render.js` (`el`) | `imp/html`                     |
   | `component.js`                    | `imp`                          |
   | `api/state.js`                    | `imp/state`                    |
   | `api/router.js`, `router.js`      | `imp/router`                   |
   | `api/i18n.js`                     | `imp/i18n`                     |
   | `api/theme.js`                    | `imp/theme`                    |
   | `logger.js` (`impLogger`)         | `imp/log`, renamed to `logger` |

   `impLogger` becomes `logger`, and that is a rename, and not only a move. The `imp` prefix on
   every warning belongs to imp, and a warning from an ejected component belongs to the app. Two
   names in this group have **no public home**, and they are the reason why the table is not the
   whole story. The first is `defaultTokens`, from `theme.js`, which is what `token()` reads its
   fallbacks from. The second is the group of `isPlainObject`, `isStateShaped` and
   `splitArgsByType`, from `render.js`, which `library-import-namespaces.md` deliberately stopped
   exporting.

2. **The shared layer for authoring**, which is `std/shared/*.js`. It holds `define.js`, with
   `defineComponent` and `tagFor`. It holds `args.js`, with the dispatch of an argument, the
   validation of a prop, and `bindValue` and `bindText`. It holds `css.js`, with `token`,
   `focusRing`, `forcedColors`, `hiddenRule` and the rules for a size. It also holds `layout.js`,
   `declarations.js`, which handles a prop as a custom property, see
   `responsive-fluid-values-only.md`, and `links.js`, `icons.js` and `path.js`. Every std component
   uses this layer. App code can reach none of it.

3. **A sibling module inside `std/`**, and there are two sorts. The first is a file of an
   implementation that imp does not export, and that exists to be shared by one family. Those are
   `inputs/field.js`, `inputs/text_input.js`, `inputs/form_state.js`, `inputs/checkable.js`,
   `inputs/control_css.js`, `layout/bar.js` and `layout/frame.js`. The second is a component that
   imp exports, and that another component composes. `submitButton` imports `general/button.js`.

## How the shared layer should be handled

There are three options, and the middle one is the recommendation.

- **Copy the layer into the project, beside the component.** That is honest, and it needs no
  dependency. But to eject `button` then drops five files that the user never asked to own. To eject
  a second component either duplicates those files, or shares an earlier copy with no message. An
  edit to a copied `css.js` also changes every ejected component at once. The option also does not
  work as stated. `args.js` needs `splitArgsByType`, and `css.js` needs `defaultTokens`. So the copy
  would have to reach further into the kernel, and pull parts of `render.js` and `theme.js` with it.

- **Promote the layer to a public specifier, `imp/kit`.** That is the kit for authoring a component,
  and the standard library itself is built on it. It holds `defineComponent`, `token`, `focusRing`,
  `forcedColors`, `hiddenRule`, `oneOf`, `bindValue`, `bindText`, and the resolver for a responsive
  prop. An ejected component is then **one file**, and all of its imports are public. That is what
  makes the result readable. It is also what lets a person compare it against the next version of
  imp. It also gives the same shape, whether somebody ejects one component or ten. The kit earns its
  place without eject. An app that writes its own themed component today writes
  `var(--imp-color-primary, #2563eb)` by hand, and its own focus ring. That app would prefer to call
  `token()` and `focusRing()`. Those give the same values, checked against the theme, and nobody can
  misspell them. A new subject gets its own bare specifier, see `library-import-namespaces.md`. So
  this is `imp/kit`, and not a subpath under `imp/std`, where `imp/std/<group>` means a group of the
  catalog.

  The cost is real, and somebody must weigh it when they take this up. It is a public API surface,
  and it must stay stable. It needs a page in `docs/`, a page in `skills/`, and an entry in the
  table of the `import-source` lint rule. `defineComponent` in particular is a design that nobody
  wrote to be seen from outside. Keep the kit to what an ejected component provably needs. The
  closure above is small, and a person can check it mechanically.

- **Flatten everything into one bundled file.** imp rejects that. The whole point of an eject is
  that the developer reads and edits the result. A file of 900 lines, with the helpers of five
  modules at the top, is not that.

For group 3, **imp copies a family module that it does not export** beside the component. Such a
module is the implementation of that component, and not a shared layer. **A sibling that imp exports
keeps its import of `imp/std`.** So an eject of `submitButton` does not fork `button` with no
message. A `--deep` flag can eject a whole family later, when somebody asks for it.

## Renaming is not optional

Two collisions make a copy that nobody renamed actively broken, and both are silent:

- **The name of the element.** `defineComponent` derives `imp-button` from the name of the export.
  `component()` answers a second definition of a name that it already holds with
  `component 'imp-button' is already defined - reusing it and ignoring the new definition`. So an
  app that ejects `button`, and that still imports anything from `imp/std` that renders a button,
  gets whichever definition mounted first. The user then edits their ejected file, and sees no
  change. So an ejected component must define its own name for an element. imp also reserves the
  `imp-` prefix. `--as <name>` sets the name of the export, and the name of the element. Without
  that flag, eject renames the tag, and keeps the name of the export.

- **The keys of the messages.** Every std component declares its own English wording, under an
  `imp.` key, through `defaultMessages`. In `defaultMessages`, the last writer wins, per key. So an
  ejected component that keeps `imp.form.checkFailed` fights the copy of the library, over one key,
  and the order of the load decides the winner. So eject rewrites the namespace of the key, with the
  name.

## What makes it smooth

- **The call sites.** After an eject, every `import { button } from 'imp/std'` in the project still
  points at the library. Eject reports each one. `--rewrite-imports` fixes them in place, through
  the same rewriting over an AST that `imp lint --fix` already does for `imp/import-source`. That
  flag is off by default. A file that imports the element factory and the component both needs the
  eye of a person.
- **The next step, printed.** Eject ends by printing what it wrote, the new import line, and the new
  name of the element. It also prints the one sentence that matters. This file is yours now.
  `imp update` will not touch it. It will not receive the fixes that the shipped component receives.
- **`--dry-run`** prints the same report, and writes nothing. So an agent can look before it acts.
- **A refusal to overwrite.** A target file that already exists stops the command, and the message
  names the path. imp does not discard an edit that the user made after their first eject.
- **A record of the eject.** An `ejected` map in `imp.json` maps a component, to a path, to the imp
  version that it came from. A later `imp eject --diff` would need that map, to show what changed
  upstream since. It is worth writing from the start, also when the view of the diff lands later.
  Decide whether it is worth the key in the config, when somebody designs the command.

## The guarantee

A test ejects **every** component of every `imp/std` barrel, into a scratch project, and builds the
result. That is the only way in which the table of the rewrite stays honest, while components land.
A new component that reaches for one more internal of the kernel fails the test on that day, and the
message names the import. It does not produce a broken eject, a year later. That is the same shape
of enforcement as the test that fails when an export of a barrel arrives with no skill file.

## Docs, skills and help

This is a command that a user sees. So it lands with its block of usage, and its prose, in
`docs/cli.md`. It lands with a `skills/eject.md` page, which somebody registers in
`cli/src/skill.js`. It lands with its entry in the help of the CLI. `docs/std-components.md` gains a
paragraph about the escape hatch, which says when to eject, in place of asking for a prop.
`skills/std.md` gains the mechanical version of that paragraph. When `imp/kit` lands with the
command, that kit needs a page in `docs/`, a page in `skills/`, and its row in the table of
`import-source`.

## ADR impact

After the command ships, `adr/standard-component-library.md` grows the seam of the eject. The closed
set of props stays closed exactly because there is a documented way out. When `imp/kit` lands, its
row belongs in `adr/library-import-namespaces.md`. The layer of shared helpers that it exposes
belongs in the ADR about the standard library.

## Open questions

- **Where does an ejected file go by default?** `src/components/` matches what `imp init` scaffolds.
  But nothing in imp knows the layout of a project. Decide between a fixed default, with `--to` to
  override it, and a `components` key in `imp.json`.
- **Which prefix does the renamed element get?** It can be a fixed `app-`, the name of the folder of
  the project, or a prefix that somebody configures. An author of an app answers the same question
  when they name their own component. So whatever somebody decides must be what
  `skills/components.md` teaches.
- **Do the tests come as well?** The test suite of imp covers the standard components, and the user
  does not get that suite. To eject a component drops it out from under that coverage, with no
  message. imp could emit a `*.test.js` file to start from, with the assertions about a role, an
  accessible name, and the keyboard, that the accessibility baseline requires. That would keep the
  guarantee with the code. But somebody wrote those tests against the internal layout of the tests
  of imp. So this needs a look, before anybody promises it.
- **What else can somebody eject?** The obvious candidates are a built-in theme, and the templates
  of `imp init`. `imp eject theme imp-light` would give a module of tokens to change, and that is
  close to what the theme editor of the preview exports. Keep the first release to a component. The
  noun in the command leaves room for more.
