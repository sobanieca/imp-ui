# The app shell is one component with named regions, and the only breakpoint imp writes

## Context

The layout group is `flex` and `stack` and nothing else (`layout-two-flex-primitives.md`), which is
right for arranging things inside a page and says nothing about the shape of a whole one. Every app
still needs the same frame - a header, a nav column, a content area, sometimes a rail or a
contextual aside - and without a component for it every app hand-assembles a CSS grid, gets the
scroll containers and the phone treatment slightly wrong, and lands somewhere different from the app
next to it.

The removed frame sorted an app's children into `navbar` / `sidebar` / `footer` slots. That is the
part not worth reviving: sorting children by an argument's shape hides where things go, and it made
the frame's regions a function of what was passed rather than a decision the component owns.

Three further constraints came from the rest of the library. A `:host { display: contents }` child
puts its real box inside its own shadow root, so a parent selector cannot reach it - a frame must
therefore render the box each region sits in. `responsive-fluid-values-only.md` says no component
changes structure by width, and yet a sidebar has to become a drawer on a phone. And imp writes no
focus trap (`browser-support-baseline.md`), so a drawer has to be a real `<dialog>`.

## Decision

**`shell` is the app frame: named regions taking DOM, main content as children, one span prop, and
the library's single sanctioned breakpoint.**

- **Regions are props taking DOM, main content is the children.** `header`, `rail`, `sidebar`,
  `aside` and `bottomNav` each take arbitrary DOM; the shell wraps, sizes, places and scrolls it and
  never looks inside. A command palette in the header or a checkbox under the sidebar nav is DOM the
  app already knows how to write, so it needs no shell prop and no shell change. Had the regions
  taken data, every question of that shape would have grown a prop and the shell would have become a
  configuration language for arbitrary markup.
- **There is no `layout` enum.** The only real arrangement choice is whether the header spans the
  side columns or starts after them, so the shell takes `headerSpan: 'full' | 'content'`, and
  everything else is region presence. The five layouts worth naming fall out of that, and so do the
  combinations nobody enumerated.
- **`bottomNav`'s presence is the mobile switch**, not a mode prop. A mode prop admits
  `compact: 'bottomNav'` with no bottom nav to show; presence cannot be inconsistent. One nav-item
  registry can feed a column `navMenu` in the sidebar and a `direction: 'row'` one in the bottom
  bar.
- **The shell owns the drawer, and the drawer is a `<dialog>`.** Below the breakpoint the sidebar
  region is moved into a `dialog` opened with `showModal()`, so the top layer, `inert` on the rest
  of the page, focus entry, focus restore and Escape are the platform's (`component-moves-rebind.md`
  makes the move safe for anything the region holds). The shell adds backdrop dismissal and closes
  itself when the viewport crosses back to desktop. `navOpen` is shell-owned by default, overridable
  with a writable state, and `navToggle` reports every change the shell makes itself. **The drawer
  is the first consumer of the overlay seam** (`overlay-top-layer.md`), so the backdrop dismissal,
  the hold on the page scroll and the motion - a slide from the inline start behind a fading
  backdrop, silent under `prefers-reduced-motion: reduce` - are shared code rather than shell code.
  The shell puts the sidebar back into the frame when the dialog fires `close`, which the seam
  raises only once the closing slide has finished.
- **Sizes are custom properties, not props.** `--imp-shell-rail-inline-size` (`3.5rem`),
  `--imp-shell-sidebar-inline-size` (`16rem`) and `--imp-shell-aside-inline-size` (`20rem`) inherit
  into the shadow root, so a page sets them without the layout group growing a width prop.
- **This is the one component that changes structure by width**, and its query lives in its own
  `styles` against the literal `48rem` - shared with the `matchMedia` query from one constant, since
  CSS cannot resolve `--imp-breakpoint-desktop` inside a media query. The exception stops here and
  is not a precedent other components copy.
- **The shell owns the frame, not the landmarks inside it.** It renders `<header>`, `<main>` and
  `<aside>`, is `100dvb` tall on its own host, and scrolls each region independently. It renders no
  `<nav>`: the app's `navMenu` brings that, and a shell-supplied one would double the landmark.
- **The recommendation is part of the decision.** Docs and skills say to reach for `shell` first and
  customize it rather than replace it, because an imp app should put the nav where the nav goes.
  Writing your own frame is a supported ending, not a failure, and is said as plainly.

## Consequences

- An app's frame is one call, and two apps built with imp look like the same kind of software
  without either author deciding to make them.
- Arbitrary content in any region is free forever, but **the shell cannot help a region's
  contents**: it does not know a rail holds icons or a sidebar holds nav, so an icon rail is app
  code until an `icon` component exists.
- **A screen cannot push DOM up into the sidebar**, because imp ships no portal
  (`todo/overlay-seam.md`). Cross-screen contribution is a nav-item state contributed to under an
  owner key, which is why the plain-data rule (`state-plain-data-values.md`) governs the registry
  and never a region's contents. A contributed widget mounts in the shell's scope, so it resolves
  state from there, not from the screen that asked for it.
- The drawer is the overlay seam's first consumer and owns none of the overlay behaviour: its
  promotion, its backdrop dismissal, its page-scroll hold and its motion are calls into
  `overlay-top-layer.md`. What stays shell code is the region move and the `navOpen` bookkeeping.
- `100dvb` on the host means the page itself stops scrolling - but only because `mount` zeroes the
  UA's default `body` margin, which would otherwise make the shell 16px taller than the window and
  put a scrollbar on every imp app. The shell cannot reach that box itself, so the reset is a
  document rule imp adopts in a cascade layer of its own on the first `mount`; unlayered app CSS
  beats it, so an app that wants a body margin still just writes one. Embedding a shell in a shorter
  box - a preview card, a docs example - is a `block-size` set on the element, which wins over the
  host rule.
