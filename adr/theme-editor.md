# The theme editor lives in imp preview and exports a plain theme file

## Context

A theme is a flat map of around ninety tokens (`themable-by-default-tokens.md`). That shape is right
for the runtime - one write of custom properties re-skins everything - and wrong for a person
starting a theme: nobody picks ninety colors, and the ones that matter (an accent, a neutral, how
round and how deep the chrome is) are buried among the ones that follow from them.

The first editor took the shape of the data rather than the shape of the decision: it listed every
applied token as a text field, so tweaking an accent meant editing `color-primary`, `-hover`,
`-active`, `color-on-primary`, `color-link` and `color-focus-ring` by hand and keeping them
consistent, per theme, twice over for light and dark. It could only ever produce the theme it was
already showing, which made it a token inspector, not an authoring tool.

Where such a tool should live was also open: `todo/theme-editor.md` scoped it as a deliverable of
the public site, which would have meant a second implementation of the live preview - a page
rendering real components under a candidate theme - next to the one `imp preview` already is.

## Decision

**The theme editor is part of `imp preview`**, beside the theme switcher, and the public site embeds
that same preview rather than hosting an editor of its own. The preview page is already an imp app
built from `imp/std`, so it is already the live preview an editor needs; adding a panel to it costs
nothing that has to be kept in sync.

**It exposes the decision, not the data - four knobs and a mode:**

- **mode** (`light` / `dark`) selects which of the two themes is being edited and previewed. Base
  colors are held **per mode**, so a dark theme is not forced to be a function of the light one;
  radius and shadow are shared, because they are geometry and an app has one answer for both.
- **primary** and **secondary** colors, from which every other color token is derived.
- **border radius** (`none` | `small` | `medium` | `large` | `full`) and **shadow** (`none` | `soft`
  | `strong`), each a step that rewrites the whole matching scale.

The per-token list is **removed, not hidden behind an "advanced" section**. Anything the knobs
cannot express is edited in the exported file, where the change is durable and reviewable, rather
than in a browser panel whose state lives in `localStorage`.

**The output is an ordinary theme module, not an imp-specific artifact.** _copy_ puts the whole file
on the clipboard and _download theme.js_ writes it to disk; both produce the same source: a shared
`palette` object of the 31 named colors, a `light` and a `dark` export spreading it, and
`export default light`. It imports nothing from imp, so it cannot fall behind an imp version, and it
is laid out to be edited by hand afterwards - the palette sits at the top precisely because the
editor will never rewrite it. The panel prints the two lines that use the file
(`await init({ theme: light })`), because a downloaded file with no instruction is a file nobody
wires up.

**Drafts are per selected theme and live in `localStorage`.** Opening the editor on a theme seeds it
from that theme's own tokens - primary and secondary read off the applied values, radius and shadow
matched back to a step - so the editor starts from what is on screen rather than from a default, and
_reset_ drops the draft and returns to the picked theme.

**The derivation is the library's, not the editor's.** The editor calls the same function the
built-in themes call (`themable-by-default-tokens.md`), so what it previews, what it exports, and
what `applyTheme('imp-light')` produces can never disagree. The editor holds no color math.

## Consequences

- Writing a theme is picking two colors and two steps and pressing copy; the result is reviewable
  source in the app's repo, not state in a browser.
- There is one live preview in the project. The site gets the editor by embedding `imp preview`, and
  a component added to the stdlib shows up in the editor's preview for free.
- The editor cannot express a token outside its four knobs - a different type scale, a bespoke
  `color-warning` - and deliberately does not try. That work belongs in the exported file, which is
  why the export is a plain module rather than a serialized editor state that only the editor can
  read back.
- Because drafts are keyed by the selected theme and never written back to any file, a preview
  session cannot silently modify an app's real theme module.
- A theme file exported today keeps working after the derivation changes, since it carries literal
  values. The converse is the cost: a theme file does **not** pick up an improved derivation, and
  re-exporting is how an app opts into one.
