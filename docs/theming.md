# imp-ui — Theming

Every imp app is themable by default. A theme is a plain JavaScript file you write, apply it at your
entry point, and your app is skinned. Swapping to another theme re-skins the whole app instantly —
no CSS build step, no re-render, no framework store to configure. Light and dark are just two theme
files.

## A theme is a file

A theme is an ordinary module whose default export is a flat set of **design tokens** — named values
like colors, radii, spacing, and typography — plus a little optional metadata:

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
  `--imp-color-primary`. There is no nesting — one flat namespace.
- **`name`** labels the theme, handy for a theme-switcher UI and for remembering a choice.
- **`colorScheme`** is `'light'` or `'dark'` (optional). It tells the browser how to render native
  form controls, scrollbars, and `prefers-color-scheme`-aware CSS so they match your palette. It is
  metadata on one theme — not a mode imp manages for you. If you leave it out, imp does not touch
  the color scheme.

An app can ship as many theme files as it likes. There is no registry to register them in — a theme
is just a module you import.

## Applying and swapping — `applyTheme`

At your entry point (the file that calls `mount()`), import a theme and apply it:

```js
import { mount } from 'imp'
import { applyTheme } from 'imp/theme'
import light from './light.js'
import dark from './dark.js'

applyTheme(light)
mount('#app', app())

// later — a settings toggle, a theme switcher:
applyTheme(dark)
```

`applyTheme` writes the theme's tokens as `--imp-*` custom properties on the document root, where
they inherit into everything — your components, their shadow DOM, and any content imp adds to the
page. It also sets the color scheme from `colorScheme`.

**Swapping re-skins instantly.** Because tokens are CSS custom properties, applying a new theme
rewrites the variables in a single pass and every rule that references a token re-skins at once —
nothing re-renders. Each theme is expected to define the full set of tokens, so applying one fully
replaces the last; start from a built-in theme (below) and every token is already covered.

## Reading the active theme — the `theme` state

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
of your app never needs this — the re-skin happens through the CSS variables — but it is there for
the rare component that must branch on the active theme, and for building a theme switcher.

## Built-in starter themes — `applyTheme('default-light' | 'default-dark')`

imp ships a built-in light and dark theme so your app renders sensibly before you write your own.
There is nothing to import: pass the name instead of an object.

```js
import { applyTheme } from 'imp/theme'

applyTheme('default-light')
// or
applyTheme('default-dark')
```

`'default-light'` and `'default-dark'` are the only names `applyTheme` accepts — any other string
throws. The `default-` prefix keeps them out of your way: your own themes are free to be called
`light` and `dark`, and there is never a question of whose theme a name refers to. Everything else
works exactly as with a theme object: the tokens land as `--imp-*` custom properties, `colorScheme`
is set to match, and the `theme` state updates.

To start from a built-in instead of spelling out every value, apply it and read it back through the
`theme` state. An applied theme is frozen, so copy the tokens into your own object rather than
editing them in place:

```js
import { applyTheme, theme } from 'imp/theme'

applyTheme('default-dark')

applyTheme({
  name: 'midnight',
  colorScheme: 'dark',
  tokens: { ...theme.get().tokens, 'color-primary': '#a78bfa' },
})
```

## Remembering a choice

imp deliberately does **not** persist the selected theme. Because a theme is a module your app
imports, imp has no way to turn a stored name back into the right module — so storage stays your
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

If you only use the built-ins, there is no map to keep — the stored name goes straight back into
`applyTheme`:

```js
const saved = localStorage.getItem('theme')
applyTheme(saved === 'default-dark' ? 'default-dark' : 'default-light')
```

## Token names

Token keys are bare names that imp prefixes with `--imp-`. They follow a fixed scheme — semantic
color roles (`color-primary`, `color-secondary`, …) alongside numeric scales for spacing, radius,
shadow, and typography — so themes stay consistent and interchangeable. Reference a token in your
own CSS with a fallback so styles still hold up before a theme is applied:

```css
.cta {
  background: var(--imp-color-primary, #2563eb);
}
```

The set of tokens grows as imp's component library grows: each component brings the tokens it needs
into the built-in themes, so every name arrives with something that actually uses it. These are the
tokens the built-in themes ship today — a theme of your own is expected to define all of them:

| Group      | Tokens                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography | `font-family`, `font-size-sm`, `font-size-md`, `font-size-lg`, `font-size-xl`, `font-size-2xl`, `font-weight-normal`, `font-weight-medium`, `font-weight-bold`, `line-height-tight`, `line-height-normal` |
| Color      | `color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-secondary`, `color-danger`, `color-danger-hover`, `color-danger-active`, `color-on-danger`                     |
| Surface    | `color-text`, `color-link`, `color-link-hover`, `color-surface`, `color-surface-hover`, `color-border`, `color-focus-ring`                                                                                |
| Metrics    | `space-1` … `space-6`, `radius-sm`, `radius-md`, `radius-lg`, `duration-fast`, `disabled-opacity`                                                                                                         |

`color-on-primary` and `color-on-danger` are the text colors that sit **on** those backgrounds, so a
theme can pick a readable pair rather than hoping white works. `color-secondary` is the muted tone —
secondary text, de-emphasized links. See **[Standard components](std-components.md)** for the
components that consume them.

## Writing styles that adapt

When you write your own component styles, prefer CSS **logical properties** — `margin-inline-*`,
`inset-inline-*`, and `text-align: start / end` rather than their left/right counterparts. Layouts
written this way mirror automatically for right-to-left languages when imp gains language support,
with no extra work on your part.
