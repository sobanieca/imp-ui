# Standard component library - what is left

The catalog is built, and `adr/short-component-catalog.md` records its shape. This file lists the
work that waits for a browser, or for a person.

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
