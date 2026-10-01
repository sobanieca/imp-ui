# Themable by default: token modules applied with applyTheme

## Context

An imp app must be skinnable, and it must handle light and dark, with no external CSS toolchain. The
components of the standard library, which imp builds as the library grows, also need a shared
vocabulary of design values to reference. So they cohere, and so they re-skin together. A theme
system could be a registry of named themes at runtime, with a built-in axis of light and dark. Or it
could be a build step that compiles design tokens into CSS. Both add moving parts. A registry must
map a stored theme name back to something. An axis of modes that imp manages competes with the
control of the app over which palette is active. A compile step brings back the toolchain that
themability was meant to avoid. The state layer, see `event-propagated-state.md`, already gives a
fine-grained update path with no re-render. A CSS custom property on `:root` already cascades
everywhere, and it crosses a shadow boundary. So a change of theme can be one write of the variables
that the whole app reads.

## Decision

A **theme is a plain JavaScript module** that the app writes and imports. Its default export is an
object with a flat `tokens` map, from a bare token name to a CSS value, plus an optional `name`.
There is no registry at runtime. There is no `defineTheme`. There is **no built-in axis of modes**.
Light and dark are two theme files, and an app ships as many themes as it wants. To change the theme
is to change which module imp applies.

`applyTheme(themeOrBuiltInName)` is the one entry point, and the **only writer** of the reactive
`theme` state. So the side effect on the DOM and the update of the signal always travel together. It
accepts a theme object, or the **name of a built-in theme** as a string, which is `'imp-light'` or
`'imp-dark'`. It resolves such a name to the matching built-in theme, and then treats it in the same
way. A theme object can also name a built-in theme as its **`base`**. imp then resolves the base,
and writes the tokens of the object over the tokens of the base. The `name` comes from the base when
the object leaves it out. The result is a complete theme, and it is what `theme` holds. So a `base`
is the one supported way to change a few tokens, such as the font, and it keeps the rule below that
a theme is complete. It does the following:

- It writes each token as a custom property with the `--imp-` prefix, on `:root`, which is
  `document.documentElement`. From there the property inherits into the body, and into the shadow
  root of every component. imp owns the `--imp-` prefix. A token key is bare, so `color-primary`
  becomes `--imp-color-primary`. There is one flat namespace, with no dot and no nesting, and that
  matches a state key and a message key.
- It overwrites every token that it carries. It does **not** compare against the previous theme, and
  it removes no property. A theme must define the **full** set of tokens. A partial theme is a bug
  in the theme, and it is the responsibility of the app. imp does not compensate for it. So a
  complete theme fully replaces a complete theme. There is no cleanup pass per change.
- **The list of token keys is frozen, and `applyTheme` checks a theme against it.** The list is the
  set of keys that the built-in themes carry, written out as one constant. When an applied theme has
  no value for a key on the list, `applyTheme` warns through the shared logger. The warning names
  the missing keys and the count. It warns once for each key of each theme name for the life of the
  page, so a theme toggle does not repeat the warning in production. It is not fatal: imp still
  applies the tokens that the theme has. A component reads every token with its built-in value as
  the CSS fallback, so a missing token degrades to the default look, or to the value of the previous
  theme. The check costs one pass over 64 keys per call. A theme with a `base` never warns, because
  the base fills every key. A new token must go into the list and into every built-in theme in the
  same change, and a test asserts that the two agree.
- It sets `color-scheme` on the same root, from the token `color-scheme`. The token is `light` or
  `dark`, and it is a token like every other: the derivation writes it from the `mode` knob, a theme
  with a `base` inherits it, and a theme file lists it. imp does not read the scheme from the
  lightness of `color-surface`. That read needs a parser for every CSS colour syntax, and the parser
  is 8 KB of minified code that every app would ship for one boolean. The author of a theme knows
  its scheme, so the theme states it, as every stylesheet on the web does. A theme can set a dark
  surface and keep `color-scheme: light`. That is a bug of the author of that theme, like a missing
  token. When the token is absent or has another value, imp warns once per theme name and clears the
  property. `colorSchemeOf(tokens)` returns the token or `undefined`, and it is public, so a
  component that must branch on the scheme uses the same read. CSS inherits `color-scheme`. So a
  value on `:root` reaches a native control, a scrollbar, and CSS that reads `prefers-color-scheme`,
  also **inside** the shadow root of a component. Nobody stamps a value on each `:host`. imp writes
  **no attribute for a mode** on the root. A descendant selector in the light DOM is the only thing
  that can reach such an attribute. A standard component, and any component with shadow DOM, cannot
  use it. So the attribute would be a hook that works exactly where theming matters least. A branch
  between light and dark belongs in the tokens themselves, where two themes carry different values
  under the same names. The inherited `color-scheme` covers what the browser renders.
- It updates the reactive `theme` state to the applied theme object, and returns that object.

**`theme`** is a readable state for the lifetime of the app. It has `get`, `watch`, `text`, `view`
and `each`, and it has no public `set`. It holds the theme that imp applied. So a UI that changes
the theme reads `theme.get()` and `theme.watch()`, and a component branches on the active theme when
it must. A token is a custom property. So a new application rewrites the variables in one
synchronous pass, and every rule that references a token re-skins at once. That is the path with no
re-render, of the state layer. The watch on `theme` is only for a component that must branch. It is
not the mechanism of the re-skin.

A **malformed theme throws at the call site.** That covers a value that is not an object, and a
value with no `tokens` object. That is the same behaviour as a bad `component()` definition. A
string that is not a known built-in name throws for the same reason, because a built-in name with a
spelling mistake is a bug, and not a theme. imp logs a problem that is not fatal through the shared
`impLogger`, see `built-in-logger.md`, and never through a raw `console`. That covers a token name
that looks wrong, a value that the browser ignores in silence, and a `color-surface` that imp cannot
read as light or dark. imp does not otherwise validate the CSS value of a token.

**Persistence is the job of the app.** imp keeps no registry of themes, because a theme is a module
that the app imports. So imp cannot map a stored name back to a module, and it deliberately does
**not** touch `localStorage`. The `theme` state exposes the active theme, with its `name`. An app
that wants to remember a choice, and to apply it again on load, reads that state.

imp ships four built-in themes. Those are `imp-light`, `imp-dark`, `imp-high-contrast-light` and
`imp-high-contrast-dark`. So an app renders correctly before somebody writes a theme of their own.
That also gives the theme editor, see `theme-editor.md`, a base to start from. imp does **not export
them as an object**. `applyTheme('imp-light')` and its three siblings are the whole API. So the
common case is one call, with no import to add, and with no name to learn beyond `applyTheme`
itself. The high-contrast pair widens `border-width` and `focus-ring-width`, raises
`disabled-opacity`, and paints pure black on white, or white on black. The names carry the **`imp-`
prefix**. So a built-in theme of imp never collides, even in a conversation, with a `light` or
`dark` theme module of an app. A bare name always means a theme of the app. A name with the `imp-`
prefix always means a theme of imp. `theme.get()` still reaches the resolved object, for anything
that must start from it. So the hidden exports cost nothing. The state layer deep-freezes every
value that it holds. So one corner of an app cannot edit an applied built-in theme in place, and
silently change what a later `applyTheme('imp-dark')` produces. To start from a built-in theme
copies its tokens. Theming adds no freezing of its own. A standard component references a token
through a `token('color-primary')` helper, which expands to `var(--imp-color-primary, ...)`, with
the fallback taken from the built-in light theme. So a component renders on its own, before imp
applies a theme, and no component can state a default that the themes disagree with.

**The fonts are three tokens, and the page loads them.** `font-family` and `font-family-mono` hold a
font stack each, and the built-in themes set system stacks. `font-family-heading` is the font of
`heading` and of the name in `appLogo`. Its default is `var(--imp-font-family)`, so a theme that
does not set it has one text font. A design with a display face sets this one token. The colour of
the same text is `color-heading`, with the default `var(--imp-color-text)`, so a heading takes the
text colour until a theme gives it one of its own. imp loads no font, injects no `<link>`, and reads
no font from a config. A `<link>` or an `@font-face` rule in `index.html` is what the browser needs,
and a font face that the document declares reaches every shadow root. So the platform owns the
loading, and the theme owns the name. The standard components use two weights, `font-weight-normal`
at 400 and `font-weight-bold` at 600. There is no medium weight. Two weights keep a web font to two
files, and a label at 600 reads as a control without the heaviness of 700. A weight token that no
component uses would ask an app to load a file for nothing.

The **scheme for a token name is fixed.** It holds semantic colour roles, numeric scales such as
`space-*`, `radius-*`, `shadow-*` and `font-size-*`, and font families. The **exact list is not
written in advance.** Each standard component brings the tokens that it needs into the built-in
surface, as somebody builds the component. So every `--imp-*` name lands with a real consumer. After
something references a name, that name is public API. `background-app` is the one token whose value
is a CSS `background`, and not a colour. The app frame paints it under everything. So a theme can
set a gradient or an image there. The built-in themes derive it from `color-surface`. So a theme
that names no background still has one.

**Somebody writes a theme from four values, and not from sixty.** To write a full token map by hand
is not a thing that a person must do. So imp derives one. A **primary** colour, a **secondary**
colour, a **radius** step, which is `none`, `small`, `medium` or `large`, and a **shadow** step,
which is `none`, `soft` or `strong`, produce the whole surface of colour, radius and shadow for one
mode, light or dark. A shadow step is the same value in both modes. It casts `color-shadow` at a
fixed opacity, and that token is near-black in a light theme and white in a dark one. The derivation
belongs to imp, and imp computes it in OKLCH. The primary colour is also the colour of a link and of
the focus ring. So imp keeps its hue, and moves its lightness until it reads at 4.5:1, the AA level
for body text, on the surface and on the sunken surface. The move goes darker in a light theme and
lighter in a dark theme. The primary then yields a `color-on-primary`, which imp selects by WCAG
contrast, between white and a near-black tint of the same hue. White wins when it reaches 4.5:1.
Otherwise the tint wins. The search stops only when both hold. It tests the rounded hex value that
imp emits, so every text pair of a derived theme reaches 4.5:1 for any primary and any secondary. A
brand that needs an exact colour sets the token by hand, and the contrast check reports the pair. A
hover step and an active step are not tokens. A component mixes them from the base colour and
`color-text` with `color-mix()`. So the step goes darker in a light theme and lighter in a dark
theme, and a theme sets one colour per role. A link and the focus ring take `color-primary`. The
secondary colour yields `color-text`, `color-surface`, `color-surface-sunken`, `color-surface-hover`
and `color-border`, at a fixed lightness step per mode. imp keeps the hue of the secondary colour,
at a capped chroma. So the neutrals of a theme carry a tint, and they are not grey.
`color-secondary` is the muted text of every component, so imp moves its lightness until it reads at
4.5:1 on the surface and on the sunken surface. To derive, in place of to tabulate, is what stops
the built-in themes, the live preview of the theme editor, and the file that the editor exports,
from ever disagreeing. There is one function, and all three call it.

**The palette is 16 named colours, and every theme carries it.** The names run from `color-gray` to
`color-pink`, and each one has one solid value. imp generates them from a table of anchors, in
OKLCH, for the hue, the chroma and the lightness. It is the one group with **no consumer inside
imp**, and it is in the token surface anyway. An app that needs a hue per item, such as the colour
of a tag, a series of a chart, or the background of an avatar, must use a themed name, and not a
literal. A theme must also be able to tune those hues in one place. imp selects each value to read
as a tint on a light surface and on a dark surface. So **one block of palette values serves both
themes**, and each mode does not carry its own. The four colour roles, `color-danger`,
`color-success`, `color-warning` and `color-info`, are `var()` references to a palette colour. So a
role and the hue behind it cannot drift apart, and a theme that changes `color-red` changes
`color-danger` with it. There is one exception. `color-danger` is also the colour of error text, and
the palette red reads below 4.5:1 on a dark surface. So when the reference does not read on the
surfaces of the mode, imp writes a lighter red as a hex value of its own, with a `color-on-danger`
that reads on it. The built-in dark theme takes that path, and the light theme keeps the reference.
The `token()` helper resolves such a reference when it writes a fallback. So a component still
renders before imp applies a theme.

imp accepts two costs deliberately. The palette values are **not** the values of Radix Colors. imp
generates its own scales, in place of vendoring the scales of a third party. So they are close in
spirit, and not identical in value, and imp owes no attribution. An app also pays for the code of
the derivation, and for the table of anchors, in its bundle, even when it only calls
`applyTheme('imp-light')`. The alternative was to commit generated token literals, and a tool to
generate them again. That buys a few kilobytes, at the price of a second source of truth for every
colour that imp ships.

**The direction, which is RTL or LTR, is not part of a theme.** It belongs with the language, and
not with the palette, see `translatable-by-default.md`. The i18n module writes the `dir` of the
document from the language, and the theme engine does not touch it. The rule of the standard library
about logical properties, which covers `margin-inline-*`, `inset-inline-*` and `text-align: start`
or `text-align: end`, mirrors a layout with no extra work once `dir` is set.

## Consequences

- A theme is an ordinary module that you import, and there is no ceremony of registration. The whole
  feature is `applyTheme`, plus a readable `theme` state. There is no system of modes for the app to
  fight.
- A change of theme re-skins the entire app, in the light DOM and in every shadow root, with one
  write of the custom properties, and with no re-render of a component. Every theme defines the full
  set of tokens. So a change fully overwrites the previous theme. There is no comparison, and there
  is no cleanup pass. A theme that lacks a token is a bug of the author of that theme.
- `color-scheme` on `:root` themes a native control inside shadow DOM, and imp stamps no value on
  each host. It is the only signal at root level that imp writes, beside the tokens. So there is no
  attribute for a mode to keep in step, and there is no hook that stops working when a component
  moves into shadow DOM.
- An app that wants to remember a theme stores the name, and applies the matching module again on
  load. It controls the order, to avoid a flash of the wrong theme. imp neither stores the choice
  nor loads it again.
- To change one token of a built-in theme is one object with a `base`, such as
  `{ base: 'imp-light', tokens: { 'font-family': '...' } }`. The applied theme is still complete.
- To get a correct light app, or a correct dark app, is one call, with nothing to import, as in
  `applyTheme('imp-dark')`. A custom theme stays a plain module, and it keeps the obvious names
  `light` and `dark` for itself. The built-in palettes belong to imp, and imp can change them,
  because no app can hold a mutable reference to them.
- The `--imp-*` token surface is public API, and it grows one consumer at a time. The named palette
  is the deliberate exception. It ships with no consumer, because it exists for the app, and not for
  imp.
- Somebody can write a theme by choosing two colours and two steps. That is what makes a theme
  editor possible at all, see `theme-editor.md`. The editor exports a plain token module. So the
  derivation is a starting point, and not a format that an app is locked into. To edit the exported
  file by hand is the supported path for anything that the four knobs cannot say.
- imp carries its own colour mathematics, of about 2 kB, into every app that touches theming. Its
  palette is visibly the palette of imp, and not a copy of an established one. imp chose both over
  vendoring the colour scales of a third party, and over the attribution that comes with them.
- A malformed theme, and an unknown built-in name, both fail loudly at the call site. imp logs input
  that looks wrong but is usable, through the imp logger, and applies it anyway. That is consistent
  with the log-and-continue posture of the rest of the library.
- Theming leaves the direction out completely. So it carries no dependency on RTL.
