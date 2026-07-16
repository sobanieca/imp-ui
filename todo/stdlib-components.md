# Standard component library

Ship a batteries-included component library so an app can be built without assembling a component
stack or pulling third-party UI dependencies (essence #5/#6 in `prev/essence.md`: imp is an
all-in-one toolkit targeting the 80% — dashboards, CRUD, internal tools, product UIs). A fleshed-out
draft set lives in `prev/experiment/stdlib/`.

## What ships

Group components the way the draft does, importable from imp itself (never a third-party package):

- **Layout** — `stack`, `row`, `grid`, `spacer`, `container`.
- **Inputs** — `textField`, `textArea`, `selectBox`, `checkbox`, `radioGroup`, `switchToggle`,
  `slider`, `datePicker`, `formBox` (SPA-default `submit` with `preventDefault`).
- **Display** — `card`, `badge`, `avatar`, `tag`, `tooltip`.
- **Feedback** — `spinner`, `progressBar`, `alert`, `toast`, `modal`, `drawer`.
- **Navigation** — `tabs`, `menuList`, `breadcrumbs`, `pagination`.
- **Data** — `dataTable`, `listView`, `tree`.

## Conventions (keep from the draft)

- **Components follow the kernel model** — plain lowercase helper functions for lifeless pieces,
  `component(name, …)` web components where a lifecycle is needed
  (`adr/web-component-lifecycle.md`), one naming rule (lint-enforced). Built entirely on the public
  kernel API, nothing privileged.
- **Two-way binding by convention:** an input's `value`/`checked` prop accepts anything
  **state-shaped** — an object with `get`/`watch`/`set`, whether it came from
  `initState`/`useState`, `computed` (read-only controls), or user code implementing the same shape.
  Pass a plain value instead for an uncontrolled initial. How this reaches **one field of a form
  state** is open — see _Open questions_. Three rules make the binding sound, and every stdlib
  control follows them uniformly:
  - The control subscribes with `watch` and updates its own element **in place** — never through a
    region rebuild — so focus and caret survive external `set`s.
  - It writes back with `set` at the commit point that fits the control (`input` for free typing,
    `change` for pickers, blur/debounce where that is the better default) — the control owns its
    commit semantics instead of exposing modifier soup.
  - It never emits a commit in response to a programmatic value assignment it made itself; together
    with `set`'s `Object.is` dedup this keeps set → watch → set echo loops from forming.

  The bind contract is **public and documented**, not a stdlib-internal convention: custom
  components and third-party widget wrappers accept state-shaped values the same way, with the
  stdlib as the reference implementation.
- **Every component consumes `--imp-*` theme tokens** (`todo/theme-styling.md`) and styles with
  `css``` using **logical properties only**, so theming and RTL work for free.
- **User-facing strings pipe through `t()`** and register defaults via `defineMessages` (the draft's
  `stdlib/index.js` seeds `imp.close`, `imp.loading`, etc.) — gated on the future i18n item.

## Dependencies

This is the top of the stack. Named state is in place and considered complete
(`adr/event-propagated-state.md`) — the one state-side question left is the field-binding contract
above, which is this item's to answer. Still needed are the `css` tagged template + theme tokens
(`todo/theme-styling.md`) and the i18n `t()`/`defineMessages` layer. Some components (`toast`,
`modal`, `drawer`) also need a `portal` primitive for DOM rendered outside the owning subtree. Land
those first; the stdlib can grow group by group.

## A showcase surface

Consider an `imp showcase` / component-gallery command (essence #20 lists a gallery with a live
theme/locale editor) so agents and humans can see every component render under each theme and
direction. Scope it as its own todo if it grows beyond a thin dev-server view.

## ADR impact

New ADR `standard-component-library.md`: what the stdlib guarantees (token-driven, i18n-piped,
logical-properties-only, state-bound-by-convention, lowercase-function components on the public
API), and the deliberate 80% scope boundary (heavy data viz, native mobile, collaborative editing
out of scope). Update the ADR table; document the component catalog in `docs/`.

## Open questions

- **How a control binds one field of a form state.** The two-way contract above assumes a control
  can be handed a single state-shaped value with `set` for its own field. Nothing in the kernel
  produces one for a **nested** field: `computed([user], (u) => u.address.city)` reads it (and, with
  structural comparison, notifies only when that field changes), but is read-only, and a write
  function cannot be inverted out of it. Two ways out, to be decided while building the first
  controls, not before:
  - **Split the contract** — `value` takes a readable, and the control reports commits separately
    (`textField({ value: computed(…), commit: (city) => user.set(…) })`). No kernel change; the
    spread stays in app code, where it is explicit.
  - **A path-addressed projection in the kernel** — a writable view built from a path rather than a
    function, so imp can walk it to read and rebuild it to write. Spelled either as a new helper
    entry (`user.field('address', 'city')`) or as a path form of `computed`. Prototyped and proven
    to work on the public API alone; **rejected for now** as unearned without a consumer (see
    `adr/event-propagated-state.md`). If the split contract turns out to be clumsy across the input
    group, this is the fallback — the cost is one more way to address state, and, for the `computed`
    spelling, a combinator that is writable or not depending on its argument type.
- **Catalog scope for v1.** Which of the draft groups are must-have vs. later additions.
- **Overlay management.** Shared stacking/focus-trap/escape handling for `modal`/`drawer`/`toast`
  rather than each rolling its own.
- **Accessibility baseline.** The ARIA/keyboard contract every interactive component must meet.
- **`console.warn` paths** (e.g. duplicate-key warnings surfaced from `each`) route through the
  built-in logger (`todo/logger.md`).
