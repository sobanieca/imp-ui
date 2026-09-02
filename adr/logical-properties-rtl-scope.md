# Every box is logical; LTR and RTL are guaranteed, vertical writing modes are not

## Context

imp already writes logical properties. `translatable-by-default.md` derives `<html dir>` from the
script of the active language, and not from a list that somebody keeps by hand. Nobody stated how
far that reaches, and the omission cost real bugs. `anchored.js` clamped `max-inline-size` against
`100vw`, while it clamped `max-block-size` against `100dvb`, in the same rule. `dialog`, `shell` and
`bugReport` carried the same mixture. Each one is a logical property fed a physical unit. That bolts
two different axes together, and it is correct only because the two happen to line up in a
horizontal writing mode.

A scope that nobody states invites two opposite mistakes, and the codebase had both. The first is to
use `width` and `100vw`, because nobody reads a dashboard vertically. That quietly breaks RTL, and
it measures the viewport wrongly. The second is to read "we use logical properties" as a promise
that `vertical-rl` is a supported mode. That invites work with no end, on a mode that no app UI
uses. Vertical text in Japanese is a convention of print and of literature. It appears in a novel,
in manga, and in editorial writing. A CJK web application lays its chrome out horizontally, like
every other app.

When the cost feels high, somebody proposes to drop the shared codebase, and to ship a build per
direction, with an RTL app on its own URL. That does not survive contact with what imp is. imp is a
library. So the split removes no work from imp. It exports the work to every app that is built on
imp, as two bundles, two deploys, a redirect and split analytics. Direction is already state at
runtime here, because language is. `init` rewrites `dir` whenever the language changes. Direction is
also not constant inside one page. A bilingual dashboard, an Arabic UI that quotes an English error,
and the `dir="auto"` of the platform on content that a user typed, are all normal. None of them can
be expressed as the URL that the user is on. A second build is also a second code path, and
`browser-support-baseline.md` forbids that.

## Decision

**imp writes every box that it styles in logical properties and logical units. imp guarantees LTR
and RTL. imp does not guarantee a vertical writing mode. It does not test one, and one is not in
scope.**

- **Everything is logical, and component CSS has no physical escape hatch.** Write `inline-size` and
  `block-size` in place of `width` and `height`. Write `margin-inline-start` in place of
  `margin-left`. Write `inset-block-end` in place of `bottom`. Write `dvi` and `dvb` in place of
  `vw` and `dvh`. Write `position-area` in logical keywords, such as `block-end` and `inline-start`,
  so that an anchored panel mirrors with no extra work. A logical property that you feed a physical
  unit is the exact bug that this rule exists to stop. The two halves of one clamp must name the
  same axis.
- **LTR and RTL are a tested guarantee.** `flex` and `stack` assert real mirrored geometry under
  `dir="rtl"`, in the e2e suite. `i18n` asserts the derivation that sets the attribute. A bug about
  direction in a standard component is a bug.
- **A vertical writing mode gets correctness by construction, and nothing else.** Logical properties
  mean that `vertical-rl` does not break the structure, and that is the whole commitment. Nobody
  verifies a component in that mode. No test pins it. Nobody spends effort to make a component
  correct there. An issue that reproduces only in a vertical writing mode is closed as out of scope,
  and not fixed. An app whose chrome must be vertical must not use imp.
- **Direction is state at runtime, and never a variant of a build.** One bundle serves every
  direction. imp ships no build per direction, no stylesheet for a direction, and no advice to serve
  an RTL app from its own URL.
- **The fluid scale of the theme is the one deliberate exception.** `theme.js` sizes its spacing
  clamps with `vw`, which is physical, because those values must also be _static_. A dynamic unit
  would resize every spacing token as a URL bar on a phone slides. If somebody ever makes the scale
  logical, it becomes `vi`, and never `dvi`. Nothing else in the library can cite this exception.

## Consequences

- **RTL costs a naming convention, and nothing else.** There is no branch, no feature flag, no
  second stylesheet, and no matrix of builds. You pay the cost once, when you write a declaration.
  That is what makes the guarantee affordable, and it is why it is a guarantee, and not a best
  effort.
- **The rule pays off in plain horizontal LTR.** That is the argument that holds even when nobody
  runs imp vertically. `100vw` includes the classic scrollbar, and `100dvi` does not. So a
  `max-inline-size` that you clamp in `vw` over-reports the space that it bounds. It then pushes the
  page into horizontal overflow, which is exactly what the clamp was there to prevent. The logical
  unit is also the unit that measures correctly.
- **The line of the scope stops work, and does not start it.** Without that line, every component
  invites a pass of polish for `vertical-rl` that no user asked for. With it, such a pass is out of
  scope by default, and RTL gets the test.
- A **vertical mode inside the content of an app** is unaffected. An app can set `writing-mode` on
  the prose that it renders. What imp does not guarantee is its own chrome around that prose.
- Somebody can widen the guarantee later, at the cost of a test suite, and not a rewrite, because
  the declarations are already logical. To promote a vertical writing mode to supported means to add
  coverage, and to reconsider the exception in `theme.js`. It does not mean to touch the components.
