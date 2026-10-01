# imp-ui - Theming

Every imp app is themable by default. A theme is a plain JavaScript file that you write. Apply it at
your entry point, and imp skins your app. A change to another theme re-skins the whole app
immediately. There is no CSS build step. Nothing renders again. There is no framework store to
configure. Light and dark are two theme files.

## A theme is a file

A theme is an ordinary module. Its default export is a flat set of **design tokens**, with a small
amount of optional metadata. A token is a named value, such as a color, a radius, a spacing step or
a typography value:

```js
// dark.js
export default {
  name: 'dark',
  base: 'imp-dark',
  tokens: {
    'color-primary': '#7c9cff',
    'color-secondary': '#94a3b8',
    'color-surface': '#1f2028',
  },
}
```

- **`tokens`** is a flat map of a token name to a CSS value. A key is a bare name, such as
  `color-primary`. imp adds an `--imp-` prefix. The CSS custom property that your styles reference
  is `--imp-color-primary`. There is no nesting. There is one flat namespace.
- **`base`** names a built-in theme to start from. imp takes every token from it, then writes your
  tokens over it. Without a `base`, a theme must give a value to every token, see
  [Token names](#token-names).
- **`name`** labels the theme. It helps in a theme switcher UI, and when you store a choice.
- **The `color-scheme` token is `light` or `dark`.** imp sets the `color-scheme` of the page to that
  value. A native form control, a scrollbar, and CSS that reads `prefers-color-scheme` then follow
  your palette. A theme with a `base` takes the value from the built-in theme. A theme that sets a
  dark surface over `imp-light` must set `color-scheme` to `dark` as well. When the token is
  missing, or has another value, imp warns and leaves the color scheme unset. imp warns one time for
  each theme.

An app can ship as many theme files as it wants. There is no registry to register them in. A theme
is a module that you import.

## How to apply and change a theme - `applyTheme`

At your entry point, the file that calls `mount()`, import a theme and apply it:

```js
import { mount } from 'imp'
import { applyTheme } from 'imp/theme'
import light from './light.js'
import dark from './dark.js'

applyTheme(light)
mount('#app', app())

// later - a settings toggle, a theme switcher:
applyTheme(dark)
```

`applyTheme` writes the tokens of the theme as `--imp-*` custom properties on the document root.
From there they inherit into everything: your components, their shadow DOM, and any content that imp
adds to the page. It also sets the `color-scheme` of the page from the token of that name.

**A change of theme re-skins the app immediately.** A token is a CSS custom property. A new theme
rewrites the variables in one pass. Every rule that references a token re-skins at the same time.
Nothing renders again. Each theme must define the full set of tokens, so a new theme fully replaces
the last one. Start from a built-in theme, described below, and every token is already covered.

## How to read the active theme - the `theme` state

`applyTheme` is the only function that changes the active theme, and it keeps a reactive `theme`
state in step. Import that state to read the current theme, or to react to it:

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { theme } from 'imp/theme'

const badge = component('my-app-theme-badge', {
  setup: () => div(theme.text((t) => t.name)),
})
```

`theme.get()` returns the active theme object anywhere. Inside a component, call
`theme.watch(self, ...)`, or bind the state with `theme.text` or `theme.view`, so it updates when
the theme changes. Most of your app never needs this, because the re-skin happens through the CSS
variables. Use it only for the rare component that must branch on the active theme, and to build a
theme switcher.

To branch on light against dark, call `colorSchemeOf(tokens)` from `imp/theme`. It returns the
`color-scheme` token, `'light'` or `'dark'`. So `colorSchemeOf(theme.get().tokens)` is the scheme of
the active theme. It returns `undefined` when the token is missing or has another value.

## Built-in starter themes

imp ships four built-in themes, so your app renders correctly before you write your own. There is
nothing to import. Pass the name in place of an object.

```js
import { applyTheme } from 'imp/theme'

applyTheme('imp-light')
applyTheme('imp-dark')
applyTheme('imp-high-contrast-light')
applyTheme('imp-high-contrast-dark')
```

| Name                      | For                                                   |
| ------------------------- | ----------------------------------------------------- |
| `imp-light`               | the default light palette                             |
| `imp-dark`                | the default dark palette                              |
| `imp-high-contrast-light` | black on white, for readers who need maximum contrast |
| `imp-high-contrast-dark`  | white on black, the same at the other polarity        |

The high-contrast pair does more than darken the text. The borders and the focus ring grow wider,
through `border-width` and `focus-ring-width`. A disabled control stays more visible, through
`disabled-opacity`. Every pair of a foreground and a background clears the WCAG AA contrast
threshold. These are ordinary themes. One of them re-skins the whole app in a single write of the
custom properties, the same way a switch between light and dark does.

`applyTheme` accepts only these four strings. Any other string throws an error. The `imp-` prefix
keeps them out of your way. Your own themes can use the names `light` and `dark`, with no confusion
about which theme a name refers to. Everything else works exactly as with a theme object. The tokens
arrive as `--imp-*` custom properties, imp sets the color scheme, and the `theme` state updates.

To start from a built-in theme, instead of writing every value, name it as the `base` of your theme.
imp resolves the base, then writes your tokens over it. The result is a complete theme. The `name`
comes from the base when you leave it out:

```js
import { applyTheme } from 'imp/theme'

applyTheme({
  base: 'imp-dark',
  name: 'midnight',
  tokens: { 'color-primary': '#a78bfa' },
})
```

`base` accepts only the four built-in names. `theme.get()` returns the resolved theme, with every
token filled in and no `base` key. An applied theme is frozen. To derive one theme from another
theme of your own, spread its tokens into a new object. Do not edit them in place.

## Fonts

The font of an app is three tokens. `font-family` is the text of every component. `font-family-mono`
is code and other monospaced text. `font-family-heading` is the text of `heading` and the name in
`appLogo`. The built-in themes set the first two to a system font stack, and they point
`font-family-heading` at `font-family`. An app ships no font file, and the text renders in the font
of the platform. Set `font-family-heading` only when the headings need a display font of their own.

The colour of a heading is its own token, `color-heading`. It colours the text of `heading`, the
name in `appLogo` and every heading that `markdown` renders. The built-in themes point it at
`color-text`, so a theme that does not set it has one text colour. Set it when the headings need a
colour of their own, such as a brand ink on a neutral body. The contrast report of the theme editor
reads it against the surfaces, the same way as `color-text`.

To use a web font, do two things. Load the font in `index.html`, and name it in the theme. imp does
not load a font for you. A `<link>` in the page is what the browser needs. The font then reaches
every component, including the inside of a shadow root:

```html
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
  />
</head>
```

```js
await init({
  theme: {
    base: 'imp-light',
    tokens: { 'font-family': "'Inter', system-ui, sans-serif" },
  },
})
```

To host the font yourself, put the font files under `public/fonts/`, and link a stylesheet with an
`@font-face` rule from the same `<head>`. Either way, follow these rules:

- **Load the weights of `font-weight-normal` and `font-weight-bold`.** They default to 400 and 600.
  The standard components use only these two weights. Every component sets its text to
  `font-weight-normal`, so a font whose regular cut looks heavy takes one token change, such as
  `'font-weight-normal': '300'`. The browser synthesizes a weight that you did not load, or falls
  back to the nearest loaded weight. A bold label can lose its emphasis with no error.
- **Keep the system stack behind your font.** A font that lacks a script, such as Arabic or Chinese,
  falls back per glyph. A translated page still renders correctly.
- **Set the fonts once, for every theme.** A font does not change between light and dark. A theme
  file from the theme editor keeps both fonts in one shared block for this reason.

`imp preview` generates its own page, so a font that `index.html` links does not load there. To see
a web font in the component preview and in the theme editor, point `preview.entry` in `imp.json` at
an HTML file that links the font. See **[`imp preview`](cli.md#imp-preview)**.

### How to follow the contrast preference of the reader

imp does not select a theme for you. There is no built-in mode axis, for contrast or for light and
dark. To follow the system setting of the reader, watch the media query and apply the matching theme
yourself:

```js
const wantsMoreContrast = matchMedia('(prefers-contrast: more)')

const pickTheme = () =>
  applyTheme(wantsMoreContrast.matches ? 'imp-high-contrast-light' : 'imp-light')

pickTheme()
wantsMoreContrast.addEventListener('change', pickTheme)
```

This setting is separate from Windows Contrast Themes, and from a similar mode at OS level. Those
replace your colors with the system palette completely. See [Forced colors](#forced-colors) below.

## How to remember a choice

imp does **not** store the selected theme. A theme is a module that your app imports, so imp cannot
turn a stored name back into the correct module. Storage stays your decision, and it stays flexible.
To remember a choice, save `theme.get().name`, for example to `localStorage`, when the person
selects a theme. Apply the matching module again on load. Apply it before you call `mount()`, so the
page does not flash the wrong theme.

```js
import { mount } from 'imp'
import { applyTheme } from 'imp/theme'
import light from './light.js'
import dark from './dark.js'

const themes = { light, dark }
const saved = localStorage.getItem('theme')
applyTheme(themes[saved] ?? light)
mount('#app', app())
```

When you use only the built-in themes, there is no map to keep. The stored name goes straight back
into `applyTheme`:

```js
const saved = localStorage.getItem('theme')
applyTheme(saved === 'imp-dark' ? 'imp-dark' : 'imp-light')
```

## How to check a theme without your app

`imp preview` renders one component at a time, on a generated page with a theme switcher in its top
bar. Move a component between your themes and the built-in themes without starting the app. List
your theme files in `imp.json`, and they join the switcher:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Nothing about the theme file changes. The switcher applies the same module as your entry point. An
edit to the file reloads the page with the new tokens. See **[`imp preview`](cli.md#imp-preview)**.

## How to write a theme with the theme editor

You do not have to write every token by hand to get a theme. imp ships a **theme editor**. In
`imp preview` it sits beside the theme switcher. Open it with **edit theme**. In `imp start` it sits
behind the imp mark in the corner of your app. Press the mark, then **Theme editor**. Both open the
same editor. The first shows the standard components under your theme. The second shows your own
screens. It edits the theme that is applied: in `imp preview` that is the theme in the sidebar, and
in your app it is the theme that `init` applied. To write a dark theme, select a dark theme first.
In `imp preview` the editor has two tabs. **Knobs** asks for nine things. **Tokens** holds the whole
theme as JSON. In your app the widget shows **Tokens** alone, because that is where you tune one
token against your real screens:

| Knob              | Choices                    | What it drives                                             |
| ----------------- | -------------------------- | ---------------------------------------------------------- |
| **Primary**       | any color, with a picker   | The accent: buttons, links, focus rings                    |
| **Secondary**     | any color, with a picker   | The muted tone, and the hue of every surface, border, text |
| **Heading color** | any color, with a picker   | `color-heading`, the text of every heading                 |
| **Font**          | a suggestion, or any stack | `font-family`, the text of every component                 |
| **Mono font**     | a suggestion, or any stack | `font-family-mono`, code and monospaced text               |
| **Border radius** | none, small, medium, large | `radius-item` and `radius-container`, as one step          |
| **Shadow**        | none, soft, strong         | The three `shadow-*` steps                                 |
| **Shadow color**  | any color, with a picker   | `color-shadow`, the color every shadow step casts          |
| **Loader**        | spinner, dots, bar, pulse  | `loader`, the shape of every loading state, with a sample  |

Every knob is a standard component. A color is a `colorPicker`: type a hex value, or press the
swatch to open the picker of the browser. A font is a `comboBox`: pick a suggested font, or type any
font stack. A step is a `segmented` row of buttons.

imp **derives** everything else. The primary color is also the color of a link, so it must read as
text. imp keeps its hue, and moves its lightness until it reads at 4.5:1 on the surface and on the
sunken surface. The move goes darker in a light theme and lighter in a dark theme. imp then picks a
readable `color-on-primary`. That is white when white reaches 4.5:1 against the primary. Otherwise
it is a near-black tint of the same hue. So a pale amber becomes a deeper amber with white text in a
light theme, and keeps its value with dark text in a dark theme. To keep an exact brand color, set
`color-primary` and `color-on-primary` by hand in the JSON. From the secondary color, imp builds the
surface, sunken, hover, border and text colors. They share one hue, and they land at a lightness
that is safe for the contrast of a light theme or a dark theme. The page re-skins while you type, on
the real components, and your choices survive a reload.

The derivation keeps muted text and error text readable too. When `color-secondary` reads below
4.5:1 on the surface or on the sunken surface, imp moves its lightness until it reads. In a dark
theme, the red of `color-danger` is too dark for error text. So a dark theme gets a lighter red, as
a color of its own, with a dark `color-on-danger` on it. So every text pair of a derived theme
reaches 4.5:1, for any primary and any secondary.

**The editor checks the contrast of the theme while you edit it.** Under the two tabs, it lists
every pair of a text token and a background token that is below 4.5:1, the WCAG AA level for body
text. A pair reads as `color-primary on color-surface: 1.4:1`. A knob always derives readable
colors, so a problem comes from a hand edit in the JSON, such as an exact brand color. When every
pair passes, the editor says so. See
**[How the theme editor checks contrast](#how-the-theme-editor-checks-contrast)** for the list of
pairs.

**Tokens** is the second tab. It holds the whole theme as JSON, in a code editor that grows with the
text. Every token that the knobs drive is there, and so is every token that they do not, such as
`background-app`, a spacing step or a font weight. Edit any value. The page re-skins as soon as the
JSON parses. An edit that does not parse yet changes nothing. The two views show one state. An edit
of `color-primary` in the JSON moves the **Primary** knob. A knob rewrites the tokens that it
drives, and it leaves every other token as you set it. Set the accent with the knob, then tune
`color-on-primary` by hand. The hand edit holds until you move the knob again.

The editor changes nothing about what a theme _is_. Press **copy**, or **download theme.js**, and
you get an ordinary module. It is the same flat token map that this page describes, as one theme
object, with the name of the theme that you edited. Save it into your app, and pass it to `init`:

```js
import { init } from 'imp'
import theme from './theme.js'

await init({ theme })
```

For a light theme and a dark theme, edit each one in turn, and save two files. A theme switcher then
passes the second one to `applyTheme`. From that point the generated file is yours to edit by hand.
A web font that you name in the editor shows on the page only when it is loaded there. See
**[Fonts](#fonts)**. The file is a starting point, not a format that the editor owns.

## How the theme editor checks contrast

A custom theme is where contrast breaks. So the theme editor lists every text and background pair of
the draft that reads below 4.5:1, the WCAG AA level, under its tabs. The report changes with each
edit. It blocks no edit and no export, because a brand can accept a pair on purpose, for example for
large text only. The editor checks these pairs, because the standard components draw text in these
combinations:

| Text               | Background                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| `color-text`       | `color-surface`, `color-surface-sunken`, `color-surface-hover`, `background-app` |
| `color-heading`    | `color-surface`, `color-surface-sunken`, `background-app`                        |
| `color-secondary`  | `color-surface`, `color-surface-sunken`, `background-app`                        |
| `color-primary`    | `color-surface`, `color-surface-sunken`, for a link                              |
| `color-danger`     | `color-surface`, for an error message                                            |
| `color-on-primary` | `color-primary`, for the label of a primary button                               |
| `color-on-danger`  | `color-danger`, for the label of a danger button                                 |

The editor reads every CSS color syntax: a hex color, a color name, `rgb()`, `hsl()`, `hwb()`,
`lab()`, `lch()`, `oklab()`, `oklch()` and `color()`. It converts the color to sRGB, as the screen
shows it. A color outside sRGB is clipped to the nearest sRGB value. It follows a `var(--imp-...)`
reference to another token. Translucent text is measured over its background.

**A pair that the editor cannot read does not pass.** A gradient, `color-mix()`, `currentColor`, a
`var()` that is not a token of the theme, and a translucent background all show in the report, with
the reason. Check such a pair by eye. The report does not measure the text of your own components,
or a color that a component mixes at runtime.

The check lives in the editor only. An app ships no color parser, so a theme file costs an app
nothing beyond its tokens.

## Token names

A token key is a bare name, and imp adds the `--imp-` prefix. The names follow a fixed scheme. There
are semantic color roles, such as `color-primary` and `color-secondary`, and numeric scales for
spacing, radius, shadow and typography. Themes stay consistent, and you can exchange one for
another. Reference a token in your own CSS with a fallback, so your styles still work before imp
applies a theme:

```css
.cta {
  background: var(--imp-color-primary, #2563eb);
}
```

The set of tokens is fixed. A few tokens exist for your own layout, not for a component. They are
`space-page`, `shadow-sm`, `breakpoint-desktop` and the palette. This page names each of them. A
theme of your own must define all of them:

| Group      | Tokens                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-family-heading`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                           |
| Color      | `color-primary`, `color-on-primary`, `color-secondary`, `color-danger`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                |
| Surface    | `color-text`, `color-heading`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-shadow`, `background-app`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                   |
| Palette    | `color-gray`, `color-brown`, `color-red`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-green`, `color-teal`, `color-cyan`, `color-sky`, `color-blue`, `color-indigo`, `color-violet`, `color-purple`, `color-pink`                |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-item`, `radius-container`, `border-width`, `focus-ring-width`, `icon-stroke-width`, `duration-fast`, `duration-medium`, `disabled-opacity`, `breakpoint-desktop` |
| Loader     | `loader`                                                                                                                                                                                                                                                 |
| Scheme     | `color-scheme`                                                                                                                                                                                                                                           |

**imp tells you when a theme is not complete.** When an applied theme has no value for one of these
tokens, `applyTheme` logs a warning that names the missing tokens. imp warns about each missing
token of a theme one time, so a theme switcher does not fill the console. The theme still applies. A
component then falls back to its built-in value, and a token of the previous theme can stay on the
page. A theme with a `base` is always complete, because imp fills every token from the base.

`color-on-primary` and `color-on-danger` are the text colors that sit **on** those backgrounds. A
theme can pick a readable pair, instead of hoping that white works. There is no hover token and no
active token. A component mixes those two steps from the base color and `color-text` with
`color-mix()`. The step goes darker in a light theme and lighter in a dark theme, and a theme sets
one color per role. A link and the focus ring take `color-primary`. `color-secondary` is the muted
tone, for secondary text and for a link with less emphasis. `color-surface` is a panel.
`color-surface-sunken` is the page behind the panel. `color-surface-hover` is the tint under the
pointer. `background-app` is what the app frame paints under everything. It is the one token that
takes a CSS `background` and not a plain color, so it can take a gradient or an image as readily as
a flat value. The built-in themes set it to their `color-surface`. See
**[Standard components](std-components.md)** for how the library uses these tokens. See the
[component gallery](/components) to watch one token change land on every component at the same time.

The **palette** is 16 named colors, with one value each. Use them where an app needs a specific hue
in place of a role. Examples are a tag per project, a series in a chart, and the background of an
avatar. No component paints with a palette color on its own. `tag` and `icon` offer the palette
names as their `color` options, so a hue that you select there is the same hue that your own CSS
reads. The four color roles point at the palette. `color-danger` is `var(--imp-color-red)`,
`color-success` is `var(--imp-color-green)`, `color-warning` is `var(--imp-color-amber)` and
`color-info` is `var(--imp-color-blue)`. A change to a palette color moves its role with it. Set a
role to another reference, or to a literal color, when a brand needs a different hue there. imp
picks every palette value to read as a tint on a light surface and on a dark surface, so the same
block of colors serves both themes.

The three shadow steps and the radius scale set the depth and the softness of a theme. `shadow-sm`
lifts a card off the page. The `card` component reads it, and so does a panel of your own.
`shadow-md` lifts an element that floats near its trigger, such as the overflow menu of a button.
`shadow-lg` lifts an overlay that sits above everything, such as a dialog or a drawer. Each step
casts `color-shadow` at its own opacity. A light theme starts with a near-black shadow. A dark theme
starts with a white one, because a black shadow is invisible on a dark surface. Set `color-shadow`
to any color, and every step follows. There are two radius tokens, because a corner reads
differently at two scales. `radius-item` rounds the small things that sit inside a page: a button,
an input, a tag, a nav row, a tab. `radius-container` rounds the panels that hold them: a dialog, a
drawer, a menu, the frame of a `shell`. It is always the larger of the two, so a panel and the
button inside it never share one corner. A theme that wants flat, square chrome sets every shadow to
`none` and both radius tokens to `0`. Every component then follows, with no CSS in your app.

## The loader

Every loading state in imp draws one loader. A `button` with `loading` shows it before its label.
The `loader` component is that loader alone. A table or a list shows it while the next rows load,
and the rich text editor shows it while an image uploads. The `loader` token selects its shape, for
the whole app at once:

| Value     | Draws                                    |
| --------- | ---------------------------------------- |
| `spinner` | a ring with a gap that turns             |
| `dots`    | three dots that bounce one after another |
| `bar`     | a short track with a segment that slides |
| `pulse`   | a disc that grows and fades              |

The built-in themes set `spinner`. The loader takes the colour of its text, so a loader in a primary
button is white and a loader in a table row is muted. It takes the size of its place, so it is one
line of text high in a button and as large as the `size` of a `loader`. Any other value logs a
warning, and every loading state draws the spinner. To show a loader in a place of your own, write
`loader({ label: 'Loading' })`. It draws the shape of the theme.

The spacing scale is **fluid**. `space-3` and the larger steps are `clamp()` values that grow with
the viewport. A gap that you set once is tighter on a phone and wider on a monitor, and you write no
breakpoint. `space-page` is the gutter for the outside of a page that you lay out yourself. No
component uses it for padding. Each step keeps a `rem` term in its preferred value, so browser zoom
and a larger default font size still scale the spacing as a reader expects. A theme that wants fixed
spacing sets a plain length instead. Nothing in imp requires the scale to be fluid.

`breakpoint-desktop` is the width where imp separates a phone layout from a desktop layout. It is
`48rem` unless you change it. It exists so that a media query in your own component does not repeat
a number that imp already has an opinion about. Use it anywhere that a length goes:

```css
.side-panel {
  max-inline-size: calc(var(--imp-breakpoint-desktop) / 3);
}
```

There is one place where the token cannot go, and that is a CSS rule, not an imp rule. **A custom
property cannot go inside a media query.** `@media (min-width: var(--imp-breakpoint-desktop))` works
in no browser. The query itself still needs the literal `48rem`. Read the token from JavaScript when
you need the number as data:

```js
const desktopFrom = getComputedStyle(document.documentElement)
  .getPropertyValue('--imp-breakpoint-desktop')
```

`border-width` and `focus-ring-width` exist so that contrast does not depend on color alone. A theme
that only changes the colors could never make a hairline border, or a thin focus ring, easier to
see. These two widths go through tokens, so the high-contrast themes can strengthen the affordances
themselves. Use them in your own styles the same way:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## Forced colors

Windows Contrast Themes, and an equivalent mode at OS level elsewhere, do not read your tokens. They
replace the colors of the page with the system palette of the reader, and no theme that you write
can override that. This behavior is deliberate. A reader who has chosen a system palette wants it
applied everywhere, not overridden by each site.

The standard components already handle this, so you get correct behavior with no work. When you
write your own styles, follow three rules to keep them correct in that mode:

- **Never let color be the only difference between two things.** Two buttons that differ only in
  their background color become identical when the browser forces both backgrounds to the same
  system color. Give them a border, an icon, or different text.
- **Build a focus ring from `outline`, not from `box-shadow`.** The browser drops a shadow in
  forced-colors mode, and it keeps an outline. The focus ring of imp is an outline for exactly this
  reason.
- **Restore a border that you set to `transparent`.** The browser keeps `transparent` instead of
  forcing it, so an invisible placeholder border stays invisible. Bring it back with a system color
  keyword:

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

These system color keywords are worth knowing. `Canvas` and `CanvasText` are the page background and
the text. `ButtonFace`, `ButtonText` and `ButtonBorder` are for a control. `LinkText` is for a link.
`Highlight` and `HighlightText` are for a selection. `Field` and `FieldText` are for an input.
`GrayText` is for a disabled element.

## How to write styles that adapt

When you write the styles of your own component, prefer CSS **logical properties**. Use
`margin-inline-*` and `inset-inline-*`, and `text-align: start` and `text-align: end`, in place of
the left and right versions. A layout written this way mirrors automatically when the `dir` of the
document is right to left, with no extra work from you. `flex` and `stack` do the same, because
their `horizontalAlign` takes `start` and `end`, not left and right. The i18n of imp sets `dir` from
the active language for you. See **[Internationalization](i18n.md)**. An app that does not use it
sets the attribute itself.
