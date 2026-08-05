# Themable by default: token modules applied with applyTheme

## Context

imp apps need to be skinnable and dark/light-aware without pulling in an external CSS toolchain, and
the stdlib components (built as the library grows) need a shared vocabulary of design values to
reference so they cohere and re-skin together. A theme system could be a runtime registry of named
themes with a built-in light/dark `mode` axis, or a build step that compiles design tokens into CSS.
Both add moving parts: a registry has to map a persisted theme name back to something, a `mode` axis
imp manages competes with the app's own control over which palette is active, and a compile step
reintroduces the toolchain themability was meant to avoid. The state layer
(`event-propagated-state.md`) already gives us a fine-grained, no-re-render update path, and CSS
custom properties on `:root` already cascade everywhere - including through shadow boundaries - so a
theme swap can be a single write of variables the whole app reads.

## Decision

A **theme is a plain JS module** the app authors and imports: its default export is an object with a
flat `tokens` map (bare token name → CSS value), plus optional `name` and `colorScheme` metadata.
There is no runtime registry, no `defineTheme`, and **no built-in mode axis** - light and dark are
simply two theme files, and an app ships as many themes as it likes. Swapping themes is swapping
which module is applied.

`applyTheme(themeOrBuiltInName)` is the single entry point and the **only writer** of the reactive
`theme` state (DOM side-effect and signal update always travel together). It accepts either a theme
object or the **name of a built-in theme** as a string (`'imp-light'` | `'imp-dark'`), which it
resolves to the matching built-in and then treats identically. It:

- writes each token as an `--imp-`-prefixed custom property on `:root` (`document.documentElement`),
  where it inherits into body, every component's shadow root, and anything a `portal` appends to the
  document. imp owns the `--imp-` prefix; token keys are bare (`color-primary` →
  `--imp-color-primary`), one flat namespace with no dots or nesting, matching state and message
  keys.
- overwrites every token it carries and does **not** diff against the previous theme or remove any
  property. A theme is required to define the **full** token set - a partial theme is a bug in the
  theme, the app's responsibility, not something imp compensates for - so a complete theme fully
  replaces a complete theme. A future runtime check may warn when an applied theme is missing known
  token keys, but there is no per-swap cleanup pass.
- sets `color-scheme` on the same root from `colorScheme` (`'light'` | `'dark'`), or clears it when
  `colorScheme` is absent or unrecognized. `color-scheme` is CSS-inherited, so setting it on `:root`
  reaches native controls, scrollbars, and `prefers-color-scheme`-aware CSS rendered **inside**
  component shadow roots automatically - no per-`:host` stamping needed. imp writes **no mode
  attribute** on the root: an attribute is only reachable by descendant selectors in the light DOM,
  which stdlib components and any shadow-DOM component cannot use, so it would be a hook that works
  in exactly the places theming matters least. Light/dark branching belongs in the tokens
  themselves - the two themes carry different values under the same names - and inherited
  `color-scheme` covers what the browser renders.
- updates the reactive `theme` state to the applied theme object and returns it.

**`theme`** is an app-lifetime readable state (`get`/`watch`/`text`/`view`/`each`, no public `set`)
holding the currently applied theme, so swap UIs read `theme.get()` / `theme.watch()` and components
branch on the active theme when they must. Because tokens are custom properties, re-applying
rewrites the variables in one synchronous pass and every rule referencing a token re-skins at once -
the no-re-render path of the state layer; the `theme` watch is only for components that must branch,
not the re-skin mechanism.

A **malformed theme throws at the call site** (not an object, or no `tokens` object), like a bad
`component()` definition; so does a string that is not a known built-in name, since a misspelled
built-in is a bug, not a theme. Non-fatal problems - suspicious token names, values the browser
silently ignores, an unrecognized `colorScheme` - are logged through the shared `impLogger`
(`built-in-logger.md`), never raw `console`; per-token CSS values are not otherwise validated.

**Persistence is the app's job.** imp keeps no theme registry - themes are modules the app imports -
so it cannot map a stored name back to a module and deliberately does **not** touch `localStorage`.
The `theme` state exposes the active theme (`name` included) for an app that wants to remember and
re-apply a choice on load.

imp ships a built-in light and dark theme so an app renders sensibly before any theme editor exists
and so a future editor has a baseline to seed from. They are **not exported as objects** -
`applyTheme('imp-light')` / `applyTheme('imp-dark')` is the whole API, keeping the common case a
single call with no import to add and no name to learn beyond `applyTheme` itself. The names carry
an **`imp-` prefix** so imp's built-ins never collide conceptually with an app's own `light` /
`dark` theme modules: a bare name always means the app's theme, an `imp-` name always means imp's.
The resolved object is still reachable through `theme.get()` for anything that needs to seed from
it, so hiding the exports costs nothing: the state layer deep-freezes every value it holds, so an
applied built-in cannot be edited in place by one app corner and silently change what a later
`applyTheme('imp-dark')` produces - seeding copies the tokens instead. Theming adds no freezing of
its own. Stdlib components reference tokens through a `token('color-primary')` helper that expands
to `var(--imp-color-primary, …)` with the fallback taken from the built-in light theme, so they
render standalone before any theme is applied and no component can state a default the themes
disagree with.

The **token naming scheme is fixed** - semantic color roles, numeric scales (`space-*`, `radius-*`,
`shadow-*`, `font-size-*`, …), and font families - but the **exact list is not enumerated up
front**: each stdlib component pulls the tokens it needs into the built-in surface as it is built,
so every `--imp-*` name lands with a real consumer. Once referenced, a name is public API. The
built-in themes currently carry only `color-primary` and `color-secondary`; the surface grows with
the stdlib.

**Direction (RTL/LTR) is not part of a theme.** It belongs with language, not palette
(`translatable-by-default.md`), and imp does not resolve it yet: nothing in the framework writes the
document's `dir`, so an app that needs right-to-left sets it itself. The stdlib's logical-properties
styling rule (`margin-inline-*`, `inset-inline-*`, `text-align: start/end`) mirrors layouts for free
once it is set. The theme engine touches direction not at all.

## Consequences

- A theme is an ordinary importable module with no registration ceremony; the whole feature is
  `applyTheme` plus a readable `theme` state, and there is no `mode` system for the app to fight.
- A theme swap re-skins the entire app - light DOM and every shadow root - in one custom-property
  write with no component re-render. Because every theme defines the full token set, a swap fully
  overwrites the previous one; there is no diffing or cleanup pass, and a theme missing tokens is
  the theme author's bug.
- `color-scheme` on `:root` themes native controls inside shadow DOM without imp stamping each host,
  and it is the only root-level signal imp writes besides the tokens - there is no mode attribute to
  keep in sync, and no hook that silently stops working once a component moves into shadow DOM.
- Apps that want to remember a theme store the name and re-apply the matching module on load,
  controlling ordering to avoid a wrong-theme flash; imp neither persists nor reloads it.
- Getting a sensible light or dark app is one call with nothing to import
  (`applyTheme('imp-dark')`), while custom themes stay plain modules and keep the obvious `light` /
  `dark` names for themselves; the built-in palettes are imp's to evolve because no app can hold a
  mutable reference to them.
- The `--imp-*` token surface is public API that grows one consumer at a time; the built-ins ship a
  minimal palette (`color-primary`, `color-secondary`) and expand as stdlib components need tokens.
- A malformed theme or an unknown built-in name fails loudly at the call site; suspicious-but-usable
  input is logged through the imp logger and applied anyway, consistent with the log-and-continue
  posture of the rest of the library.
- Direction is left out of theming entirely, so it carries no RTL dependency.
