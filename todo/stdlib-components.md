# Standard component library - what is left

The catalog is built, and `adr/short-component-catalog.md` records its shape: one component per job,
a prop for a variant, and an infinite scroll in place of a pager. The groups are `imp/std`,
`layout`, `inputs`, `display`, `shell`, `feedback` and `data`. Each component ships a skill file, a
preview and a unit test. This file lists the work that is still owed.

## Responsive

- **A `breakpoint` value with the shape of a state** is still owed. A person must be able to read it
  and to watch it. It serves the structural swap that CSS cannot express. `table` switches to cards
  through a container query, so no consumer exists yet. Build it with the first consumer.

## Components that wait

- **`carousel` waits** until `::scroll-button()` and `::scroll-marker()` work in every browser. To
  write JavaScript for a scroll button in the meantime is what `adr/browser-support-baseline.md`
  forbids.
- **`timeline`, `image` with a zoom, and `qrCode`** are not built. Each waits for a call site.

## Verification that is still owed

The agents that built the new components looked at each one in Chrome, in the light theme. These
checks are open:

- Firefox and Safari, for the native `<progress>`, `<input type="range">` and `<details name>`
  styles.
- The dark theme and the forced-colours mode of every new component.
- A screen reader pass over `table`, `comboBox`, `calendar` and `toast`.
- An e2e spec for the mirrored geometry of `chart`, `gantt`, `calendar` and the corner of `toast`.
  happy-dom cannot measure geometry, so the unit tests assert only the declared logical CSS.

## Open questions

- **The accessibility baseline.** The contract about ARIA and the keyboard that every interactive
  component must meet is in `todo/accessibility.md`.
