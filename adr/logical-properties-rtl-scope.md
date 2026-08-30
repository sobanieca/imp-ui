# Every box is logical; LTR and RTL are guaranteed, vertical writing modes are not

## Context

imp writes logical properties already, and `translatable-by-default.md` derives `<html dir>` from
the active language's script rather than a hand-kept list. What was never stated is how far that
reaches, and the omission cost real bugs: `anchored.js` clamped `max-inline-size` against `100vw`
while clamping `max-block-size` against `100dvb` in the same rule, and `dialog`, `shell` and
`bugReport` carried the same mix. Every one of them is a logical property fed a physical unit - two
different axes bolted together, correct only by the coincidence that they line up in horizontal
writing modes.

An unstated scope invites two opposite mistakes, and the codebase had both. One is reaching for
`width` and `100vw` because no one reads a dashboard vertically, which quietly breaks RTL and
mismeasures the viewport. The other is treating "we use logical properties" as a promise that
`vertical-rl` is a supported mode, which invites open-ended work on a mode no app UI uses: vertical
text in Japanese is a print and literary convention - novels, manga, editorial - and CJK web
applications lay their chrome out horizontally like every other app.

The alternative that gets proposed when the cost feels high is to drop the shared codebase and ship
a build per direction, an RTL app on its own URL. It does not survive contact with what imp is. imp
is a library, so the split does not remove work from imp - it exports it to every app built on imp,
as two bundles, two deploys, redirects and split analytics. Direction is already runtime state here,
because language is: `init` rewrites `dir` whenever the language changes. And direction is not even
constant within one page - a bilingual dashboard, an Arabic UI quoting an English error, and the
platform's `dir="auto"` on user content are all normal, and none of them is expressible as which URL
the user is on. A second build is also a second code path, which `browser-support-baseline.md`
forbids outright.

## Decision

**Every box imp styles is written in logical properties and logical units, and imp guarantees LTR
and RTL. Vertical writing modes are not guaranteed, not tested, and not in scope.**

- **Logical everywhere, with no physical escape hatch in component CSS.** `inline-size` and
  `block-size` over `width` and `height`, `margin-inline-start` over `margin-left`,
  `inset-block-end` over `bottom`, `dvi` and `dvb` over `vw` and `dvh`, `position-area` in logical
  keywords (`block-end`, `inline-start`) so an anchored panel mirrors for free. A logical property
  fed a physical unit is the specific bug this rule exists to stop; the two halves of one clamp must
  name the same axis.
- **LTR and RTL are a tested guarantee.** `flex` and `stack` assert real mirrored geometry under
  `dir="rtl"` in the e2e suite, and `i18n` asserts the derivation that sets the attribute. A
  direction bug in a standard component is a bug.
- **Vertical writing modes get correctness by construction and nothing else.** Logical properties
  mean `vertical-rl` does not break structurally, and that is the whole of the commitment: no
  component is verified in it, no test pins it, and no effort is spent making one correct there. An
  issue that only reproduces in a vertical writing mode is closed as out of scope rather than fixed.
  An app whose chrome must be vertical should not use imp.
- **Direction is runtime state, never a build variant.** One bundle serves every direction. imp
  ships no per-direction build, no direction-specific stylesheet, and no guidance to serve an RTL
  app from its own URL.
- **The fluid theme scale is the one deliberate exception.** `theme.js` sizes its spacing clamps
  with `vw`, which is physical, because those values must also be _static_: a dynamic unit would
  resize every spacing token continuously as a mobile URL bar slides. If the scale is ever made
  logical it becomes `vi`, never `dvi`. Nothing else in the library may cite this exception.

## Consequences

- **RTL costs a naming convention and nothing else** - no branch, no feature flag, no second
  stylesheet, no build matrix, paid once when a declaration is written. That is what makes the
  guarantee affordable, and it is why it is a guarantee rather than a best effort.
- **The rule pays off in plain horizontal LTR**, which is the argument that holds even if no one
  ever runs imp vertically: `100vw` includes the classic scrollbar and `100dvi` does not, so a
  `max-inline-size` clamped in `vw` over-reports the space it is bounding and pushes the page into
  horizontal overflow - the exact thing the clamp was there to prevent. The logical unit is also the
  correctly measured one.
- **The scope line stops work rather than starting it.** Without it, every component invites a pass
  of `vertical-rl` polish that no user asked for; with it, that pass is out of scope by default and
  RTL is what gets the test.
- A **vertical mode inside an app's own content** is unaffected. An app is free to set
  `writing-mode` on prose it renders; what is unguaranteed is imp's chrome around it.
- The guarantee can be widened later at the cost of a test suite, not a rewrite, because the
  declarations are already logical. Promoting vertical writing modes to supported means adding
  coverage and reconsidering the `theme.js` exception - it does not mean touching the components.
