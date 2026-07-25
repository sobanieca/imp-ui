# Standard component library

Ship a batteries-included component library so an app can be built without assembling a component
stack or pulling third-party UI dependencies — imp is an all-in-one toolkit targeting the 80%
(dashboards, CRUD, internal tools, product UIs).

## What ships

Components are importable from imp itself (never a third-party package). The catalog targets rough
parity with the mainstream sets (antd, shadcn/ui) inside the 80% scope. Entries marked _(later)_ are
fast-follow tier — listed now so the shape of the full set is fixed up front, built after the core
lands.

**Imports are grouped by subpath** (`adr/standard-component-library.md`): the base group is
`imp/std`, every other group is `imp/std/<group>` — `imp/std/layout`, `imp/std/inputs`, and so on. A
group is registered as a subpath when it lands; until then the specifier fails with an imp-branded
error listing what exists.

**Names are the natural ones** — `button`, `text`, `form`, `select` — because `imp/std` is a
separate namespace from the element factories, so shadowing one is not a conflict. A file that needs
both the raw element and the component aliases one of them at the import
(`import { button as stdButton } from 'imp/std'`). The one hard limit is JS reserved words: `switch`
is impossible as an import binding, so that component is `toggle` — which sits awkwardly next to
`toggleGroup`, to be revisited when the inputs group lands.

- **General** — `icon`. `button`, `heading`, `text` and `link` have landed; the conventions they
  fixed are recorded in `adr/standard-component-library.md` and documented in
  `docs/std-components.md`.
- **Layout** — `stack`, `row`, `grid`, `spacer`, `container`, `divider`, `appShell`, `scrollArea`,
  `splitPane` _(later)_, `aspectBox` _(later)_ — placement details in _Layout & placement_ below.
- **Inputs** — `textField`, `textArea`, `numberField`, `passwordField`, `searchField`, `select`,
  `comboBox` (autocomplete), `checkbox`, `radioGroup`, `toggle`, `slider`, `datePicker`,
  `dateRangePicker`, `timePicker`, `fileUpload`, `segmented`, `toggleGroup`, `tagInput` _(later)_,
  `colorPicker` _(later)_, `rating` _(later)_, `otpField` _(later)_, `cascader` _(later)_,
  `treeSelect` _(later)_, plus `form` and the form layer — details in _Form handling_ below.
- **Display** — `card`, `badge`, `avatar`, `tag`, `tooltip`, `popover`, `accordion`,
  `descriptionList`, `statistic`, `emptyState`, `timeline` _(later)_, `carousel` _(later)_, `image`
  (preview/zoom) _(later)_, `calendar` _(later)_, `qrCode` _(later)_.
- **Feedback** — `spinner`, `progress`, `alert`, `toast`, `modal`, `drawer`, `skeleton`,
  `popconfirm`, `result` _(later)_.
- **Navigation** — `tabs`, `menu`, `breadcrumbs`, `pagination`, `dropdownMenu`, `steps`,
  `commandPalette` _(later)_, `anchorNav` _(later)_, `floatButton` _(later)_.
- **Data** — `table` (sorting, filtering, pagination, row selection), `list`, `tree`, `virtualList`
  _(later)_, `transferList` _(later)_.

## Layout & placement

The layout group is the antd-style placement toolkit — child positioning is expressed through layout
parents, not per-component positioning props:

- **`stack` / `row`** carry the flex placement surface: `justify`, `align`, `gap`, `wrap`,
  `direction` — enough that app code almost never writes raw flex CSS.
- **`grid`** is the antd Row/Col model: a 24-column grid where children declare `span`, `offset`,
  and `order`, with per-breakpoint values for each (see _Responsive & mobile_). Also a plain
  CSS-grid mode (`columns`, `areas`) for dashboard-style placement.
- **`appShell`** is the page-level frame (antd Layout): header, sider, content, footer slots with
  sticky header and collapsible sider built in.
- **`spacer`, `divider`, `container`, `scrollArea`** round out spacing, separation, max-width
  centering, and overflow control; `splitPane` adds user-resizable panes _(later)_.
- All spacing values come off the theme's spacing scale (`--imp-*` tokens), not free-form pixels, so
  layouts stay consistent across an app.

## Form handling

`form` grows from an SPA-default `submit` wrapper into a proper form layer (what antd `Form`
provides), still built entirely on named state:

- **A form is a state object.** `form` accepts the form's state; fields bind to it through the
  two-way contract below — no separate form-value store to sync. This makes the form layer the first
  real consumer of the field-binding open question, which gets decided here.
- **`formField`** wraps a control with label, required marker, help text, and an error slot, with
  the antd layout variants (vertical, horizontal with aligned labels, inline) driven by the form's
  layout prop and logical properties only.
- **Validation is declarative per field** — `required`, min/max, pattern, custom sync/async
  validators — evaluated at the control's commit point and again on submit. Errors live in state, so
  error display is reactive like everything else; default messages route through `t()`.
- **Submit runs from a handler, not a native submit event** (see _Dependencies_): `form` gates on
  validity, wires the submit button's loading/disabled state, surfaces form-level (non-field)
  errors, and provides implicit submission itself.
- **Touched/dirty tracking and `reset`** to initial values come with the form state.

## Responsive & mobile

Mobile layout is first-class, not a separate component set:

- **Breakpoint scale as theme tokens** (`xs`–`xl`), shared by every component and overridable per
  theme.
- **Responsive prop convention:** every layout-affecting prop accepts a per-breakpoint object —
  `grid` spans/offsets (`span: { xs: 24, md: 12 }`), `stack`/`row` direction and gap, visibility
  (`hideBelow`/`hideAbove`). One spelling, used uniformly across the stdlib.
- **Components adapt below the breakpoints they care about:** `appShell` collapses the sider into a
  `drawer` behind a menu button; `table` switches to stacked cards or horizontal scroll; `modal`
  goes full-screen; `drawer` becomes a bottom sheet; pickers render touch-appropriate panels.
- **Touch targets** meet a minimum size taken from the theme tokens.
- **A state-shaped `breakpoint` value** (readable + watchable) is public API, so app code can branch
  on viewport the same way the stdlib does internally.

## Conventions

The shape every component follows — `imp-` prefixed custom elements, lazy definition, the
`(props?, …children)` call shape, closed and logged prop sets, live props taking state, tokens with
fallbacks, logical properties, no outer margins — is settled and recorded in
`adr/standard-component-library.md`. What is still open here:

- **Two-way binding by convention:** an input's `value`/`checked` prop accepts anything
  **state-shaped** — an object with `get`/`watch`/`set`, whether it came from
  `initState`/`useState`, `computed` (read-only controls), or user code implementing the same shape.
  Pass a plain value instead for an uncontrolled initial. The readable half is already in place (the
  ADR's _live props_); the writable half, and how it reaches **one field of a form state**, is open
  — see _Open questions_. Three rules make the binding sound, and every stdlib control follows them
  uniformly:
  - The control subscribes with `watch` and updates its own element **in place** — never through a
    region rebuild — so focus and caret survive external `set`s.
  - It writes back with `set` at the commit point that fits the control (`input` for free typing,
    `change` for pickers, blur/debounce where that is the better default) — the control owns its
    commit semantics instead of exposing modifier soup.
  - It never emits a commit in response to a programmatic value assignment it made itself; together
    with `set`'s content-equality dedup this keeps set → watch → set echo loops from forming.

  The bind contract is **public and documented**, not a stdlib-internal convention: custom
  components and third-party widget wrappers accept state-shaped values the same way, with the
  stdlib as the reference implementation.
- **Add the theme-completeness check once the token surface is final.** The token list grows one
  component at a time, so there is no canonical set to validate against yet. When all components
  have landed and the full `--imp-*` token list is settled, freeze that list and have `applyTheme`
  warn (through `createLogger('imp')`, non-fatal — the app still runs) when an applied theme is
  missing any known token key. This is the runtime check the theming ADR
  (`adr/themable-by-default-tokens.md`) defers: it only becomes meaningful with the complete list in
  hand, and the built-in light / dark themes must define every key on it.
- **User-facing strings pipe through `t()`** and register defaults via `defineMessages` (seeding
  `imp.close`, `imp.loading`, etc.) — gated on the future i18n item.

## Dependencies

This is the top of the stack. Named state is in place and considered complete
(`adr/event-propagated-state.md`) — the one state-side question left is the field-binding contract
above, which is this item's to answer. Theming is in place (`adr/themable-by-default-tokens.md`),
and each group extends the `--imp-*` token surface as it lands. Still needed is the i18n
`t()`/`defineMessages` layer, and some components (`toast`, `modal`, `drawer`) need a `portal`
primitive for DOM rendered outside the owning subtree. The stdlib grows group by group; a group that
needs a missing dependency waits for it.

**Native form semantics are deliberately not used.** A control inside its own shadow root does not
participate in an outside `<form>`, so native submit, `FormData` collection and constraint
validation cannot reach std components. Rather than adding form-associated custom elements
(`static formAssociated` + `ElementInternals`) to the kernel to recover them, the form layer stays
state-driven end to end: `form` holds the values, validation is declarative, and submitting runs
from a button's `click` handler. `button` therefore has no `type` prop
(`adr/standard-component-library.md`). Two things the form layer owes as a result:

- **Implicit submission.** Enter in a single-line field must submit the form, since the platform
  will not do it. `form` implements it (watch `keydown` on its fields, respecting `textArea`, IME
  composition and modifier keys) and every input group is checked against it.
- **A designated submit action.** `form` needs a spelling for "this is the button that submits" so
  it can drive its loading/disabled state and be the target of implicit submission — a prop on
  `form`, not a mode on the button.

## A showcase surface

Consider an `imp showcase` / component-gallery command (essence #20 lists a gallery with a live
theme/locale editor) so agents and humans can see every component render under each theme and
direction. Scope it as its own todo if it grows beyond a thin dev-server view.

## ADR impact

`adr/standard-component-library.md` records what the stdlib guarantees and landed with the General
group. Still to add to it as the catalog fills out: the i18n piping rule once `t()` exists, and the
deliberate 80% scope boundary (heavy data viz, native mobile, collaborative editing out of scope).
Each group extends `docs/std-components.md` with its own section as it lands.

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
- **Catalog scope for v1.** A core vs. _(later)_ split is drafted in the catalog above; confirm or
  reshuffle it while building — the tier markers are a starting bid, not a commitment.
- **Responsive prop mechanics.** Whether per-breakpoint props compile to pure CSS (media/container
  queries generated by the component) or resolve in JS via the `breakpoint` state — CSS is likely
  the default for layout, with the JS path reserved for structural swaps like `table`'s card mode.
- **Overlay management.** Shared stacking/focus-trap/escape handling for `modal`/`drawer`/`toast`
  rather than each rolling its own.
- **Accessibility baseline.** The ARIA/keyboard contract every interactive component must meet. The
  General group set the opening precedent — render the native element wherever one exists, a
  `:focus-visible` ring from `--imp-color-focus-ring`, and state mirrored into ARIA (`aria-busy` on
  a loading button) — but the full contract (labelling, roving focus, escape/dismiss) is still open.
- **`console.warn` paths** (e.g. duplicate-key warnings surfaced from `each`) route through the
  built-in logger (`todo/logger.md`).
