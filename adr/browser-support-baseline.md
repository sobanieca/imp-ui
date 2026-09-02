# Browser support: current stable browsers, no polyfills, no platform workarounds

## Context

imp had no written floor for browser support. In practice a floor existed. The library already
requires `adoptedStyleSheets`, `inert`, the `dvh` unit, `:focus-visible` and logical properties. But
nobody stated the floor. So each feature negotiated its own question about support, and the answers
drifted. The overlay components forced the issue. `<dialog>.showModal()` and `popover` have been
interoperable since 2022 and 2024. CSS anchor positioning has been interoperable only since Firefox
147, in January 2026. With no stated policy, the choice for each feature is either to wait, or to
write JavaScript that stands in for it. Whoever builds a component decides that for that component.

The two choices are not equivalent. A polyfill for a layout primitive is not a small cost that you
pay once. A positioner in JavaScript needs a scroll listener and a resize listener. It runs one
frame behind the thing that it tracks. Somebody must tear it down per instance. Nobody can unit-test
it without a layout engine. It lives forever, because nothing ever forces its removal. imp is a
complete toolkit, and its argument is that the platform is enough. To ship a shadow implementation
of the platform inside imp contradicts the product.

## Decision

**imp targets Baseline Newly available. That is the current stable version of Chrome, Edge, Firefox
and Safari.** A web platform feature is available to imp the moment when all four have shipped it.
imp does **not** wait the further 30 months for Baseline Widely available. imp supports no browser
older than the current stable version.

- **imp ships no polyfill, and no feature detection.** Below the floor, imp **breaks. It does not
  degrade.** `showPopover()` on an engine that lacks it throws. imp neither guards the call nor
  provides another path. There is no `@supports` fallback branch, no `typeof x === 'function'`
  check, and no tier of graceful degradation. There is one code path, and it is the current one.
- **imp never writes JavaScript that stands in for a platform primitive.** The line is not "no
  JavaScript", because imp is a JavaScript library. The line is **what the JavaScript is for**:
  - **imp allows JavaScript that implements a feature.** That covers a sort of a table, a fuzzy
    match in a filtered list, a walk of a `field` path, a validation of a form, and the handling of
    a key press. Nothing in the platform does these. imp is the thing that does them.
  - **imp forbids JavaScript that stands in for something that the platform owns.** That covers a
    focus trap, an engine for anchor positioning, a registry of the stacking order, a virtualizer
    for a scroll, and a shim for `:has()`. The platform owns these. Where it owns them, imp calls
    them.
- **imp does not build a component that needs the forbidden kind.** imp documents the absence of
  that component as a deliberate boundary. It does not fill the gap with an approximation. This is a
  rule about scope, and not a bar of quality to reach later. The catalog in
  `todo/stdlib-components.md` is subject to it, and this rule can remove an entry from that catalog.
- **The floor moves on its own.** It is "current stable", and not a version number in a config file.
  So there is nothing to raise, and there is no support matrix to maintain. A feature that is
  interoperable today is usable today.

Here is the boundary case, recorded so that the rule has a worked example. **The scroll lock of a
modal is allowed.** `showModal()` deliberately does not stop the page behind it from scrolling. So
imp writes `overflow: hidden` on the document element while an overlay is open. That is a state
toggle of one property. It is not an implementation of a primitive that the platform provides, and
it shadows nothing. A focus trap beside it would be forbidden, because `showModal()` already traps
the focus.

## Consequences

- The overlay components are buildable now, entirely on platform behaviour. The top layer handles
  the stacking and the focus. CSS anchor positioning handles the placement. `popovertarget` handles
  the open and the close, see `todo/overlay-seam.md`. None of that is imp code. So none of it can
  decay.
- **A user on an older browser gets a broken app, and not a degraded one.** imp accepts that cost.
  An app whose audience includes such a user must not use imp. The clearest case today is Firefox
  ESR 140. It is supported until September 2026, and it is seven releases older than anchor
  positioning. An anchored panel opens in the wrong place there. The next ESR branch closes that
  gap, which is the general shape. A gap against this policy is temporary by construction.
- Some entries in the catalog fall outside the boundary. `virtualList` is one. To window a list
  implements again what the scrolling and the rendering of the browser do.
  `content-visibility: auto` with `contain-intrinsic-size` is the answer of the platform. So imp
  documents that, and it ships no virtualizer. `carousel` waits until `::scroll-button()` and
  `::scroll-marker()` are interoperable. imp does not ship JavaScript for a scroll button now.
- A component with **no** native counterpart stays in scope. `comboBox`, `datePicker` and `tree` are
  the examples. They replace nothing, because the platform has no such control. They remain the
  largest surfaces of ARIA and of keyboard work in the library. The accessibility contract, and not
  this decision, is what keeps them honest.
- When an agent or a maintainer reads the source of imp, they never ask which of two paths runs,
  because there is one. The same property makes the compiled binary smaller, and it makes the e2e
  suite meaningful, because that suite exercises the only implementation that exists.
- The cost is reach. imp trades the tail of older installations for a library that is mostly calls
  to the platform. imp states that trade publicly, in `docs/browser-support.md`. Nobody discovers it
  in a bug report.
