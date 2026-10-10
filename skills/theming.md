# theming - themes as plain token modules

A theme is an ordinary module. Its default export is a flat token map. `applyTheme` writes the
tokens as `--imp-*` custom properties on the document root. From there they inherit into every
component, and also through a shadow root. A swap re-skins the whole app in one pass. Nothing
renders again.

```js
// dark.js
export default {
  name: 'dark',
  base: 'imp-dark',
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

The `color-scheme` token is `light` or `dark`. `applyTheme` sets `color-scheme` on the root to that
value, so native controls and `prefers-color-scheme` follow the theme. A theme with a `base` takes
it from the built-in theme. A dark theme over `base: 'imp-light'` must set `'color-scheme': 'dark'`
itself. When the token is absent or has another value, imp warns once per theme and leaves
`color-scheme` unset. `colorSchemeOf(tokens)` returns that token, for a component that must branch.

Apply a theme at the entry point, or through `init({ theme })`, see [i18n](i18n.md). Do it before
`mount`. The page then does not flash the wrong theme. `applyTheme` stores a copy. The object that
you pass stays editable, and the value of `theme.get()` is frozen.

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

`font-family` is the text of every component. `font-family-mono` is code. `font-family-heading` is
the text of `heading` and the name in `appLogo`, and it defaults to `font-family`. `color-heading`
is the colour of the same text and of every heading in `markdown`. It defaults to
`var(--imp-color-text)`. The built-in themes set system stacks. imp loads no font. Load a web font
with a `<link>` in `index.html`, then name it in the theme:

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
- **A project from `imp init` already self-hosts one font**, named in `src/theme.js`. Keep it. See
  [init](init.md).

## Rules an agent gets wrong

- **A token key is a bare name with no prefix**, such as `color-primary`. The map is flat, with no
  nesting. The CSS property is `--imp-color-primary`.
- **A theme must define the full token set.** A new theme fully replaces the last one. Name a
  built-in theme as `base`, or spread the tokens of a theme of your own. Do not list a few tokens
  alone.
- **imp does not store the theme, and it has no light or dark mode axis.** Save `theme.get().name`
  yourself and apply it again on load. To follow `prefers-contrast` or `prefers-color-scheme`, watch
  the media query and call `applyTheme`.
- **`loader` is a keyword, not CSS.** Write `loader: 'dots'`. The `loader` component and the
  `loading` of a `button` have no shape prop. The theme decides the shape for the whole app.
- **Reference a token with a fallback** in your own CSS: `var(--imp-color-primary, #2563eb)`.
- **There is no `color-primary-hover`, `color-link` or `color-focus-ring`.** A link and the focus
  ring take `color-primary`. Mix a hover step with `color-mix()` from the base colour and
  `color-text`.
- **Write logical properties**, such as `margin-inline-*`, `inset-inline-*` and `text-align: start`
  or `text-align: end`. A layout then mirrors under `dir="rtl"`. `flex` and `stack` align with
  `start` and `end`, and they already mirror. `init` and `setLang` write `dir` for you, see
  [i18n](i18n.md).

## The tokens

The list is fixed. A theme with no `base` must give every token a value. When one is missing,
`applyTheme` warns and names it, then applies the theme anyway. It warns once per token and theme
name, not on each toggle. A theme with a `base` is always complete.

| Group      | Tokens                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-family-heading`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                           |
| Color      | `color-primary`, `color-on-primary`, `color-secondary`, `color-danger`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                |
| Surface    | `color-text`, `color-heading`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-shadow`, `background-app`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                   |
| Palette    | `color-gray`, `color-brown`, `color-red`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-green`, `color-teal`, `color-cyan`, `color-sky`, `color-blue`, `color-indigo`, `color-violet`, `color-purple`, `color-pink`                |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-item`, `radius-container`, `border-width`, `focus-ring-width`, `icon-stroke-width`, `duration-fast`, `duration-medium`, `disabled-opacity`, `breakpoint-desktop` |
| Loader     | `loader`                                                                                                                                                                                                                                                 |
| Scheme     | `color-scheme`                                                                                                                                                                                                                                           |

`color-scheme` is `light` or `dark`, see above. `loader` is the shape of every loading state: the
`loading` of a `button`, the `loader` component, the row of a `table` or a `list` that loads more,
and the image upload of `richTextEditor`. The values are `spinner`, `dots`, `bar` and `pulse`. The
built-in themes set `spinner`. Any other value logs a warning and draws the spinner. The loader
takes `currentColor` and the size of its place. To show the loader of the theme on its own, write
`loader({ label: 'Loading' })`.

`radius-item` rounds a button, an input, a tag, a nav row and a tab. `radius-container` rounds a
dialog, a drawer, a menu and the frame of a `shell`. Set `radius-item` and `radius-container`
together. The container radius must be the larger one.

`color-on-primary` and `color-on-danger` are the text colours that sit **on** those backgrounds.
There is no hover token and no active token. Mix them from the base colour and `color-text`:
`color-mix(in oklab, var(--imp-color-primary), var(--imp-color-text) 12%)` is the hover step, and
`24%` is the active step. A link and the focus ring take `color-primary`. `color-secondary` is the
muted tone. `color-surface` is a panel, and `color-surface-sunken` is the page behind it.
`background-app` is what `shell` paints under everything. It is a CSS `background`, not a colour, so
a gradient or an image is valid. The built-in themes set it to `color-surface`. The **palette** is
16 named hues for a per-item colour, such as a tag, a chart series or an avatar. `tag` and `icon`
take the palette names as a `color` option. Nothing else reads them. The four colour roles are
`var()` references into the palette. `color-danger` is `var(--imp-color-red)`, `color-success` is
`var(--imp-color-green)`, `color-warning` is `var(--imp-color-amber)` and `color-info` is
`var(--imp-color-blue)`. A change to a palette colour moves its role with it.

`space-3` and the larger spaces are **fluid** `clamp()` values that grow with the viewport. Each one
keeps a `rem` term, so zoom still scales it. `space-page` is the gutter for the outside of a page
that you lay out yourself. No component uses it for padding. `card` reads `shadow-sm`. Use it for a
panel of your own. Use `shadow-md` for a menu that floats beside its trigger. Use `shadow-lg` for a
dialog or a drawer. Each step casts `color-shadow` at its own opacity. It is near-black in a light
theme and white in a dark theme. Set `color-shadow` to change every step at once. A theme can set a
plain length instead.

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

imp has one theme editor. In `imp preview`, open it with _edit theme_ in the top bar. In
`imp start`, press the imp mark in the corner of the app, then **Theme editor**. It edits the theme
the app applied, so a dark theme is edited with a dark theme selected. It keeps a draft per theme
name in `localStorage` across reloads, until the person presses _reset_. It exposes **primary**,
**secondary**, **heading colour**, which is `color-heading`, **font**, **mono font**, **border
radius**, which is `none`, `small`, `medium` or `large`, **shadow**, which is `none`, `soft` or
`strong`, **shadow colour**, which is `color-shadow`, and **loader**, which is `spinner`, `dots`,
`bar` or `pulse`, with a live sample beside it. A colour is a `colorPicker`, a font is a `comboBox`
with suggestions that accepts any stack, and a step is a `segmented` row. It derives every other
colour token from the two base colours. The knobs sit on the **Knobs** tab. The **Tokens** tab is
the whole theme as JSON, in a `codeEditor` that grows with the text. An edit there applies as soon
as the JSON parses. A knob rewrites the tokens it drives, and it leaves every other token as edited.
The widget of `imp start` shows the **Tokens** view alone, with no knobs. It copies or downloads a
complete `theme.js`, one theme per file:

```js
// theme.js - generated, then edited by hand
const theme = {
  name: 'imp-light',
  tokens: { 'font-family': "'Inter', system-ui, sans-serif", 'color-green': '#00884d' /* ... */ },
}
export default theme
```

```js
import { init } from 'imp'
import theme from './theme.js'

await init({ theme })
```

The editor follows these derivation rules. Follow them as well when you write a theme by hand.
`color-primary` keeps its hue, and moves in lightness until it reads at 4.5:1 on the surface and the
sunken surface: darker in a light theme, lighter in a dark theme. `color-on-primary` is white when
white reaches 4.5:1 against the primary. Otherwise it is a near-black tint of the same hue. Set
`color-primary` and `color-on-primary` by hand when a brand needs an exact colour. The contrast
check then reports a pair below 4.5:1. A surface, a border and the text take the hue of the
secondary colour, at a fixed lightness step for each mode. `color-secondary` moves in lightness
until it reads at 4.5:1 on the surface and the sunken surface. A dark theme gets a lighter
`color-danger` hex of its own, with a dark `color-on-danger`, because the palette red is too dark
for error text there. So every text pair of a derived theme reaches 4.5:1.

## Contrast check

The editor lists every text and background pair of the draft below 4.5:1, the WCAG AA level, under
its tabs. The report changes with each edit. It blocks nothing.

- It checks `color-text` on `color-surface`, `color-surface-sunken`, `color-surface-hover` and
  `background-app`; `color-heading` on `color-surface`, `color-surface-sunken` and `background-app`;
  `color-secondary` on `color-surface`, `color-surface-sunken` and `background-app`; `color-primary`
  on `color-surface` and `color-surface-sunken`; `color-danger` on `color-surface`;
  `color-on-primary` on `color-primary`; `color-on-danger` on `color-danger`.
- It reads hex, color names, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and
  `color()`, converts to sRGB, and clips a color outside sRGB. It follows a `var(--imp-...)`
  reference. It puts translucent text over its background.
- **An unreadable side never passes.** A gradient, `color-mix()`, `currentColor`, an unknown
  `var()`, or a translucent background is listed with the reason. Check that pair by eye.
- The check is part of the editor only. `imp/theme` exports no contrast function, and an app ships
  no colour parser.

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
