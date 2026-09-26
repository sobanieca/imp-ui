# Standard component library - what is left

The catalog is built, and `adr/short-component-catalog.md` records its shape: one component per job,
a prop for a variant, and an infinite scroll in place of a pager. The groups are `imp/std`,
`layout`, `inputs`, `display`, `shell`, `feedback` and `data`. Each component ships a skill file, a
preview and a unit test. This file lists the work that is still owed.

## Form layer

- **The tracking of `dirty`**, which is a value that differs from `initialValues`, is not
  implemented. `touched` is.
- **An error at the level of the form** has no home yet. That is a failure of a submit that belongs
  to no single field.

## Responsive

- **A `breakpoint` value with the shape of a state** is still owed. A person must be able to read it
  and to watch it. It serves the structural swap that CSS cannot express. `table` switches to cards
  through a container query, so no consumer exists yet. Build it with the first consumer.

## Theme

- **A check about a complete theme.** After somebody settles the full list of `--imp-*` tokens,
  freeze that list. Then make `applyTheme` warn, through the shared `impLogger`, when an applied
  theme has no value for a known token key. The warning must not be fatal.

## Components that wait

- **`splitPane`**, a set of panes that a user can resize, is still wanted.
- **A switcher for a tenant, or for a workspace**, in `imp/std/shell`. It is a `menuButton` with
  `items` and a trigger that shows the current choice.
- **`carousel` waits** until `::scroll-button()` and `::scroll-marker()` work in every browser. To
  write JavaScript for a scroll button in the meantime is what `adr/browser-support-baseline.md`
  forbids.
- **A continuous bar for a multi-day event** in the month view of `calendar`. Today the event shows
  as a chip in every day that it covers.
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
- A `comboBox` inside a modal `dialog`. Escape closes the list and must not also cancel the dialog.

## Open questions

- **Whether the addressing by a path stays inside the form layer.** The contract of
  `field: 'user.firstName'` lives in the form components. A writable projection of a path in the
  kernel stays **rejected** as unearned, see `adr/event-propagated-state.md`. Reconsider it only
  when something outside a form wants the same thing.
- **The accessibility baseline.** The contract about ARIA and the keyboard that every interactive
  component must meet is in `todo/accessibility.md`.
