# Standard component library

Ship a component library that includes the batteries. So a person can build an app, and assemble no
stack of components, and pull in no third-party UI dependency. imp is a complete toolkit, and it
targets the 80%. That is a dashboard, CRUD, an internal tool, and the UI of a product.

## What ships

A person imports a component from imp itself, and never from a third-party package. The catalog aims
for rough parity with the mainstream sets, which are antd and shadcn/ui, inside the scope of the
80%. An entry that carries the mark _(later)_ is in the tier that follows quickly. It is listed now,
so that the shape of the full set is fixed at the start. Somebody builds it after the core lands.

**imp groups the imports by subpath**, see `adr/standard-component-library.md`. The base group is
`imp/std`. Every other group is `imp/std/<group>`, such as `imp/std/inputs` and
`imp/std/navigation`. imp registers a group as a subpath when the group lands. Until then, the
specifier fails, with an error that carries the imp brand, and that lists the groups that exist.

**The names are the natural ones**, such as `button`, `text`, `form` and `select`. `imp/std` is a
namespace that is separate from the element factories. So to shadow a factory is not a conflict. A
file that needs the raw element and the component gives one of them an alias at the import, as in
`import { button as stdButton } from 'imp/std'`. The one hard limit is a reserved word of
JavaScript. `switch` cannot be an import binding. So that component is `toggle`, and that name sits
awkwardly beside `toggleGroup`. Reconsider it when the group of inputs lands.

**A component is not done until it ships a skill.** That is a `<module>.skill.md` file beside it,
which `imp skill std/<name>` prints, see `adr/agent-skills.md`. To export the component from a
barrel is the only registration, and imp derives the subject from that export. A test fails when a
component reaches a barrel with no skill file. So imp enforces this, and nobody must remember it.

- **General** - `button`, `heading`, `text`, `link` and `icon` have landed. They fixed the
  conventions of the library. `adr/standard-component-library.md` and `adr/bundled-icon-set.md`
  record those conventions, and `docs/std-components.md` documents them.
- **Layout** - `flex` and `stack` have landed. They opened the `imp/std/layout` subpath, and they
  settled the shape of the group. That shape is two flex primitives, an alignment with a physical
  name, a space as a `gap` step, and nothing else, see `adr/layout-two-flex-primitives.md`. `shell`
  landed beside them, see `adr/app-shell-component.md`. It is the frame of an app, which holds a
  logo, a navbar, a sidebar, the content and an account, and it works on a phone and on a desktop.
  The components that usually fill its regions ship beside it, as `imp/std/shell`, see
  `adr/shell-region-components.md`. **`scrollArea` is out of scope**, for the reason that puts
  `virtualList` out of scope. A custom scrollbar builds the scrolling of the browser again, see
  `adr/browser-support-baseline.md`.
- **Inputs** - `comboBox`, which completes an entry automatically, `slider`, `datePicker`,
  `dateRangePicker`, `timePicker`, `fileUpload`, `segmented`, `toggleGroup`, `tagInput` _(later)_,
  `colorPicker` _(later)_, `rating` _(later)_, `otpField` _(later)_, `cascader` _(later)_ and
  `treeSelect` _(later)_. `form`, and the form layer, have landed. They landed with `textField`,
  `passwordField`, `searchField`, `textArea`, `numberField`, `select`, `checkbox`, `toggle`,
  `radioGroup`, `submitButton` and `resetButton`. They opened the `imp/std/inputs` subpath, and they
  settled the contract that binds a field, see `adr/state-driven-forms.md`. _Form handling_, below,
  gives the details.
- **Display** - `card`, `badge`, `avatar`, `tooltip`, `popover`, `accordion`, `descriptionList`,
  `statistic`, `timeline` _(later)_, `image`, which previews and zooms, _(later)_, `calendar`
  _(later)_ and `qrCode` _(later)_. **`carousel` waits** until `::scroll-button()` and
  `::scroll-marker()` work in every browser. To write JavaScript for a scroll button in the meantime
  is what `adr/browser-support-baseline.md` forbids. `emptyState` has landed. It opened the
  `imp/std/display` subpath, and it fixed the convention for wording, see
  `adr/translatable-by-default.md`. `tag` landed with it. `tag` is what the `tag` data of a nav row
  of `shell` renders.
- **Feedback** - `spinner`, `progress`, `alert`, `toast`, `skeleton`, `popconfirm` and `result`
  _(later)_. Every overlay in this group builds on the seam that `dialog` opened, see
  `adr/overlay-top-layer.md`. But **`dialog` itself belongs to _Layout and placement_**, below. It
  is a frame to put content in. It is not something that the app says to the user. `bugReport` has
  landed before the rest. It opened the `imp/std/feedback` subpath. It shares the element picker of
  the development server, and its capture of the context, through `lib/src/report.js`, see
  `adr/in-page-review-capture.md`. It settled two things that the group inherits. The first is that
  **an action that runs asynchronously, and that can fail, is a function prop**, such as `onSubmit`,
  and not an entry in `events`. The reason is that nobody can await a `CustomEvent`. The second is
  that **a component composes `button`, and does not restyle a native one**. It drives the nested
  button through a prop, such as a state handle for `disabled` or for `loading`. It focuses that
  button through its host, which every component now supports, see `adr/focus-delegation.md`.
- **Shell** - the usual contents of the regions of the frame have landed, as `imp/std/shell`. Those
  are `appLogo`, `breadcrumbs`, `userCard`, `themeSelect` and `langSelect`, see
  `adr/shell-region-components.md`. `breadcrumbs` is the trail only, and its picker is still owed,
  see `todo/breadcrumbs.md`. Two things are still wanted here. The first is a **switcher for a
  tenant, or for a workspace**, which needs the anchored panel from `todo/overlay-seam.md`. The
  second is a **bell for notifications**, which wants `badge`, from _Display_, first.
- **Navigation** - `pagination`, `dropdownMenu`, `steps`, `anchorNav` _(later)_ and `floatButton`
  _(later)_. `tabs` has landed. It opened the `imp/std/navigation` subpath. It fixed the shape that
  data drives, which every composite widget with an internal ARIA id reference follows.
  `adr/component-preview.md` is its first consumer. The `menu` of the roadmap is **not a
  component**. A list of destinations is the nav of `shell`. A set of actions with `role="menu"` is
  `dropdownMenu`.
- **Data** - `table`, which sorts, filters, paginates and selects a row, `list`, `tree` and
  `transferList` _(later)_. **`virtualList` is out of scope.** To window a list builds the
  scrolling, the measurement and the rendering of the browser again, and
  `adr/browser-support-baseline.md` forbids that. The answer is `content-visibility: auto`, with
  `contain-intrinsic-size`. imp documents that answer, and wraps it in no component.

## Layout and placement

`flex` and `stack` are the whole set for an arrangement. The group deliberately stays that small,
see `adr/layout-two-flex-primitives.md`. `shell` is the app frame beside them, see
`adr/app-shell-component.md`. `dialog` is the frame that an app opens over its page. `dialog` landed
with the overlay seam, and every other overlay in the catalog builds on that seam, see
`adr/overlay-top-layer.md`. There is **no separate `modal`**. `dialog({ modal })` is the frame that
is fixed in the centre of the page, and it is also the window that a user can drag anywhere. The two
differ only in which promotion to the top layer they use. What is left of the seam is in
`todo/overlay-seam.md`. That includes the anchored components in _Display_ and in _Navigation_. This
is what is still owed:

- **Whether anybody ever wants a grid.** A dense form, and a dashboard of cards, are CSS grid in the
  component of the app, today. That is the deliberate answer for now. Reconsider it only with a real
  call site, that a nested `flex` and `stack` truly cannot express.
- **`splitPane`**, which is a set of panes that a user can resize, is still wanted. The redesign
  does not block it.

## Form handling

`form` grows from a wrapper around a `submit` event, which is the default of an SPA, into a real
form layer. That is what the `Form` of antd provides. It is still built entirely on a named state:

- **A form is a state object, and a field addresses it by a path.** `form` takes an `initialValues`
  prop, which is a plain object. Inside, it calls
  `initState(self, 'imp.form', initialValues ?? null)`. So the values of the form are an ordinary
  named state, and they live at the position of the form in the tree. There is no separate store of
  form values to keep in step, and there is nothing for the app to connect. To put a `form` into a
  view creates the state. To unmount it releases the state, with the rest of the subtree.

  A control inside that form names the field that it owns, with a **dot-separated path**. Nobody
  hands that control a handle to a state:

  ```js
  form(
    { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' } },
    textField({ field: 'user.firstName', label: 'First name' }),
    select({ field: 'plan', options: PLANS }),
  )
  ```

  The control resolves `imp.form` from its own position, through the same `useState` lookup that
  every other component does. It reads its field by a walk along the path. It writes back by
  rebuilding the object along that path. That is what makes a nested field work, with no writable
  projection in the kernel. The path is data, and the control can walk it in both directions. A
  `computed(...)` is a function, and a walk goes one way only. It also keeps the call site free of
  plumbing. A field is a string, and that is exactly the shape that an agent gets right.

  These consequences need work, when somebody builds the group:
  - **A control with a `field` must be inside a `form`.** To resolve `imp.form` from outside a form
    is an error that carries the imp brand, and that names the field. It is not something that does
    nothing, with no message.
  - **`field` and `value` are alternatives, and not partners.** `value` stays the way to use a
    control on its own, and it takes a value with the shape of a state, or a plain value. `field` is
    the spelling inside a form. imp logs a call that passes both, and `field` wins.
  - **A write to a path rebuilds. It does not change a value in place.** `set` receives a new
    object. So the deduplication by content, and the structural comparison, both keep working.
  - The validation rules, `touched`, `dirty` and `reset`, all key off the same paths. So the form
    layer has one scheme of addressing, from start to end.

  **The names are settled: `textField` and friends**, chosen over `textInput` / `inputText`.
- **There is no `formField` wrapper component.** `label[for]`, `aria-describedby` and `aria-invalid`
  resolve by id, and they cannot cross a shadow root. So a wrapper could never label the control
  that it wraps. Every control renders its own label, its marker for a required field, its help text
  and its error. Each one takes `label`, `ariaLabel`, `help` and `required` as a prop. `radioGroup`
  renders a `<fieldset>` with a `<legend>`, for the same reason. The `layout` prop of the form
  drives the layout variants of antd, which are vertical, horizontal and inline, through an
  inherited custom property.
- **The validation is declarative, per field.** It covers `required`, `minLength`, `maxLength`,
  `min`, `max`, `pattern`, and a custom `validate`. imp evaluates it at the commit point of the
  control, and again on a submit. An error lives in `imp.form.errors`, as a message key with its
  parameters. So a change of language renders the error again, in place. `validateAsync` covers a
  check that needs the network. It runs on a blur, and on a submit, only. It tracks the checks in
  flight in `imp.form.validating`. A submit waits until that state is empty.
- **A submit runs from a handler, and not from a native submit event.** `form` gates on the
  validity. `submitButton` and `resetButton` find their form through a composed, bubbling event.
  They read `imp.form.submitting`, to drive their own spinner. `form` implements the implicit
  submit, which is Enter in a single-line field.
- **The tracking of `touched`, and `reset` to the initial values, come with the state of the form.**
  imp shows an error only after a person touches its field, or tries to submit.

Still owed by this group:

- **The tracking of `dirty`**, which is a value that differs from `initialValues`, is not
  implemented. `touched` is.
- **An error at the level of the form** has no home yet. That is a failure of a submit that belongs
  to no single field.

## Responsive and mobile

A layout for a phone is first class. It is not a separate set of components:

- **This is settled across the library**, see `adr/responsive-fluid-values-only.md`. A prop takes
  exactly one value. imp applies it at every width, and resolves it into one CSS custom property,
  per instance. No component varies a prop by the size of a screen, and no component hides itself by
  that size. Every group after this one uses the same spelling.
- **`--imp-breakpoint-desktop`, which is 48rem, is a theme token.** So an app can reuse that width
  in a `calc()`, and read it from JavaScript. It is a token for a value only. **A media query cannot
  read a custom property.** So a query still needs the literal value. Do not build anything that
  suggests otherwise.
- **A component adapts below the breakpoint that it cares about.** `table` changes to a stack of
  cards, or to a horizontal scroll. `dialog` goes to full screen, and that removes the drag with it,
  because there is nowhere to drag a full-screen panel to. A picker renders a panel that suits a
  touch.
- **A touch target meets a minimum size**, which imp takes from the theme tokens.
- **A `breakpoint` value with the shape of a state is still owed.** A person must be able to read it
  and to watch it. It serves the structural swap that CSS cannot express. The card mode of `table`
  is the first real consumer. So it lands with the group of data components, and nobody invents it
  before a consumer exists.

## Conventions

The shape that every component follows is settled, and `adr/standard-component-library.md` records
it. That shape covers a custom element with the `imp-` prefix, a definition that imp makes lazily,
the call shape `(props?, ...children)`, a closed set of props that imp logs about, a live prop that
takes a state, a token with a fallback, a logical property, and no outer margin. This is what is
still open:

- **The name of a component must not shadow a global of the browser.** An import binding shadows the
  global with the same name, for the whole module. So `import { alert } from 'imp/std/feedback'`
  makes a later `alert(...)` in that file the component, and nothing says so. That is the problem of
  `switch`, with no syntax error to catch it. It also lands on app code, and not on imp. It has
  already decided one name here. The overlay component is `dialog`, see `todo/overlay-seam.md`.
  **`alert`, in _Feedback_ above, is the same collision, and it is still open.** Check a candidate
  name against the list that the platform owns. That list holds `name`, `length`, `status`,
  `origin`, `event`, `open`, `close`, `focus`, `blur`, `print`, `scroll`, `history`, `screen`,
  `location`, `top`, `parent`, `self`, `frames`, `menubar` and `toolbar`. To shadow an imp **element
  factory** is a different thing, and it is acceptable. The two are separate namespaces, and
  `button`, `text`, `link` and `select` already do it.
- **A binding in two directions is a convention.** The `value` prop, and the `checked` prop, of an
  input, accept anything with **the shape of a state**. That is an object with `get`, `watch` and
  `set`. It can come from `initState` or `useState`. It can come from `computed`, which gives a
  read-only control. It can come from user code that implements the same shape. To give an initial
  value that imp does not control, pass a plain value. The readable half is already in place, as the
  _live props_ of the ADR. The writable half is the `set` call, described below. To reach **one
  field of a form state** is the contract of a `field` path, in _Form handling_. Three rules make
  the binding sound, and every control of the standard library follows them in the same way:
  - The control subscribes with `watch`. It updates its own element **in place**, and never through
    a rebuild of a region. So the focus and the caret survive a `set` from outside.
  - The control writes back with `set`, at the commit point that fits it. That is `input` for free
    typing, `change` for a picker, and a blur or a debounce where that is the better default. The
    control owns the semantics of its commit. It does not expose a set of modifier options.
  - The control never emits a commit in response to a value that it assigned itself, from code. With
    the deduplication of `set` by content, that stops a loop of set, then watch, then set.

  The contract of the binding is **public, and documented**. It is not a convention inside the
  standard library. A custom component, and a wrapper around a third-party widget, accept a value
  with the shape of a state in the same way. The standard library is the reference implementation.
- **Add the check about a complete theme, after the token surface is final.** The list of tokens
  grows one component at a time. So there is no canonical set to validate against yet. After every
  component lands, and after somebody settles the full list of `--imp-*` tokens, freeze that list.
  Then make `applyTheme` warn, through the shared `impLogger`, when an applied theme has no value
  for a known token key. That warning must not be fatal, and the app must still run. That is the
  check at runtime that the ADR about theming defers, see `adr/themable-by-default-tokens.md`. It
  becomes meaningful only with the complete list in hand. The built-in light theme, and the built-in
  dark theme, must then define every key on that list.
- **Nothing is open about the wording.** A string goes through `t()`, under an `imp.` key, and imp
  binds it through `lang`. Each component declares its own English default, with `defaultMessages`,
  beside its `component()` call. `adr/standard-component-library.md` and
  `adr/translatable-by-default.md` settle that, and `emptyState` first exercised it. A component
  that needs a new word adds the key, and its wording, to its own file. It also adds the row to the
  table in the documentation of that component, in the same change.

## Dependencies

This is the top of the stack. The named state is in place, and it counts as complete, see
`adr/event-propagated-state.md`. It needs no addition for the form layer, because the form
components walk a `field` path on the public API. The theming is in place, see
`adr/themable-by-default-tokens.md`, and each group extends the `--imp-*` token surface as it lands.
The translations are in place, see `adr/translatable-by-default.md`. **The overlay components need
no new surface in the kernel, and no `portal`.** They promote into the top layer of the platform,
and they do not move in the DOM, see `todo/overlay-seam.md`. The standard library grows group by
group. A group that needs a dependency that is missing waits for that dependency.

**The feedback group owes the HTTP client its wiring**, see `adr/http-client.md`. A client publishes
`pending` and `lastError`, and both have the shape of a state. So `spinner` and `progress` must
accept a client, or the name of a client, which they resolve with `useHttpClient`, from their own
position. They must then show themselves while the calls of that client are in flight. `alert` and
`toast` must raise a standard banner for a failure, from `lastError`. That includes a handle per
request, which a call asks for with `track`. This is an ordinary reactive binding, through the state
layer that landed. So the work is to decide the spelling of a prop. It is not to build a mechanism
for a coupling.

**imp deliberately does not use the native semantics of a form.** A control inside its own shadow
root does not join a `<form>` outside it. So a native submit, the collection of a `FormData` object,
and constraint validation, cannot reach a std component. imp could add a custom element that
associates with a form, through `static formAssociated` and `ElementInternals`, to the kernel, and
recover those. imp does not. The form layer stays driven by a state, from start to end. `form` holds
the values. The validation is declarative. A submit runs from the `click` handler of a button. So
`button` has no `type` prop, see `adr/standard-component-library.md`. Two things follow, and the
form layer owes both:

- **The implicit submit.** Enter in a single-line field must submit the form, because the platform
  does not do it. `form` implements that. It watches `keydown` on its fields. It respects a
  `textArea`, the composition of an input method editor, and a modifier key. Somebody checks every
  group of inputs against that behaviour.
- **A named action for the submit.** `form` needs a spelling for "this is the button that submits".
  So it can drive the loading state, and the disabled state, of that button. That button is also the
  target of the implicit submit. This is a prop on `form`, and not a mode on the button.

## A showcase surface

**`imp preview` is the gallery.** Nobody needs a separate `imp showcase` command. Its catalog groups
every `*.preview.js` file by folder. Its search finds a component by a name, or by a group. The
pickers for the theme, the language and the direction are on the same page, and that is what a
showcase was for. One thing is still missing, against essence 20. That is a **live editor for a
theme and a locale**, in place of a picker over the themes that a project already lists. Scope that
as its own todo item, when somebody wants it.

## ADR impact

`adr/standard-component-library.md` records what the standard library guarantees. It landed with the
General group, and it now also carries the rule about the piping of i18n. One thing is still to add,
as the catalog fills. That is the deliberate boundary of the 80% scope, which puts heavy
visualization of data, a native mobile app, and collaborative editing, out of scope. Each group also
extends `docs/std-components.md` with a section of its own, as it lands.

## Open questions

- **Whether the addressing by a path stays inside the form layer.** The contract of
  `field: 'user.firstName'`, above, lives in the form components. They walk the path, and rebuild
  it, themselves, on the public API of the state. They need no change to the kernel. The alternative
  is a writable projection of a path, in the kernel. That is `user.field('address', 'city')`, or a
  form of `computed` that takes a path. Somebody prototyped it, and it works. It stays **rejected**
  as unearned, while the form layer needs no help, see `adr/event-propagated-state.md`. Reconsider
  it only when something outside a form wants the same thing. The cost would be one more way to
  address a state, and a combinator that is writable or not, depending on the type of its argument.
- **The scope of the catalog for version 1.** The catalog above drafts a split, between a core
  component and a _(later)_ component. Confirm that split, or change it, while somebody builds. The
  markers of a tier are a first proposal, and not a commitment.
- **The accessibility baseline.** That is the contract about ARIA, and about the keyboard, that
  every interactive component must meet. The General group set the first precedent. It renders the
  native element wherever one exists. It draws a `:focus-visible` ring from
  `--imp-color-focus-ring`. It mirrors a state into ARIA, such as `aria-busy` on a button that
  loads. The full contract is still open. That covers the labelling, the roving focus, and the
  dismissal with Escape.
- **A path that calls `console.warn`** goes through the built-in logger, see
  `adr/built-in-logger.md`. A warning about a duplicate key, which `each` raises, is an example.
