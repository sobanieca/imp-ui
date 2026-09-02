# Overlays are promoted in place to the top layer, behind a module of plain functions

## Context

Every overlay that imp will ship must paint above the rest of the page, take the focus, and be
dismissed. That covers `dialog`, `drawer`, `toast`, `tooltip` and `dropdownMenu`. The obvious answer
of a library is a `portal` primitive, a registry of z-index values, and a shared focus trap. All
three are wrong here. The top layer of the platform already stacks in the order of the calls. It
closes the topmost overlay first on Escape. `showModal()` brings `::backdrop`, `inert` on the rest
of the document, the entry of the focus, and the restore of the focus. All of that is inside the
floor of imp, see `browser-support-baseline.md`. To move an overlay into a container near the root
of the document would also cost the overlay the adopted stylesheet of its component. It would break
the ARIA id references, which resolve inside one tree scope only, see `shadow-dom-isolation.md`.

The platform ships two promotions, and not one, and an overlay needs both. `showModal()` gives the
modal frame that owns the screen. `popover="manual"` gives the window that does not own the screen.
`show()` is not the second one, because it promotes nothing. The dialog then stays clipped by
whatever ancestor it sits under. `popover="auto"` is not the second one either, because it dismisses
itself on the first click behind it. That click is the interaction that a non-modal window exists to
permit.

The one thing that the platform does not own yet is the **exit** transition. `@starting-style`
covers the entry everywhere. But an exit in CSS alone needs `transition-behavior: allow-discrete` on
`display`, which Firefox does not implement, see bug 1882408. It also needs the `overlay` property,
to keep the element in the top layer while it animates, and only Chrome ships that. So an exit in
CSS alone does not animate at all in Firefox, and it animates outside the top layer in Safari.

## Decision

**imp promotes an overlay where it renders. The shared code is `lib/src/std/shared/overlay.js`. It
holds plain functions. It is not a component, and it is not a manager singleton.**

- **There is no `portal`, no registry of z-index values, and no focus trap.** `dialog.showModal()`
  promotes an element to the top layer, from inside a shadow root, and it does not move the element.
  So an overlay keeps its stylesheet, its id references and its disposal. The top layer owns the
  stacking, and the order of Escape.
- **There are two helpers, one per promotion, because the two share no line of code.**
  `modalOverlay(dialog)` calls `showModal()`. It adds only what the platform leaves out. It adds a
  dismissal from the backdrop, through `event.target === dialog`, because a click on `::backdrop`
  lands on the element. It adds a **hold on the page scroll, with a reference count**, while any
  modal is open. That is the boundary case that `browser-support-baseline.md` already approved. It
  also adds the closing slide, described below. `panelOverlay(panel)` calls `showPopover()` on an
  element with `popover="manual"`. It adds the **restore of the focus**, which is the one thing that
  `showModal()` gives for free, and that the popover path does not. It gives the focus back to
  whatever had it, and the platform would leave it on `<body>`. Both helpers return
  `{ open, close }`. Neither one knows about the other.
- **A non-modal overlay holds nothing.** There is no scroll lock, no `inert`, no dismissal from a
  backdrop, and no Escape. A manual popover ignores Escape, and raises no `cancel`. imp adds none. A
  window that somebody parked deliberately must not disappear on a stray keystroke. The page behind
  it stays live, because that is the whole reason to open one.
- **Several non-modal overlays can be open at once.** They stack in the order in which imp showed
  them. imp does not raise one on a click. To raise one means to hide it and to show it again. That
  costs the window its focus, and it plays the entry animation again. That is a worse trade than a
  window that stays where the top layer put it.
- **`overlayMotion(selector)` builds a CSS string.** That follows the spirit of the rest of
  `std/shared`, where shared CSS is a shared string. There is one mechanism for every overlay. It
  fades, and it translates by `--overlay-offset`, which the component sets to the geometry that it
  wants. A drawer uses `-100% 0`. A dialog that rises uses `0 0.5rem`. It keys off **both** states
  of an open overlay. It uses `[open]` for a modal, and `:popover-open` for a manual popover.
  `showPopover()` never sets `open`, and an entry animation that keys on the wrong one never fires,
  and says nothing. The duration is `--imp-duration-medium`, so a theme sets it, and no prop passes
  it. `prefers-reduced-motion: reduce` removes the transitions in the stylesheet. There is no branch
  in JavaScript for it.
- **The scrim is a second builder, `overlayScrim(selector)`, and it is never automatic.** A
  non-modal window also has a `::backdrop`, and that backdrop paints without blocking a single
  click. So to dim the page behind such a window would say "blocked" about a page that is not
  blocked. The component asks for the dim where it means it, as in
  `overlayScrim('.panel[data-modal]')`. `overlayMotion` only fades whatever backdrop is there.
- **imp sequences the exit in JavaScript, and not the entry.** The entry is `@starting-style`. The
  exit sets `data-closing` on the dialog, which is still open, awaits `getAnimations()`, and then
  calls `close()`. This is not JavaScript that stands in for a platform primitive. The platform has
  no call that means "close after the exit transition". It is also the only way in which the exit
  animates in all four current browsers today. imp deletes it on the day when `display` is
  transitionable in Firefox, and `overlay` ships beyond Chrome.
- **imp animates Escape as well.** The seam takes the cancelable `cancel` event of the platform,
  prevents the instant close, and runs the same closing slide. So a `dialog.requestClose()` from app
  code also animates, at no cost, because it raises `cancel` as Escape does.
- **A dismissal gets no vocabulary from imp.** Escape and the backdrop close the dialog with no
  return value. So `dialog.returnValue` stays the channel of the platform. An empty value means that
  the user dismissed the dialog. Any other value is what the app closed it with. There is no
  `onDismiss` enum of reasons, and there is no veto.
- **Dragging is the one place where imp writes positioning**, and `draggable(element, handle)` is
  the helper. It captures the pointer. It writes the offset to `--drag-x` and `--drag-y`. It clamps
  the offset, so a title bar can never leave the viewport, and it clamps again on a resize. It also
  handles the **arrow keys on the focusable handle**, so the gesture is not for a pointer only. The
  offset rides on `transform`, while the entry and the exit ride on the `translate` property. The
  two compose in the browser, in place of a fight over one value. That is why a window that somebody
  dragged can still animate out from where the user left it. The position belongs to the instance,
  and imp never stores it. A window that opens again is centred again.
- **A component delays an initial open to `afterMount`.** Both promotions throw an
  `InvalidStateError` on an element that is not in the document. `build` returns its tree before imp
  puts that tree in the shadow root. So a dialog whose `open` is already true at mount opens on the
  next frame, in place of during the mount, which would throw. Only the first open needs that. Every
  later open runs against an element that is connected.
- **The test DOM gets a fill for the top layer.** `installDomEnvironment` installs it, beside the
  fills for the popover and for the animations. It covers the entry of the focus, the restore of the
  focus, `inert` on the rest of the body, and the sequence from Escape to `cancel` to `close`. The
  vendored happy-dom stubs `showModal()` as `setAttribute('open', '')`, and it has none of that.
  Without the fill, a unit test can assert the markup, and nothing that the seam exists for. The
  fill completes the test environment, in the way that `fake-timers.md` does. The seam itself calls
  the real APIs, with no condition, and the proof in a real browser stays in an e2e spec, see
  `two-level-testing.md`.

## Consequences

- The mobile drawer of `shell` is the first consumer, and it now owns none of this. Its dismissal
  from the backdrop, its `showModal()` call, and its motion CSS, are three lines of the seam. Every
  later overlay inherits the same dismissal, the same hold on the scroll, and the same motion, and
  it decides none of that again.
- The closing slide runs in Chrome, in Firefox and in Safari, because imp sequences it. The price is
  one `await` between "the user dismissed it" and the `close()` call. A component that moves DOM on
  a close, such as the shell, which moves its sidebar back into the frame, does that work in the
  `close` listener. It then sees a dialog that has already finished its animation.
- An overlay cannot veto its own dismissal, because the seam prevents the `cancel` event before any
  app code could act. Nothing needs a veto yet. On the day when something does, the seam grows the
  hook.
- `closedby="any"` would delete the handler for a click on the backdrop completely, and
  `requestClose()` already works. The attribute is not usable yet. Chrome 134 and Firefox 141 ship
  it, and Safari has it in a preview only. So the handler stays until the attribute is
  interoperable, and its removal is a pure subtraction.
- `drawer` is the second component on the seam, and it shows what this ADR claimed. It uses the same
  two promotions, the same `open` contract, and the same `modal` boolean, as `dialog`. The only
  thing that it owns is its geometry. It docks to the inline end, with `margin-inline-start: auto`.
  Its size comes from `--imp-drawer-inline-size`. It enters along `--overlay-offset: 100% 0`, which
  `:dir(rtl)` mirrors. There is no side prop. The contextual panel has one place, and a panel from
  the start of the line is the drawer of the shell. It also has no phone mode. imp caps the panel at
  `85dvi`, and on a narrow screen that already is the phone form. So nobody added a breakpoint, see
  `responsive-fluid-values-only.md`. The drawer adds one thing to the seam, which is `pin`.
  `modalOverlay` takes a `backdropDismisses` predicate. So a pinned drawer keeps its click on the
  backdrop, while Escape and the close button still close it. The modal stays modal, the page stays
  inert, and only the accidental dismissal is gone.
- `dialog` is the first consumer of both halves, and it is **one component with a `modal` boolean**,
  and not two components. The modes differ in which promotion they call, and in nothing else. They
  share the frame, the title bar, the content and the close button. imp reads `modal` once, at
  mount. To change it on a live dialog would mean to unwind one promotion, and to build the other,
  with the focus and the scroll state to reconcile across the gap.
- The anchored layer uses neither helper here. A panel that hangs from a trigger is a
  `popover="auto"` element, and CSS anchor positioning places it. imp builds it as the
  `anchoredStyles` string builder, beside the two helpers. The `items` menu of `button` is its first
  consumer. `tooltip`, `dropdownMenu` and `popconfirm` are not built yet, see
  `todo/overlay-seam.md`.
