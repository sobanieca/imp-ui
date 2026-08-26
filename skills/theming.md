# theming - themes as plain token modules

A theme is an ordinary module whose default export is a flat token map. `applyTheme` writes the
tokens as `--imp-*` custom properties on the document root, where they inherit into every component
(including through shadow roots). Swapping re-skins the whole app in one pass - nothing re-renders.

```js
// dark.js
export default {
  name: 'dark',
  colorScheme: 'dark', // 'light' | 'dark' | omitted - drives native controls and prefers-color-scheme
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
strings are the only ones `applyTheme` accepts - any other string throws. The high-contrast pair
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
- **A theme is expected to define the full token set** - applying one fully replaces the last.
  Spread a built-in's tokens rather than listing a handful.
- **imp does not persist the theme and has no light/dark mode axis.** Save `theme.get().name`
  yourself and re-apply on load; follow `prefers-contrast`/`prefers-color-scheme` by watching the
  media query and calling `applyTheme`.
- **Reference tokens with a fallback** in your own CSS: `var(--imp-color-primary, #2563eb)`.
- **Write logical properties** - `margin-inline-*`, `inset-inline-*`, `text-align: start/end` - so
  layouts mirror under `dir="rtl"`. imp does not set `dir` for you outside `init`.

## The tokens the built-in themes ship

| Group      | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-medium`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                                                                                                                                                                                                                                          |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                                                                                                                                  |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-focus-ring`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                                                                                                                                                                                                                              |
| Palette    | `color-gray`, `color-mauve`, `color-slate`, `color-sage`, `color-olive`, `color-sand`, `color-tomato`, `color-red`, `color-ruby`, `color-crimson`, `color-pink`, `color-plum`, `color-purple`, `color-violet`, `color-iris`, `color-indigo`, `color-blue`, `color-cyan`, `color-teal`, `color-jade`, `color-green`, `color-grass`, `color-bronze`, `color-gold`, `color-brown`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-mint`, `color-sky` |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-full`, `border-width`, `focus-ring-width`, `duration-fast`, `duration-medium`, `disabled-opacity`                                                                                                                                                                                                                          |
| Sizing     | `content-sm`, `content-md`, `content-lg`, `content-xl`, `sidebar-xs`, `sidebar-sm`, `sidebar-md`, `sidebar-lg`, `sidebar-xl`, `sidebar-collapsed`                                                                                                                                                                                                                                                                                                                      |

`color-on-primary` / `color-on-danger` are the text colors that sit **on** those backgrounds.
`color-secondary` is the muted tone. `color-surface` is a panel, `color-surface-sunken` the page
behind it. The **palette** is 31 named hues no component reads by default - use them for per-item
colors (tags, chart series, avatars). `color-success` / `color-warning` / `color-info` alias
`color-green` / `color-amber` / `color-blue`; `color-danger` derives from `color-red`.

`space-3` and up are **fluid** `clamp()` values that grow with the viewport, each keeping a `rem`
term so zoom still scales them; `space-page` is the gutter `page` uses. A theme may set plain
lengths instead.

`border-width` and `focus-ring-width` exist so contrast is not purely a matter of color - use them
in your own styles:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## Writing a theme with the editor

`imp preview` has a theme editor (_edit theme_ in the top bar). It exposes **mode** (light/dark),
**primary**, **secondary**, **border radius** (`none` | `small` | `medium` | `large` | `full`) and
**shadow** (`none` | `soft` | `strong`), derives every other color token from the two base colors,
and copies or downloads a ready `theme.js`:

```js
// theme.js - generated, then edited by hand
const palette = { 'color-green': '#00884d' /* 30 more */ }

export const light = {
  name: 'app-light',
  colorScheme: 'light',
  tokens: { ...palette /* ... */ },
}
export const dark = {
  name: 'app-dark',
  colorScheme: 'dark',
  tokens: { ...palette /* ... */ },
}
export default light
```

```js
import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })
```

Derivation rules the editor follows, and which you should follow when hand-writing a theme:
`color-primary-hover` / `-active` step the primary darker in light mode and lighter in dark;
`color-on-primary` is whichever of white or a near-black tint of the same hue has the better
contrast; surfaces, borders and text take the secondary's hue at fixed lightness steps per mode.

## Forced colors

Windows Contrast Themes replace your colors outright; no theme overrides them. Standard components
already handle it. In your own styles:

- **Never let color alone distinguish two things** - they collapse to one system color.
- **Build focus rings from `outline`, not `box-shadow`** (shadows are dropped, outlines survive).
- **Restore borders you set to `transparent`** - it is preserved rather than forced.

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
to add them - see [preview](preview.md) and [config](config.md).
