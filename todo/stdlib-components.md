# Standard component library - what is left

The catalog is built, and `adr/short-component-catalog.md` records its shape. This file lists the
work that waits for a consumer, for a browser, or for a person.

## Responsive

- **A `breakpoint` value with the shape of a state** is still owed. A person must be able to read it
  and to watch it. It serves the structural swap that CSS cannot express. `table` switches to cards
  through a container query. `shell` swaps its navigation at the one breakpoint, and it reads its
  own media query, because nothing outside it needs the value. So no consumer exists yet. Build the
  state with the first consumer outside `shell`.

## Components that wait

- **`carousel` waits** until `::scroll-button()` and `::scroll-marker()` work in every browser. To
  write JavaScript for a scroll button in the meantime is what `adr/browser-support-baseline.md`
  forbids.
- **`image` with a zoom, and `qrCode`** are not built. Each waits for a call site.

## Platform features that wait

- **`closedby="any"` on `<dialog>`** ships in Chrome 134 and Firefox 141, and in a Safari preview
  only. When Safari ships it, remove the listener of the seam for a click on the backdrop, and let
  the attribute close the modal. Keep `beforeClose` on that path. See `adr/overlay-top-layer.md`.

## Verification that is still owed

The e2e suite runs in Chrome. A screenshot pass in Chrome covered the light theme, the dark theme
and the forced-colours mode of the components. These checks cannot run in that suite, so a person
runs them by hand:

- Firefox and Safari, for the native `<progress>`, `<input type="range">` and `<details name>`
  styles, and for the anchored panels of `menuButton`, `datePicker` and `comboBox`.
- A screen reader pass over `table`, `comboBox`, `calendar`, `splitPane` and `toast`, with each
  supported pair of screen reader and browser.
