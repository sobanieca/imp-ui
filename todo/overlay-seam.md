# Overlay seam - what is left after `dialog` landed

The seam is built and recorded in `adr/overlay-top-layer.md`: `lib/src/std/shared/overlay.js` ships
`modalOverlay`, `panelOverlay`, `draggable`, `overlayMotion` and `overlayScrim`; `shell`'s drawer
and the `dialog` component run on them; and `cli/src/test_dom.js` carries the top-layer fill. This
file is the rest, with the browser facts it depends on re-checked against MDN's compat data in
August 2026 - several of the earlier assumptions here were wrong and are corrected below.

## Corrections to the original plan

- **The closing transition cannot be pure CSS**, which the plan had drifted towards.
  `transition-behavior: allow-discrete` on `display` is unimplemented in Firefox (bug 1882408) and
  the `overlay` property is Chrome-only, so a CSS-only exit does not animate in Firefox and animates
  outside the top layer in Safari. The seam sequences the exit instead - `data-closing`, await
  `getAnimations()`, then `close()` - which is what the original bullet asked for. Reduced motion
  needs no branch: the stylesheet drops the transitions, so there is nothing to await.
- **`prefers-reduced-motion` is never read from JavaScript** anywhere in the seam.
- **Dismissal reasons are not an imp API.** Escape and backdrop dismissal close with no return
  value, leaving `dialog.returnValue` as the channel the platform already defined. Nothing needs a
  reason enum.
- **`dialog.requestClose()` is Baseline** (Chrome 134, Firefox 139, Safari 18.4) and already runs
  the seam's animated close, because the seam handles the `cancel` event that `requestClose()`
  raises. No wrapper needed.
- **`closedby="any"` is not usable yet** - Chrome 134 and Firefox 141 ship it, Safari only in
  preview, so the feature is Baseline "limited". When Safari ships it, the attribute deletes the
  seam's backdrop-click listener outright. Recheck before building the next overlay.
- **Anchor positioning holds up, with one trap.** `anchor-name` (Chrome 125, Firefox 147, Safari
  26), `position-area` (129 / 147 / 26), `position-try-fallbacks` (128 / 147 / 26) and
  `position-visibility: anchors-visible` (125 / 147 / 26.2) are all shipped in the four current
  browsers. But **`position-anchor`'s initial value only settled in Chrome 151, Firefox 151 and
  Safari 27**, so every panel must declare `position-anchor` explicitly and never lean on the
  initial value. `web-features` still classifies the group as "limited"; the per-property data is
  what to trust here.
- **A `<dialog popover="manual">` behaves differently from a modal in four ways that matter**, all
  probed in the browser the e2e suite pins rather than assumed: `showPopover()` **never sets the
  `open` attribute** (so `:popover-open` is the only selector that sees it), Escape does not close
  it and raises no `cancel`, focus moves in on show but is **dropped on `<body>` on hide** rather
  than restored, and its `::backdrop` paints but blocks no clicks. The seam covers the second and
  third; the fourth is why the scrim is opt-in.
- **The test-DOM claims were accurate.** A probe of the vendored happy-dom confirms `showModal()`
  only sets the attribute: no focus move, no focus restore, no `inert`, no `cancel` on Escape, no
  `requestClose`, no `:modal`, no `:popover-open`, and no popover API at all. The fill now covers
  the modal half; the popover shim still dispatches toggle events only, which is enough because the
  seam tracks its own shown flag rather than querying `:popover-open` - **light dismiss and the
  popover focusing steps still need emulating before `dropdownMenu`.**

## What is built

The seam - `modalOverlay`, `panelOverlay`, `draggable`, `overlayMotion`, `overlayScrim` - and the
`dialog` component on top of it, in both modes: the modal frame and the movable, non-blocking
window, several of which may be open at once. `shell`'s drawer uses the modal half. What the seam
adds over the platform is backdrop dismissal, the ref-counted scroll hold, focus restore for the
popover path, the closing slide and the drag, and nothing else.

## What is left

### 1. `drawer`

Same helper, different geometry: `--overlay-offset` is the only thing that differs from a dialog,
and a bottom sheet below the breakpoint is one more offset. The shell's drawer already proves the
path.

### 2. `dropdownMenu` - the first anchored consumer

`popover="auto"` brings the layer, light dismiss, Escape and a nesting stack; placement is CSS, so
`anchoredStyles({ placement, align })` is a **string builder** and not a runtime - `anchor-name` on
the trigger, `position-anchor` on the panel (always declared), `position-area` in logical keywords
so RTL mirrors for free, `position-try-fallbacks: flip-block, flip-inline` for collisions, and
`position-visibility: anchors-visible` to hide a panel whose trigger scrolled away. No
`ResizeObserver`, no scroll listener, nothing to recompute. `anchor-name` is tree-scoped, so every
instance can use the same literal `--imp-anchor` with no generated ids.

Placement is exempt from unit testing - happy-dom has no layout engine - so what a unit test can
check is that a component declares the rules; where a panel lands is e2e and visual.

### 3. `toast` - the one region

Several toasts share one region for reading order and stacking. That region is a component the app
mounts once, found by a composed bubbling event the way `useState` resolves, building each toast
from plain data. It is still not a container other components render into.

## Where the component boundary falls

Unchanged and still the decision that cannot be retrofitted: ARIA id references do not cross a
shadow root, and `anchor-name` / `position-anchor` resolve within one tree scope. Both force trigger
and panel into the same shadow root, which is why the seam is a module and not an `overlay()`
wrapper. The consequence: **`tooltip({ text }, button(...))` cannot be made correct** - the child is
an `imp-button` host, `aria-describedby` on a roleless host is ignored, and the real `<button>` is
one root deeper. A tooltip is therefore a prop of the component that owns the trigger,
`button({ tooltip: 'Copy' })`. `dropdownMenu({ label, items })` is unaffected, since it renders its
own trigger.

## Docs and skills impact

- `docs/state.md`, `skills/state.md` and `skills/http.md` illustrate out-of-subtree DOM with "an
  overlay appended to `document.body`". True of app code, misleading about imp's own overlays, which
  never do it - reword them.

## Open questions

- **Tooltip spelling.** `button({ tooltip: 'Copy' })` follows from the tree-scope constraint, but it
  grows a prop on every component that can carry one. Confirm that against shipping no `tooltip` at
  all and leaning on `title`.
- **Vetoing a dismissal.** The seam prevents `cancel` itself, so an app cannot refuse to close. A
  form with unsaved changes is the case that would want it; decide whether that is the seam's hook
  or the component's prop when a component asks for it.
