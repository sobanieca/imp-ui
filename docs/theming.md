# imp-ui - Theming

Every imp app is themable by default. A theme is a plain JavaScript file you write, apply it at your
entry point, and your app is skinned. Swapping to another theme re-skins the whole app instantly -
no CSS build step, no re-render, no framework store to configure. Light and dark are just two theme
files.

## A theme is a file

A theme is an ordinary module whose default export is a flat set of **design tokens** - named values
like colors, radii, spacing, and typography - plus a little optional metadata:

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

- **`tokens`** is a flat map of token name → CSS value. Keys are bare names like `color-primary`;
  imp adds an `--imp-` prefix, so the CSS custom property your styles reference is
  `--imp-color-primary`. There is no nesting - one flat namespace.
- **`name`** labels the theme, handy for a theme-switcher UI and for remembering a choice.
- **`colorScheme`** is `'light'` or `'dark'` (optional). It tells the browser how to render native
  form controls, scrollbars, and `prefers-color-scheme`-aware CSS so they match your palette. It is
  metadata on one theme - not a mode imp manages for you. If you leave it out, imp does not touch
  the color scheme.

An app can ship as many theme files as it likes. There is no registry to register them in - a theme
is just a module you import.

## Applying and swapping - `applyTheme`

At your entry point (the file that calls `mount()`), import a theme and apply it:

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

`applyTheme` writes the theme's tokens as `--imp-*` custom properties on the document root, where
they inherit into everything - your components, their shadow DOM, and any content imp adds to the
page. It also sets the color scheme from `colorScheme`.

**Swapping re-skins instantly.** Because tokens are CSS custom properties, applying a new theme
rewrites the variables in a single pass and every rule that references a token re-skins at once -
nothing re-renders. Each theme is expected to define the full set of tokens, so applying one fully
replaces the last; start from a built-in theme (below) and every token is already covered.

## Reading the active theme - the `theme` state

`applyTheme` is the only thing that changes the active theme, and it keeps a reactive `theme` state
in sync. Import it to read or react to whichever theme is currently applied:

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { theme } from 'imp/theme'

const badge = component('my-app-theme-badge', {
  onMount: () => div(theme.text((t) => t.name)),
})
```

`theme.get()` returns the active theme object anywhere; inside a component you can
`theme.watch(...)` or bind it with `theme.text` / `theme.view` to update when the theme swaps. Most
of your app never needs this - the re-skin happens through the CSS variables - but it is there for
the rare component that must branch on the active theme, and for building a theme switcher.

## Built-in starter themes

imp ships four built-in themes so your app renders sensibly before you write your own. There is
nothing to import: pass the name instead of an object.

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

The high-contrast pair does more than darken the text. Borders and the focus ring get wider
(`border-width`, `focus-ring-width`), hover states move in bigger steps so they stay visible, and
every foreground/background pair is chosen well past the WCAG AA threshold. Because they are
ordinary themes, applying one re-skins the whole app in a single custom-property write, exactly like
switching between light and dark.

These four names are the only strings `applyTheme` accepts - any other throws. The `imp-` prefix
keeps them out of your way: your own themes are free to be called `light` and `dark`, and there is
never a question of whose theme a name refers to. Everything else works exactly as with a theme
object: the tokens land as `--imp-*` custom properties, `colorScheme` is set to match, and the
`theme` state updates.

To start from a built-in instead of spelling out every value, apply it and read it back through the
`theme` state. An applied theme is frozen, so copy the tokens into your own object rather than
editing them in place:

```js
import { applyTheme, theme } from 'imp/theme'

applyTheme('imp-dark')

applyTheme({
  name: 'midnight',
  colorScheme: 'dark',
  tokens: { ...theme.get().tokens, 'color-primary': '#a78bfa' },
})
```

### Following the reader's contrast preference

imp does not pick a theme for you - there is no built-in mode axis, for contrast any more than for
light and dark. If you want to follow the reader's system setting, watch the media query and apply
the matching theme yourself:

```js
const wantsMoreContrast = matchMedia('(prefers-contrast: more)')

const pickTheme = () =>
  applyTheme(wantsMoreContrast.matches ? 'imp-high-contrast-light' : 'imp-light')

pickTheme()
wantsMoreContrast.addEventListener('change', pickTheme)
```

This is separate from Windows Contrast Themes and similar OS-level modes, which replace your colors
with the system palette outright - see [Forced colors](#forced-colors) below.

## Remembering a choice

imp deliberately does **not** persist the selected theme. Because a theme is a module your app
imports, imp has no way to turn a stored name back into the right module - so storage stays your
call, and stays flexible. To remember a choice, save `theme.get().name` (for example to
`localStorage`) when the user picks one, and re-apply the matching module on load. Applying it
before you `mount()` avoids a flash of the wrong theme.

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

If you only use the built-ins, there is no map to keep - the stored name goes straight back into
`applyTheme`:

```js
const saved = localStorage.getItem('theme')
applyTheme(saved === 'imp-dark' ? 'imp-dark' : 'imp-light')
```

## Checking a theme without your app

`imp preview` renders one component at a time on a generated page with a theme switcher in its top
bar, so you can flip a component between your themes and the built-ins without booting the app. List
your theme files in `imp.json` and they join the switcher:

```json
{
  "preview": { "themes": ["src/theme/light.js", "src/theme/brand-dark.js"] }
}
```

Nothing about the theme file changes - the switcher applies the same module your entry point does,
and editing it reloads the page with the new tokens. See **[`imp preview`](cli.md#imp-preview)**.

## Writing a theme with the theme editor

You do not have to spell out ninety tokens to get a theme. `imp preview` ships a **theme editor**
next to the switcher - open it with _edit theme_ - and it asks for four things:

| Knob              | Choices                          | What it drives                                             |
| ----------------- | -------------------------------- | ---------------------------------------------------------- |
| **Mode**          | light, dark                      | Which of the two themes you are editing                    |
| **Primary**       | any color                        | The accent: buttons, links, focus rings                    |
| **Secondary**     | any color                        | The muted tone, and the hue of every surface, border, text |
| **Border radius** | none, small, medium, large, full | The whole `radius-*` scale                                 |
| **Shadow**        | none, soft, strong               | The three `shadow-*` steps                                 |

Everything else is **derived**. From the primary color imp builds the hover and active steps and
picks a readable `color-on-primary`; from the secondary it builds the surface, sunken, hover, border
and text colors so they share one hue and land at contrast-safe lightness for the mode you are in.
The page re-skins as you type, on the real components, and your choices survive a reload.

The editor changes nothing about what a theme _is_. Press **copy** (or **download theme.js**) and
you get an ordinary module - the same flat token map described above, with a `light` and a `dark`
export - which you save into your app and pass to `init`:

```js
import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })

// later, from a theme switcher:
applyTheme(dark)
```

The generated file is yours to edit by hand from that point on, and it is laid out for exactly that.
The 31 named palette colors sit at the top as a shared `palette` object both themes spread in, so
changing `color-grass` once changes it for light and dark together. The editor never rewrites the
file - it is a starting point, not a format it owns.

## Token names

Token keys are bare names that imp prefixes with `--imp-`. They follow a fixed scheme - semantic
color roles (`color-primary`, `color-secondary`, …) alongside numeric scales for spacing, radius,
shadow, and typography - so themes stay consistent and interchangeable. Reference a token in your
own CSS with a fallback so styles still hold up before a theme is applied:

```css
.cta {
  background: var(--imp-color-primary, #2563eb);
}
```

The set of tokens grows as imp's component library grows: each component brings the tokens it needs
into the built-in themes, so every name arrives with something that actually uses it. These are the
tokens the built-in themes ship today - a theme of your own is expected to define all of them:

| Group      | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-family-mono`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-medium`, `font-weight-bold`, `line-height-tight`, `line-height-normal`                                                                                                                                                                                                                                          |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`, `color-success`, `color-warning`, `color-info`                                                                                                                                                                                                                                  |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-sunken`, `color-surface-hover`, `color-border`, `color-focus-ring`, `shadow-sm`, `shadow-md`, `shadow-lg`                                                                                                                                                                                                                                                                              |
| Palette    | `color-gray`, `color-mauve`, `color-slate`, `color-sage`, `color-olive`, `color-sand`, `color-tomato`, `color-red`, `color-ruby`, `color-crimson`, `color-pink`, `color-plum`, `color-purple`, `color-violet`, `color-iris`, `color-indigo`, `color-blue`, `color-cyan`, `color-teal`, `color-jade`, `color-green`, `color-grass`, `color-bronze`, `color-gold`, `color-brown`, `color-orange`, `color-amber`, `color-yellow`, `color-lime`, `color-mint`, `color-sky` |
| Metrics    | `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-page`, `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-full`, `border-width`, `focus-ring-width`, `duration-fast`, `duration-medium`, `disabled-opacity`                                                                                                                                                                                                                          |
| Sizing     | `content-sm`, `content-md`, `content-lg`, `content-xl`, `sidebar-xs`, `sidebar-sm`, `sidebar-md`, `sidebar-lg`, `sidebar-xl`, `sidebar-collapsed`                                                                                                                                                                                                                                                                                                                      |

`color-on-primary` and `color-on-danger` are the text colors that sit **on** those backgrounds, so a
theme can pick a readable pair rather than hoping white works. `color-secondary` is the muted tone -
secondary text, de-emphasized links. `color-surface` is a panel, `color-surface-sunken` the page
behind it, `color-surface-hover` the tint under the pointer. See
**[Standard components](std-components.md)** for the components that consume them.

The **palette** is the one group nothing in imp consumes by default: 31 named colors, one value
each, there for the places an app needs a specific hue rather than a role - a tag per project, a
series in a chart, an avatar background. `color-success`, `color-warning` and `color-info` are
aliases pointing at three of them (`color-green`, `color-amber`, `color-blue`), and `color-danger`
is derived from `color-red`, so editing the hue in one place moves the role with it. Every palette
value is chosen to carry white text and to stay legible on a light or a dark surface, so the same
block of colors serves both themes.

The three shadow steps and the radius scale are how a theme sets its own depth and softness:
`shadow-sm` lifts a card off the page, `shadow-md` an element that floats near it, `shadow-lg` an
overlay that sits above everything - and `radius-sm` through `radius-xl` (plus `radius-full` for
pills) round every corner the standard components draw. A theme that wants flat, square chrome sets
every shadow to `none` and every radius to `0`, and every component follows without a line of CSS in
your app. The layout components expose both scales directly, as
`stack({ radius: 'lg', shadow: 'sm' })`.

The spacing scale is **fluid**. `space-3` and up are `clamp()` values that grow with the viewport,
so a gap set once is tighter on a phone and roomier on a monitor with no breakpoint written
anywhere, and `space-page` is the page gutter the `page` component uses. Each one keeps a `rem` term
in its preferred value, so browser zoom and a larger default font size still scale spacing the way a
reader expects. A theme that wants fixed spacing sets plain lengths instead; nothing in imp requires
the scale to be fluid.

`border-width` and `focus-ring-width` exist so that contrast is not purely a matter of color. A
theme that only swapped colors could never make a hairline border or a thin focus ring easier to
see; routing those two widths through tokens is what lets the high-contrast themes strengthen the
affordances themselves. Use them in your own styles the same way:

```css
.panel {
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
}
```

## Forced colors

Windows Contrast Themes - and equivalent OS-level modes elsewhere - do not read your tokens at all.
They replace the page's colors with the reader's own system palette, and no theme you write can
override that. This is deliberate: a reader who has chosen a system palette wants it applied
everywhere, not overridden by each site.

Standard components already handle it, so you get correct behavior for free. When you write your own
styles, three rules keep them working in that mode:

- **Never let color be the only difference between two things.** Two buttons distinguished purely by
  background color become identical once both backgrounds are forced to the same system color. Give
  them a border, an icon, or different text.
- **Build focus rings from `outline`, not `box-shadow`.** Shadows are dropped in forced-colors mode;
  outlines survive. imp's focus ring is an outline for exactly this reason.
- **Restore borders you set to `transparent`.** `transparent` is preserved rather than forced, so an
  invisible placeholder border stays invisible. Bring it back with a system color keyword:

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

The system color keywords worth knowing are `Canvas` / `CanvasText` for page background and text,
`ButtonFace` / `ButtonText` / `ButtonBorder` for controls, `LinkText` for links, `Highlight` /
`HighlightText` for selection, `Field` / `FieldText` for inputs, and `GrayText` for disabled.

## Writing styles that adapt

When you write your own component styles, prefer CSS **logical properties** - `margin-inline-*`,
`inset-inline-*`, and `text-align: start / end` rather than their left/right counterparts. Layouts
written this way mirror automatically once the document's `dir` is right-to-left, with no extra work
on your part. imp does not set `dir` for you - set it yourself if your app has an RTL language.
