# Responsive layout: fluid values only, and the app writes any breakpoint it needs

## Context

The layout group carried two responsive stops, `mobile` and `desktop`, split at 48rem. Every
layout-affecting prop accepted `{ mobile, desktop }` in place of a single value, resolved into a
two-rung ladder of CSS custom properties consumed through one static media query per component, and
every layout component carried `hideOnMobile` / `hideOnDesktop` booleans riding the same ladder.

Three things came out of living with it.

- **Almost nothing used it.** The example app in this repo is the only whole application built on
  the library, and across its layout calls it passed no per-stop object at all. The one component
  that genuinely decides by width, `sidebar`, uses its own media query.
- **Two rungs is still a ladder.** Every declaration of every layout component paid for a duplicated
  custom-property default and a second rule block inside a media query, in CSS compiled once per
  component type but shipped to every app that imports one - to serve a feature almost no call site
  used.
- **The stop was quietly asymmetric, and the docs got it wrong.** Resolution filled forward from
  each named stop, so `{ mobile: 'row' }` also applied at desktop while `{ desktop: 'row' }` left
  mobile alone. That is the only behaviour a plain value can have, since a plain value was shorthand
  for `{ mobile: value }` and obviously had to apply everywhere - but it meant the documented rule,
  "a stop you leave out keeps the component's own default", was true in one direction only. A prop
  whose own docs could not state its behaviour correctly is a prop that is too clever.

Meanwhile the platform's answer to the continuous part of the problem kept getting better. `clamp()`
scales a value smoothly with the viewport, and `repeat(auto-fit, minmax(...))` fits as many columns
as a width allows. Neither needs a breakpoint, and both give a better result than a step function
does: no jump at an arbitrary width.

## Decision

**Responsiveness is a property of the values. The library has no notion of a screen size, and an app
that needs a breakpoint writes it as a media query in its own component's `styles`.**

- **Every layout prop takes exactly one value**, applied at every width. There is no per-stop object
  and no per-stop resolution: a prop converts to one CSS value written as one custom property on the
  instance's root, against one default declared in the shared stylesheet.
- **No component hides itself at a width.** Showing something on one screen size and not the other
  is a media query on the thing that needs it, in the component that owns it.
- **The theme's spacing scale stays fluid.** `space-3` through `space-6` and `space-page` are
  `clamp()` values that grow with the viewport, so a `gap: 4` or a page gutter is already correct at
  every width with no breakpoint written anywhere. Each keeps a `rem` term in its preferred value,
  so browser zoom and a larger default font size still scale spacing (WCAG 1.4.4).
- **`grid` fits as many columns as the width allows by default**, through `minItemWidth` (16rem
  unless given). `columns` remains for the rarer case where the count must be exact.
- **`stack` wraps by default**, so a line of controls that runs out of room continues on the next
  line rather than overflowing.
- **The width imp itself splits at is the theme token `breakpoint-desktop`, `48rem`.** It is a value
  token, so an app can reuse it wherever a length goes and read it from JavaScript rather than
  repeating a number the library already has an opinion about. **It cannot be used inside a media
  query** - CSS does not resolve `var()` there - so a query still needs the literal, and the token
  does not move the drawer width compiled into `sidebar`. The docs say both plainly.
- **`sidebar` keeps its own media query at that width**, unchanged: below it a sidebar leaves the
  flow and becomes a drawer. It is the one component whose job is a structural change by width, and
  it owns that decision rather than exposing it.

## Consequences

- Every layout component's generated CSS loses a rung and a media block: one default per declaration
  instead of two, one rule block instead of two.
- The common case is unchanged and still costs nothing: a `stack` or a `page` with no props is
  responsive because its values are, not because it resolved anything at mount.
- **An app that needs a structural change by width now writes CSS.** That is more to type than a
  prop was, and it is the deliberate trade: the breakpoint is visible, scoped to the component that
  needs it, and readable by anyone who knows CSS without knowing an imp convention. A layout that
  changes shape at a width is genuinely a CSS problem, and the library stops pretending otherwise.
- Structural swaps CSS cannot express - a table becoming a list of cards - are not solved here and
  are not solved by a prop either. They need two components and a decision made in JavaScript, which
  the library does not currently help with.
- Naming a token after a device (`breakpoint-desktop`) reads wrong at the edges: a desktop window
  snapped to half-screen is below it. The alternative names were more accurate and less
  recognisable, and recognisability won.
