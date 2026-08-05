# Standard component library

Ship a batteries-included component library so an app can be built without assembling a component
stack or pulling third-party UI dependencies - imp is an all-in-one toolkit targeting the 80%
(dashboards, CRUD, internal tools, product UIs).

## What ships

Components are importable from imp itself (never a third-party package). The catalog targets rough
parity with the mainstream sets (antd, shadcn/ui) inside the 80% scope. Entries marked _(later)_ are
fast-follow tier - listed now so the shape of the full set is fixed up front, built after the core
lands.

**Imports are grouped by subpath** (`adr/standard-component-library.md`): the base group is
`imp/std`, every other group is `imp/std/<group>` - `imp/std/layout`, `imp/std/inputs`, and so on. A
group is registered as a subpath when it lands; until then the specifier fails with an imp-branded
error listing what exists.

**Names are the natural ones** - `button`, `text`, `form`, `select` - because `imp/std` is a
separate namespace from the element factories, so shadowing one is not a conflict. A file that needs
both the raw element and the component aliases one of them at the import
(`import { button as stdButton } from 'imp/std'`). The one hard limit is JS reserved words: `switch`
is impossible as an import binding, so that component is `toggle` - which sits awkwardly next to
`toggleGroup`, to be revisited when the inputs group lands.

**A component is not done until it ships a skill** - a `<module>.skill.md` file next to it, printed
by `imp skill std/<name>` (`adr/agent-skills.md`). Exporting it from a barrel is the only
registration; the subject is derived from there. A test fails when a component reaches a barrel
without a skill file, so this is enforced rather than remembered.

- **General** - `icon`. `button`, `heading`, `text` and `link` have landed; the conventions they
  fixed are recorded in `adr/standard-component-library.md` and documented in
  `docs/std-components.md`.
- **Layout** - `splitPane` _(later)_, `aspectBox` _(later)_ - placement details in _Layout &
  placement_ below. `stack`, `row`, `grid`, `item`, `container`, `spacer`, `divider` and
  `scrollArea` have landed, opening the `imp/std/layout` subpath and fixing the responsive prop
  convention for the whole library (`adr/responsive-layout-props.md`); `appShell` and `toolbar`
  landed with them.
- **Inputs** - `comboBox` (autocomplete), `slider`, `datePicker`, `dateRangePicker`, `timePicker`,
  `fileUpload`, `segmented`, `toggleGroup`, `tagInput` _(later)_, `colorPicker` _(later)_, `rating`
  _(later)_, `otpField` _(later)_, `cascader` _(later)_, `treeSelect` _(later)_. `form` and the form
  layer have landed with `textField`, `passwordField`, `searchField`, `textArea`, `numberField`,
  `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton` and `resetButton`, opening the
  `imp/std/inputs` subpath and settling the field-binding contract (`adr/state-driven-forms.md`) -
  details in _Form handling_ below.
- **Display** - `card`, `badge`, `avatar`, `tag`, `tooltip`, `popover`, `accordion`,
  `descriptionList`, `statistic`, `timeline` _(later)_, `image` (preview/zoom) _(later)_, `calendar`
  _(later)_, `qrCode` _(later)_. **`carousel` waits** for `::scroll-button()` and
  `::scroll-marker()` to be interoperable - scroll-button JavaScript in the meantime is what
  `adr/browser-support-baseline.md` rules out. `emptyState` has landed, opening the
  `imp/std/display` subpath and fixing the wording convention (`adr/translatable-by-default.md`).
- **Feedback** - `spinner`, `progress`, `alert`, `toast`, `modal`, `drawer`, `skeleton`,
  `popconfirm`, `result` _(later)_. How the overlays among them reach above the page is settled in
  `todo/overlay-seam.md`, which also covers the anchored ones in _Display_ and _Navigation_.
- **Navigation** - `breadcrumbs`, `pagination`, `dropdownMenu`, `steps`, `anchorNav` _(later)_,
  `floatButton` _(later)_. `tabs` has landed, opening the `imp/std/navigation` subpath and fixing
  the data-driven shape every composite widget with internal ARIA id references follows
  (`adr/component-preview.md` is its first consumer); `navMenu` and `commandPalette` landed with it.
  The roadmap's `menu` is **`navMenu`**: a list of destinations rendering a `<nav>` of links, not a
  `role="menu"` of actions - that one is `dropdownMenu`.
- **Data** - `table` (sorting, filtering, pagination, row selection), `list`, `tree`, `transferList`
  _(later)_. **`virtualList` is out of scope**: windowing reimplements the browser's own scrolling,
  measurement and rendering, which `adr/browser-support-baseline.md` forbids -
  `content-visibility: auto` with `contain-intrinsic-size` is the answer, documented rather than
  wrapped.

## Layout & placement

The layout group is the placement toolkit - child positioning is expressed through layout parents
and a placement wrapper, not per-component positioning props. What landed:

- **`stack` / `row`** carry the flex placement surface: `direction`, `gap`, `justify`, `align`,
  `wrap` - enough that app code almost never writes raw flex CSS. They are one component with
  opposite default directions.
- **`grid`** is a count of equal columns (`columns`, 1-12) plus `minItemWidth` for the auto-fitting
  case, not a track template. The antd Row/Col model was **dropped**: a 24-column grid with `offset`
  on the children buys nothing over `columns` + `item({ span, start })`, and a percentage `offset`
  is the one placement that cannot be expressed cleanly on an auto-placed grid item. Named-area
  templates (`areas`) were left out too - add them when something needs one.
- **`item`** is the placement wrapper: `grow`, `span`, `start`, `rowSpan`, `order`, `align`. Per-
  child placement has to live on a wrapper because `:host { display: contents }` means a child
  component's own root - inside its shadow - is the real flex or grid item, and no selector from the
  parent can reach it (`adr/responsive-layout-props.md`).
- **`spacer`, `divider`, `container`, `scrollArea`** round out spacing, separation, max-width
  centering, and overflow control. `container` widths are theme tokens (`--imp-container-sm` ...
  `-xl`); `splitPane` adds user-resizable panes _(later)_.
- All spacing values come off the theme's spacing scale as a step `0`-`6`, not free-form pixels, so
  layouts stay consistent across an app.

What `appShell` settled, since it landed ahead of the feedback group rather than waiting for
`drawer`:

- **It is a viewport frame**, not a block that grows: `100dvh`, with `main` and the sidebar
  scrolling and the header, footer and bottom bar holding their place.
- **Regions are props, content is children** - `header`, `sidebar`, `footer`, `bottomBar` render as
  `<header>`, `<aside>`, `<footer>` and a bottom strip; the children are `<main>`.
- **The collapse is CSS-driven, not a `drawer`.** Below `collapseBelow` the sidebar hides and a menu
  button in the header shows it as a fixed overlay with a backdrop, `inert` on the rest of the
  frame, Escape and backdrop dismissal, focus moved in and handed back, and a bubbling `select`
  closing it. The sidebar never moves in the DOM - the docked and overlay states differ only in
  per-breakpoint custom properties, so nothing is re-parented or re-mounted. **It stays its own
  thing when `drawer` lands** (`todo/overlay-seam.md`): a `<dialog>` is open or closed, while this
  sidebar is docked at one breakpoint and an overlay at another, and driving that from a
  `matchMedia` listener is exactly the JS-resolved layout and wrong first paint
  `adr/responsive-layout-props.md` rejected.
- **A flex item's `z-index` applies even when it is `position: static`**, which is why the sidebar's
  overlay `z-index` is part of the collapsed state rather than a constant: a constant one painted
  the docked sidebar over the header's dropdowns.

Still open in this group:

- **`splitPane`** - user-resizable panes.

## Form handling

`form` grows from an SPA-default `submit` wrapper into a proper form layer (what antd `Form`
provides), still built entirely on named state:

- **A form is a state object, and fields address it by path.** `form` takes an `initialValues`
  prop - a plain object - and internally calls `initState('imp.form', initialValues ?? null)`, so
  the form's values are ordinary named state living at the form's own position in the tree. There is
  no separate form-value store to sync and nothing for the app to wire: dropping a `form` into a
  view creates the state, and unmounting it disposes it with the rest of the subtree.

  A control inside that form names the field it owns with a **dot-separated path** rather than being
  handed a state handle:

  ```js
  form(
    { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' } },
    textField({ field: 'user.firstName', label: 'First name' }),
    select({ field: 'plan', options: PLANS }),
  )
  ```

  The control resolves `imp.form` from its own position (the same `useState` lookup every other
  component does), reads its field by walking the path, and writes back by rebuilding the object
  along that path. This is what makes nested fields work without a writable projection in the
  kernel: the path is data the control can walk in both directions, where `computed(...)` is a
  function that can only be walked one way. It also keeps the call site free of plumbing - a field
  is a string, which is exactly the shape an agent gets right.

  Consequences to work through when the group is built:
  - **A control with `field` must be inside a `form`.** Resolving `imp.form` from outside one is an
    imp-branded error naming the offending field, not a silent no-op.
  - **`field` and `value` are alternatives, not partners.** `value` (a state-shaped value or a plain
    one) stays the way a control is used standalone; `field` is the in-form spelling. Passing both
    is logged and `field` wins.
  - **Path writes rebuild, they do not mutate** - `set` gets a new object so content-equality dedup
    and structural comparison keep behaving.
  - Validation rules, `touched`/`dirty` and `reset` all key off the same paths, so the form layer
    has one addressing scheme end to end.

  **The names are settled: `textField` and friends**, chosen over `textInput` / `inputText`.
- **There is no `formField` wrapper component.** `label[for]`, `aria-describedby` and `aria-invalid`
  resolve by id and cannot cross a shadow root, so a wrapper could never label the control it wraps.
  Every control renders its own label, required marker, help text and error instead, taking `label`,
  `ariaLabel`, `help` and `required` as props; `radioGroup` renders a `<fieldset>`/`<legend>` for
  the same reason. The antd layout variants (vertical, horizontal, inline) are driven by the form's
  `layout` prop through inherited custom properties.
- **Validation is declarative per field** - `required`, `minLength`/`maxLength`, `min`/`max`,
  `pattern` and a custom `validate` - evaluated at the control's commit point and again on submit.
  Errors live in `imp.form.errors` as a message key plus params, so a language switch re-renders
  them in place. `validateAsync` covers checks that need the network: it runs on blur and submit
  only, tracks in-flight checks in `imp.form.validating`, and submit waits on that state emptying.
- **Submit runs from a handler, not a native submit event**: `form` gates on validity, and
  `submitButton` / `resetButton` find their form through a composed bubbling event and read
  `imp.form.submitting` to drive their own spinner. Implicit submission (Enter in a single-line
  field) is implemented by `form`.
- **Touched tracking and `reset`** to initial values come with the form state; an error is shown
  only once its field is touched or a submit has been attempted.

Still owed by this group:

- **`dirty` tracking** (values differing from `initialValues`) is not implemented; `touched` is.
- **Form-level errors** - a submit failure that belongs to no single field - have no home yet.

## Responsive & mobile

Mobile layout is first-class, not a separate component set:

- **Settled with the layout group** (`adr/responsive-layout-props.md`): the `xs`-`xl` scale, the
  per-breakpoint object every layout-affecting prop accepts
  (`direction: { xs: 'column', md: 'row' }`), inherit-from-below semantics, `hideBelow`/`hideAbove`,
  and resolution into per-instance CSS custom properties consumed by static media queries. Every
  group after this one follows the same spelling.
- **The breakpoint scale is _not_ theme tokens**, contrary to the original plan here: a media query
  cannot read a custom property, so themeable widths would force JS-resolved layout and a wrong
  first paint. The widths are fixed and documented as such; do not add `--imp-breakpoint-*` tokens
  that would silently do nothing.
- **Components adapt below the breakpoints they care about:** `appShell` already collapses its
  sidebar into an overlay behind a menu button; `table` switches to stacked cards or horizontal
  scroll; `modal` goes full-screen; `drawer` becomes a bottom sheet; pickers render
  touch-appropriate panels.
- **Touch targets** meet a minimum size taken from the theme tokens.
- **A state-shaped `breakpoint` value** (readable + watchable) is still owed, for the structural
  swaps CSS cannot express - `table`'s card mode is the first real consumer, so it lands with the
  data group rather than being invented ahead of one. Pure-CSS responsiveness covers the layout
  group completely without it.

## Conventions

The shape every component follows - `imp-` prefixed custom elements, lazy definition, the
`(props?, ...children)` call shape, closed and logged prop sets, live props taking state, tokens
with fallbacks, logical properties, no outer margins - is settled and recorded in
`adr/standard-component-library.md`. What is still open here:

- **Two-way binding by convention:** an input's `value`/`checked` prop accepts anything
  **state-shaped** - an object with `get`/`watch`/`set`, whether it came from
  `initState`/`useState`, `computed` (read-only controls), or user code implementing the same shape.
  Pass a plain value instead for an uncontrolled initial. The readable half is already in place (the
  ADR's _live props_); the writable half is the `set` call below, and reaching **one field of a form
  state** is the `field` path contract in _Form handling_. Three rules make the binding sound, and
  every stdlib control follows them uniformly:
  - The control subscribes with `watch` and updates its own element **in place** - never through a
    region rebuild - so focus and caret survive external `set`s.
  - It writes back with `set` at the commit point that fits the control (`input` for free typing,
    `change` for pickers, blur/debounce where that is the better default) - the control owns its
    commit semantics instead of exposing modifier soup.
  - It never emits a commit in response to a programmatic value assignment it made itself; together
    with `set`'s content-equality dedup this keeps set -> watch -> set echo loops from forming.

  The bind contract is **public and documented**, not a stdlib-internal convention: custom
  components and third-party widget wrappers accept state-shaped values the same way, with the
  stdlib as the reference implementation.
- **Add the theme-completeness check once the token surface is final.** The token list grows one
  component at a time, so there is no canonical set to validate against yet. When all components
  have landed and the full `--imp-*` token list is settled, freeze that list and have `applyTheme`
  warn (through the shared `impLogger`, non-fatal - the app still runs) when an applied theme is
  missing any known token key. This is the runtime check the theming ADR
  (`adr/themable-by-default-tokens.md`) defers: it only becomes meaningful with the complete list in
  hand, and the built-in light / dark themes must define every key on it.
- **Nothing is open on wording.** Strings pipe through `t()` under an `imp.` key, bound through
  `lang`, and each component declares its own English default with `defaultMessages` beside its
  `component()` call - settled in `adr/standard-component-library.md` and
  `adr/translatable-by-default.md`, and first exercised by `emptyState`. A component that needs a
  new word adds the key and its wording to its own file, and the docs table for that component in
  the same change.

## Dependencies

This is the top of the stack. Named state is in place and considered complete
(`adr/event-propagated-state.md`) and needs no addition for the form layer - `field` paths are
walked by the form components on the public API. Theming is in place
(`adr/themable-by-default-tokens.md`), and each group extends the `--imp-*` token surface as it
lands. Translations are in place (`adr/translatable-by-default.md`). **The overlay components need
no new kernel surface and no `portal`** - they promote into the platform's top layer without moving
in the DOM (`todo/overlay-seam.md`). The stdlib grows group by group; a group that needs a missing
dependency waits for it.

**The feedback group owes the HTTP client its wiring** (`adr/http-client.md`). A client publishes
state-shaped `pending` and `lastError`, so `spinner`/`progress` should accept a client (or its name,
resolved with `useHttpClient` from the component's own position) and show while its calls are in
flight, and `alert`/`toast` should raise a standard failure banner from `lastError` - including the
per-request handles a call opts into with `track`. It is ordinary reactive binding through the
landed state layer, so the work is deciding the prop spelling, not building a coupling mechanism.

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
  it can drive its loading/disabled state and be the target of implicit submission - a prop on
  `form`, not a mode on the button.

## A showcase surface

**`imp preview` is the gallery** - no separate `imp showcase` command is needed. Its catalog groups
every `*.preview.js` by folder, its search finds a component by name or category, and the theme,
language and direction pickers are on the same page, which is what a showcase was for. What is still
missing against essence #20 is a **live theme/locale editor** rather than pickers over the themes a
project already lists; scope that as its own todo when it is wanted.

## ADR impact

`adr/standard-component-library.md` records what the stdlib guarantees; it landed with the General
group and now carries the i18n piping rule too. Still to add to it as the catalog fills out: the
deliberate 80% scope boundary (heavy data viz, native mobile, collaborative editing out of scope).
Each group extends `docs/std-components.md` with its own section as it lands.

## Open questions

- **Whether path addressing stays inside the form layer.** The `field: 'user.firstName'` contract
  above lives in the form components: they walk and rebuild the path themselves, on the public state
  API, with no kernel change. The alternative - a writable path projection in the kernel
  (`user.field('address', 'city')`, or a path form of `computed`) - was prototyped and works, but
  stays **rejected** as unearned while the form layer needs no help (see
  `adr/event-propagated-state.md`). Revisit only if something outside forms wants the same thing;
  the cost would be one more way to address state, and a combinator that is writable or not
  depending on its argument type.
- **Catalog scope for v1.** A core vs. _(later)_ split is drafted in the catalog above; confirm or
  reshuffle it while building - the tier markers are a starting bid, not a commitment.
- **Accessibility baseline.** The ARIA/keyboard contract every interactive component must meet. The
  General group set the opening precedent - render the native element wherever one exists, a
  `:focus-visible` ring from `--imp-color-focus-ring`, and state mirrored into ARIA (`aria-busy` on
  a loading button) - but the full contract (labelling, roving focus, escape/dismiss) is still open.
- **`console.warn` paths** (e.g. duplicate-key warnings surfaced from `each`) route through the
  built-in logger (`adr/built-in-logger.md`).
