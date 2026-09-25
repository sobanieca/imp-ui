# Lucide ships in the box, as one export per icon

## Context

Every app needs an icon, and the three usual ways to get one all cost something that imp will not
pay. An icon font is a download that blocks the render, and it uses a `content` trick that no screen
reader reads. A sprite sheet on a CDN is a third-party request on every page load.
`npm install
lucide` puts a package manager in front of a user, and imp otherwise asks a user to
install nothing.

The first answer of imp was a set of about forty line glyphs, drawn by hand, and addressed by a
`name` string. That was enough for a nav rail and an empty state, and for nothing beyond that. So
every real app met its edge immediately, and fell back to an inline `<svg>`. In other words, the set
solved the easy half of the problem, and left the rest.

To bundle a real set runs straight into `tree-shakeable-library.md`. Lucide is 1791 icons, and 434
kB of drawing data. The obvious API, `icon('house')`, makes that table one lookup at runtime, keyed
by a string. No bundler can shake that out. So the first app that draws one icon ships all of them.
The shape of the API is therefore not a matter of taste here. It decides whether the feature is
affordable at all.

## Decision

**imp compiles the whole Lucide set into the binary, as plain data, with one export per icon. `icon`
draws it, and takes the value, not a name.**

- **`imp/icons` is a generated module of `export const` array literals.** `luUser` is the list of
  shapes that draws it, which is
  `[['path', { d: '...' }], ['circle', { cx: '12', cy: '7', r: '4' }]]`, and nothing more. An app
  imports the names that it draws, esbuild drops the rest, and an entry that uses one icon builds to
  less than 20 kB, against the 434 kB of the table. A test builds that entry, and fails above 25 kB.
  So imp measures the guarantee, and does not only assert it.
- **The export name is `lu` plus the Lucide icon name in PascalCase.** So `house` is `luHouse`, and
  `chart-column` is `luChartColumn`. The prefix is not decoration. A bare name collides with a
  global that an app module already has, such as `Map`, `File`, `Text` and `Image`. A prefixed name
  also says where the value came from, at the import. imp does not re-export the deprecated aliases
  of Lucide. imp ships one name per icon.
- **There is no string form, and there never will be.** `icon('house')` is what this design exists
  to avoid. It would defeat the shaking for every app, in order to be convenient for one call site.
  The skills say so, because that is the first thing that an agent reaches for.
- **`icon` renders the value, and it comes from `imp/std`.** It takes the icon positionally, or as a
  prop. It draws the icon on the 24x24 grid of Lucide, stroked in `currentColor`. It exposes `size`,
  which takes three steps or any CSS length, and which sets both axes because every icon is square.
  It also exposes `color`, which takes the name of a theme token, and never a CSS colour. So an icon
  re-skins with the theme.
- **There is one set.** A second set, drawn by hand, would mean two components, two naming schemes,
  and a standing question about which one to use. That would save an app that draws one glyph a few
  hundred bytes. `icon` is the one icon component, and Lucide is the one set.
- **There is one generated file, and not one file per icon.** `lib/src/icons/lucide-icons.js` is 434
  kB, and it holds 1791 declarations. `deno run -A --no-lock tools/vendor-lucide.js` writes it, from
  the pinned `lucide-static` package, and you commit it. A module per icon would shake in the same
  way, and it would add 1791 files to the repository for no gain. esbuild shakes per declaration
  inside a module. The generator runs with `--no-lock`, because that package in `deno.lock` adds its
  npm tarball to the compiled binary, and nothing imports it.
- **Lucide uses the ISC licence, and the icons that it inherited from Feather use MIT.** Both are
  already in the permissive tier of `license-policy-gate.md`. So nothing about the policy changes.
- **The attribution ships with the app, automatically.** The generated module starts with a `/*! */`
  legal comment. That comment names the version, the licences and both copyright holders.
  `imp build` already collects a legal comment into `LICENSES.txt`, see
  `built-app-license-notices.md`. So an app that draws an icon carries the notice, and an app that
  draws none carries nothing. The same record is in `THIRD-PARTY-LICENSES.md`, for the binary.

## Consequences

- An app gets a real icon set. There is no install, no font, no network request and no CSS file. The
  app pays only for the icons that it names.
- The cost is one rule that the documentation and the skills must repeat. Never write
  `import * as icons from 'imp/icons'`, because a namespace import pins the whole table. That is the
  one way to get this wrong. A test of the bundle size in the repository of imp cannot see into an
  app. So the `imp/icons-by-name` lint rule enforces the rule where the app is. A namespace import,
  an `export *` re-export, and a dynamic `import()` of `imp/icons`, are each an error, and the
  message names the form that imports by name.
- The binary grows by 434 kB, which is well under one percent of it. `deno fmt` and `deno lint`
  exclude the generated file.
- Lucide renames an icon between two releases. So an update is one pinned version in
  `tools/vendor-lucide.js`, a file that imp generates again, and possibly a rename in the public API
  of imp. Before version 1.0.0, that is a rename and nothing more.
