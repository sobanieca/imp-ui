# The theme editor lives in imp preview and exports a plain theme file

## Context

A theme is a flat map of about ninety tokens, see `themable-by-default-tokens.md`. That shape is
correct for the runtime, because one write of the custom properties re-skins everything. It is wrong
for a person who starts a theme. Nobody selects ninety colours. The colours that matter are an
accent, a neutral, how round the chrome is, and how deep it is. Those sit among the colours that
follow from them.

The first editor took the shape of the data, and not the shape of the decision. It listed every
applied token as a text field. So a change to an accent meant an edit of `color-primary`,
`color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-link` and
`color-focus-ring` by hand, and it meant keeping those consistent. A person did that per theme, and
twice, for light and for dark. That editor could only ever produce the theme that it already showed.
So it was a token inspector, and not a tool for authoring.

Where such a tool must live was also open. `todo/theme-editor.md` scoped it as a deliverable of the
public site. That would mean a second implementation of the live preview, which is a page that
renders real components under a candidate theme, beside the page that `imp preview` already is.

## Decision

**The theme editor is part of `imp preview`**, beside the theme switcher. The public site embeds
that same preview, and it hosts no editor of its own. The preview page is already an imp app, built
from `imp/std`. So it is already the live preview that an editor needs. A panel on that page costs
nothing that somebody must keep in step.

**The editor exposes the decision, not the data. It has six knobs and a mode:**

- **mode**, which is `light` or `dark`, selects which of the two themes the editor edits and
  previews. The editor holds the base colours **per mode**. So a dark theme is not forced to be a
  function of the light theme. The radius and the shadow are shared, because they are geometry, and
  an app has one answer for both modes.
- **primary** and **secondary** are colours, and the editor derives every other colour token from
  them.
- **font** and **mono font** are font stacks, and they are `font-family` and `font-family-mono` as
  written. They are shared between the modes, because a font does not change with the colour scheme.
  The editor loads no font. A web font shows on the page only when the page loads it. A project
  points `preview.entry` at an HTML file that links the font, see `component-preview.md`.
- **border radius**, which is `none`, `small`, `medium` or `large`, and **shadow**, which is `none`,
  `soft` or `strong`. Each one is a step, and it rewrites the whole matching scale.

The editor **removes the list per token. It does not hide it behind an advanced section.** Anything
that the knobs cannot express, a person edits in the exported file. There the change is durable, and
a reviewer can read it. It is not in a browser panel whose state lives in `localStorage`.

**The output is an ordinary theme module, and not an artifact that belongs to imp.** _copy_ puts the
whole file on the clipboard. _download theme.js_ writes it to disk. Both produce the same source. It
holds a shared `fonts` object of the two font stacks, a shared `palette` object of the 31 named
colours, a `light` export and a `dark` export that spread both objects, and `export default light`.
The file imports nothing from imp. So it cannot fall behind an imp version. Its layout suits an edit
by hand afterwards, and the palette sits at the top for exactly that reason, because the editor will
never rewrite it. The panel prints the two lines that use the file, which are
`await init({ theme: light })`. A downloaded file with no instruction is a file that nobody
connects.

**A draft belongs to the selected theme, and it lives in `localStorage`.** When you open the editor
on a theme, imp seeds the draft from the tokens of that theme. It reads the primary and the
secondary colour off the applied values, and it matches the radius and the shadow back to a step. So
the editor starts from what is on the screen, and not from a default. _reset_ drops the draft, and
returns to the selected theme.

**The derivation belongs to the library, and not to the editor.** The editor calls the same function
that the built-in themes call, see `themable-by-default-tokens.md`. So what it previews, what it
exports, and what `applyTheme('imp-light')` produces, can never differ. The editor holds no colour
mathematics.

## Consequences

- To write a theme, a person selects two colours, two fonts and two steps, and presses copy. The
  result is source in the repository of the app, and a reviewer can read it. It is not state in a
  browser.
- There is one live preview in the project. The site gets the editor by an embed of `imp preview`.
  When somebody adds a component to the standard library, that component appears in the preview of
  the editor with no extra work.
- The editor cannot express a token outside its four knobs, such as a different type scale, or a
  `color-warning` of your own. It deliberately does not try. That work belongs in the exported file.
  That is why the export is a plain module, and not a serialized state that only the editor can read
  back.
- A draft is keyed by the selected theme, and imp never writes it back to a file. So a preview
  session cannot change the real theme module of an app with no message.
- A theme file that you export today keeps working after the derivation changes, because it carries
  literal values. The cost is the opposite case. A theme file does **not** take an improved
  derivation. To take one, an app exports the file again.
