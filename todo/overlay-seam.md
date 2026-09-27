# Overlay seam - what is left after `dialog` landed

The seam is built, and `adr/overlay-top-layer.md` records it. `lib/src/std/shared/overlay.js` ships
`modalOverlay`, `panelOverlay`, `dismissal`, `draggable`, `overlayMotion` and `overlayScrim`. The
drawer of `shell`, and the `dialog` component, run on them. `cli/src/test-dom.js` carries the fill
for the top layer. This file is the rest. Somebody checked the facts about a browser that it depends
on, against the compatibility data of MDN, in August 2026. Several earlier assumptions here were
wrong, and the corrections are below.

## Corrections to the original plan

- **The transition that closes an overlay cannot be pure CSS.** The plan had moved toward that.
  Firefox does not implement `transition-behavior: allow-discrete` on `display`, see bug 1882408.
  The `overlay` property is in Chrome only. So an exit in CSS alone does not animate in Firefox, and
  it animates outside the top layer in Safari. The seam sequences the exit instead. It sets
  `data-closing`, awaits `getAnimations()`, and then calls `close()`. That is what the original
  point asked for. Reduced motion needs no branch. The stylesheet removes the transitions, so there
  is nothing to await.
- **Nothing in the seam reads `prefers-reduced-motion` from JavaScript.**
- **A reason for a dismissal is not an API of imp.** Escape, and a dismissal from the backdrop, both
  close with no return value. So `dialog.returnValue` stays the channel that the platform already
  defined. Nothing needs an enum of reasons.
- **`dialog.requestClose()` is Baseline**, in Chrome 134, Firefox 139 and Safari 18.4. It already
  runs the animated close of the seam, because the seam handles the `cancel` event that
  `requestClose()` raises. Nobody needs a wrapper.
- **`closedby="any"` is not usable yet.** Chrome 134 and Firefox 141 ship it. Safari has it in a
  preview only. So the feature is Baseline "limited". When Safari ships it, the attribute deletes
  the listener of the seam for a click on the backdrop, completely. Check that again before somebody
  builds the next overlay.
- **Anchor positioning works, with one trap.** `anchor-name` is in Chrome 125, Firefox 147 and
  Safari 26. `position-area` is in 129, 147 and 26. `position-try-fallbacks` is in 128, 147 and 26.
  `position-visibility: anchors-visible` is in 125, 147 and 26.2. All four current browsers ship all
  of those. But **the initial value of `position-anchor` settled only in Chrome 151, Firefox 151 and
  Safari 27**. So every panel must declare `position-anchor` explicitly, and no panel must depend on
  the initial value. `web-features` still classifies the group as "limited". Trust the data per
  property here.
- **A `<dialog popover="manual">` behaves differently from a modal, in four ways that matter.**
  Somebody probed each one in the browser that the e2e suite pins, in place of assuming it. First,
  `showPopover()` **never sets the `open` attribute**. So `:popover-open` is the only selector that
  sees the panel. Second, Escape does not close the panel, and it raises no `cancel`. Third, the
  focus moves in on a show, and the browser **drops it on `<body>` on a hide**, in place of
  restoring it. Fourth, the `::backdrop` of the panel paints, and it blocks no click. The seam
  covers the second point and the third point. The fourth point is why the scrim is a choice, and
  not automatic.
- **The claims about the test DOM were accurate.** A probe of the vendored happy-dom confirms that
  `showModal()` sets the attribute only. There is no move of the focus, no restore of the focus, no
  `inert`, no `cancel` on Escape, no `requestClose`, no `:modal`, no `:popover-open`, and no popover
  API at all. The fill now covers the modal half. The popover half carries the light dismissal, and
  Escape, for a `popover="auto"` element. It also carries invocation through `popovertarget`, and
  the `oldState` and `newState` fields on a toggle event. A caller still tracks its own flag for a
  shown panel, in place of a query on `:popover-open`, which the shim does not implement.

## What is built

The seam is built. That is `modalOverlay`, `panelOverlay`, `draggable`, `overlayMotion` and
`overlayScrim`. The `dialog` and `drawer` components sit on top of it, each one in both modes. Those
modes are the modal frame, and the window or panel that blocks nothing, and several of the second
kind can be open at once. The drawer of `shell` uses the modal half. What the seam adds over the
platform is the dismissal from the backdrop, the hold on the scroll with a reference count, the
restore of the focus for the popover path, the closing slide, and the drag. It adds nothing else.

The anchored half is built too, as a second module, and it has no runtime at all.
`anchoredStyles({ trigger, panel, placement, align })`, in `lib/src/std/shared/anchored.js`, is a
builder of a string. It writes `anchor-name` on the trigger. It writes `position-anchor` on the
panel, and it always declares that. It writes `position-area` in logical keywords, so RTL mirrors
with no work. It writes `position-try-fallbacks` for a collision. It writes
`position-visibility: anchors-visible`, for a trigger that scrolls away. It also hides the panel
while the panel is closed, with `:not(:popover-open) { display: none }`. The rule of the user agent
that does that uses a selector of one class. So any `display` that a component sets on its own panel
wins against it, and the panel would otherwise paint at all times. Every instance can use the same
literal `--imp-anchor`, because a tree scope contains it. The menu of `menuButton` is its first
consumer. That menu is a `popover="auto"` with `role="menu"`, a roving tabindex, and an
`aria-expanded` attribute that imp writes from the `toggle` event of the panel. Its `trigger` prop
selects the look of the square control that opens it, a triple-dot or a chevron.

**A panel anchors to a box of its own root, never to a nested control.** An `anchor-name` on a
component host names no box, because a host is `display: contents`, and the name cannot cross a tree
scope either. `adr/joined-control-seam.md` records that, and every anchored component that follows
must place its `anchor-name` on an element of its own root.

## What is left

The overlays of the catalog are built on the seam: `dialog`, `drawer`, the menu of `menuButton` and
of `breadcrumbs` through `shared/menu.js`, `tooltip`, the panel of `datePicker`, the list of
`comboBox`, and the region of `toast`. There is no `dropdownMenu`, see
`adr/short-component-catalog.md`. One case is still open. A menu that is taller than the space on
either side of its trigger is capped to the viewport and scrolls, but it is not capped to the room
on the side that it chose. `position-try-order: most-block-size` is the property to use. Check it
against the four browsers first.

The placement is exempt from a unit test, because happy-dom has no layout engine. `std.spec.js` pins
the trigger of the menu to each edge and each corner of the viewport, and asserts which side the
panel took. The panels of `datePicker`, `comboBox` and `toast` owe the same spec.

## Where the component boundary falls

This does not change, and it is still the decision that nobody can add later. An ARIA id reference
does not cross a shadow root. `anchor-name` and `position-anchor` resolve inside one tree scope.
Both force a trigger and its panel into the same shadow root. That is why the seam is a module, and
not an `overlay()` wrapper. It is also why a panel is a prop of the component that renders its
trigger, as in `menuButton({ items })`, and never `menu(button(...))`.

The consequence is that **a tooltip cannot name its control**. The child of
`tooltip({ text }, button(...))` is an `imp-button` host, and `aria-describedby` on a host with no
role names nothing. So `tooltip` is visual only. It wraps the control in a box of its own root, and
anchors the panel to that box. The control carries its own accessible name.
