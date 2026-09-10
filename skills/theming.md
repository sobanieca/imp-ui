# theming - themes as plain token modules

A theme is an ordinary module. Its default export is a flat token map. `applyTheme` writes the
tokens as `--imp-*` custom properties on the document root. From there they inherit into every
component, and also through a shadow root. A swap re-skins the whole app in one pass. Nothing
renders again.

```js
// dark.js
export default {
  name: 'dark',
  tokens: { 'color-primary': '#7c9cff', 'color-secondary': '#94a3b8', 'color-surface': '#1f2028' },
}
```

```js
import { applyTheme, colorSchemeOf, theme } from 'imp/theme'
import dark from './dark.js'

applyTheme('imp-light') // a built-in name...
applyTheme(dark) // ...or your own module
theme.get().name // the active theme; also theme.watch/text/view
colorSchemeOf(theme.get().tokens) // 'light' | 'dark' | undefined
```

There is no mode field. imp reads light or dark from the lightness of `color-surface`, and sets
`color-scheme` on the root to match. So native controls and `prefers-color-scheme` follow the theme.
`color-surface` must be a hex colour. When it is absent, or not hex, imp warns and leaves
`color-scheme` unset. `colorSchemeOf(tokens)` is the same test, for a component that must branch.

Apply a theme at the entry point, or through `init({ theme })`, see [i18n](i18n.md). Do it before
`mount`. The page then does not flash the wrong theme.

## Built-in themes

The built-in names are `'imp-light'`, `'imp-dark'`, `'imp-high-contrast-light'` and
`'imp-high-contrast-dark'`. `applyTheme` accepts these four strings only. Any other string throws.
The high-contrast pair also makes `border-width` and `focus-ring-width` wider, and raises
`disabled-opacity`.

To start from a built-in theme, name it as `base`. imp fills every token from the base, then writes
your tokens over it. `name` defaults to the base. `base` takes the four built-in names only.
`theme.get()` returns the resolved theme, with no `base` key:

```js
applyTheme({ base: 'imp-dark', name: 'midnight', tokens: { 'color-primary': '#a78bfa' } })
```

## Fonts

`font-family` is the text of every component. `font-family-mono` is code. The built-in themes set
system stacks. imp loads no font. Load a web font with a `<link>` in `index.html`, then name it in
the theme:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" />
```

```js
await init({
  theme: { base: 'imp-light', tokens: { 'font-family': "'Inter', system-ui, sans-serif" } },
})
```

- **Load the weights of `font-weight-normal` and `font-weight-bold`**, 400 and 600 by default. They
  are the only weights the standard components use. Every component sets its text to
  `font-weight-normal`, so a heavy regular cut is one token change, `'font-weight-normal': '300'`. A
  weight that is not loaded is synthesized or snapped.
- **Keep the system stack behind the font**, so a script the font lacks still renders.
- **Set the same fonts in every theme.** A font does not change between light and dark.
- A self-hosted font goes under `public/fonts/`, with an `@font-face` stylesheet linked from
  `index.html`.

## Rules an agent gets wrong

- **A token key is a bare name with no prefix**, such as `color-primary`. The map is flat, with no
  nesting. The CSS property is `--imp-color-primary`.
- **A theme must define the full token set.** A new theme fully replaces the last one. Name a
  built-in theme as `base`, or spread the tokens of a theme of your own. Do not list a few tokens
  alone.
- **imp does not store the theme, and it has no light or dark mode axis.** Save `theme.get().name`
  yourself and apply it again on load. To follow `prefers-contrast` or `prefers-color-scheme`, watch
  the media query and call `applyTheme`.
- **Reference a token with a fallback** in your own CSS: `var(--imp-color-primary, #2563eb)`.
- **Write logical properties**, such as `margin-inline-*`, `inset-inline-*` and `text-align: start`
  or `text-align: end`. A layout then mirrors under `dir="rtl"`. `flex` and `stack` align with
  `start` and `end`, and they already mirror. `init` and `setLang` write `dir` for you, see
  [i18n](i18n.md).

## The tokens that the built-in themes ship

| Group      | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                                                                                                                                                                                                                                                                |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                                                                                                                                  |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-focus-ring`, `background-app`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                                                                                                                                                                                                            |
| Palette    | `color-gray`, `color-mauve`, `color-slate`, `color-sage`, `color-olive`, `color-sand`, `color-tomato`, `color-red`, `color-ruby`, `color-crimson`, `color-pink`, `color-plum`, `color-purple`, `color-violet`, `color-iris`, `color-indigo`, `color-blue`, `color-cyan`, `color-teal`, `color-jade`, `color-green`, `color-grass`, `color-bronze`, `color-gold`, `color-brown`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-mint`, `color-sky` |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-item`, `radius-container`, `radius-full`, `border-width`, `focus-ring-width`, `duration-fast`, `duration-medium`, `disabled-opacity`, `breakpoint-desktop`                                                                                                                                                                                                                     |

`radius-item` rounds a button, an input, a tag, a nav row and a tab. `radius-container` rounds a
dialog, a drawer, a menu and the frame of a `shell`. `radius-full` is the pill and is always
`9999px`. Set `radius-item` and `radius-container` together. The container radius must be the larger
one.

`color-on-primary` and `color-on-danger` are the text colours that sit **on** those backgrounds.
`color-secondary` is the muted tone. `color-surface` is a panel, and `color-surface-sunken` is the
page behind it. `background-app` is what `shell` paints under everything. It is a CSS `background`,
not a colour, so a gradient or an image is valid. The built-in themes set it to `color-surface`. The
**palette** is 31 named hues for a per-item colour, such as a tag, a chart series or an avatar.
`tag` and `icon` take the palette names as a `color` option. Nothing else reads them.
`color-success`, `color-warning` and `color-info` are aliases of `color-green`, `color-amber` and
`color-blue`. `color-danger` derives from `color-red`.

`space-3` and the larger spaces are **fluid** `clamp()` values that grow with the viewport. Each one
keeps a `rem` term, so zoom still scales it. `space-page` is the gutter for the outside of a page
that you lay out yourself. No component uses it for padding. `card` reads `shadow-sm`. Use it for a
panel of your own. Use `shadow-md` for a menu that floats beside its trigger. Use `shadow-lg` for a
dialog or a drawer. A theme can set a plain length instead.

`breakpoint-desktop` is `48rem`. It is the width where imp separates a phone from a desktop. Use it
anywhere a length goes, and read it from JavaScript with `getComputedStyle`. **It cannot go inside a
media query**, because CSS forbids `var()` there. Write the literal value in the query, and keep the
token everywhere else.

`border-width` and `focus-ring-width` exist so that contrast does not depend on colour alone. Use
them in your own styles:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## How to write a theme with the editor

`imp preview` has a theme editor. Open it with _edit theme_ in the top bar. It exposes **mode**,
which is light or dark, **primary**, **secondary**, **font**, **mono font**, **border radius**,
which is `none`, `small`, `medium` or `large`, and **shadow**, which is `none`, `soft` or `strong`.
It derives every other colour token from the two base colours. It copies or downloads a complete
`theme.js`:

```js
// theme.js - generated, then edited by hand
const fonts = { 'font-family': "'Inter', system-ui, sans-serif", 'font-family-mono': '...' }
const palette = { 'color-green': '#00884d' /* 30 more */ }

export const light = {
  name: 'app-light',
  tokens: { ...fonts, ...palette /* ... */ },
}
export const dark = {
  name: 'app-dark',
  tokens: { ...fonts, ...palette /* ... */ },
}
export default light
```

```js
import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })
```

The editor follows these derivation rules. Follow them as well when you write a theme by hand.
`color-primary-hover` and `color-primary-active` step the primary colour darker in light mode, and
lighter in dark mode. `color-on-primary` is white or a near-black tint of the same hue, whichever
has the better contrast. A surface, a border and the text take the hue of the secondary colour, at a
fixed lightness step for each mode.

## Forced colours

A Windows Contrast Theme replaces your colours completely. No theme can override it. The standard
components already handle this. In your own styles, follow these rules:

- **Never let colour alone separate two things.** The two colours become one system colour.
- **Build a focus ring from `outline`, not from `box-shadow`.** The browser drops a shadow and keeps
  an outline.
- **Restore a border that you set to `transparent`.** The browser keeps that value instead of
  forcing it.

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

The keywords are `Canvas` and `CanvasText`, `ButtonFace`, `ButtonText` and `ButtonBorder`,
`LinkText`, `Highlight` and `HighlightText`, `Field` and `FieldText`, and `GrayText`.

`imp preview` offers a theme switcher. To add your themes to it, list your theme modules under
`preview.themes` in `imp.json`. See [preview](preview.md) and [config](config.md).
