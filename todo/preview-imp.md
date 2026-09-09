# Preview redesign - a gallery for the home page and for every user

`imp preview` is a working development tool. It is not yet the page that the home page embeds, and
not yet the gallery that a team publishes for its own components. This item turns it into both. The
same page serves development, the exported gallery of imp, and the gallery of any project. See
`todo/landing-site.md` for the site and `todo/preview-static-export.md` for the export.

Two decisions in `adr/component-preview.md` must flip. The ADR says that a panel shows no code, and
that the manual stays out of the page. A public gallery needs both. Rewrite the ADR in the first
step below.

## 1. Code per scenario

- **Keep the source span of every scenario.** The export scanner in the CLI already reads the exact
  text of each `export const x = ...` expression. Today it keeps that text only for the metadata
  exports. Keep it for every scenario, and the catalog carries the code of each panel. The code
  shown is the code that ran, so nothing can drift.
- **Show a call site, not an export.** Remove `export const primary =`. Add the import lines whose
  identifiers the expression uses. Add a copy button.

  ```js
  import { button } from 'imp/std'
  button({ variant: 'primary' }, 'Save changes')
  ```

- **A scenario must read as a real call.** Some previews use a local helper such as `wrap(...)`. A
  visitor cannot paste `wrap(select(...))`. Inline those helpers in the standard previews. Add a
  "view file" control that expands the whole preview file, for the cases that keep a helper.
- **Fold the sidecar into the page.** Every component has a `*.skill.md` next to it, and `imp build`
  already folds it into a bundle as `impSkill`. Fold the sibling sidecar of a preview file into the
  catalog in the same way. Render it as a "Manual" tab on the component page. That gives the gallery
  the prop table and the message keys that `docs/std-components.md` promises. Render the Markdown to
  HTML in the CLI at bundle time, with the engine that the landing site vendors, so the runtime
  receives HTML.
- **Remove the `description` export.** Its only content is a command such as `imp skill std/button`,
  and the CLI can compute that command from the path of the file. Two reserved names remain, `name`
  and `group`. Show the computed command as a small line for agents. Hide that line in embed mode.

## 2. Viewing components is a breeze

- **A visual index.** Replace the card per group with a grid of live thumbnails. Each card renders
  the first scenario, scaled down, with `pointer-events: none`. A search and a group filter sit
  above the grid. They do not replace it.
- **A visible toolbar.** Theme, language and direction sit behind a settings button today. On the
  gallery they are the demonstration. Put them in a visible bar on the component page.
- **A scenario strip.** A sticky row of chips, one per scenario, that scrolls to its panel. Show
  `withHoverMenu` as "With hover menu". The code tab keeps the export name.
- **Keyboard.** `/` focuses the search. `[` and `]` step between components. `Cmd+K` opens a fuzzy
  jump to any component or scenario.
- **Light and dark side by side.** One compare toggle renders a scenario twice, once per colour
  scheme. This needs `applyTheme` to accept a target element in place of the document root. Do this
  after the rest.

## 3. Embedding and user galleries

- **Separate the document from the widget.** The runtime mounts to `document.body` and injects
  document styles. Split it into a specimen component, which renders the panels with stage, code and
  manual, and the gallery app, which wraps the specimen in `shell`. Add an embed route, for example
  `/embed/<group>/<name>?scenario=x`. It renders the specimen with the toolbar and no sidebar. The
  page posts its height to the parent frame, so an iframe on the home page sizes itself.
- **Base path and static export.** Implement `imp preview --output` from
  `todo/preview-static-export.md`. Reuse the base path handling of `imp build`, so the gallery works
  under `/components/`. The home page owns the navigation and embeds the specimen pages. One
  generator serves the dev server and the export.
- **Branding.** The brand block is fixed to the imp mark. Add `preview.title` and `preview.logo` to
  `imp.json`, and `preview.intro`, a Markdown file for the hero of the index. Together with
  `preview.entry`, `preview.themes` and `preview.groups`, an exported gallery then looks like the
  design system of the team.
- **Scaffold.** Let `imp init` ship one preview file and one skill file, so the gallery of a new
  project is not empty on the first day.

## Refactoring first

- `cli/src/preview.js` holds discovery, a JavaScript tokenizer, the state scanner, the esbuild
  plugin, the HTML page and the request handler. Split it into modules for discovery, source
  scanning, bundling, page and command before the code spans and the sidecars land.
- `cli/src/preview-runtime.js` holds the theme registry, storage, the stage, the state editor and
  the app. Split it along the same seams. The stage and the state editor keep their behaviour.
- Turn on minify and splitting for the export, so each specimen page stays small.

## Order

1. Code panel, manual tab and removal of `description`. The scanner and the sidecar fold exist.
   Rewrite `adr/component-preview.md` in the same change.
2. The visual redesign: index grid, toolbar, scenario strip, keyboard.
3. Embed route, base path and static export.
4. Branding options and the scaffold.
