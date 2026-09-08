# Layout: two flex primitives, `flex` and `stack`, and no third box

## Context

The first layout group was a shared box surface, with `box`, `stack`, `grid`, `page` and `section`,
and an app frame of `navbar`, `sidebar` and `footer` regions. imp built it, shipped it, and then
removed it completely. That removal left the group with no design. The redesign must avoid what the
first version got wrong:

- **There were too many names.** Six components had overlapping jobs. The difference between a
  `box`, a `section` and a `page` was a convention, and not a behaviour. Each one is a name that a
  reader, and an agent that writes against the library, must learn and choose between.
- **One prop table covered all of them.** Padding, width, minimum and maximum width, height, radius,
  shadow, background, border, aspect ratio, grow and scroll all rode on a shared box surface. So
  every layout component carried the whole surface, whether or not it made sense there. That is a
  component library that implements CSS again, through props, and it grows without a limit. Each new
  need is a new prop on every box.
- **It went past what a layout component can honestly do.** A host with `display: contents` means
  that the real box of a child lives inside its own shadow root. So no selector from a parent can
  reach it, see `shadow-dom-isolation.md`. A component that claims to place its children can only do
  what the properties of the container do.

At the same time, the two things that a page does all day are one CSS declaration each. Those are to
put things in a row, and to put things in a stack. Both work perfectly through a host with
`display: contents`, because the properties of a flex container apply to whatever the flex items
turn out to be.

The redesign must also settle the direction. The rest of the library is written in CSS logical
properties, and it mirrors under `dir="rtl"` on its own, see `standard-component-library.md` and
`translatable-by-default.md`. So a layout pair that did not mirror would be the one part of an imp
app that stayed left to right, while everything inside it turned around.

## Decision

**The arrangement primitives are `flex` and `stack`, imported from `imp/std/layout`. They are CSS
flexbox with a small, closed set of props. The library ships no third way to arrange children, and
no third way to put them in a box.**

- **`flex` is a row**, with `flex-direction: row`. It takes `horizontalAlign`, which is `start`,
  `end`, `center` or `justify`, `verticalAlign`, which is `top`, `bottom`, `center` or `stretch`,
  `wrap` and `gap`. **`stack` is a column**, with `flex-direction: column`. It takes
  `horizontalAlign`, which is `start`, `end`, `center` or `stretch`, and `gap`.
- **A prop name is the axis that the user sees**, and not the axis of flexbox. The `horizontalAlign`
  of a row is its `justify-content`, and its `verticalAlign` is its `align-items`. The
  `horizontalAlign` of a stack is its `align-items`. To name the axes by what they look like is what
  makes the pair learnable, with no knowledge of which axis flexbox calls the main axis.
- **Along the horizontal axis, the values are `start` and `end`, and they follow the reading
  direction.** That is the same spelling that `text` and `heading` use for the alignment of text,
  and it means the same thing. It is the edge where the language starts. `start` is the left edge
  under `dir="ltr"`, and the right edge under `dir="rtl"`. Neither component writes a rule about
  direction. The plain `flex-start` and `flex-end` values already resolve against the inherited
  `direction`. So a row lays its children out from the right, and a stack aligns to the right, the
  moment when the document reads from right to left. `left` and `right` are not accepted values. imp
  warns about one, and falls back, as it does for any other value outside the list.
- **`verticalAlign` keeps `top` and `bottom`.** The direction mirrors the inline axis only. So a
  logical spelling there would be jargon with no behaviour behind it.
- **A stack has no vertical alignment**, because a stack is as tall as its children. To place things
  in spare room along an axis is what a row is for.
- **Spacing is `gap` only.** It is a step from `0` to `6` on the spacing scale of the theme, and not
  a length. So it stays fluid and themable, see `responsive-fluid-values-only.md`. There is no
  margin prop, and no standard component carries an outer margin. So a `gap` on the parent is the
  one answer to the space between two components.
- **There is no padding, background, width, height, radius, border, grow or scroll prop, and there
  is no `box` and no `grid` component.** A box that needs those is a `div`, inside the component of
  the app, styled with plain CSS. The library takes the two arrangements that every page makes, and
  it leaves the rest to the language that already does that well.
- **No prop varies by the size of the screen.** A layout that must change shape at a width is a
  media query that the app writes in its own component, see `responsive-fluid-values-only.md`.
  `wrap` and the fluid scale cover the rest.
- **The other exports of the group, `shell`, `dialog` and `drawer`, are not arrangement primitives,
  and they do not open this decision again.** `shell` is the app frame. It is a fixed set of named
  regions for a whole page, and it takes DOM. It does not sort children into a slot, as the removed
  frame did, see `app-shell-component.md`. `dialog` and `drawer` are the frames that an app opens
  over its page, promoted into the top layer, see `overlay-top-layer.md`. All three are frames that
  hold content. None of them is a component that arranges content. Neither one places anything that
  an app hands it, beyond a box. So the rule above still holds inside every one of those boxes.

## Consequences

- The whole arrangement surface is two names and six props. That is small enough to keep in mind,
  and small enough for an agent to get right from one skill page.
- **Anything richer than a row or a stack is the CSS of the app**, and that is more to type than a
  prop table was. That is the trade. A `div` with a `padding` and a `background`, in the `styles` of
  a component, is readable by anybody who knows CSS. A `box({ padding: 4, background: 'surface' })`
  is readable by somebody who knows imp.
- Nesting is the technique. Every arrangement is a row inside a stack inside a row. The cost is one
  custom element per level. That is cheap, because a layout component defines no state, and compiles
  its stylesheet once for the whole app.
- **There is no grid.** So a layout that is genuinely two-dimensional is CSS grid, in the component
  of the app. A dense form, and a dashboard of cards, are the examples. There is one exception at
  page level. `shell` owns the grid that an app frame is made of, so nobody writes that grid by
  hand. Whether the library must own a grid at all stays open. imp does not answer that badly a
  second time.
- **The layout of an RTL app mirrors on its own, and it costs nothing to write.** A toolbar that you
  build as a row with `horizontalAlign: 'justify'`, and the buttons of a form that you push to
  `'end'`, are correct in Arabic and in English, from the same call. There is no `dir.get()` branch,
  and there is no reversed child list. That is the same behaviour that the styling of the
  components, in logical properties, gives them. So an app mirrors as a whole, and not in parts. It
  is also the direction in which the library steers the author of an app.
- **An arrangement that truly must not mirror is the CSS of the app**, like anything outside the two
  primitives. That is rare, and the transport controls of a media player are the usual example. To
  pay for it in a `div`, with `flex-direction: row` and a physical `justify-content`, is the correct
  way round. The common case is the one that must be free.
