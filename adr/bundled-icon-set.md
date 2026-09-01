# Font Awesome Free ships in the box, as one export per icon

## Context

`icon` covers around forty hand-drawn line glyphs - enough for a nav rail and an empty state, and
deliberately fixed. Every app past that point reaches for a real icon set, and the three ways to get
one all cost something imp is not willing to pay: an icon font is a render-blocking download and a
`content` hack that no screen reader reads; a CDN sprite sheet is a third-party request on every
page load; and `npm install @fortawesome/...` puts a package manager back in front of a user who imp
otherwise never asks to install anything.

Bundling the set instead runs straight into `tree-shakeable-library.md`. Font Awesome Free 7 is 2163
icons and 1.5 MB of path data. The obvious API - `faIcon('user-group')` - makes that table one
runtime lookup keyed by a string, which no bundler can shake: the first app to draw one icon ships
all of them. The API shape is therefore not a matter of taste here. It decides whether the feature
is affordable at all.

Licensing is the second constraint. Font Awesome Free is a multi-licensed download, and only the
icons - CC BY 4.0 - are what imp wants. CC BY requires attribution to travel with redistribution,
and the artifact being redistributed is not imp's binary but the `dist/` directory of every app that
draws an icon.

## Decision

**The whole free set is compiled into the binary as plain data, one export per icon, and drawn by a
component that takes the value.**

- **`imp/icons` is a generated module of `export const` array literals** - `faUser` is
  `[448, 512, 'M224 248a...']` and nothing more. An app imports the names it draws, esbuild drops
  the rest, and an entry using one icon builds under 20 kB against the 1.5 MB the table weighs. A
  test builds that entry and fails over 25 kB, so the guarantee is measured rather than asserted.
- **The style is part of the export name**: `fa` for Solid, `far` for Regular, `fab` for Brands,
  followed by the Font Awesome icon name in PascalCase. One flat namespace with no collisions and no
  `style` prop, and the name is derivable from what fontawesome.com shows. Font Awesome's own
  aliases are re-exported as references to the canonical icon, so either name works and neither
  duplicates the path data.
- **There is no string form and there never will be.** `faIcon('user')` is what the design exists to
  avoid; it would defeat the shaking for every app in the process of being convenient for one call
  site. The skills say so, because it is the thing an agent will reach for first.
- **`faIcon` renders it, from `imp/std`.** It takes the icon positionally or as a prop, sets the
  icon's own `viewBox`, fills with `currentColor`, and exposes `size` (three steps or any CSS
  length, block size only so the aspect ratio holds) and `color` (a theme token name, never a CSS
  colour, so icons re-skin with the theme). `icon` keeps its string-named hand-drawn set: it costs
  no attribution and stays the right answer for a glyph the library itself draws.
- **One generated file, not one file per icon.** `lib/src/icons/fa_icons.js` is 1.5 MB and 2883
  declarations, written by `deno task fontawesome` from the pinned `@fortawesome/free-*-svg-icons`
  packages and checked in. Per-icon modules would shake identically and add 2163 files to the repo
  for no benefit; esbuild shakes per declaration within a module. The generator runs `--no-lock`,
  because letting those packages into `deno.lock` adds 8.5 MB of npm tarballs to the compiled binary
  that nothing imports.
- **Only the icons are bundled**, so only CC BY 4.0 applies - no web font (SIL OFL 1.1) and none of
  Font Awesome's own code (MIT). CC-BY-4.0 already sits in the permissive tier of
  `license-policy-gate.md`, so nothing about the policy changes.
- **The attribution ships with the app, automatically.** The generated module opens with a `/*! */`
  legal comment naming the version, the licenses, the copyright holder and the fact that imp
  reshapes each icon, which is what CC BY's "indicate if changes were made" asks for. `imp build`
  already collects legal comments into `LICENSES.txt` (`built-app-license-notices.md`), so an app
  that draws an icon carries the notice and an app that draws none carries nothing. The same record
  is in `THIRD_PARTY_LICENSES.md` for the binary.

## Consequences

- An app gets a real icon set with no install, no font, no network request and no CSS file, and pays
  only for the icons it names.
- The cost is one rule the docs and skills have to keep repeating: never
  `import * as icons from 'imp/icons'`, because a namespace import pins all 1.5 MB. It is the single
  way to get this wrong, and nothing but prose prevents it - a bundle-size test in imp's own repo
  cannot see into an app.
- The binary grows by 1.5 MB, which is 1% of it. `lib/src` roughly doubles in size, and the
  generated file is excluded from `deno fmt` and `deno lint`.
- Brand icons are trademarks of their owners. imp ships the artwork and says so in
  `THIRD_PARTY_LICENSES.md` and in the skills; the obligation not to imply endorsement is the app
  author's, and imp cannot check it.
- Upgrading Font Awesome is one pinned version in `tools/vendor_fontawesome.js` and a regenerated
  file. An icon renamed upstream is a rename in imp's public API, which before `1.0.0` is a rename
  and nothing more.
