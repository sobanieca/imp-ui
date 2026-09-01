# The app shell is one component, one nav tree, and the only breakpoint imp writes

## Context

The layout group is `flex` and `stack` and nothing else (`layout-two-flex-primitives.md`), which is
right for arranging things inside a page and says nothing about the shape of a whole one. Every app
still needs the same frame - a brand block, a top-level nav, a nav column for what is under it, a
content area, sometimes a contextual aside, and somewhere to put the signed-in person - and without
a component for it every app hand-assembles a CSS grid, gets the scroll containers and the phone
treatment slightly wrong, and lands somewhere different from the app next to it.

Sorting an app's children into slots by an argument's shape is the part not worth reviving: it hides
where things go, and it makes the frame's regions a function of what was passed rather than a
decision the component owns.

Four further constraints came from the rest of the library. A `:host { display: contents }` child
puts its real box inside its own shadow root, so a parent selector cannot reach it - a frame must
therefore render the box each region sits in. `responsive-fluid-values-only.md` says no component
changes structure by width, and yet a phone cannot show a sidebar, a top bar and a row of pickers at
once. imp writes no focus trap (`browser-support-baseline.md`), so a drawer has to be a real
`<dialog>`. And a frame that only relocates opaque DOM cannot make a wide-screen control into a
narrow-screen one.

## Decision

**`shell` is the app frame: one nav tree driving three surfaces, chrome the frame places itself,
main content as children, and the library's single sanctioned breakpoint.**

- **One nav tree, three surfaces.** `navbar.items` are the sections; a section may carry its own
  `groups` of `items`, and that is what the sidebar shows while that section is current. The bar
  lists the sections, the sidebar lists the current section's groups, the phone's bottom bar lists
  that section's items. **Nothing is declared twice**, so a nav change lands on every surface at
  once and no app keeps two arrays in sync from the route by hand.
- **A section with no groups renders no sidebar at all**, and the content takes the full width. The
  frame does not fake a column holding one row: the layout shift is the signal that the context
  changed. This is the one thing the two-prop shape could not express, because presence of the
  sidebar was the app's decision rather than the tree's.
- **`sidebar` names the second level rather than supplying it.** Beside a `navbar` it carries only
  `label`, `selected` and the `footer` rows; its `groups` and `items` warn and are dropped, because
  a section declares its own. **Without a `navbar` it carries the whole column**, which is the
  sidebar-only layout - one component, two arrangements, no second frame component and no `layout`
  enum. Two components were considered and rejected: the fold, the drawer, the bottom bar, the aside
  and the account are the bulk of the code and would have been duplicated to vary one axis.
- **A region takes DOM; a role the frame must re-present takes data.** `logo`, `aside` and `extras`
  are arbitrary DOM the shell wraps, sizes, places, moves and scrolls without looking inside. The
  nav and the `account` are **data**, because the shell renders each of them more than once and
  cannot make a second presentation out of DOM it was handed: the bar row is also a drawer column,
  the sidebar column is also a length-capped bottom bar, the account is a `userCard` in the bar and
  the same card in the drawer. **That is the line: placing or moving DOM is free, making a second
  presentation of it is not.**
- **Nav data is `navMenu`'s data, extended.** The row shape is item for item the one `navMenu`
  takes, plus `children` for one level of nesting, so the same array drives the frame or a
  standalone menu and the two components share one row renderer rather than two that drift.
- **A section is always activatable.** With no `href` and no `onClick` it still renders a button and
  reports `select`, because choosing a section is what changes the sidebar - an inert section would
  make the tree unusable.
- **The shell owns where the chrome sits, and it depends on what else was passed.** With a navbar,
  the logo heads it and `extras` plus the account sit at its end. With only a sidebar, the logo
  heads the column and the chrome foots it, and no bar is rendered at all.
- **Below `48rem` the frame folds into a phone app.** The top bar becomes a hamburger and a two-line
  title - the section over the current row - because on a phone the frame should say where you are,
  which a brand block does not. The **sidebar becomes the bottom bar**: those are the destinations
  inside the section you are already in, so they are the ones worth a thumb's reach. It is capped at
  `--imp-shell-bottom-bar-items` rows plus a **More** button opening a bottom sheet with the rest,
  and groups flatten there, because a bottom bar is a row of destinations and not an outline. The
  **sections, `extras` and the account move into the hamburger drawer**. The aside is gone. **When
  the current section has no sidebar the bottom bar carries the sections instead**, and the drawer
  then holds only the chrome - a row is one node and lives in one place at a time.
- **The bottom bar's length is a custom property, not a prop.** `--imp-shell-bottom-bar-items` (`4`,
  clamped to 3-5) is read from the shell's computed style, so a page tunes it in CSS next to the two
  width properties rather than the frame growing a knob.
- **The sidebar collapses to an icon rail** from a toggle in its head, which also names the current
  section. Collapse is shell state with no prop and no event: it is a view preference of the frame,
  not something an app routes on. **Drag-to-resize is deliberately not built** - a width is a custom
  property, and a pointer-driven splitter is a component of its own if it is ever wanted.
- **`signedIn` is the whole auth story, and it is one boolean.** `false` withholds the nav, the
  bottom bar and the aside, closes the drawer, and falls back to a single top bar holding the logo
  and the sign-in button - which is `account.onSignIn`, so the signed-out frame is the same props
  with one flag flipped rather than a second layout.
- **The shell owns the drawer, and the drawer is a `<dialog>`.** The top layer, `inert` on the rest
  of the page, focus entry, focus restore and Escape are the platform's. The shell adds backdrop
  dismissal, closes itself when the viewport crosses back to desktop, and closes when a row in it is
  chosen. `navOpen` is shell-owned by default, overridable with a writable state, and `navToggle`
  reports every change the shell makes itself. **The drawer is the first consumer of the overlay
  seam** (`overlay-top-layer.md`), so the backdrop dismissal, the hold on the page scroll and the
  motion are shared code rather than shell code. **The More sheet is a plain `popover`** with a
  `popovertarget` invoker, so its light dismiss, its Escape and its focus order are the platform's.
  Being in the top layer it sits at the foot of the viewport rather than of an embedded frame; that
  is the platform's positioning and the shell does not fight it.
- **Every row is built once and afterwards only moved.** Each section's sidebar is built when the
  items data changes, so switching sections, crossing the breakpoint and expanding a parent row all
  re-parent or unhide existing nodes. This is not an optimisation: a media-query listener and a
  click handler run **outside a mount scope**, where rebuilding a row that binds a state would throw
  (`state-plain-data-values.md`), and `component-moves-rebind.md` keeps what a row holds working
  across the move.
- **This is the one component that changes structure by width**, and its query lives in its own
  `styles` against the literal `48rem` - shared with the `matchMedia` query from one constant, since
  CSS cannot resolve `--imp-breakpoint-desktop` inside a media query. A container query would fold
  an embedded frame correctly too, and was considered and not taken: it would replace the one
  documented breakpoint with a per-instance rule and a `ResizeObserver`, for a case - a shell inside
  a narrow panel - that only imp's own preview stage has. The consequence is accepted below.
- **The shell renders the landmarks, including the `<nav>` ones.** It renders `<header>`, `<main>`
  and `<aside>`, is `100dvb` tall on its own host, scrolls each region independently, and names each
  nav level from that level's `label`, falling back to a translated default.
- **A page's own furniture is not frame chrome.** There is no `header` region and no `footer`, so a
  breadcrumb trail, a page title or a toolbar of actions goes at the top of the main content. They
  change with the screen; the frame does not.
- **The recommendation is part of the decision.** Docs and skills say to reach for `shell` first and
  customize it rather than replace it, because an imp app should put the nav where the nav goes.
  Writing your own frame is a supported ending, not a failure, and is said as plainly.

## Consequences

- An app's frame is one call, and two apps built with imp look like the same kind of software
  without either author deciding to make them.
- **The nav being data costs the arbitrary widget in a nav region.** A tenant switcher above the
  sections, or a checkbox below them, has nowhere in the frame to go; it belongs at the top of the
  main content, or in `extras`. That is the price of a bottom bar the frame can count, cap and
  overflow, and of a nav it can present three ways.
- **Every section's sidebar is built at mount, not on demand.** A tree with many sections pays for
  all of them upfront. Nav trees are small and the alternative - building on section change - throws
  outside a mount scope, so the cost is accepted.
- **The row renderer is shared between `shell` and `navMenu`**, so a shell pulls the nav-row code -
  and `tag` behind it - into every bundle that uses the frame, alongside the `userCard` and `button`
  that `account` already pulls. That is accepted: the frame is the recommended way to start an app,
  and an app with a frame has nav rows and buttons.
- **The fold is a media query, so an embedded shell does not fold with its box.** A shell in a panel
  narrower than `48rem` on a wide screen keeps its desktop layout and crowds its top bar. imp's own
  component preview is where this shows; an app that embeds a frame in a narrow panel should give it
  the room a frame needs.
- **A screen cannot push DOM up into the nav**, because imp ships no portal
  (`todo/overlay-seam.md`). Cross-screen contribution is a nav-item state contributed to under an
  owner key, which is why the plain-data rule (`state-plain-data-values.md`) governs the tree.
- **Chrome that moves between parents is moved, not duplicated**, so the same `extras` node lives in
  the bar on a wide screen and in the drawer on a narrow one. Anything in a region must therefore
  survive being re-parented, which `component-moves-rebind.md` guarantees for imp components and
  does not for raw DOM holding untracked listeners.
- `100dvb` on the host means the page itself stops scrolling - but only because `mount` zeroes the
  UA's default `body` margin, which would otherwise make the shell 16px taller than the window and
  put a scrollbar on every imp app. The shell cannot reach that box itself, so the reset is a
  document rule imp adopts in a cascade layer of its own on the first `mount`; unlayered app CSS
  beats it, so an app that wants a body margin still just writes one. Embedding a shell in a shorter
  box - a preview card, a docs example - is a `block-size` set on the element, which wins over the
  host rule.
