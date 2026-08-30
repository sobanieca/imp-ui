# Overlays are promoted in place to the top layer, behind a module of plain functions

## Context

Every overlay imp will ship - `dialog`, `drawer`, `toast`, `tooltip`, `dropdownMenu` - has to paint
above the rest of the page, take focus, and be dismissed. The obvious library answer is a `portal`
primitive, a z-index registry and a shared focus trap, and all three are wrong here: the platform's
top layer already stacks in call order, closes topmost-first on Escape, and `showModal()` brings
`::backdrop`, `inert` on the rest of the document, focus entry and focus restore with it
(`browser-support-baseline.md` puts all of that inside imp's floor). Re-parenting into a container
near the document root would also cost an overlay its component's adopted stylesheet and break the
ARIA id references that only resolve inside one tree scope (`shadow-dom-isolation.md`).

The platform ships two promotions, not one, and an overlay needs both: `showModal()` for the modal
frame that owns the screen, and `popover="manual"` for the window that does not. `show()` is not the
second one - it does not promote at all, leaving the dialog to be clipped by whatever ancestor it
sits under - and `popover="auto"` is not either, since it light-dismisses on the first click behind
it, which is the interaction a non-modal window exists to permit.

The one thing the platform does not yet own is the **exit** transition. `@starting-style` covers the
entry everywhere, but a CSS-only exit needs `transition-behavior: allow-discrete` on `display` -
which Firefox does not implement (bug 1882408) - and the `overlay` property to keep the element in
the top layer while it animates, which only Chrome ships. A CSS-only exit therefore does not animate
at all in Firefox and animates outside the top layer in Safari.

## Decision

**Overlays are promoted where they are rendered, and the shared code is
`lib/src/std/shared/overlay.js`: plain functions, not a component and not a manager singleton.**

- **No `portal`, no z-index registry, no focus trap.** `dialog.showModal()` promotes an element to
  the top layer from inside a shadow root without moving it, so an overlay keeps its stylesheet, its
  id references and its disposal. Stacking and Escape ordering are the top layer's.
- **Two helpers, one per promotion, because the two share no line.** `modalOverlay(dialog)` is
  `showModal()` and adds only what the platform leaves out: backdrop dismissal
  (`event.target === dialog`, since a click on `::backdrop` lands on the element), a **ref-counted
  hold on the page scroll** while any modal is open - the boundary case
  `browser-support-baseline.md` already blessed - and the closing slide below. `panelOverlay(panel)`
  is `showPopover()` on a `popover="manual"` element and adds **focus restore**, which is the one
  thing `showModal()` gives free and the popover path does not: it hands focus back to whatever had
  it, where the platform would drop it on `<body>`. Both return `{ open, close }`; neither knows
  about the other.
- **A non-modal overlay holds nothing.** No scroll lock, no `inert`, no backdrop dismissal, no
  Escape - a manual popover ignores Escape and raises no `cancel`, and imp does not add one. A
  window someone parked deliberately should not vanish on a stray keystroke, and the page behind it
  stays live because that is the whole reason to open one.
- **Several non-modal overlays may be open at once**, stacking in the order they were shown, and imp
  does not raise one on click. Raising means hiding and re-showing, which costs the window its focus
  and replays its entry animation - a worse trade than a window that stays where the top layer put
  it.
- **`overlayMotion(selector)` is a CSS string builder**, in the same "shared CSS is shared strings"
  spirit as the rest of `std/shared`. One mechanism for every overlay: it fades and translates by
  `--overlay-offset`, which the component sets to the geometry it wants (`-100% 0` for a drawer,
  `0 0.5rem` for a dialog that rises). It keys off **both** open states - `[open]` for a modal and
  `:popover-open` for a manual popover - because `showPopover()` never sets `open`, and an entry
  animation keyed on the wrong one silently never fires. Duration is `--imp-duration-medium`, so it
  is themed rather than passed as a prop, and `prefers-reduced-motion: reduce` drops the transitions
  in the stylesheet - there is no JavaScript branch for it.
- **The scrim is a second builder, `overlayScrim(selector)`, and never automatic.** A non-modal
  window has a `::backdrop` too, and it paints without blocking a single click - so dimming the page
  behind one would say "blocked" about a page that is not. The component asks for the dim where it
  means it (`overlayScrim('.panel[data-modal]')`), and `overlayMotion` only fades whatever backdrop
  is there.
- **The exit is sequenced in JavaScript, the entry is not.** Entry is `@starting-style`. Exit sets
  `data-closing` on the still-open dialog, awaits `getAnimations()`, then calls `close()`. This is
  not JavaScript standing in for a platform primitive - the platform has no "close after the exit
  transition" call - and it is the only way the exit animates in all four current browsers today. It
  is deleted the day `display` is transitionable in Firefox and `overlay` ships beyond Chrome.
- **Escape is animated too**, because the seam takes the platform's cancelable `cancel` event,
  prevents the instant close, and runs the same closing slide. `dialog.requestClose()` from app code
  therefore animates as well, at no cost - it raises `cancel` like Escape does.
- **Dismissal gets no imp vocabulary.** Escape and backdrop close with no return value, so
  `dialog.returnValue` stays the platform's own channel: empty means the user dismissed it, anything
  else is what the app closed it with. There is no `onDismiss` reason enum and no veto.
- **Dragging is the one place imp writes positioning**, and `draggable(element, handle)` is the
  helper: pointer capture, the offset written to `--drag-x` / `--drag-y`, clamped so a title bar can
  never leave the viewport and re-clamped on resize, plus **arrow keys on the focusable handle**, so
  the gesture is not pointer-only. The offset rides on `transform` while the entry and exit ride on
  the `translate` property: the two compose in the browser instead of fighting over one value, which
  is why a dragged window can still animate out from where the user left it. Position is
  per-instance and never persisted - a reopened window is centred again.
- **A component defers an initial open to `afterMount`.** Both promotions throw `InvalidStateError`
  on an element that is not in the document, and `onMount` returns its tree before imp puts it in
  the shadow root - so a dialog whose `open` is already true at mount opens on the next frame rather
  than during the mount that would have thrown. Only the first open needs it; every later one runs
  against a connected element.
- **The test DOM gets a top-layer fill**, installed in `installDomEnvironment` next to the popover
  and animation fills: focus entry, focus restore, `inert` on the rest of the body, and Escape ->
  `cancel` -> `close`. The vendored happy-dom stubs `showModal()` as `setAttribute('open', '')` and
  has none of that, so without it a unit test can assert markup and nothing the seam exists for. It
  completes the test environment the way `fake-timers.md` does; the seam itself calls the real APIs
  unconditionally, and real-browser proof stays in e2e specs (`two-level-testing.md`).

## Consequences

- `shell`'s mobile drawer is the first consumer and now owns none of this: its backdrop dismissal,
  its `showModal()` call and its motion CSS are three lines of seam. Every later overlay inherits
  the same dismissal, the same scroll hold and the same motion without deciding any of it again.
- The closing slide runs in Chrome, Firefox and Safari because imp sequences it, at the price of one
  `await` between "the user dismissed it" and `close()` firing. A component that moves DOM on
  close - the shell moves its sidebar back into the frame - does that work in the `close` listener
  and sees a dialog that has already finished animating.
- An overlay cannot veto its own dismissal, because the seam prevents the `cancel` event before any
  app code could. Nothing needs a veto yet; the day one does, it is the seam that grows the hook.
- `closedby="any"` would delete the backdrop-click handler entirely, and `requestClose()` already
  works. The attribute is not usable yet - Chrome 134 and Firefox 141 ship it, Safari has it only in
  preview - so the handler stays until it is interoperable, and its removal is a pure subtraction.
- `dialog` is the first consumer of both halves, and it is **one component with a `modal` boolean**
  rather than two: the modes differ in which promotion they call and in nothing else - same frame,
  same title bar, same content, same close button. `modal` is read once, at mount, because switching
  it on a live dialog would mean unwinding one promotion and rebuilding the other with focus and
  scroll state to reconcile across the gap.
- The anchored layer uses neither helper here: a panel that hangs off a trigger is `popover="auto"`
  placed by CSS anchor positioning, built as the `anchoredStyles` string builder next to them.
  `button`'s `items` menu is its first consumer; `tooltip`, `dropdownMenu` and `popconfirm` are
  still unbuilt (`todo/overlay-seam.md`).
