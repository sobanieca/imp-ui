# The theme and the language are app-wide states that init declares and can persist

## Context

An app that lets a person pick a theme or a language needs four things: the list of choices, the
current choice, the storage of the choice, and a start in the stored choice before the first paint.
`applyTheme` and the i18n loader give none of these. Each app wrote the same layer by hand: a
persisted state in the root, a watch that applies it, a `matchMedia` listener for a "System" choice,
and a read of the stored value at the entry point. The entry point and the root had to resolve the
choice in the same way, or the first paint showed one theme and the root applied another. The
pickers had a second mode that stored the choice under another key, so an app could keep two
sources of truth for one setting.

## Decision

**imp owns the choice of the theme and of the language. `init` declares the choices.**

- `init({ themes })` is the list of theme choices. A choice is `'system'`, a built-in theme name, or
  a theme object with a `name` and an optional `label`. There is no wrapper object. Without
  `themes`, the choices are System, Light and Dark. A single `theme` outside them is the only
  choice, so `init({ theme })` stays the one-theme setup.
- `init({ theme })` is the starting choice, as a name or as the theme object. `init({ lang })` is
  the starting language. `init({ translations })` is the list of languages.
- `init({ persist })` stores the choice of the person under `imp.theme` and `imp.lang` in
  `localStorage`. It is `true`, `false`, or `{ theme, lang }`. imp stores only a choice that the
  person made, so a first visit keeps following the default. `init` starts in a stored choice that
  the list offers, before `mount`. A change in another tab arrives through the `storage` event.
- `theme` on `imp/theme` is an app-wide state of the choice name, with `set`. `theme.set` resolves
  the name, applies the theme, and stores it with `persist`. `lang` on `imp/i18n` is the same for the
  language. `lang.set` is async, because it loads the messages first.
- `'system'` resolves inside imp. It applies the first listed theme with `color-scheme` `light` or
  `dark`, to match the device, and one `matchMedia` listener applies the other one when the device
  changes. `init` throws when `'system'` is listed without both kinds.
- `appliedTheme` is the read-only state of the theme object in force. `applyTheme` stays the
  low-level call. It applies one theme and changes no choice, which is what a preview and the theme
  editor need.
- `themeSelect()` and `langSelect()` show and set these states. They take no list of themes, no
  `value` and no `remember`. `langSelect` takes `languages` only to rename or narrow the offered
  codes.

## Consequences

- A theme setting is one `init` call and one picker. The app writes no root state, no apply watch,
  no `matchMedia` listener and no read before `mount`.
- Every picker on a page shows the same state. A picker in the bar and one on a settings page cannot
  disagree, and the theme is correct on a page with no picker.
- A choice kept on the account of the person is `theme.set(user.theme)` after sign-in, and a watch
  that sends each change. imp does not know about accounts.
- `theme.get()` is a name, not a theme object. Code that reads tokens reads `appliedTheme`.
- The list of themes is module-wide state of the library. A second `init` with `themes` replaces
  it. A test that needs another list runs in its own file.
- "System" pairs themes by `color-scheme` and by their order in the list. An app with two light
  themes puts the one that "System" uses first.
