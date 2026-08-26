# Responsive layout: fluid values first, then two stops - mobile and desktop

## Context

The layout group carried a five-stop responsive scale - `xs`, `sm`, `md`, `lg`, `xl` at 0, 40rem,
48rem, 64rem and 80rem - and every layout-affecting prop accepted a per-breakpoint object resolved
into a ladder of CSS custom properties. Three things came out of using it.

- **The ladder was almost never used.** The example app in this repo is the only whole application
  built on the library, and across 37 layout calls it passed **no** per-breakpoint object at all.
  The one component that does make a decision by width, `sidebar`, uses exactly one breakpoint. The
  library shipped a five-mode API to serve what was in practice a two-mode need.
- **The ladder was not cheap.** Fifteen declarations times five stops meant 75 custom-property
  defaults and five rule blocks per layout component - 4,942 bytes of generated CSS for the plain
  box, compiled once per component type but paid for by every app that imports one.
- **`sm` at 40rem and `md` at 48rem are 128px apart.** They were not two device classes. Naming five
  stops forced an agent to choose between rungs that did not correspond to anything.

Meanwhile the platform had grown a better answer for the continuous part of the problem. `clamp()`
scales a value smoothly with the viewport, and `repeat(auto-fit, minmax(...))` fits as many columns
as a width allows. Neither needs a breakpoint, and both give a better result than a step function
does: no jump at an arbitrary width.

The two constraints that shaped the old mechanism still hold. **A component's `styles` string is
compiled once and shared** by every instance (`shadow-dom-isolation.md`), so a per-call value cannot
be generated there. **Media queries cannot read CSS custom properties**, so the breakpoint widths
themselves cannot be theme tokens.

## Decision

**Responsiveness is a property of the values first, and only then of the layout.**

- **The theme's spacing scale is fluid.** `space-3` through `space-6` and `space-page` are `clamp()`
  values that grow with the viewport, so a `gap: 4` or a page gutter is already correct at every
  width with no breakpoint written anywhere. Each keeps a `rem` term in its preferred value, so
  browser zoom and a larger default font size still scale spacing (WCAG 1.4.4). This is a theme
  value, not library machinery: an app that wants fixed spacing sets plain lengths and nothing in
  the library changes.
- **`grid` fits as many columns as the width allows by default**, through `minItemWidth` (16rem
  unless given). `columns` remains for the rarer case where the count must be exact.
- **`stack` wraps by default**, so a line of controls that runs out of room continues on the next
  line rather than overflowing or needing a stop.
- **There are exactly two stops, `mobile` and `desktop`, split at 48rem.** 48rem is where `sidebar`
  already switched from a rail to a drawer, so the frame and the boxes now agree on one number.
  Every layout prop takes one value or `{ mobile, desktop }`, told apart by type
  (`type-based-argument-dispatch.md`); a stop that is not named keeps the component's own default
  rather than inheriting a neighbour. A plain value is shorthand for `{ mobile: value }`.
- **The names are `mobile` and `desktop`, and they mean widths.** They name devices, which is not
  literally what is measured - a desktop window snapped to half-screen is `mobile` here - but they
  are the two words every developer already has for the distinction, and the docs say plainly that
  `mobile` means under 48rem whatever the hardware is.
- **The width is fixed, not themeable**, forced by the media-query limitation above. With fluid
  values doing the continuous work, one stop is enough that this costs little.
- **Resolution stays a ladder of CSS custom properties written per instance**, unchanged in
  mechanism and now two rungs instead of five: the shared stylesheet declares each component's
  default for both rungs and consumes them through one static media query, and the component writes
  only the rungs it was given as inline custom properties on its own root. Declaring the defaults on
  each root is what stops an inherited ladder reaching a nested box through the shadow boundary.
- **Visibility is two booleans, not a range.** `hideOnMobile` and `hideOnDesktop` resolve into the
  same `display` ladder every component already carries. Two stops make a range meaningless, so the
  four-value `hideBelow` / `hideAbove` pair collapses to a flag each, with nothing left to validate
  beyond the type.

## Consequences

- Generated CSS for the shared box surface drops from 4,942 bytes to 2,230 - 55% - and from four
  media blocks to one, per layout component.
- The common case costs nothing at all: a `stack` or a `page` with no props is responsive because
  its values are, not because it resolved anything at mount.
- Breakpoint widths remain a fixed part of the library rather than a theme's choice. An app that
  needs a different split writes its own media query in a component's `styles`.
- Fluid spacing is expressed entirely in theme tokens, so it is inspectable, overridable, and
  requires no library support. The library's only commitment is to keep consuming tokens rather than
  hardcoding lengths.
- Naming the stops after devices will occasionally read wrong - a phone in landscape gets the
  `mobile` layout at 844px wide only if it is under 48rem, which it is not. The docs carry the
  correction; the alternative names (`narrow`/`wide`) were more accurate and less recognisable, and
  recognisability won.
- Structural swaps CSS cannot express - a table becoming cards - are still not solved here. They
  need a readable, watchable breakpoint value, which lands with the first component that needs one.
