# Standard component library: imp-prefixed components on the public kernel API

## Context

imp is a complete toolkit. So a person must be able to build an app without assembling a stack of
components, and without a third-party UI package. `short-component-catalog.md` records the shape of
that catalog. The kernel already supplies everything that such a library needs. It supplies the
element factories, a component with `styles` that are scoped by a shadow root, see
`shadow-dom-isolation.md`, a named state, see `event-propagated-state.md`, and the `--imp-*` design
tokens, see `themable-by-default-tokens.md`. So the question was not what to build on. The question
was what shape a component takes, how imp packages it, and what an app can assume about all of them
at once. The first group answers that for every group after it. So the conventions land with the
first components, and not after somebody writes the catalog.

## Decision

A standard component is an **ordinary imp component, built on the public API of the kernel only**,
and imp ships it. Those components live under `lib/src/std/<group>/`, with one file per component.
imp groups them by the taxonomy of the catalog. The groups that exist are `general`, `layout`,
`inputs`, `display`, `shell`, `feedback` and `data`. The folder of a component is its group. The
same name is the subpath of its import, the key of its preview group, and its section of the
documentation. A test checks that every preview names the group of its folder, and that every group
has a folder. Nothing in `std/` is privileged. It imports the same surface as an app.

- **The library is a separate import namespace, split by group.** The kernel is `imp`, with its
  specifiers per subject, which are `imp/html`, `imp/state`, `imp/router`, `imp/theme` and
  `imp/log`, see `library-import-namespaces.md`. The base group is **`imp/std`**. Every other group
  is **`imp/std/<group>`**, such as `imp/std/inputs` and `imp/std/display`. imp registers a group as
  a subpath when the group lands. An unknown subpath fails with an error that carries the imp brand,
  and that lists the subpaths that exist. That happens in the bundler, in the import map of the dev
  server, and in the specifier check of `imp lint`, from one shared table. The split by group keeps
  a catalog that grows from filling one namespace. It also makes an import line say which part of
  the library a file uses.
- **The names are the natural ones**, such as `button`, `text`, `link`, `form` and `select`. That is
  possible exactly because the namespace is separate. A std component can shadow a bare element
  factory from `imp/html`, because the two never arrive through the same specifier. A file that
  needs both gives one an alias at the import. The one hard limit is a reserved word of JavaScript,
  which cannot be an import binding.

- **Every standard component is a `component()`, and not a bare helper function.** That includes a
  component with no life of its own, such as `text`. A themed control needs a rule for hover, for
  focus and for disabled. The `styles` entry of a component is the only channel for styling in imp,
  see `shadow-dom-isolation.md`. A helper that returns a raw element could carry an inline style
  only, or it would need imp to inject a global stylesheet, and `shadow-dom-isolation.md`
  deliberately removed that. Shared CSS is a shared **string**, which somebody composes into several
  `styles` entries, as that ADR prescribes.
- **imp claims the `imp-` prefix for an element name.** A component is named `imp-button`,
  `imp-text`, and so on. That is the same rule of namespacing that an app follows, and imp reserves
  the prefix for the library.
- **imp defines an element on first use, and not at import.** A component export is a plain
  function, as in
  `export const button = (...args) => defineComponent('button', () => definition)(...args)`.
  `defineComponent` memoizes the element by name. It builds the definition, its CSS string and its
  default messages, the first time when somebody renders the component. Nothing runs when the module
  loads. So an app carries only the components that it uses, see `tree-shakeable-library.md`. That
  is also why the `styles` of a definition is a function, and not a string. imp derives the element
  name from the export name. So `radioGroup` defines `imp-radio-group`, and the two cannot differ.
- **A component dispatches its arguments by type, exactly as an element factory does**, see
  `type-based-argument-dispatch.md`. A plain object is props, wherever it sits. Everything else is
  content. imp reports a state that you pass as a standalone argument, and skips it.
  `defineComponent` does the dispatch once for every component, through the same `splitArgsByType`
  that `el` uses. It hands `setup` the resolved `(self, props, children)`. So there is one rule of
  dispatch to learn for the whole library, and not one per import. There is also one implementation
  of that rule, and not one per component. What a component adds on top is validation, and not a
  different call shape.
- **A component has a closed, documented set of props.** Each component declares that set as the
  `props` list of its definition. So `defineComponent` can check every call against it. A standard
  component does not forward an arbitrary prop onto an inner element. The boundary is the point. imp
  **logs an unknown prop, and a value outside the allowed list of a prop, through the shared
  `impLogger`, and the component continues** with its default. That is consistent with the
  log-and-continue posture of the rest of the library, and it is never fatal for a mistake about
  appearance.
- **A prop that the documentation marks as _live_ accepts a value with the shape of a state**, which
  is anything with `get` and `watch`, and it also accepts a plain value. The component subscribes
  with `watch(self, fn)`, which ends with the mount, and updates the one element property in place.
  It never rebuilds a region. So the focus and the caret survive. That is the readable half of the
  two-way binding contract that the input group completes. The writable half, which is how a control
  commits back into one field of a form state, stays open until a control exists that needs it.
- **Every value that somebody could theme comes from a token.** A component references it as
  `token('name')`, which expands to `var(--imp-name, fallback)`. So a component still renders on its
  own. imp reads the fallback from the built-in light theme, and nobody writes it at the call site.
  So no component can disagree with the theme about the default of a token. `token()` throws on a
  name that no theme defines. Somebody adds each new token to **both** built-in themes, when its
  first consumer lands. The styling uses **logical properties only**.
- **No standard component carries an outer margin.** The space between two components belongs to a
  layout parent from the `layout` group. So an app never fights a collapsing margin, and it never
  fights a spacing prop per component. That group also fixes how the library handles the width of a
  viewport. The spacing scale of the theme is fluid, so most layouts need no breakpoint at all. A
  layout that must change shape at a width is a media query that the app writes in its own
  component, see `responsive-fluid-values-only.md`.
- **Every word that a component shows goes through `t()`, under an `imp.` key, and it is bound
  through `lang`.** A component writes `lang.text(() => t('imp.state.empty'))`, and not a bare
  `t()`. So a change of language localizes the word again, in place. The component **declares its
  own English wording** for the keys that it reads. It passes `defaultMessages` as the first-use
  hook of `defineComponent`. So that runs once, with the registration of the element, and module
  scope stays free of a call. A translation of the key by an app shadows the wording, exactly as a
  token of a theme overrides the fallback in `token('color-text')`, see
  `translatable-by-default.md`. So the wording lives in the file that renders it. To add a key is
  one line, in one component. Text that the **app** passes in, such as a `title` prop or a child, is
  the app's to translate. A component never translates a value that somebody hands to it.

- **A composite widget cannot move the focus between the components inside it.** A control renders
  its focusable element inside its own shadow root. A host with `display: contents` cannot be
  focused in place of that element. So a roving tabindex, which is the ARIA pattern for a menu bar,
  or for a group in the style of radio buttons, is implementable **inside** one component only, and
  never across a set of them. So a bar of controls is a plain layout box, and each child keeps its
  own tab stop. It is not a widget that ships handling of the arrow keys, which would silently skip
  anything that it cannot reach. That is the same boundary that makes `tabs`, and the nav of
  `shell`, driven by data. A widget that holds an internal ARIA reference, or an internal order of
  the focus, must render every part of it.

`link` also gives a plain left-click on an in-app href to `navigate()`, see `client-side-router.md`.
It renders a real anchor. So the URL, a middle-click and a copy of the link all behave natively. It
leaves a click with a modifier key, an `external` link and an off-site URL to the browser. You write
`href` in the space of the app, exactly as you pass it to `navigate()`, and imp applies the base
path. Every other component that renders a destination follows that same contract, from one shared
helper. That covers the nav rows of `shell`, and `breadcrumbs`. Each one reports a **cancelable
`select` event** before it follows the link, and that is how an app takes the navigation back.

## Consequences

- An app gets a button, a heading and text, with one import and no setup of CSS. Every component
  re-skins on a change of theme, because all of them read the same tokens.
- To add a group means to add a subpath to the shared table. To forget that breaks the resolution
  everywhere at once, in place of one of the three resolvers. The failure is a clear message, and
  not an error about a missing module.
- The namespace of the kernel stays small, and the imports of a file say whether it uses imp, or the
  components of imp. The cost is one more specifier to know, and an alias in the rare file that
  wants both `button` the element and `button` the component.
- The internals of a component are sealed. The content of a standard component is not visible as
  `host.textContent`. Page CSS cannot restyle its inner element. A test must go through the shadow
  root. That is the same contract that a component of an app already has.
- Each standard component costs one extra element in the tree. imp gives up a native coupling that
  cannot cross a shadow boundary, and does not imitate it. **`button` has no `type` prop, and it is
  never a native submit button.** Its `<button>` sits one shadow root deeper than any `<form>` that
  an app, or a `formBox`, could write. So the association with the form can never resolve, and a
  `type: 'submit'` would be inert, with no message. A button acts on its `click` handler, and the
  form layer submits from there. The state-driven design of that layer does this anyway. The cost is
  that the form layer must implement **the implicit submit**, which is Enter in a text field. The
  platform does not give it here. It was never available here, because a std input is equally
  unassociated.
- A closed set of props means that to add a prop is a deliberate act, with an entry in the
  documentation. App code cannot pass an arbitrary attribute through a component. When an escape
  hatch is necessary, it is an explicit prop.
- The `--imp-*` token surface grows one component group at a time, and each name arrives with a real
  consumer, as `themable-by-default-tokens.md` intends. The built-in themes stay complete, because
  to add a token to one means to add it to both.
- imp defines a component lazily. So the registration of a custom element, and the compilation of a
  stylesheet, are paid per use. Somebody can import the whole barrel of a group, and pay nothing for
  a component that a file does not call.
