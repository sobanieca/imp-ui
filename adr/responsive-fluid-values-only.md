# Responsive layout: fluid values only, and the app writes any breakpoint it needs

## Context

The library once carried two responsive stops, `mobile` and `desktop`, split at 48rem. Every prop
that affected the layout accepted a `{ mobile, desktop }` object in place of a single value. imp
resolved that object into a ladder of two rungs of CSS custom properties, and each component
consumed the ladder through one static media query. A component also carried a `hideOnMobile`
boolean and a `hideOnDesktop` boolean, which rode the same ladder.

Three things came out of living with that design.

- **Almost nothing used it.** Across every call site in this repository, nobody passed an object per
  stop. A component that really decided by width used a media query of its own instead.
- **Two rungs is still a ladder.** Every declaration of every component paid for a duplicated
  default of a custom property, and for a second rule block inside a media query. imp compiles that
  CSS once per component type, and ships it to every app that imports one component. It paid that
  cost to serve a feature that almost no call site used.
- **The stop was quietly asymmetric, and the documentation was wrong.** The resolution filled
  forward from each named stop. So `{ mobile: 'row' }` also applied at desktop, and
  `{ desktop: 'row' }` left mobile alone. That is the only behaviour that a plain value can have,
  because a plain value was short for `{ mobile: value }`, and it clearly had to apply everywhere.
  But it meant that the documented rule was true in one direction only. That rule said "a stop that
  you leave out keeps the default of the component". A prop whose own documentation cannot state its
  behaviour correctly is a prop that is too clever.

At the same time, the answer of the platform to the continuous part of the problem kept improving.
`clamp()` scales a value smoothly with the viewport. `repeat(auto-fit, minmax(...))` fits as many
columns as a width allows. Neither one needs a breakpoint, and both give a better result than a step
function. There is no jump at an arbitrary width.

## Decision

**Responsiveness is a property of the values. The library has no notion of a screen size. An app
that needs a breakpoint writes it as a media query, in the `styles` of its own component.**

- **Every prop takes exactly one value**, and imp applies it at every width. There is no object per
  stop, and no resolution per stop. A prop becomes one CSS value, written as one custom property on
  the root of the instance, against one default that the shared stylesheet declares.
- **No component hides itself at a width.** To show something on one screen size and not on the
  other, write a media query on the thing that needs it, in the component that owns it.
- **No component changes its structure by width.** The library does not ship a component that must
  leave the flow, or swap the shape of its box, below some width. That decision belongs to the app,
  in CSS that the app can read.
- **The spacing scale of the theme stays fluid.** `space-3` to `space-6`, and `space-page`, are
  `clamp()` values that grow with the viewport. So a gap and a page gutter are already correct at
  every width, and nobody writes a breakpoint. Each one keeps a `rem` term in its preferred value.
  So browser zoom, and a larger default font size, still scale the spacing, which meets WCAG 1.4.4.
- **The width where imp itself splits is the theme token `breakpoint-desktop`, which is `48rem`.**
  It is a value token. So an app can use it anywhere a length goes, and read it from JavaScript, in
  place of a number that the library already has an opinion about. **You cannot use it inside a
  media query**, because CSS does not resolve `var()` there. So a query still needs the literal
  value. The documentation states both facts plainly.

## Consequences

- The generated CSS of every component loses one rung and one media block. There is one default per
  declaration in place of two, and one rule block in place of two.
- The common case does not change, and it still costs nothing. A component with no prop is
  responsive because its values are responsive, and not because it resolved something at mount.
- **An app that needs a structural change by width now writes CSS.** That is more to type than a
  prop was, and it is the deliberate trade. The breakpoint is visible, it is scoped to the component
  that needs it, and anybody who knows CSS can read it, with no knowledge of an imp convention. A
  layout that changes shape at a width really is a CSS problem, and the library stops pretending
  otherwise.
- A structural swap that CSS cannot express is not solved here, and a prop did not solve it either.
  An example is a table that becomes a list of cards. Such a swap needs two components, and a
  decision in JavaScript. The library does not help with that today.
- A token named after a device, such as `breakpoint-desktop`, reads wrongly at the edge. A desktop
  window that a person snaps to half of the screen is below it. The other names were more accurate
  and less recognizable, and recognizability won.
