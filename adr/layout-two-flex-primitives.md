# Layout: two flex primitives, `flex` and `stack`, and no third box

## Context

The first layout group was a shared box surface plus `box`, `stack`, `grid`, `page`, `section` and
an app frame of `navbar` / `sidebar` / `footer` regions. It was built, shipped and then removed
outright, and the removal left the group undesigned. What it got wrong is what the redesign has to
avoid:

- **Too many names.** Six components with overlapping jobs, where the difference between a `box`, a
  `section` and a `page` was a convention rather than a behaviour. Every one of them is a name a
  reader - and an agent writing against the library - has to learn and choose between.
- **One prop table across all of them.** Padding, width, min/max width, height, radius, shadow,
  background, border, aspect ratio, grow and scroll rode a shared box surface, so every layout
  component carried the whole surface whether it made sense there or not. That is a component
  library reimplementing CSS through props, and it grows without limit: each new need is a new prop
  on every box.
- **It went past what a layout component can honestly do.** A `display: contents` host means a
  child's real box lives inside its own shadow root, so no parent selector can reach it
  (`shadow-dom-isolation.md`). A component that claims to place its children can only do what the
  container's own properties do.

Meanwhile the two things a page actually does all day - put things in a row, put things in a stack -
are one CSS declaration each, and both work perfectly through a `display: contents` host, because
flex container properties apply to whatever the flex items turn out to be.

## Decision

**The arrangement primitives are `flex` and `stack`, imported from `imp/std/layout`. They are CSS
flexbox with a small, closed prop set, and the library ships no third way to arrange or box up
children.**

- **`flex` is a row** (`flex-direction: row`) taking `horizontalAlign`
  (`left`/`right`/`center`/`justify`), `verticalAlign` (`top`/`bottom`/`center`/`stretch`), `wrap`
  and `gap`. **`stack` is a column** (`flex-direction: column`) taking `horizontalAlign`
  (`left`/`right`/`center`/`stretch`) and `gap`.
- **Alignment props are named after what the user sees**, not after the flexbox axis: a row's
  `horizontalAlign` is its `justify-content` and its `verticalAlign` is its `align-items`, while a
  stack's `horizontalAlign` is its `align-items`. Naming the axes physically is what makes the pair
  learnable without knowing which axis flexbox calls "main". They are deliberately **not** the
  `start`/`center`/`end` spelling that `text` and `heading` use for text alignment: that prop aligns
  glyphs inside a box and follows the text direction, this one places boxes.
- **The names are physical, and stay physical under `dir="rtl"`.** These two components place
  components - buttons, fields, cards - not glyphs, so `left` is the left of the screen whichever
  way the document reads. A row flips to `flex-direction: row-reverse` under `:dir(rtl)`, which
  keeps its children in source order from the left and makes `flex-start` the left edge again; a
  stack swaps its `left` and `right` `align-items` values the same way. `direction` itself is left
  to inherit untouched, so text inside the children still reads right to left.
- **A stack has no vertical alignment**, because a stack is as tall as its children; placing things
  in spare room along an axis is what a row is for.
- **Spacing is `gap` only**, and it is a step `0`-`6` on the theme's spacing scale rather than a
  length, so it stays fluid and themable (`responsive-fluid-values-only.md`). There are no margin
  props, and no standard component carries an outer margin, so a `gap` on the parent is the single
  answer to space between two components.
- **There is no padding, background, width, height, radius, border, grow or scroll prop, and no
  `box` or `grid` component.** A box that needs those is a `div` in the app's own component, styled
  with plain CSS. The library takes the two arrangements every page makes and leaves the rest to the
  language that already does it well.
- **No prop varies by screen size.** A layout that must change shape at a width is a media query the
  app writes in its own component (`responsive-fluid-values-only.md`); `wrap` and the fluid scale
  cover the rest.
- **The group's other exports, `shell` and `dialog`, are not arrangement primitives and do not
  reopen this decision.** `shell` is the app frame - a fixed set of named regions for a whole page,
  taking DOM rather than sorting children into slots the way the removed frame did
  (`app-shell-component.md`). `dialog` is the frame an app opens over its page, promoted into the
  top layer (`overlay-top-layer.md`). Both are frames that hold content rather than components that
  arrange it: neither places anything an app hands it beyond putting it in a box, so the rule above
  still holds inside every one of those boxes.

## Consequences

- The whole arrangement surface is two names and six props, which is small enough to hold in mind
  and small enough for an agent to get right from one skill page.
- **Anything richer than a row or a stack is the app's CSS**, which is more to type than a prop
  table was. That is the trade: a `div` with `padding` and `background` in a component's `styles` is
  readable by anyone who knows CSS, where a `box({ padding: 4, background: 'surface' })` is readable
  by someone who knows imp.
- Nesting is the technique. Every arrangement is rows inside stacks inside rows, at the cost of one
  custom element per level - cheap, since a layout component defines no state and compiles its
  stylesheet once for the whole app.
- **A grid is not available**, so a genuinely two-dimensional layout (a dense form, a dashboard of
  cards) is CSS grid in the app's own component - with the page-level exception that `shell` owns
  the grid an app frame is made of, so nobody hand-writes that one. Whether the library should own a
  grid at all is left open rather than answered badly a second time.
- **An RTL app's layout does not mirror**, which is the deliberate cost of literal names: a toolbar
  written as a row keeps its first child on the left in Arabic as in English, where the usual RTL
  convention would flip it. An app that wants a mirrored arrangement orders the children the other
  way itself, behind the active language. Only the text inside each child mirrors, which the
  platform does on its own.
