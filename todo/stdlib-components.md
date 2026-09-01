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
`imp/std`, every other group is `imp/std/<group>` - `imp/std/inputs`, `imp/std/navigation`, and so
on. A group is registered as a subpath when it lands; until then the specifier fails with an
imp-branded error listing what exists.

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

- **General** - `button`, `heading`, `text`, `link` and `icon` have landed; the conventions they
  fixed are recorded in `adr/standard-component-library.md` and `adr/bundled-icon-set.md`, and
  documented in `docs/std-components.md`.
- **Layout** - `flex` and `stack` have landed, opening the `imp/std/layout` subpath and settling the
  group's shape: two flex primitives, alignment named physically, spacing as a `gap` step, and
  nothing else (`adr/layout-two-flex-primitives.md`). `shell`, the app frame of header / rail /
  sidebar / content / aside that works on a phone and a desktop, has landed alongside them
  (`adr/app-shell-component.md`), and the contents its regions are usually filled with ship beside
  it as `imp/std/shell` (`adr/shell-region-components.md`). **`scrollArea` is out of scope** for the
  same reason `virtualList` is - custom scrollbars reimplement the browser's own scrolling
  (`adr/browser-support-baseline.md`).
- **Inputs** - `comboBox` (autocomplete), `slider`, `datePicker`, `dateRangePicker`, `timePicker`,
  `fileUpload`, `segmented`, `toggleGroup`, `tagInput` _(later)_, `colorPicker` _(later)_, `rating`
  _(later)_, `otpField` _(later)_, `cascader` _(later)_, `treeSelect` _(later)_. `form` and the form
  layer have landed with `textField`, `passwordField`, `searchField`, `textArea`, `numberField`,
  `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton` and `resetButton`, opening the
  `imp/std/inputs` subpath and settling the field-binding contract (`adr/state-driven-forms.md`) -
  details in _Form handling_ below.
- **Display** - `card`, `badge`, `avatar`, `tooltip`, `popover`, `accordion`, `descriptionList`,
  `statistic`, `timeline` _(later)_, `image` (preview/zoom) _(later)_, `calendar` _(later)_,
  `qrCode` _(later)_. **`carousel` waits** for `::scroll-button()` and `::scroll-marker()` to be
  interoperable - scroll-button JavaScript in the meantime is what `adr/browser-support-baseline.md`
  rules out. `emptyState` has landed, opening the `imp/std/display` subpath and fixing the wording
  convention (`adr/translatable-by-default.md`); `tag` landed with it, and is what a `navMenu`
  item's `tag` data renders.
- **Feedback** - `spinner`, `progress`, `alert`, `toast`, `drawer`, `skeleton`, `popconfirm`,
  `result` _(later)_. Every overlay in this group builds on the seam `dialog` opened
  (`adr/overlay-top-layer.md`), but **`dialog` itself belongs to _Layout & placement_** below: it is
  a frame to put content in, not something the app says to the user. `bugReport` has landed ahead of
  the rest, opening the `imp/std/feedback` subpath: it shares the dev server's element picker and
  context capture through `lib/src/report.js` (`adr/in-page-review-capture.md`), and it settled two
  things the group inherits - **an asynchronous, failable action is a function prop** (`onSubmit`)
  rather than an `events` entry, because a `CustomEvent` cannot be awaited, and **a component
  composes `button` rather than restyling a native one** - it drives the nested button through props
  (a state handle for `disabled` or `loading`) and focuses it through its host, which every
  component now supports (`adr/focus-delegation.md`).
- **Shell** - the frame's usual region contents have landed as `imp/std/shell`: `appLogo`,
  `breadcrumbs` (the trail; its picker is still owed - `todo/breadcrumbs.md`), `userCard`,
  `themeSelect` and `langSelect` (`adr/shell-region-components.md`). Still wanted here: a **tenant /
  workspace switcher**, which needs the anchored panel from `todo/overlay-seam.md`, and a
  **notifications bell**, which wants `badge` from _Display_ first.
- **Navigation** - `pagination`, `dropdownMenu`, `steps`, `anchorNav` _(later)_, `floatButton`
  _(later)_. `tabs` has landed, opening the `imp/std/navigation` subpath and fixing the data-driven
  shape every composite widget with internal ARIA id references follows (`adr/component-preview.md`
  is its first consumer); `navMenu` landed with it. The roadmap's `menu` is **`navMenu`**: a list of
  destinations rendering a `<nav>` of links, not a `role="menu"` of actions - that one is
  `dropdownMenu`.
- **Data** - `table` (sorting, filtering, pagination, row selection), `list`, `tree`, `transferList`
  _(later)_. **`virtualList` is out of scope**: windowing reimplements the browser's own scrolling,
  measurement and rendering, which `adr/browser-support-baseline.md` forbids -
  `content-visibility: auto` with `contain-intrinsic-size` is the answer, documented rather than
  wrapped.

## Layout & placement

`flex` and `stack` are the whole arrangement set and the group is deliberately staying that small
(`adr/layout-two-flex-primitives.md`); `shell` is the app frame beside them
(`adr/app-shell-component.md`), and `dialog` is the frame an app opens over its page. `dialog`
landed with the overlay seam every other overlay in the catalog builds on
(`adr/overlay-top-layer.md`): there is **no separate `modal`**, because `dialog({ modal })` is both
the frame frozen in the centre of the page and the window the user can drag anywhere, the two
differing only in which top-layer promotion they use. What is left of the seam - the anchored ones
in _Display_ and _Navigation_ among them - is in `todo/overlay-seam.md`. What is still owed:

- **Whether a grid is ever wanted.** A dense form or a dashboard of cards is CSS grid in the app's
  own component today. That is the deliberate answer for now; revisit only with a real call site
  that a nested `flex`/`stack` genuinely cannot express.
- **`splitPane`** - user-resizable panes - is still wanted and is unblocked by the redesign.

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

- **Settled library-wide** (`adr/responsive-fluid-values-only.md`): a prop takes exactly one value,
  applied at every width, resolved into one per-instance CSS custom property. No component varies a
  prop or hides itself by screen size. Every group after this one follows the same spelling.
- **`--imp-breakpoint-desktop` (48rem) is a theme token**, so an app can reuse the width in `calc()`
  and read it from JS. It is a value token only: **a media query cannot read a custom property**, so
  a query still needs the literal. Do not build anything that implies otherwise.
- **Components adapt below the breakpoints they care about:** `table` switches to stacked cards or
  horizontal scroll; `dialog` goes full-screen, which drops dragging with it - there is nowhere to
  drag a full-screen panel to; `drawer` becomes a bottom sheet; pickers render touch-appropriate
  panels.
- **Touch targets** meet a minimum size taken from the theme tokens.
- **A state-shaped `breakpoint` value** (readable + watchable) is still owed, for the structural
  swaps CSS cannot express - `table`'s card mode is the first real consumer, so it lands with the
  data group rather than being invented ahead of one.

## Conventions

The shape every component follows - `imp-` prefixed custom elements, lazy definition, the
`(props?, ...children)` call shape, closed and logged prop sets, live props taking state, tokens
with fallbacks, logical properties, no outer margins - is settled and recorded in
`adr/standard-component-library.md`. What is still open here:

- **A component name may not shadow a browser global.** An import binding shadows the global of the
  same name for the whole module, so `import { alert } from 'imp/std/feedback'` makes `alert(...)`
  later in that file the component, silently. It is the `switch` problem without the syntax error to
  catch it, and it lands on app code rather than on imp. It has already decided one name here - the
  overlay component is `dialog` (`todo/overlay-seam.md`) - and **`alert` in _Feedback_ above is the
  same collision, still unresolved.** The list to check a candidate against is the one the platform
  owns: `name`, `length`, `status`, `origin`, `event`, `open`, `close`, `focus`, `blur`, `print`,
  `scroll`, `history`, `screen`, `location`, `top`, `parent`, `self`, `frames`, `menubar`,
  `toolbar`. Shadowing an imp **element factory** is a different thing and is fine - the two are
  separate namespaces and `button`, `text`, `link` and `select` already do it.
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
