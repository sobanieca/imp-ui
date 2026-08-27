# Overlay seam - one shared module behind modal, drawer, tooltip and menus

Settle how `modal`, `drawer`, `toast`, `popconfirm`, `tooltip`, `popover` and `dropdownMenu` paint
above the rest of the page, before the first of them is built. The conclusion is almost entirely
**subtractive**: the platform's top layer does what a `portal` primitive, a z-index registry and a
shared focus trap were planned for, and CSS anchor positioning does the placement. What is left is a
handful of small helpers, one public-API decision, and a fill for a gap in imp's test DOM.

## No portal - the top layer, in place

**Overlays are not re-parented and imp ships no `portal`.** Both `dialog.showModal()` and
`popover=""` + `showPopover()` promote an element to the document's **top layer from inside a shadow
root**, without moving it in the DOM. Promotion changes painting and stacking only, so the element
keeps its position for style inheritance and for everything imp relies on:

- It keeps its component's adopted stylesheet. Content appended to a container outside the component
  would lose it, and recovering it would mean injecting document-level CSS, which
  `adr/shadow-dom-isolation.md` deliberately removed.
- Its ARIA id references keep resolving, because it stays in the tree scope that owns them.
- It is disposed with its component, with nothing to tear down by hand.

The top layer also stacks in call order and closes topmost-first on Escape, and a `popover` inside
an open `dialog` paints above it - so a `select` or a `dropdownMenu` opened from inside a `modal` is
correct with no shared bookkeeping. That is the whole of the "shared stacking" the stdlib was going
to build.

The portal model - one container near the document root that overlays render their content into - is
what a virtual-DOM library needs because its tree cannot opt out of a container's clipping. imp
writes real DOM, and the platform shipped the answer.

## What the seam is

A shared module of plain functions, `lib/src/std/shared/overlay.js` - **not** a component, and not a
manager singleton. Each overlay component renders its own native element and attaches behaviour to
it:

```js
export const modalOverlay = (dialog, { onDismiss, signal }) // -> { open, close }
export const anchoredStyles = ({ placement, align }) // -> a CSS string for the component's `styles`
export const lockScroll = () // ref-counted, returns release
```

`modalOverlay` is mostly a call into the platform. `open()` is `showModal()`, which brings
`::backdrop`, `inert` on the rest of the document, focus moved in, focus restored to the invoker on
close, and Escape as a cancelable `cancel` event. It adds only what the platform leaves out:

- **Backdrop dismissal**, detected by `event.target === dialog` on a `click`, since a click on
  `::backdrop` lands on the dialog itself.
- **Scroll locking** while any overlay is open, ref-counted so nested overlays release correctly.
- **Waiting out a closing transition** before `close()`, skipped under `prefers-reduced-motion`.

`toast` is the one that needs a **region** rather than an element - several toasts share one for
reading order and stacking. That region is a component the app mounts once, found by a composed
bubbling event the way `useState` and `useHttpClient` resolve, and it builds every toast from plain
data. It is still not a container other components render into.

## The anchored layer is CSS, not JavaScript

`tooltip`, `popover`, `dropdownMenu` and `popconfirm` are positioned against a trigger, and **none
of that positioning is imp code**. The layer and the dismissal come from `popover="auto"` - light
dismiss, Escape, and a nesting stack - and the placement comes from CSS anchor positioning, which is
interoperable since Firefox 147 and so inside imp's floor (`adr/browser-support-baseline.md`). There
is no `ResizeObserver`, no scroll listener, no measuring in `afterMount`, and nothing to recompute:

- `anchor-name` on the trigger and `position-anchor` on the panel.
- `position-area` places it, in **logical** keywords, so RTL mirrors for free.
- `position-try-fallbacks: flip-block, flip-inline` handles collisions, with `@position-try` blocks
  for anything that needs a shape of its own.
- `position-visibility: anchors-visible` hides the panel when its trigger scrolls away.

Repositioning on scroll and resize is layout rather than a callback, so it cannot lag a frame behind
the trigger the way a JS positioner does. `anchoredStyles` is therefore a **CSS-string builder**, in
the same "shared CSS is shared strings" spirit as the rest of `std/shared`
(`adr/shadow-dom-isolation.md`) - not a runtime.

A pleasant consequence of shadow DOM: `anchor-name` is tree-scoped, so every instance of a component
can use the same literal name (`--imp-anchor`) with no collision and no generated ids - the same
isolation that makes `id="control"` safe inside a component today.

Opening and closing is declarative too wherever the trigger is a button in the same root:
`popovertarget` needs no listener at all. JS is left only for triggers the attribute cannot
express - a tooltip opening on hover or focus with a delay.

## Where the component boundary falls

Two constraints point the same way, and this is the decision that cannot be retrofitted:

- ARIA id references (`aria-controls`, `aria-describedby`, `aria-activedescendant`) cannot cross a
  shadow root.
- CSS `anchor-name` and `position-anchor` resolve **within one tree scope**, so an anchor in one
  shadow root is invisible to a panel in another.

Both force the trigger and the panel into the same shadow root, which is why the seam has to be a
module and not an `overlay()` wrapper: a wrapper can neither label nor anchor what it wraps - the
same argument that ruled out `formField`.

The consequence worth stating plainly: **`tooltip({ text }, button(...))` cannot be made correct.**
The child is an `imp-button` host, `aria-describedby` on a host with no role is ignored, and the
real `<button>` sits one shadow root deeper. So a tooltip is a **prop of the component that owns the
trigger** - `button({ tooltip: 'Copy' })` - rendered inside that component's own root through the
shared helper. `dropdownMenu({ label, items })` is unaffected because it renders its own trigger.
This is the data-driven rule that already made `tabs`, `navMenu` and `commandPalette` what they are
(`adr/standard-component-library.md`), applied to its least obvious case.

## `sidebar` keeps its own drawer

This answers the note left in `todo/stdlib-components.md`: **when `drawer` lands, the frame's
`sidebar` does not become one.** A `<dialog>` is open or closed, while a sidebar is docked above
`md` and a drawer below it (`adr/app-frame-regions.md`). Expressing that as a dialog means calling
`showModal()` from a `matchMedia` listener, which is the JS-resolved layout and wrong first paint
that `adr/responsive-fluid-values-only.md` already rejected. The drawer state stays CSS-driven with
its own focus and Escape handling, and `app` keeps arbitrating which one is open; the seam is for
components that are unconditionally overlays.

## imp's test DOM does not implement any of this

The vendored happy-dom stubs `showModal()` as `setAttribute('open', '')` - no top layer, no `inert`,
no focus move, no focus restore, no `cancel` - and has no `showPopover` at all. So without a fill,
unit tests can assert markup, roles, accessible names and state wiring, and **nothing about the
behaviour the seam exists for**.

Focus delegation is in the same state: happy-dom reads the shadow-root option as `delegateFocus`
rather than `delegatesFocus` and never forwards focus, so `host.focus()` does nothing there
(`adr/focus-delegation.md`). Every assertion about focus reaching a nested component is an e2e spec
today, and a top-layer fill should cover this alongside the rest.

`todo/accessibility.md` asks for a test-backed guarantee rather than a best-effort convention, so
budget a small top-layer emulation installed in `installDomEnvironment` (`cli/src/test_dom.js`):
promotion, `inert` on the rest of the document, focus entry and restore, Escape, and light dismiss.
This completes the test environment the same way imp already ships fake timers
(`adr/fake-timers.md`); it is not a product fallback, and the seam itself calls the real APIs
unconditionally. Real-browser behaviour still belongs in e2e specs (`adr/two-level-testing.md`) -
the emulation buys per-component unit coverage, not proof.

Placement is exempt: happy-dom has no layout engine, so anchor positioning was never going to be
unit-testable - but with it in CSS there is no imp code to test either, only whether a component
declares the rules it should. Where a panel actually lands is an e2e and visual concern.

## Build order

1. `overlay.js` and the test-DOM top-layer emulation.
2. `modal` - proves the modal half on the smallest surface.
3. `drawer` - proves it generalizes: same helper, different geometry, bottom sheet below `md`.
4. `dropdownMenu` - first anchored consumer, proves `anchoredStyles` and the tree-scope API
   decision.
5. `toast` - the region, resolved by composed event.

Then the accessibility contract can be recorded as an ADR (`todo/accessibility.md`), which has been
waiting on this seam to be describable from something real.

## Docs, skills and ADR impact

- Record an `overlay-top-layer.md` ADR **once the seam lands**: no portal, promotion in place, the
  three helpers, the trigger-and-panel-in-one-root rule and what it does to the public API, and the
  scroll lock as the one thing imp adds. Update the table in `adr/README.md`.
- `docs/state.md`, `skills/state.md` and `skills/http.md` all illustrate out-of-subtree DOM with "an
  overlay appended to `document.body`". That stays true of app code, but it will read as a
  description of imp's own overlays, which never do it. Reword the example when the seam lands.
- `docs/std-components.md` describes a collapsed `sidebar` as turning "into a drawer". Reword once
  `drawer` is a component, so the two do not read as the same thing.

## Open questions

- **Tooltip spelling.** `button({ tooltip: 'Copy' })` follows from the tree-scope constraint, but it
  means every component that can carry a tooltip grows a prop and a bit of shared wiring. Confirm
  that against the alternative of shipping no `tooltip` at all and leaning on `title`.
- **Dismissal reasons.** Whether `onDismiss` receives a reason (`escape`, `backdrop`, `close`) and
  whether a component may veto a dismissal, or whether an overlay is always dismissible.
- **Animation.** Whether entry and exit transitions are fixed component behaviour or theme tokens,
  and how that interacts with `@starting-style` and `transition-behavior: allow-discrete`.
