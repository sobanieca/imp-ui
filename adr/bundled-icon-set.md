# Lucide ships in the box, as one export per icon

## Context

Every app needs icons, and the three usual ways to get them all cost something imp is not willing to
pay: an icon font is a render-blocking download and a `content` hack that no screen reader reads; a
CDN sprite sheet is a third-party request on every page load; and `npm install lucide` puts a
package manager back in front of a user imp otherwise never asks to install anything.

imp's first answer was a hand-drawn set of around forty line glyphs addressed by a `name` string. It
was enough for a nav rail and an empty state and nothing beyond that, so every real app hit its edge
immediately and fell back to writing inline `<svg>` - which is to say the set solved the easy half
of the problem and left the rest.

Bundling a real set instead runs straight into `tree-shakeable-library.md`. Lucide is 1791 icons and
434 kB of drawing data. The obvious API - `icon('house')` - makes that table one runtime lookup
keyed by a string, which no bundler can shake: the first app to draw one icon ships all of them. The
API shape is therefore not a matter of taste here. It decides whether the feature is affordable at
all.

## Decision

**The whole Lucide set is compiled into the binary as plain data, one export per icon, and drawn by
`icon`, which takes the value rather than a name.**

- **`imp/icons` is a generated module of `export const` array literals** - `luUser` is the list of
  shapes that draws it, `[['path', { d: '...' }], ['circle', { cx: '12', cy: '7', r: '4' }]]`, and
  nothing more. An app imports the names it draws, esbuild drops the rest, and an entry using one
  icon builds under 20 kB against the 434 kB the table weighs. A test builds that entry and fails
  over 25 kB, so the guarantee is measured rather than asserted.
- **The export name is `lu` plus the Lucide icon name in PascalCase** - `house` is `luHouse`,
  `chart-column` is `luChartColumn`. The prefix is not decoration: the bare names collide with
  globals an app module already has (`Map`, `File`, `Text`, `Image`), and a prefixed name says where
  the value came from at the import site. Lucide's own deprecated aliases are not re-exported; imp
  ships one name per icon.
- **There is no string form and there never will be.** `icon('house')` is what the design exists to
  avoid; it would defeat the shaking for every app in the process of being convenient for one call
  site. The skills say so, because it is the thing an agent will reach for first.
- **`icon` renders it, from `imp/std`.** It takes the icon positionally or as a prop, draws it on
  Lucide's 24x24 grid stroked in `currentColor`, and exposes `size` (three steps or any CSS length,
  both axes because every icon is square) and `color` (a theme token name, never a CSS colour, so
  icons re-skin with the theme).
- **The hand-drawn set is gone.** Keeping both would mean two components, two naming schemes and a
  standing question of which to reach for, to save an app that draws one glyph a few hundred bytes.
  `icon` is the one icon component and Lucide is the one set.
- **One generated file, not one file per icon.** `lib/src/icons/lucide_icons.js` is 434 kB and 1791
  declarations, written by `deno task lucide` from the pinned `lucide-static` package and checked
  in. Per-icon modules would shake identically and add 1791 files to the repo for no benefit;
  esbuild shakes per declaration within a module. The generator runs `--no-lock`, because letting
  that package into `deno.lock` adds its npm tarball to the compiled binary that nothing imports.
- **Lucide is ISC, and the icons it inherited from Feather are MIT.** Both are already in the
  permissive tier of `license-policy-gate.md`, so nothing about the policy changes.
- **The attribution ships with the app, automatically.** The generated module opens with a `/*! */`
  legal comment naming the version, the licenses and both copyright holders. `imp build` already
  collects legal comments into `LICENSES.txt` (`built-app-license-notices.md`), so an app that draws
  an icon carries the notice and an app that draws none carries nothing. The same record is in
  `THIRD_PARTY_LICENSES.md` for the binary.

## Consequences

- An app gets a real icon set with no install, no font, no network request and no CSS file, and pays
  only for the icons it names.
- The cost is one rule the docs and skills have to keep repeating: never
  `import * as icons from 'imp/icons'`, because a namespace import pins the whole table. It is the
  single way to get this wrong, and nothing but prose prevents it - a bundle-size test in imp's own
  repo cannot see into an app.
- The binary grows by 434 kB, well under a percent of it. The generated file is excluded from
  `deno fmt` and `deno lint`.
- Lucide renames icons between releases, so upgrading is one pinned version in
  `tools/vendor_lucide.js`, a regenerated file, and possibly a rename in imp's public API - which
  before `1.0.0` is a rename and nothing more.
