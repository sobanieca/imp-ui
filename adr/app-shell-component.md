# The app shell is one component, one nav tree, and the only breakpoint imp writes

## Context

The layout group is `flex` and `stack`, and nothing else, see `layout-two-flex-primitives.md`. That
is correct for the arrangement of things inside a page, and it says nothing about the shape of a
whole page. Every app still needs the same frame. That frame holds a brand block, a nav at the top
level, a nav column for what sits under it, a content area, and a place for the signed-in person.
With no component for that frame, every app assembles a CSS grid by hand. It then gets the scroll
containers, and the treatment on a phone, slightly wrong, and it lands somewhere different from the
app beside it.

One part is not worth reviving. That is to sort the children of an app into a slot, by the shape of
an argument. It hides where things go. It also makes the regions of the frame a function of what
somebody passed, in place of a decision that the component owns.

Four more constraints came from the rest of the library. A child with `:host { display: contents }`
puts its real box inside its own shadow root. So a selector from a parent cannot reach it. A frame
must therefore render the box that each region sits in. `responsive-fluid-values-only.md` says that
no component changes its structure by width. And yet a phone cannot show a sidebar, a top bar and a
row of pickers at the same time. imp writes no focus trap, see `browser-support-baseline.md`. So a
drawer must be a real `<dialog>`. And a frame that only moves opaque DOM cannot turn a control for a
wide screen into a control for a narrow one.

## Decision

**`shell` is the app frame. It has one nav tree that drives three surfaces and the trail. It places
the chrome itself. The main content is its children. It holds the one breakpoint that imp
approves.**

- **There is one nav tree, and three surfaces.** The application map is the tree, see
  `application-map.md`. `shell({ map })` takes it, the same as `router({ map, screens })`. The
  router derives the sections, the rows of the current context, the selected ids, the label of the
  context and the crumbs, and the shell reads them as two plain-data states that the map owns.
  **You declare nothing twice.** So a change to the map lands on every surface at once, and no app
  keeps two arrays in step from the route, by hand. The map is the only input of the nav. A shell
  with no map draws no nav, because a second form of input would be a second tree to keep in step.
- **The depth of a node decides its surface.** The top-level nodes are the sections of the bar. A
  root that a screen binds is the first section. The children of the current section are the rows
  of the sidebar. The bottom bar of a phone lists the
  same rows. So the arrangement is a fact of the tree, and the app writes no layout for it.
- **The settings of a node bind in one table, `nav`, keyed by handle.** An entry takes `icon`,
  `tag`, `group` and `hidden`. The map says what a feature is, and `nav` says how the frame shows it.
  One table per node keeps every setting of a node in one place. Four tables keyed by handle would
  spread one node over four places. `hidden: true` keeps a node off the bar and the sidebar, and the
  route stays. Its page then marks the nearest shown row above it.
- **A group heading is a node of the map.** `group: true` makes a sidebar node a heading over its
  children, and the heading is not a link. Its text is the label of the node, so the message
  `appMap.<id>.label` translates it, the same as every row, section and crumb. A heading that is a
  node needs no second word for "group" and no list of handles. **The bar has no groups**, because a
  row of sections has no room for a heading. imp warns about `group: true` on a node of the bar and
  ignores it.
- **`navbar: false` removes the bar, and nothing else does.** The sections are then the rows of the
  sidebar, with their children under them. The logo and the extras move to the column. No
  rule hides the bar on its own, because a layout that changes when the map grows a second section
  surprises the app. `navbar: { hidden: true, background }` is the same as `false`, but keeps a
  backdrop on the top bar of a phone, which `imp preview` paints with the brand bars. There is one
  component, with two arrangements. There is no second component for the frame, and there is no
  `layout` enum. imp considered two components, and rejected them. The fold, the drawer and the
  bottom bar are most of the code, and somebody would duplicate all of it to vary one axis.
- **A section with no children renders no sidebar**, and the content takes the full width. The
  frame does not imitate a column that holds one row. The change of layout is the signal that the
  context changed.
- **The sidebar carries one app-wide slot, and it is not per section.** That is `sidebar.extras`,
  which is DOM. It stays whichever section is current. A help link, a support card and an upgrade
  prompt belong to the app, and a person expects them in one place. An external link goes there
  too, because it is not a node of the map. It is the one thing that keeps the column on the screen
  in a section with no children. A column that shows app-wide content is not the false column above.
  `extras` sits below the rows. The icon rail hides it, because arbitrary DOM has no form as an icon.
  On a phone it folds into the drawer. imp merges the `extras` of the sidebar with the `extras` of
  the shell. So the drawer is the one place that holds everything that is not the current section.
  `sidebar` takes `label`, `extras` and `background`, and nothing else.
- **A region takes DOM. A role that the frame must present again takes data.** `logo` and `extras`
  are any DOM. The shell wraps it, sizes it, places it, moves it and scrolls it, and it does not
  look inside. The nav is **data**. The shell renders it more than once, and it cannot make a second
  presentation out of DOM that somebody handed it. The row of the bar is also a column of the
  drawer. The column of the sidebar is also a bottom bar with a capped length. **That is the line.
  To place or to move DOM is free. To make a second presentation of it is not.**
- **The DOM of a region lands inside the shadow root of the shell, and page CSS does not reach it,
  by design.** imp appends `logo`, `extras`, the `extras` of the sidebar, and the main content, into
  the tree of the frame. So a rule in the stylesheet of the app never styles them. Only an inherited
  property, and an `--imp-*` custom property, cross the boundary, see `shadow-dom-isolation.md`.
  That is the intended contract, and not a cost to hide. What goes into a region is an imp
  component. That is `appLogo`, `themeSelect`, `userCard`, or a `component()` of the app. A
  component carries its styles in its own shadow root. So it looks the same in the bar, in the
  column and in the drawer, and the frame and the page know nothing about it. Raw DOM in a region
  gets an inline style, or nothing. The fix for a region that needs styling is to make it a
  component. The fix is never to open the tree of the shell to page CSS.
- **The nav data is plain rows, and not a menu component.** A row is
  `{ id, label, href, icon, tag }`, with `children` for one level of nesting. The map derives rows of
  that shape, with the pattern of the node as the `id`, and `nav` binds an icon and a tag per id.
  Every row is a link, because every node of the map has a page. imp ships no separate menu of
  destinations. The frame is where the destinations of an app live, and one renderer of a row serves
  every presentation of them.
- **A tag is a state name, or a fixed `{ text, color, title }`.** A state name matches the
  `states` of a router guard. The root component of the app initializes the state, and a screen
  writes it later, so the pill stays live. `text` is short, so it fits a row and the bottom bar.
  `title` is the full form of it. The tag carries it as a native `title`, for a pointer. The row
  points `aria-describedby` at a hidden copy of it in the same shadow root, so a screen reader reads
  it after the name, and the name stays the visible label. A `title` attribute on the tag alone
  would reach no screen reader, because the name of a link comes from the text of its content.
- **The shell owns where the chrome sits, and that depends on the bar.** With the bar, the logo
  heads the bar, and `extras` sit at its end. With `navbar: false`, the logo heads the column, the
  chrome sits at its foot, and imp renders no bar on a desktop.
- **Below `48rem` the frame folds into a phone app.** The top bar becomes a hamburger and a two-line
  title, with the section over the current row, or the last two crumbs when a map is present. On a
  phone, the frame must say where you are, and a brand block does not. The **sidebar becomes the
  bottom bar**. Those are the destinations inside the section that you are already in. So they are
  the ones that are worth a thumb. imp caps the bottom bar at `--imp-shell-bottom-bar-items` rows,
  plus a **More** button, which opens a sheet with the rest. The sheet is one column, anchored above
  the row that was tapped, like a menu that opens upward. So the bar stays in view, the thumb stays
  where it tapped, and the rest of the screen stays readable. The groups flatten there, because a
  bottom bar is a row of destinations, and not an outline. A parent row with `children` sits in the
  bottom bar like any row. A tap on it there opens its children in that same sheet, under the label
  of the parent. The one level of nesting that a phone gets is a sheet, and not an outline either.
  On a desktop, the parent of the selected row starts expanded. So the row that is current is never
  hidden behind a collapsed caret. The **sections and both sets of `extras` move into the hamburger
  drawer**. **When the current section has no sidebar, the bottom bar carries the
  sections instead**, and the drawer then holds the chrome only. A row is one node, and it lives in
  one place at a time.
- **The length of the bottom bar is a custom property, and not a prop.**
  `--imp-shell-bottom-bar-items` defaults to `4`, and imp clamps it between 3 and 5. imp reads it
  from the computed style of the shell. So a page tunes it in CSS, beside the two properties for a
  width, and the frame grows no knob.
- **The sidebar collapses to an icon rail**, from a toggle in its head. That head also names the
  current section. The collapse is state of the shell, with no prop and no event. It is a preference
  about the view of the frame, and not something that an app routes on. **The toggle exists only
  when every row can survive the rail.** Each row of the current section must carry an `icon`. A rail of empty rows shows nothing. So a column with one row that has no icon
  keeps its width, and offers no toggle. A change of section that lands on such a column expands the
  rail again. The rail keeps the icons of the rows, and hides everything else. It hides the logo, the name of the context, the `extras` of the sidebar, and the
  `extras` of the shell, at the foot of the column. Arbitrary DOM has no form as an icon, and a rail
  is a strip of icons, or it is not a rail. **imp deliberately does not build a drag to resize.** A
  width is a custom property. A splitter that a pointer drives is a component of its own, if
  somebody ever wants one.
- **The frame knows nothing about the session. Its layout follows the route.** The sign-in page is a
  node of the map, and the guard of the root redirects a visitor with no session to it, see
  `route-guards.md`. `signIn` names that node. On it and on its children, the frame shows the main
  content and the `logo` in the middle of the screen, and nothing else: no bar, no column, no
  drawer, no `extras`. The frame does the same while the verdict of the current node is `wait`,
  because the app does not know yet who may see the page, and the main content is the loading
  content of the router. A redirect verdict keeps the layout, so the move from the loading content
  to the sign-in page never paints the chrome. The router stays mounted in both layouts, so the
  sign-in page is an ordinary page for the nav, the title and analytics. A session flag on the frame
  would hide the sign-in page from the router: it would have no URL, no page view in analytics, and
  no return path for a deep link. The frame holds no account prop, it renders no form, and it talks
  to no identity provider. The sign-in page is the app's, because it differs with every app: a
  password form, social buttons, a magic link, a passkey, or the return URL of an external identity
  provider under the sign-in node. `userCard` in `extras` displays the person, and the sign-out
  action is a button or a `menuButton` of the app beside it.
- **The shell owns the drawer, and the drawer is a `<dialog>`.** The top layer, `inert` on the rest
  of the page, the entry of the focus, the restore of the focus, and Escape, all belong to the
  platform. The shell adds a dismissal from the backdrop. It closes itself when the viewport crosses
  back to a desktop width. It closes when a person chooses a row inside it. It is as tall as its
  content, up to the height of the frame, and its nav scrolls when the rows do not fit. A drawer
  that holds only the logo and the extras would otherwise be a full-height panel that is mostly
  empty. `navOpen` belongs to the shell by default, and a writable state overrides it. `navToggle`
  reports every change that the shell makes itself. **The drawer is the first consumer of the
  overlay seam**, see `overlay-top-layer.md`. So the dismissal from the backdrop, the hold on the
  page scroll, and the motion, are shared code, and not code of the shell. **The More sheet is a
  plain `popover`**, with a `popovertarget` invoker. So its light dismissal, its Escape, and its
  focus order, belong to the platform. It is in the top layer. So it sits at the foot of the
  viewport, and not at the foot of an embedded frame. That is the positioning of the platform, and
  the shell does not fight it.
- **imp builds every row once, and afterwards it only moves that row.** imp builds the sidebar of
  each section when the derived nav or a tag changes. So a change of section, a crossing of the
  breakpoint, and an expansion of a parent row, all reparent an existing node, or unhide one. This
  is not an optimization. A listener on a media query, and a click handler, run **outside a mount
  scope**. There, to rebuild a row that binds a state would throw, see `state-plain-data-values.md`.
  `component-moves-rebind.md` keeps what a row holds working, across the move.
- **This is the one component that changes its structure by width.** Its query lives in its own
  `styles`, against the literal `48rem`. It shares that literal with the `matchMedia` query, from
  one constant, because CSS cannot resolve `--imp-breakpoint-desktop` inside a media query. A
  container query would also fold an embedded frame correctly. imp considered that, and did not take
  it. It would replace the one documented breakpoint with a rule per instance, and a
  `ResizeObserver`, for a case that only the preview stage of imp has, which is a shell inside a
  narrow panel. The consequence is accepted below.
- **The shell renders the landmarks, and that includes the `<nav>` landmarks.** It renders
  `<header>` and `<main>`. It is `100dvb` tall on its own host. It scrolls each region on its own.
  It names each level of the nav from the `label` of that level, and falls back to a translated
  default.
- **There is no aside region, because a region of the frame must work on a phone.** The frame of imp
  exists so that one call makes an app suit a desktop and a phone at the same time, and nobody
  designs anything twice. Every region that the shell owns has a form for a phone. The bar folds
  into the drawer. The sidebar becomes the bottom bar. The extras move into the drawer. A contextual
  side column has no such form. It is an idea from the desktop. On a phone there is no room beside
  the content. There are two honest answers, and both are wrong here. To hide the column means that
  the frame drops content that the app put there, with no message. To stack it under the page is not
  a decision for a frame to make. A region with no form for a phone would make the frame encourage a
  layout that breaks at the fold, and that is the opposite of its purpose. So the shell offers no
  such region. What would live there has two homes, and both belong to the app:
  - **Content that comes and goes is a `drawer`**, see `overlay-top-layer.md`. That covers filters,
    an inspector and a detail view. Mount the drawer in the main content, and open it from a control
    there. It is an overlay in the top layer. It slides in over the frame, from the inline end, and
    it is the same panel on a phone.
  - **Content that must stand beside the page is a layout that the app writes, inside the main
    content.** That is a `flex` of the page and its side column, and a media query of the app
    decides when the column wraps below the page, see `responsive-fluid-values-only.md`. The
    `<main>` of the shell is a plain scrolling box. So a page with two columns inside it is ordinary
    CSS. The app knows what the column holds. So the app chooses what happens to it on a phone.
- **The phone drawer of the shell is not the `drawer` component.** Its hamburger names the drawer
  with `aria-controls`, and that reference cannot cross a shadow root, see
  `shadow-dom-isolation.md`. So the two must share one root.
- **The trail is chrome of the frame, and the rest of the furniture of a page is not.** The trail is
  data derived from the same tree as the nav, and it has a phone form, which is the two-line title
  of the folded bar. So the shell renders `breadcrumbs` above the main content when a map is
  present, and `breadcrumbs: false` turns the strip off. The strip shows only when the trail has two
  or more crumbs. A top-level page has one crumb, which repeats the nav row, so the strip hides
  there and the content takes its place. There is no `header` region, and there is no `footer`. A
  page title and a toolbar of actions go at the top of the main content. They change with the
  screen, and the frame does not.
- **`gap` is the one knob for a frame that floats, and it carries the radius with it.** Step `0` is
  the edge-to-edge frame, with hairline dividers. Any other step, on the shared spacing scale,
  insets the frame. It pulls the bar, the column and the bottom bar apart, into bordered panels,
  rounded with `radius-container`. imp ties the radius to the gap, in place of offering it on its
  own, because a rounded corner against the edge of a screen looks broken. So the radius of a theme
  reaches the frame only when there is room for it, and a theme with `radius: none` floats square
  panels. imp writes the gap as a margin on each panel, and not as a grid `gap`. So a region that
  imp does not render leaves no gap behind. The content is deliberately not a panel. It sits on the
  background. So a person sees a moving backdrop, in place of glimpsing it between two cards, and a
  page that wants a card draws one. The phone drawer floats with the panels. It is inset by the gap,
  bordered and rounded. A gapped frame also publishes `--imp-shell-frame-gap` and
  `--imp-shell-frame-radius`. Those are inherited custom properties. A `drawer` that somebody mounts
  anywhere inside reads them, and floats in the same way. So the one contextual panel lines up with
  the frame that it opens over, and the shell does not know that it exists.
- **`maxWidth` caps the frame, and it is `125rem` by default.** A line that runs across a very wide
  screen is hard to read, and a column at its far edge is far from the content. So the column and
  the content together never get wider than `maxWidth`, and beyond it they sit in the middle of the
  screen. The grid does the centring. Its two outer tracks are `minmax(gap, 1fr)`, so they share
  what the capped tracks leave, and nothing measures the screen. The background keeps painting from
  edge to edge, because it is the grid, not the tracks. The top bar spans every track and lays its
  controls out in a subgrid over the capped ones. So its surface and its divider stay edge to edge,
  and the controls line up with the content. With a `gap` the bar is a bordered panel, and a panel
  against the edge of the screen is the corner case that `gap` exists to avoid. So a gapped bar is
  capped like the column. The frame publishes the end-edge margin as `--imp-shell-frame-inset`, and
  a `drawer` in the content opens at the end edge of the content. The inset is a percentage of the
  screen, because the drawer is in the top layer and has no other box to measure. `'none'` lifts the
  cap for a dashboard that wants every pixel.
- **The background is a theme token first, and a DOM node second.** The frame paints
  `background-app`, which is the one token that is a CSS `background`, and not a colour. A gradient
  in a theme is the common case, and it needs no prop. Every chrome panel paints
  `color-surface-sunken` over it. So the bar stays readable on any backdrop. `background` takes one
  DOM node, for what CSS cannot draw, such as shapes that drift on a timer, or a canvas. imp
  stretches that node to the frame. It paints it under the panels, from inside the stacking context
  of the shell. It hides the node from assistive technology, as decoration.
- **The recommendation is part of the decision.** The documentation and the skills say to use
  `shell` first, and to customize it, in place of replacing it. An imp app must put the nav where a
  nav goes. To write your own frame is a supported result, and not a failure, and imp says that as
  plainly.

- **The `<main>` of the shell is the screen region of the router.** The frame is `100dvb` tall and
  scrolls each region on its own, so the window never scrolls. A router that restored the window
  scroll would restore nothing. The shell claims its `<main>` through `claimScreen`, from
  `lib/src/screen.js`, and releases it on unmount. The router reads that region, scrolls it to the
  top on a push and back to the saved place on a back or a forward, see `client-side-router.md`.
- **A change of screen animates inside the `<main>`, and `effect` picks the animation.** The claim
  also names the region `imp-screen` for a view transition, and installs the keyframes of the effect
  in one document-level stylesheet. `fade` cross-fades. `slide` follows the reading direction, and
  turns around on a back navigation. `zoom` scales the new screen in. The default is `none`, because
  the browser takes no input while a transition runs: a hit test during the animation lands on the
  root element, also with `pointer-events: none` on `::view-transition`. A default animation would
  drop a click in the first 200ms after every navigation, in every app and in every e2e spec. So
  motion is a choice of the app. The bar, the column and the trail are outside the named region, so
  they stay still. The shell imports `screen.js` and not the router, so a frame with no router
  carries no router code.

## Consequences

- The frame of an app is one call. Two apps that somebody builds with imp look like the same kind of
  software, and neither author decided to make them look alike.
- **The nav is data, and that costs the arbitrary widget in a nav region.** A switcher of tenants
  above the sections, or a checkbox below them, has no place in the frame. It belongs at the top of
  the main content, or in `extras`. That is the price of a bottom bar that the frame can count, cap
  and overflow, and of a nav that the frame can present in three ways.
- **imp builds the sidebar of every section at the mount, and not on demand.** A tree with many
  sections pays for all of them at the start. A nav tree is small. The alternative is to build on a
  change of section, and a binding built inside a watch callback has no region to own it. So imp
  accepts the cost.
- **The renderer of a row lives with the shell.** So a shell pulls the code of a nav row, the `tag`
  behind it, `breadcrumbs` and `icon`, into every bundle that uses the frame. imp accepts that. The
  frame is the recommended way to start an app, and an app with a frame has a nav row and a trail.
- **The fold is a media query. So an embedded shell does not fold with its box.** A shell in a panel
  narrower than `48rem`, on a wide screen, keeps its desktop layout, and crowds its top bar. The
  component preview of imp is where that shows. An app that embeds a frame in a narrow panel must
  give the frame the room that a frame needs.
- **A screen cannot push DOM up into the nav**, because imp ships no portal, see
  `overlay-top-layer.md`. A contribution across screens is a state that the map names, as the
  `options` of a param node or the `tag` of a row, which a screen fills. That is why the rule about
  plain data, see `state-plain-data-values.md`, governs the tree.
- **imp moves the chrome that changes parent. It does not duplicate it.** So the same `extras` node
  lives in the bar on a wide screen, and in the drawer on a narrow one. Anything in a region must
  therefore survive a change of parent. `component-moves-rebind.md` guarantees that for an imp
  component. It does not guarantee it for raw DOM that holds a listener that imp does not track.
- `100dvb` on the host means that the page itself stops scrolling. That works only because `mount`
  sets the default `body` margin of the user agent to zero. That margin would otherwise make the
  shell 16px taller than the window, and put a scrollbar on every imp app. The shell cannot reach
  that box itself. So the reset is a document rule that imp adopts, in a cascade layer of its own,
  on the first `mount`. Unlayered CSS of an app wins against it. So an app that wants a margin on
  the body still writes one. To embed a shell in a shorter box, such as a preview card, or an
  example in the documentation, is a `block-size` on the element, and that wins against the rule on
  the host.
