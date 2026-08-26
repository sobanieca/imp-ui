# The app frame: regions passed as children and sorted by the frame

## Context

Almost every application draws the same outline - a bar on top, navigation down one or both sides,
something along the bottom, the page in the middle - and imp's standard library has to offer it or
every app rebuilds it. Two things about imp constrain how:

- **A component seals its own DOM** (`shadow-dom-isolation.md`), so a frame cannot reach into a
  region to style it, and a button in one component cannot carry an `aria-controls` pointing at a
  panel in another - id references do not cross a shadow root.
- **The layout group is deliberately small.** It carries a handful of boxes and the frame. Every
  extra layout primitive is a name an agent has to learn and a decision it has to make, so a shape
  that can be expressed with what is already there does not become a component
  (`standard-component-library.md`).

The question was how an app describes the frame's regions, and what happens to a frame with several
side regions on a screen too narrow for any of them.

## Decision

**The frame is `app`, and its regions go in as children rather than props.** `app` reads its direct
children, sorts them by element (`navbar` on top, each `sidebar` down the side it names, `footer` at
the bottom) and treats **everything left over** as the main region:

```js
app(
  { maxWidth: 'lg' },
  navbar({ label: 'Top bar' }, brand()),
  sidebar({ side: 'left', label: 'Sections' }, navMenu({ items })),
  sidebar({ side: 'right', label: 'Activity' }, feed()),
  footer({ label: 'Page footer' }, copyright()),
  pageContent(),
)
```

- **Sorting by element rather than by prop is what makes side regions repeatable.** A props object
  has one `sidebar` key; children have no arity at all, so two sidebars on the left and one on the
  right is the same call shape as none. Sidebars on a side stack in written order, outward from the
  page, and order between unlike regions does not matter. A `side` is read from an attribute the
  `sidebar` factory writes before mount, because `app` builds its DOM before its children mount and
  cannot ask them anything yet.
- **Only direct children are regions.** A `sidebar` inside a `stack` is content, not a region. The
  alternative - searching the subtree - would make an unrelated nested component silently
  restructure the page.
- **`maxWidth` caps the main region, not the frame.** The bars and sidebars stay full-bleed against
  the window while the page settles into a centred column, which is the layout a wide monitor wants;
  capping the whole frame instead would float the navigation away from the edges it belongs to.
- **A sidebar owns its own collapse toggle.** The button and the panel it expands must be rendered
  by the same component for `aria-controls` and `aria-expanded` to resolve, so the toggle cannot
  live in `navbar` where a hamburger button would conventionally go. This is the accessibility
  constraint deciding the component boundary, as `standard-component-library.md` requires.
- **Below `md` every sidebar becomes a drawer, and `app` coordinates them.** A sidebar leaves the
  flow, keeps a tab pinned to its own screen edge - stacked down that edge by an index `app` writes
  onto each one - and slides over the page when opened. `app` listens for a bubbling event from the
  sidebar that opened, closes the others, shows the backdrop, and marks every other region `inert`.
  **One drawer is open at a time, whichever side it came from.** Two panels over a phone screen
  would cover each other; making the frame the arbiter keeps that rule in one place rather than in a
  registry each sidebar consults.
- **The breakpoint is not configurable.** It is the `md` of the shared scale
  (`responsive-fluid-two-stops.md`). A per-sidebar collapse width would let two sidebars on one edge
  disagree about whether they are drawers, and the stacked-tab geometry assumes they agree.
- **`collapsible: false` speaks about the wide screen only.** It says the sidebar is not a column
  that rolls up to a rail, so its toggle is hidden there - but below `md` the sidebar is a drawer
  like every other, and its tab is rendered whatever `collapsible` says. The toggle is therefore
  always in the DOM and CSS decides where it shows, rather than the prop deciding whether it exists:
  a sidebar that opts out of collapsing and then loses its only way to open would put its content
  behind nothing at all on a phone, which no prop should be able to express.
- **A sidebar the reader can drag wider is opt-in, and its range is the same keyword scale as its
  width.** `resizable: true` renders a splitter down the edge facing the page, and `minWidth` and
  `maxWidth` bound the drag with keywords from the theme's sidebar scale rather than lengths. Two
  reasons for keywords: a length would be the one place in the layout group where an app writes CSS
  values instead of theme steps, and it would let an app pick a range its theme cannot express.
  Bounding in CSS (`min-inline-size` / `max-inline-size`) rather than only in the drag handler is
  what keeps a `width` outside the range, an unusually narrow window and a dragged width all
  agreeing on one answer.
- **The splitter is written by hand because the platform has no such control.** It is the case
  `browser-support-baseline.md` allows: `resize: horizontal` is the nearest primitive and it cannot
  do the job - its grip is a corner, it only grows toward the block-end inline-end corner so it
  cannot sit on a right-hand sidebar's inner edge, it is not reachable by keyboard, and it is not
  usable by touch. What imp does write is thin, and every part of it that the platform does own is
  delegated: pointer capture makes mouse, touch and pen one code path, `touch-action: none` stops
  the browser panning instead of dragging, and a `ResizeObserver` is what keeps `aria-valuenow`
  honest rather than a size the component believes it has.

## Consequences

- Adding a region is adding a child, and removing one is deleting a line. An app that wants no
  navigation writes `app(pageContent())`; one that wants three sidebars writes three.
- The frame renders the landmarks - `banner`, `complementary`, `main`, `contentinfo` - so an app
  gets the landmark structure a screen reader navigates by without naming a single role, and a
  `sidebar` warns when it has no `label` because two unnamed `complementary` landmarks are
  indistinguishable.
- A frame with several sidebars needs no responsive work from the app author, and no app-authored
  breakpoint can disagree with the one the drawer behaviour uses.
- A resizable sidebar is resizable by keyboard too, because the splitter is a focusable `separator`
  with the arrow keys, `Home` and `End` bound - a drag handle that only a pointer can move would
  fail the baseline every standard component is held to.
- A width the reader drags to lives for the life of the page and no longer. Remembering it across
  visits would mean imp choosing a storage key and an eviction rule on the app's behalf, so it stays
  out until an app asks for it.
- `footer` collides by name with the `footer` element factory from `imp/html`. Both are documented,
  and a file wanting both aliases one; the frame keeps the obvious name because it is the one an
  agent reaches for.
- The frame is `100dvh` and only its main region scrolls, so `app` is the outermost thing a page
  renders. Nesting one inside a scrolling document is not supported and is called out in the docs.
- Sorting children by element name means `app` knows the three region tags by string rather than by
  import, which keeps `app` free of imports of `navbar`, `sidebar` and `footer` and therefore keeps
  an app that uses none of them from bundling them (`tree-shakeable-library.md`).
