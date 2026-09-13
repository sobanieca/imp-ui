# One theme editor, in imp preview and in the dev widget, exports a plain theme file

## Context

A theme is a flat map of about ninety tokens, see `themable-by-default-tokens.md`. That shape is
correct for the runtime, because one write of the custom properties re-skins everything. It is wrong
for a person who starts a theme. Nobody selects ninety colours. The colours that matter are an
accent, a neutral, how round the chrome is, and how deep it is. Those sit among the colours that
follow from them.

An editor that takes the shape of the data alone, and not the shape of the decision, is a token
inspector. It lists every applied token as a text field. A change to an accent then means an edit of
`color-primary`, `color-primary-hover`, `color-primary-active`, `color-on-primary`, `color-link` and
`color-focus-ring` by hand, and it means keeping those consistent, per theme, twice, for light and
for dark. Such a tool can only ever produce the theme that it already shows.

An editor that takes the shape of the decision alone is too small. A brand needs a `color-warning`
of its own, a different `background-app`, or a hover step that the derivation does not select. Such
a change belongs in the token map, and a person wants to see it on the page while they type it, not
after a round trip through a downloaded file.

Where such a tool must live was also open. One option was a deliverable of the public site. That
would mean a second implementation of the live preview, which is a page that renders real components
under a candidate theme, beside the page that `imp preview` already is. A second place also matters.
A theme is designed against the components in isolation, but it is judged in the app, on the real
screens, with the real content. A person who tunes a colour must see it on their own page.

## Decision

**The theme editor is one library component, `lib/src/theme-editor.js`, and two development surfaces
host it.** The library holds the component and the draft model, `lib/src/theme-draft.js`, the same
way it holds the capture engine of a review, see `in-page-review-capture.md`. Nothing in an app
imports either module. `imp build` never bundles them.

- **In `imp preview`**, _edit theme_ beside the theme switcher opens the editor in a non-modal
  drawer. The preview page is an imp app built from `imp/std`, so it is already the live preview
  that an editor needs. The public site embeds that same preview, and it hosts no editor of its own.
- **In `imp start`**, the imp mark of the review widget opens a fourth round button, **Theme
  editor**. It renders the same component in the panel of the widget, on a card in the surface
  colour of the theme. So the app re-skins while the person picks, on its own screens. The widget
  reaches the component by a dynamic import of `/@imp/theme-editor.js`, the served library module.
  So the editor runs on the same copy of imp as the app, with the same custom elements and the same
  theme state. The page fetches the module only when somebody presses the button.
- **The widget on a preview page does not repeat the button.** The preview page runs from its own
  bundle of the library, and a second copy loaded through `/@imp/` would define the same custom
  elements again. The page already has _edit theme_, so the widget shows three buttons there.

**The draft is two token maps, one per mode, and the editor shows each map in two views.** The draft
holds `light.tokens` and `dark.tokens`, complete, and `mode` names the map that the page shows. The
knobs are a projection of the map of that mode. The JSON is the map itself.

- **The knobs expose the decision.** There are six, and a mode. **mode** is `light` or `dark`, and
  it selects the map that the editor edits and previews. **primary** and **secondary** are colours.
  **font** and **mono font** are font stacks, and they are `font-family` and `font-family-mono` as
  written. **border radius** is `none`, `small`, `medium` or `large`. **shadow** is `none`, `soft`
  or `strong`. Each knob reads its value off the map. The primary is `color-primary`, the radius is
  the step whose `radius-item` matches, and so on. A knob writes the tokens that it drives, and no
  other. The primary writes the primary ramp, the focus ring and the link colours. The secondary
  writes `color-secondary`, the text, the surfaces and the border. A font writes its one token in
  both maps. The radius and the shadow write their scale in both maps, because they are geometry,
  and an app has one answer for both modes. The colours are per mode, so a dark theme is not forced
  to be a function of the light theme.
- **The JSON exposes the data.** Under the knobs, a `codeEditor` holds the map of the mode as JSON,
  see `code-editor-textarea-mirror.md`. Every token is there, the ones the knobs drive and the ones
  they do not. An edit applies as soon as the text parses to a non-empty object of strings, and an
  edit that does not parse yet changes nothing. The knobs read the map again after each applied
  edit, so an edit of `color-primary` in the JSON moves the primary knob. The editor never writes
  the JSON back while the person types in it, because a re-serialization would move the caret.
- **The two views agree on one rule.** A knob rewrites the tokens that it drives, and it leaves
  every other token as the JSON set it. So a hand edit of `color-primary-hover` holds until the
  primary knob moves again. The rule is short enough to say in the help text under the JSON, and it
  is the whole contract between the views.

**The output is an ordinary theme module, and not an artifact that belongs to imp.** _copy_ puts the
whole file on the clipboard. _download theme.js_ writes it to disk. Both produce the same source. It
holds a shared `fonts` object and a shared `palette` object of the named colours, a `light` export
and a `dark` export that spread both objects, and `export default light`. A font or a palette colour
that the two maps do not agree on is listed in the theme that differs. A semantic alias such as
`color-success` is written as a reference into the palette while its value is the palette colour,
and as a literal otherwise. The file imports nothing from imp. So it cannot fall behind an imp
version. Its layout suits an edit by hand afterwards. The panel prints the two lines that use the
file, which are `await init({ theme: light })`. A downloaded file with no instruction is a file that
nobody connects.

**A draft belongs to the applied theme, by name, and it lives in `localStorage`.** The key is
`imp.theme-draft.<name>`, where the name is the `name` of the theme that `applyTheme` last applied.
In an app that is the theme that `init` applied. In the preview it is the label of the selected
theme, which the page passes as the `name` when it applies a custom theme. When the editor opens
with no draft, imp seeds the map of the applied mode from the tokens on the screen, and it builds
the map of the other mode from the defaults of that mode, with the fonts, the radius, the shadow and
every token without a knob carried over. So the editor starts from what is on the screen, and not
from a default. _reset_ drops the draft and reloads the page.

**A draft follows the applied theme across a reload.** The dev server reloads the page on every
save, and an edit that vanishes on each reload is an edit that nobody keeps. So `theme-draft.js`
watches the theme state. Each time the app applies a theme, it applies the stored draft of that name
on top, and it ignores the applies that it makes itself. The preview page installs the watcher
before it applies the selected theme. In an app, the injected client installs it at load, and only
when `localStorage` holds a draft. So a page with no draft fetches nothing for it.

**The derivation belongs to the library, and not to the editor.** A knob calls the same functions
that the built-in themes call, see `themable-by-default-tokens.md`. So what a knob writes and what
`applyTheme('imp-light')` produces can never differ. The editor holds no colour mathematics.

## Consequences

- To write a theme, a person selects two colours, two fonts and two steps, tunes any token by hand,
  and presses copy. The result is source in the repository of the app, and a reviewer can read it.
  It is not state in a browser.
- There is one editor and one draft model. A knob added to the component appears in the preview and
  in the widget at once. There is one live preview of the standard components, and the site gets it
  by an embed of `imp preview`. The app is the second live preview, and it costs no page of its own.
- The JSON view makes the editor complete. A token outside the knobs is one edit away, on the page,
  with the result visible as it is typed. The cost is that a knob can hide a hand edit. A person who
  sets `color-primary-hover` by hand and then moves the primary knob loses the hand edit, by the
  rule above, and the JSON shows the new value at once.
- A draft is keyed by the theme name, and imp never writes it back to a file. So a session in the
  editor cannot change the real theme module of an app with no message. A draft that a person saves
  as `theme.js` and passes to `init` is applied twice after the next reload, once by the file and
  once by the draft, until they press _reset_. The two agree, so nothing looks wrong, and the hint
  in the panel says to reset.
- The widget edits the theme that is applied when the panel opens. An app that switches its theme
  while the panel is open keeps the editor on the first name. Close and open the panel to edit the
  new one.
- The library holds two more modules that an app never imports. `imp lint` on the library lists
  their entry exports in `publicExports`, because only the CLI and the served page reach them.
- A theme file that you export today keeps working after the derivation changes, because it carries
  literal values. The cost is the opposite case. A theme file does **not** take an improved
  derivation. To take one, an app exports the file again.
