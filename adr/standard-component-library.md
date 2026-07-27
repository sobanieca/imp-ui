# Standard component library: imp-prefixed components on the public kernel API

## Context

imp is an all-in-one toolkit, so an app should be buildable without assembling a component stack or
pulling a third-party UI package (`todo/stdlib-components.md` holds the full catalog this grows
into). The kernel already supplies everything such a library needs — element factories, components
with shadow-scoped `styles` (`shadow-dom-isolation.md`), named state (`event-propagated-state.md`),
and `--imp-*` design tokens (`themable-by-default-tokens.md`) — so the question was not what to
build on but what shape the components take, how they are packaged, and what an app is allowed to
assume about all of them at once. The first group answers that for every group after it, so the
conventions land with the first components rather than after the catalog is written.

## Decision

Standard components are **ordinary imp components built on the public kernel API only**, shipped in
imp itself. They live under `lib/src/std/<group>/`, one file per component, grouped by the catalog's
own taxonomy (`general`, `layout`, `inputs`, `display`, `feedback`, `navigation`, `data`), so
folders, docs sections and catalog entries stay one-to-one. Nothing in `std/` is privileged: it
imports the same surface an app does.

- **The library is a separate import namespace, split by group.** The kernel is `imp` and its
  per-subject specifiers — `imp/html`, `imp/state`, `imp/router`, `imp/theme`, `imp/log`
  (`library-import-namespaces.md`). The base group is **`imp/std`**; every other group is
  **`imp/std/<group>`** (`imp/std/layout`, `imp/std/inputs`, …). Groups are registered as subpaths
  when they land, and an unknown subpath fails with an imp-branded error listing the ones that exist
  — in the bundler, the dev server's import map and the `imp lint` specifier check alike, from one
  shared table. Splitting by group keeps a growing catalog from flooding one namespace and makes an
  import line say which part of the library a file leans on.
- **Names are the natural ones** — `button`, `text`, `link`, `form`, `select` — precisely because
  the namespace is separate: a std component may shadow a bare element factory from `imp/html`,
  since the two never arrive through the same specifier. A file needing both aliases one at the
  import. The only hard limit is JS reserved words, which cannot be import bindings.

- **Every standard component is a `component()`**, not a bare helper function — including lifeless
  ones like `text`. A themed control needs hover, focus and disabled rules, and a component's
  `styles` entry is imp's only styling channel (`shadow-dom-isolation.md`); a helper returning a raw
  element could only carry inline styles, or would require imp to inject a global stylesheet, which
  `shadow-dom-isolation.md` deliberately removed. Shared CSS is shared **strings** composed into
  several `styles` entries, as that ADR prescribes.
- **imp claims the `imp-` element-name prefix.** Components are named `imp-button`, `imp-text`, and
  so on — the same namespacing rule apps follow, with the prefix reserved for the library.
- **Elements are defined on first use, not on import.** Each module holds its definition object and
  a memoized factory, and calls `component()` inside the exported function. Module scope stays free
  of calls and therefore of side effects, so no app pays for a component it never renders, and
  `todo/tree-shakeable-library.md` can make the library shakeable without reworking `std/`.
- **Components dispatch their arguments by type, exactly as the element factories do**
  (`type-based-argument-dispatch.md`) — a plain object is props wherever it sits, everything else is
  content, and a state passed as a standalone argument is reported and skipped. `splitArgs` in
  `std/shared/args.js` delegates to the same `splitArgsByType` that `el` uses, so there is one
  dispatch rule to learn for the whole library rather than one per import. What the components add
  on top is validation, not a different call shape.
- **Props are a closed, documented set per component.** Standard components do not forward arbitrary
  props onto an inner element: the boundary is the point. An unknown prop, or a value outside a
  prop's allowed list, is **logged through `createLogger('imp')` and the component continues** with
  its default — consistent with the log-and-continue posture of the rest of the library, and never
  fatal for a cosmetic mistake.
- **Props documented as _live_ accept a state-shaped value** (anything with `get`/`watch`) as well
  as a plain one. The component subscribes with `watch` and updates the single element property in
  place, never through a region rebuild, so focus and caret survive. This is the readable half of
  the two-way binding contract the input group will complete; the writable half (how a control
  commits back into one field of a form state) stays open until controls exist that need it.
- **Every value that could be themed comes from a token**, referenced as `var(--imp-name, fallback)`
  so a component still renders standalone, and each new token is added to **both** built-in themes
  when its first consumer lands. Styling uses **logical properties only**.
- **No standard component carries an outer margin.** Spacing between components belongs to the
  layout parents of the `layout` group, so an app never fights collapsing margins or per-component
  spacing props.
- **Every word a component shows goes through `t()` under an `imp.` key, bound through `lang`**
  (`lang.text(() => t('imp.state.empty'))` rather than a bare `t()`), so a language switch
  re-localizes it in place. The component **declares its own English wording** for the keys it reads
  by calling `defaultMessages` next to its `component()` call — inside the memoized factory, so
  module scope stays free of calls — and an app's translation of the key shadows it, exactly as a
  theme's token overrides the fallback in `var(--imp-color-text, #0f172a)`
  (`translatable-by-default.md`). Wording therefore lives in the file that renders it: adding a key
  is one line in one component. Text the **app** passes in (a `title` prop, children) is the app's
  to translate; a component never translates values handed to it.

`link` additionally hands plain left-clicks on in-app hrefs to `navigate()`
(`client-side-router.md`), rendering a real anchor so the URL, middle-click and copy-link behave
natively, and leaving modifier-clicks, `external` links and off-site URLs to the browser. `href` is
written in app space, exactly as passed to `navigate()`, with the base path applied by imp.

## Consequences

- An app gets buttons, headings and text with one import and no CSS setup, and every component
  re-skins with a theme swap because all of them read the same tokens.
- Adding a group means adding a subpath to the shared table; forgetting to breaks resolution
  everywhere at once rather than in one of the three resolvers, and the failure is a clear message
  rather than a missing-module error.
- The kernel namespace stays small, and a file's imports say whether it is using imp or imp's
  components. The cost is one more specifier to know, and an alias in the rare file that wants both
  `button` the element and `button` the component.
- Component internals are sealed: a standard component's content is not visible as
  `host.textContent`, page CSS cannot restyle its inner element, and tests must pierce the shadow
  root. This is the same contract app components already have.
- Each standard component costs one extra element in the tree, and native couplings that cannot
  cross a shadow boundary are given up rather than faked. **`button` has no `type` prop and is never
  a native submit button:** its `<button>` sits one shadow root deeper than any `<form>` an app or
  `formBox` could write, so form association can never resolve and a `type: 'submit'` would be
  silently inert. Buttons act on their `click` handler and the form layer submits from there, which
  is what its state-driven design does anyway. The cost is that **implicit submission** — Enter in a
  text field — must be implemented by the form layer rather than coming from the platform; it was
  never available here, since std inputs are equally unassociated.
- A closed prop set means adding a prop is a deliberate act with a docs entry, and app code cannot
  smuggle arbitrary attributes through a component. Escape hatches, when needed, are explicit props.
- The `--imp-*` token surface grows one component group at a time and each name arrives with a real
  consumer, as `themable-by-default-tokens.md` intends; the built-in themes stay complete because
  adding a token to one means adding it to both.
- Because definitions are lazy, custom-element registration and stylesheet compilation are
  pay-per-use: a group's whole barrel can be imported without paying for the components a file does
  not call.
