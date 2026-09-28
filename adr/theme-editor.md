# One theme editor, in imp preview and in the dev widget, exports a plain theme file

## Context

A theme is a flat map of about sixty tokens, see `themable-by-default-tokens.md`. That shape is
correct for the runtime, because one write of the custom properties re-skins everything. It is wrong
for a person who starts a theme. Nobody selects sixty values. The colours that matter are an accent,
a neutral, how round the chrome is, and how deep it is. Those sit among the colours that follow from
them.

An editor that takes the shape of the data alone, and not the shape of the decision, is a token
inspector. It lists every applied token as a text field. A change to a neutral then means an edit of
`color-secondary`, `color-text`, the three surfaces and `color-border` by hand, and it means keeping
those consistent, per theme, twice, for light and for dark. Such a tool can only ever produce the
theme that it already shows.

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
  editor**. It renders the same component in the panel of the widget, with `tokensOnly` set, so the
  panel holds the JSON view and no knobs. A theme starts in the preview, where the knobs derive it
  from two colours against the components in isolation. The app is where a person tunes one token
  against the real screens, and a JSON edit is that tune. Eight knobs in a panel 340px wide would
  only push the JSON out of view. The widget reaches the component by a dynamic import of
  `/@imp/theme-editor.js`, the served library module. So the editor runs on the same copy of imp as
  the app, with the same custom elements and the same theme state. The page fetches the module only
  when somebody presses the button.
- **The widget on a preview page does not repeat the button.** The preview page runs from its own
  bundle of the library, and a second copy loaded through `/@imp/` would define the same custom
  elements again. The page already has _edit theme_, so the widget shows three buttons there.

**The draft is one token map, the applied theme with edits on top, and the preview shows it on two
tabs.** The editor has no light or dark switch of its own. The theme that the page applied is the
one it edits. In the preview that is the theme in the sidebar, and a change there re-mounts the
editor on the new theme. A light theme and a dark theme are two sessions in the editor and two
exported files. imp reads light or dark from the surface colour of the map, the same way it does for
every theme, and the derivation uses that. The knobs are a projection of the map. The JSON is the
map itself.

- **The knobs expose the decision.** There are eight. **primary**, **secondary** and **shadow
  colour** are colours. **font** and **mono font** are font stacks, and they are `font-family` and
  `font-family-mono` as written. **border radius** is `none`, `small`, `medium` or `large`.
  **shadow** is `none`, `soft` or `strong`. **loader** is `spinner`, `dots`, `bar` or `pulse`, see
  `loader-shape-theme-token.md`, and a live sample of the loader stands beside it, in the primary
  colour. Each knob reads its value off the map. The primary is `color-primary`, the radius is the
  step whose `radius-item` matches, and so on. A knob writes the tokens that it drives, and no
  other. The primary writes `color-primary` and `color-on-primary`. The secondary writes
  `color-secondary`, the text, the surfaces and the border. A font writes its one token. The radius
  and the shadow write their scale. The loader writes `loader`. The shadow colour writes
  `color-shadow`, and every shadow step reads it, so a step never changes with the colour.
- **The JSON exposes the data.** On the second tab, a `codeEditor` holds the map as JSON, see
  `code-editor-textarea-mirror.md`. Its `rows` follow the line count, so it grows with the text. The
  drawer around it is then the only thing that scrolls. A fixed-height editor inside a scrolling
  drawer swallowed the wheel for the whole length of the JSON, and the drawer looked stuck. Every
  token is there, the ones the knobs drive and the ones they do not. An edit applies as soon as the
  text parses to a non-empty object of strings, and an edit that does not parse yet changes nothing.
  The knobs read the map again after each applied edit, so an edit of `color-primary` in the JSON
  moves the primary knob. The editor never writes the JSON back while the person types in it,
  because a re-serialization would move the caret.
- **The two tabs agree on one rule.** A knob rewrites the tokens that it drives, and it leaves every
  other token as the JSON set it. So a hand edit of `color-on-primary` holds until the primary knob
  moves again. The rule is short enough to say in the help text under the JSON, and it is the whole
  contract between the views.

**The output is an ordinary theme module, and not an artifact that belongs to imp.** _copy_ puts the
whole file on the clipboard. _download theme.js_ writes it to disk. Both produce the same source. It
holds one theme object, with the name of the applied theme and the full token map, as the default
export. A colour role such as `color-success` is a `var()` reference to a palette colour, and the
file writes it as the string it is. The file imports nothing from imp. So it cannot fall behind an
imp version. Its layout suits an edit by hand afterwards. The panel prints the two lines that use
the file, which are `await init({ theme })`. A downloaded file with no instruction is a file that
nobody connects.

**A draft belongs to the applied theme, by name, and it lives in `localStorage`.** The key is
`imp.theme-draft.<name>`, where the name is the `name` of the theme that `applyTheme` last applied.
In an app that is the theme that `init` applied. In the preview it is the label of the selected
theme, which the page passes as the `name` when it applies a custom theme. When the editor opens
with no draft, imp seeds the map from the tokens on the screen. So the editor starts from what is on
the screen, and not from a default. _reset_ drops the draft and reloads the page.

**A draft follows the applied theme across a reload.** The dev server reloads the page on every
save, and an edit that vanishes on each reload is an edit that nobody keeps. So `theme-draft.js`
watches the theme state. Each time the app applies a theme, it applies the stored draft of that name
on top, and it ignores the applies that it makes itself. The preview page installs the watcher
before it applies the selected theme. In an app, the injected client installs it at load, and only
when `localStorage` holds a draft. So a page with no draft fetches nothing for it.

**A draft records the theme that it started from, and it ends when that theme changes.** A draft
holds two token maps: `tokens`, which is the edit, and `base`, which is the applied theme at the
moment of the seed. At each load, `theme-draft.js` compares `base` with the tokens that the app just
applied. When they differ, somebody changed the theme of that name, so imp removes the draft and
applies nothing. A draft that outlived its theme painted the old look over the new one, with no sign
on the page of where the colours came from.

**The editor checks the contrast of the draft on every change.** Under the tabs, it lists each pair
of a text token and a background token that is below 4.5:1, the WCAG AA level for body text. The
pairs are the combinations that the standard components draw: `color-text` and `color-secondary` on
the surfaces and on `background-app`, `color-primary` and `color-danger` on `color-surface`, and
each `color-on-*` on its colour. The check follows a `var()` reference to another token, and it
skips a side that is not a hex colour, such as a gradient. A custom theme is where contrast breaks,
and the editor is where a person makes a custom theme. So the report sits beside the edit that
causes it, and not in a separate audit. The check is `contrastProblems` in `imp/theme`, so an app
can guard its theme file with the same function in a unit test. The report is advice. It blocks no
edit and no export, because a brand can accept a pair on purpose, for example for large text only.

**The derivation belongs to the library, and not to the editor.** A knob calls the same functions
that the built-in themes call, see `themable-by-default-tokens.md`. So what a knob writes and what
`applyTheme('imp-light')` produces can never differ. The editor holds no colour mathematics.

## Consequences

- To write a theme, a person selects two colours, two fonts and three steps, tunes any token by
  hand, and presses copy. The result is source in the repository of the app, and a reviewer can read
  it. It is not state in a browser.
- There is one editor and one draft model. A change to the JSON view or to the export appears in the
  preview and in the widget at once. A knob appears in the preview alone. There is one live preview
  of the standard components, and the site gets it by an embed of `imp preview`. The app is the
  second live preview, and it costs no page of its own.
- The JSON view makes the editor complete. A token outside the knobs is one edit away, on the page,
  with the result visible as it is typed. The cost is that a knob can hide a hand edit. A person who
  sets `color-on-primary` by hand and then moves the primary knob loses the hand edit, by the rule
  above, and the JSON shows the new value at once.
- A draft is keyed by the theme name, and imp never writes it back to a file. So a session in the
  editor cannot change the real theme module of an app with no message. A draft that a person saves
  as `theme.js` and passes to `init` changes the applied theme. So the next load removes the draft,
  and the file alone paints the page.
- The widget edits the theme that is applied when the panel opens. An app that switches its theme
  while the panel is open keeps the editor on the first name. Close and open the panel to edit the
  new one.
- The library holds two more modules that an app never imports. `imp lint` on the library lists
  their entry exports in `publicExports`, because only the CLI and the served page reach them.
- A theme file that you export today keeps working after the derivation changes, because it carries
  literal values. The cost is the opposite case. A theme file does **not** take an improved
  derivation. To take one, an app exports the file again.
