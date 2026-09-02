# imp-ui - Theming

Every imp app is themable by default. A theme is a plain JavaScript file that you write. Apply it at
your entry point, and imp skins your app. A change to another theme re-skins the whole app
immediately. There is no CSS build step, nothing renders again, and there is no framework store to
configure. Light and dark are two theme files.

## A theme is a file

A theme is an ordinary module. Its default export is a flat set of **design tokens**, with a small
amount of optional metadata. A token is a named value, such as a colour, a radius, a spacing step or
a typography value:

```js
// dark.js
export default {
  name: 'dark',
  colorScheme: 'dark',
  tokens: {
    'color-primary': '#7c9cff',
    'color-secondary': '#94a3b8',
  },
}
```

- **`tokens`** is a flat map of a token name to a CSS value. A key is a bare name, such as
  `color-primary`. imp adds an `--imp-` prefix. So the CSS custom property that your styles
  reference is `--imp-color-primary`. There is no nesting. There is one flat namespace.
- **`name`** labels the theme. It helps in a theme switcher UI, and when you store a choice.
- **`colorScheme`** is `'light'` or `'dark'`, and it is optional. It tells the browser how to render
  a native form control, a scrollbar, and CSS that reads `prefers-color-scheme`. So those match your
  palette. It is metadata on one theme. It is not a mode that imp manages for you. When you leave it
  out, imp does not change the colour scheme.

An app can ship as many theme files as it wants. There is no registry to register them in. A theme
is a module that you import.

## How to apply and change a theme - `applyTheme`

At your entry point, which is the file that calls `mount()`, import a theme and apply it:

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
adds to the page. It also sets the colour scheme from `colorScheme`.

**A change of theme re-skins the app immediately.** A token is a CSS custom property. So a new theme
rewrites the variables in one pass, and every rule that references a token re-skins at the same
time. Nothing renders again. Each theme must define the full set of tokens, so a new theme fully
replaces the last one. Start from a built-in theme, described below, and every token is already
covered.

## How to read the active theme - the `theme` state

`applyTheme` is the only thing that changes the active theme, and it keeps a reactive `theme` state
in step. Import that state to read the current theme, or to react to it:

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { theme } from 'imp/theme'

const badge = component('my-app-theme-badge', {
  build: () => div(theme.text((t) => t.name)),
})
```

`theme.get()` returns the active theme object anywhere. Inside a component you can call
`theme.watch(...)`, or bind the state with `theme.text` or `theme.view`, so it updates when the
theme changes. Most of your app never needs this, because the re-skin happens through the CSS
variables. It is there for the rare component that must branch on the active theme, and to build a
theme switcher.

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

The high-contrast pair does more than make the text darker. The borders and the focus ring become
wider, through `border-width` and `focus-ring-width`. A hover state moves in a larger step, so it
stays visible. Every pair of a foreground and a background is well above the WCAG AA threshold.
These are ordinary themes. So one of them re-skins the whole app in a single write of the custom
properties, exactly like a change between light and dark.

These four names are the only strings that `applyTheme` accepts. Any other string throws. The `imp-`
prefix keeps them out of your way. Your own themes can have the names `light` and `dark`, and there
is never a question about whose theme a name refers to. Everything else works exactly as with a
theme object. The tokens arrive as `--imp-*` custom properties, imp sets `colorScheme` to match, and
the `theme` state updates.

To start from a built-in theme, instead of writing every value, apply the theme and read it back
through the `theme` state. An applied theme is frozen. So copy the tokens into your own object. Do
not edit them in place:

```js
import { applyTheme, theme } from 'imp/theme'

applyTheme('imp-dark')

applyTheme({
  name: 'midnight',
  colorScheme: 'dark',
  tokens: { ...theme.get().tokens, 'color-primary': '#a78bfa' },
})
```

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

This is separate from Windows Contrast Themes, and from a similar mode at OS level. Those replace
your colours with the system palette completely. See [Forced colors](#forced-colors) below.

## How to remember a choice

imp deliberately does **not** store the selected theme. A theme is a module that your app imports.
So imp cannot turn a stored name back into the correct module. Storage stays your decision, and it
stays flexible. To remember a choice, save `theme.get().name`, for example to `localStorage`, when
the person selects a theme. Apply the matching module again on load. Apply it before you call
`mount()`, so the page does not flash the wrong theme.

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
bar. So you can move a component between your themes and the built-in themes, and you do not start
the app. List your theme files in `imp.json`, and they join the switcher:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Nothing about the theme file changes. The switcher applies the same module as your entry point. An
edit to the file reloads the page with the new tokens. See **[`imp preview`](cli.md#imp-preview)**.

## How to write a theme with the theme editor

You do not have to write ninety tokens to get a theme. `imp preview` ships a **theme editor** beside
the switcher. Open it with _edit theme_. It asks for four things:

| Knob              | Choices                          | What it drives                                             |
| ----------------- | -------------------------------- | ---------------------------------------------------------- |
| **Mode**          | light, dark                      | Which of the two themes you are editing                    |
| **Primary**       | any color                        | The accent: buttons, links, focus rings                    |
| **Secondary**     | any color                        | The muted tone, and the hue of every surface, border, text |
| **Border radius** | none, small, medium, large, full | The whole `radius-*` scale                                 |
| **Shadow**        | none, soft, strong               | The three `shadow-*` steps                                 |

imp **derives** everything else. From the primary colour it builds the hover step and the active
step, and it selects a readable `color-on-primary`. From the secondary colour it builds the surface,
sunken, hover, border and text colours. They then share one hue, and they land at a lightness that
is safe for the contrast of the mode that you are in. The page re-skins while you type, on the real
components, and your choices survive a reload.

The editor changes nothing about what a theme _is_. Press **copy**, or **download theme.js**, and
you get an ordinary module. It is the same flat token map that this page describes, with a `light`
export and a `dark` export. Save it into your app, and pass it to `init`:

```js
import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })

// later, from a theme switcher:
applyTheme(dark)
```

From that point the generated file is yours to edit by hand, and its layout suits that. The 31 named
palette colours sit at the top, as a shared `palette` object that both themes spread in. So a change
to `color-grass` changes it for light and dark at the same time. The editor never rewrites the file.
It is a starting point, not a format that it owns.

## Token names

A token key is a bare name, and imp adds the `--imp-` prefix. The names follow a fixed scheme. There
are semantic colour roles, such as `color-primary` and `color-secondary`, and numeric scales for
spacing, radius, shadow and typography. So themes stay consistent, and you can exchange one for
another. Reference a token in your own CSS with a fallback, so your styles still work before imp
applies a theme:

```css
.cta {
  background: var(--imp-color-primary, #2563eb);
}
```

The set of tokens grows with the component library of imp. Each component brings the tokens that it
needs into the built-in themes. A few tokens exist for your own layout, not for a component. They
are `space-page`, `shadow-sm`, `breakpoint-desktop` and the palette. This page names each of them.
These are the tokens that the built-in themes ship today. A theme of your own must define all of
them:

| Group      | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-medium`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                                                                                                                                                                                                                                          |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                                                                                                                                  |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-focus-ring`, `background-app`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                                                                                                                                                                                                            |
| Palette    | `color-gray`, `color-mauve`, `color-slate`, `color-sage`, `color-olive`, `color-sand`, `color-tomato`, `color-red`, `color-ruby`, `color-crimson`, `color-pink`, `color-plum`, `color-purple`, `color-violet`, `color-iris`, `color-indigo`, `color-blue`, `color-cyan`, `color-teal`, `color-jade`, `color-green`, `color-grass`, `color-bronze`, `color-gold`, `color-brown`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-mint`, `color-sky` |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-sm`, `radius-md`, `radius-lg`, `radius-full`, `border-width`, `focus-ring-width`, `duration-fast`, `duration-medium`, `disabled-opacity`, `breakpoint-desktop`                                                                                                                                                                                                                 |

`color-on-primary` and `color-on-danger` are the text colours that sit **on** those backgrounds. So
a theme can select a readable pair, and it does not have to hope that white works. `color-secondary`
is the muted tone, for secondary text and for a link with less emphasis. `color-surface` is a panel.
`color-surface-sunken` is the page behind the panel. `color-surface-hover` is the tint under the
pointer. `background-app` is what the app frame paints under everything. It is the one token that is
a CSS `background` and not a colour. So it takes a gradient or an image as readily as a flat value.
The built-in themes set it to their `color-surface`. See
**[Standard components](std-components.md)** for how the library uses these tokens. See the
[component gallery](/components) to watch one token change land on every component at the same time.

The **palette** is 31 named colours, with one value each. Use them where an app needs a specific hue
in place of a role. Examples are a tag per project, a series in a chart, and the background of an
avatar. No component paints with a palette colour on its own. `tag` and `icon` offer the palette
names as their `color` options. So a hue that you select there is the same hue that your own CSS
reads. `color-success`, `color-warning` and `color-info` are aliases of three palette colours, which
are `color-green`, `color-amber` and `color-blue`. `color-danger` derives from `color-red`. So a
change to a hue in one place moves the role with it. imp selects every palette value to carry white
text, and to stay legible on a light surface and on a dark surface. So the same block of colours
serves both themes.

The three shadow steps and the radius scale set the depth and the softness of a theme. `shadow-sm`
lifts a card off the page. No standard component is a card, so this step is for your own layout.
`shadow-md` lifts an element that floats near its trigger, such as the overflow menu of a button.
`shadow-lg` lifts an overlay that sits above everything, such as a dialog or a drawer. `radius-sm`
to `radius-lg`, and `radius-full` for a pill, round every corner that the standard components draw.
A theme that wants flat, square chrome sets every shadow to `none` and every radius to `0`. Every
component then follows, with no CSS in your app.

The spacing scale is **fluid**. `space-3` and the larger steps are `clamp()` values that grow with
the viewport. So a gap that you set once is tighter on a phone and wider on a monitor, and you write
no breakpoint. `space-page` is the gutter for the outside of a page that you lay out yourself. No
component uses it for padding. Each step keeps a `rem` term in its preferred value. So browser zoom
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
in no browser. So the query itself still needs the literal `48rem`. Read the token from JavaScript
when you need the number as data:

```js
const desktopFrom = getComputedStyle(document.documentElement)
  .getPropertyValue('--imp-breakpoint-desktop')
```

`border-width` and `focus-ring-width` exist so that contrast does not depend on colour alone. A
theme that only changed the colours could never make a hairline border, or a thin focus ring, easier
to see. These two widths go through tokens. That is what lets the high-contrast themes strengthen
the affordances themselves. Use them in your own styles in the same way:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## Forced colors

Windows Contrast Themes, and an equivalent mode at OS level elsewhere, do not read your tokens. They
replace the colours of the page with the system palette of the reader, and no theme that you write
can override that. This is deliberate. A reader who has chosen a system palette wants it applied
everywhere, not overridden by each site.

The standard components already handle this, so you get correct behaviour with no work. When you
write your own styles, three rules keep them correct in that mode:

- **Never let colour be the only difference between two things.** Two buttons that differ only in
  their background colour become identical when the browser forces both backgrounds to the same
  system colour. Give them a border, an icon, or different text.
- **Build a focus ring from `outline`, not from `box-shadow`.** The browser drops a shadow in
  forced-colors mode, and it keeps an outline. The focus ring of imp is an outline for exactly this
  reason.
- **Restore a border that you set to `transparent`.** The browser keeps `transparent` instead of
  forcing it. So an invisible placeholder border stays invisible. Bring it back with a system colour
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

These system colour keywords are worth knowing. `Canvas` and `CanvasText` are the page background
and the text. `ButtonFace`, `ButtonText` and `ButtonBorder` are for a control. `LinkText` is for a
link. `Highlight` and `HighlightText` are for a selection. `Field` and `FieldText` are for an input.
`GrayText` is for a disabled element.

## How to write styles that adapt

When you write the styles of your own component, prefer CSS **logical properties**. Use
`margin-inline-*` and `inset-inline-*`, and `text-align: start` and `text-align: end`, in place of
the left and right versions. A layout written this way mirrors automatically when the `dir` of the
document is right to left, and you do no extra work. `flex` and `stack` do the same, because their
`horizontalAlign` takes `start` and `end`, not left and right. The i18n of imp sets `dir` from the
active language for you, see **[Internationalization](i18n.md)**. An app that does not use it sets
the attribute itself.
