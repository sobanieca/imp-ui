# Browser support: current stable browsers, no polyfills, no platform workarounds

## Context

imp had no written browser floor. In practice one existed anyway - the library already requires
`adoptedStyleSheets`, `inert`, `dvh` units, `:focus-visible` and logical properties - but because it
was never stated, each feature negotiated its own support question and the answers drifted. The
overlay components forced the issue: `<dialog>.showModal()` and `popover` are interoperable since
2022 and 2024, CSS anchor positioning only since Firefox 147 in January 2026. Without a stated
policy, the choice for each is either "wait" or "write JavaScript that stands in for it", and both
get decided per component by whoever is building it.

The two are not equivalent choices. A polyfill for a layout primitive is not a small cost paid once:
a JS positioner needs scroll and resize listeners, runs a frame behind the thing it tracks, has to
be torn down per instance, cannot be unit-tested without a layout engine, and lives forever because
nothing ever forces its removal. imp is an all-in-one toolkit whose argument is that the platform is
enough - shipping a shadow implementation of the platform inside it contradicts the product.

## Decision

**imp targets Baseline Newly available: the current stable version of Chrome, Edge, Firefox and
Safari.** A web platform feature is available to imp the moment all four have shipped it. imp does
**not** wait the further 30 months for Baseline Widely available, and supports no browser older than
current stable.

- **imp ships no polyfills and no feature detection.** Below the floor imp **breaks rather than
  degrades**: `showPopover()` on an engine that lacks it throws, and imp neither guards the call nor
  provides another path. There is no `@supports` fallback branch, no `typeof x === 'function'`
  check, no graceful-degradation tier. One code path, the current one.
- **imp never writes JavaScript that substitutes for a platform primitive.** The line is not "no
  JavaScript" - imp is a JavaScript library - it is **what the JavaScript is for**:
  - **Allowed: JavaScript that implements a feature.** Sorting a table, fuzzy-matching in a filtered
    list, walking a `field` path, validating a form, handling a keypress. Nothing in the platform
    does these; imp is the thing that does them.
  - **Forbidden: JavaScript that stands in for something the platform owns.** A focus trap, an
    anchor positioning engine, a stacking-order registry, a scroll virtualizer, a `:has()` shim. The
    platform owns these, and where it owns them imp calls them.
- **A component that cannot be built without the forbidden kind is not built.** Its absence is
  documented as a deliberate boundary, not filled with an approximation. This is a scope rule, not a
  quality bar to reach later: the catalog in `todo/stdlib-components.md` is subject to it, and an
  entry may be removed by it.
- **The floor moves on its own.** It is "current stable", not a version number in a config file, so
  there is nothing to bump and no support matrix to maintain. A feature that is interoperable today
  is usable today.

The boundary case, recorded so the rule has a worked example: **a modal's scroll lock is allowed.**
`showModal()` deliberately does not stop the page behind it from scrolling, so imp writes
`overflow: hidden` on the document element while an overlay is open. That is a one-property state
toggle, not an implementation of a primitive the platform provides - nothing is being shadowed. A
focus trap next to it would be forbidden, because `showModal()` already traps focus.

## Consequences

- The overlay components are buildable now, entirely on platform behaviour: the top layer for
  stacking and focus, CSS anchor positioning for placement, `popovertarget` for open and close
  (`todo/overlay-seam.md`). None of it is imp code, so none of it can rot.
- **Users on older browsers get a broken app, not a degraded one**, and that is the accepted cost.
  An app whose audience includes them should not use imp. The most concrete case today is Firefox
  ESR 140, supported until September 2026 and predating anchor positioning by seven releases:
  anchored panels open in the wrong place there. The next ESR branch closes it, which is the general
  shape - gaps against this policy are temporary by construction.
- Some catalog entries fall outside the boundary. `virtualList` is one: windowing reimplements what
  the browser's own scrolling and rendering do, and `content-visibility: auto` with
  `contain-intrinsic-size` is the platform's answer, so imp documents that instead of shipping a
  virtualizer. `carousel` waits for `::scroll-button()` and `::scroll-marker()` to be interoperable
  rather than shipping scroll-button JavaScript now.
- Components with **no** native counterpart - `comboBox`, `datePicker`, `tree` - stay in scope. They
  are not substitutes for anything; the platform simply has no such control. They remain the largest
  ARIA and keyboard surfaces in the library, and the accessibility contract, not this decision, is
  what holds them honest.
- Reading imp's source, an agent or a maintainer never has to ask which of two paths runs, because
  there is one. The same property makes the compiled binary smaller and the e2e suite meaningful: it
  exercises the only implementation there is.
- The cost is reach. imp trades the tail of older installs for a library that is mostly platform
  calls, and states the trade publicly (`docs/browser-support.md`) rather than discovering it in a
  bug report.
