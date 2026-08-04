# theming — themes as plain token modules

A theme is an ordinary module whose default export is a flat token map. `applyTheme` writes the
tokens as `--imp-*` custom properties on the document root, where they inherit into every component
(including through shadow roots). Swapping re-skins the whole app in one pass — nothing re-renders.

```js
// dark.js
export default {
  name: 'dark',
  colorScheme: 'dark', // 'light' | 'dark' | omitted — drives native controls and prefers-color-scheme
  tokens: { 'color-primary': '#7c9cff', 'color-secondary': '#94a3b8' },
}
```

```js
import { applyTheme, theme } from 'imp/theme'
import dark from './dark.js'

applyTheme('imp-light') // a built-in name…
applyTheme(dark) // …or your own module
theme.get().name // the active theme; also theme.watch/text/view
```

Applying a theme at the entry point (or via `init({ theme })`, see [i18n](i18n.md)) before `mount`
avoids a flash of the wrong theme.

## Built-in themes

`'imp-light'`, `'imp-dark'`, `'imp-high-contrast-light'`, `'imp-high-contrast-dark'`. These four
strings are the only ones `applyTheme` accepts — any other string throws. The high-contrast pair
also widens `border-width` and `focus-ring-width` and strengthens hover steps.

Start from a built-in by applying it and copying the tokens (an applied theme is frozen):

```js
applyTheme('imp-dark')
applyTheme({
  name: 'midnight',
  colorScheme: 'dark',
  tokens: { ...theme.get().tokens, 'color-primary': '#a78bfa' },
})
```

## Rules an agent gets wrong

- **Token keys are bare, unprefixed names** (`color-primary`), flat, no nesting. The CSS property is
  `--imp-color-primary`.
- **A theme is expected to define the full token set** — applying one fully replaces the last.
  Spread a built-in's tokens rather than listing a handful.
- **imp does not persist the theme and has no light/dark mode axis.** Save `theme.get().name`
  yourself and re-apply on load; follow `prefers-contrast`/`prefers-color-scheme` by watching the
  media query and calling `applyTheme`.
- **Reference tokens with a fallback** in your own CSS: `var(--imp-color-primary, #2563eb)`.
- **Write logical properties** — `margin-inline-*`, `inset-inline-*`, `text-align: start/end` — so
  layouts mirror under `dir="rtl"`. imp does not set `dir` for you outside `init`.

## The tokens the built-in themes ship

| Group      | Tokens                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-medium`, `font-weight-bold`, `line-height-tight`, `line-height-normal` |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`                                         |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-hover`, `color-border`, `color-focus-ring`                                                                                                    |
| Metrics    | `space-1` … `space-6`, `radius-sm`, `radius-md`, `radius-lg`, `border-width`, `focus-ring-width`, `duration-fast`, `disabled-opacity`, `container-sm` … `container-xl`                                                        |

`color-on-primary` / `color-on-danger` are the text colors that sit **on** those backgrounds.
`color-secondary` is the muted tone. `border-width` and `focus-ring-width` exist so contrast is not
purely a matter of color — use them in your own styles:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## Forced colors

Windows Contrast Themes replace your colors outright; no theme overrides them. Standard components
already handle it. In your own styles:

- **Never let color alone distinguish two things** — they collapse to one system color.
- **Build focus rings from `outline`, not `box-shadow`** (shadows are dropped, outlines survive).
- **Restore borders you set to `transparent`** — it is preserved rather than forced.

```css
@media (forced-colors: active) {
  .panel {
    border-color: ButtonBorder;
  }
  .panel:disabled {
    color: GrayText;
  }
}
```

Keywords: `Canvas`/`CanvasText`, `ButtonFace`/`ButtonText`/`ButtonBorder`, `LinkText`,
`Highlight`/`HighlightText`, `Field`/`FieldText`, `GrayText`.

`imp preview` offers a theme switcher; list your theme modules under `preview.themes` in `imp.json`
to add them — see [preview](preview.md) and [config](config.md).
