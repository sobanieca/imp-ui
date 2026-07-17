# Theming and styling

Give imp buildless co-located CSS and a themable-by-default token system, so an app is skinnable and
dark/light/RTL-aware with no external CSS toolchain. Drafts to adapt live in
`prev/experiment/imp/styles.js` and `prev/experiment/imp/theme.js`.

## Buildless co-located CSS — `css``

Port `prev/experiment/imp/styles.js`:

- `` css`...` `` returns a **content-hashed class name** and injects the rule once into a single
  shared `CSSStyleSheet` via `adoptedStyleSheets` (falling back to a `<style>` element where
  constructable stylesheets or `insertRule` are unavailable). Identical rule text dedupes to one
  class. Native CSS nesting handles `&:hover` / `@media` — imp parses no CSS.
- `css.global` for top-level rules that can't live in a class block (`@keyframes`, `@font-face`).
- Rule: **static styles go in `css`; per-instance dynamic values go in
  inline``style`.** Function
  interpolation into`css``` throws — reactive values must not leak into
  a shared, cached rule.
- `flushStyles()` to emit rules queued before a DOM exists (needed by `imp test`'s DOM stubs, see
  `todo/test-command.md`).
- `adoptStyles(shadowRoot)` so styles reach components exposed as web components.

This composes with the existing class handling in `src/render.js` (`applyClass` already accepts
arrays/objects) — a `css``` result is just a class string.

## Themable by default — `--imp-*` tokens

Port `prev/experiment/imp/theme.js`. Design tokens (color, radius, shadow, spacing, typography) are
`--imp-*` CSS custom properties on `:root`, driven by a page-wide `theme` state. Swapping the theme
rewrites the variables in one pass, so every ``css``` rule that references a token re-skins the
whole app **instantly with no re-render** — a headless component watching the state
(`adr/event-propagated-state.md`).

- `defineTheme(name, { mode, direction, tokens })` — starts from the built-in light/dark token set
  for its mode; `tokens` overrides individual entries (copy-and-tweak, no full list needed).
- `setTheme(name)`, `themeNames()`, and built-in `light`/`dark` themes.
- `setMode('light' | 'dark' | 'system')` — `system` follows `prefers-color-scheme` live via
  `matchMedia`.
- A theme carries **mode** (light/dark → `color-scheme` + `data-imp-mode`) and **direction**
  (ltr/rtl → `<html dir>`); `setDirection('ltr'|'rtl'|'auto'|null)`, where `auto` derives from
  locale.
- **Stdlib styling rule:** logical CSS properties only (`margin-inline-*`, `inset-inline-*`,
  `text-align: start/end`) so an RTL flip mirrors layouts for free.

## Interaction with i18n

The draft `theme.js` reads a `locale` signal to resolve `auto` direction. Direction↔locale coupling
belongs with a future i18n item (`locale` + reactive `t()`, essence #18) — keep the theme module's
locale dependency behind a small seam so theming can land before full i18n.

## ADR impact

- New ADR `buildless-co-located-css.md` (content-hashed
  ``css``` into one adopted stylesheet, static
  in``css``` / dynamic inline) and
  `themable-by-default-tokens.md` (`--imp-*` tokens on a reactive `theme` signal, mode + direction);
  update the ADR table.

## Open questions

- **Token surface.** Which token groups ship built-in vs. left to apps; naming stability of
  `--imp-*` keys (they become public API the moment stdlib and user CSS reference them).
- **Hash function & collisions.** The draft uses FNV-1a with a `_`-suffix collision guard — confirm
  that is good enough, or move to a stronger hash.
- **`console`/error paths.** Route any diagnostics through the built-in logger (`todo/logger.md`).
- **Bundle/PWA integration.** How injected `adoptedStyleSheets` rules are emitted into the static
  output by `imp build` (`adr/production-bundling.md`).
