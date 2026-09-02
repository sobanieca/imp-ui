# Static preview export - `imp preview --output <path>`

Today `imp preview` exists only behind a running dev server. Add a mode that exports the same
preview site to a folder, as plain static files. That is an index, plus one page per `*.preview.js`
file. You can deploy it to any static host, with no imp process behind it.

There are two audiences, and one feature:

- **The site of imp itself.** The landing page, see `todo/landing-site.md`, wants a section where a
  visitor browses the standard components. The visitor selects a component from a nav, sees it
  rendered, changes the theme, and reads the code that built it. That is exactly the page that
  `imp preview` already generates. It only has to survive with no server.
- **Every user of imp.** A team publishes its own gallery of components, as a build step, in the way
  that `imp build` ships the app. That gallery serves a designer, a reviewer, and a public page
  about a design system.

## What the export produces

```
imp preview --output site/components
```

The shape of the URLs is the shape that the server uses. So the pages are the pages that somebody
already exercised in development:

```
index.html                                 an index of every preview
preview/general/button.preview.html        one page per preview file
@imp/preview/general/button.preview.js     its bundle
```

There is no injection into the head from the dev server. There is no socket for a live reload, no
development log, and no telemetry of the console or the network. The output must be inert static
files.

## Why this is nearly free

The pieces are already in place, and a test of the idea confirmed the whole flow, from start to end:

- `bundlePreview` returns a **self-contained** ESM bundle. It holds imp, the component, the chrome
  of the preview, and each asset as a data URL. imp extracts the order of the scenarios, and the
  declarations of a state, at bundle time, into the metadata of the entry. So the page fetches
  nothing later.
- `preview_runtime.js` makes **no network call**. It couples to the environment in two places only.
  It reads `location.search` for the `?scenario=` view that isolates one scenario. It uses
  `localStorage` for the theme, the language and the direction. Both are correct on a static host.
- The behaviour that belongs to development enters through `injectImp`, which is a separate step
  that wraps the shell of the page. To not call that step is the whole of "make it static".
- `selectPreviewFiles`, the shell of the page, and the index page, are already exported, and the
  server path already uses them. So the export and the serve stay one code path, with one output.

The test of the idea covered the 26 previews under `lib/src/std`. A cold run of the full set took
**16.3 s**. A page is about 148 KB, without minification, and **36 KB** with gzip. The exported
pages render correctly in a headless browser, served from a plain static file server. The toolbar
works, the pickers for the theme and the direction work, the stage that a person can resize works,
and the panel for the state works.

## What must change

1. **The base path.** The URLs of a page and of a bundle are root-absolute. The link home, on the
   brand of the shell, is a fixed `/`. So the site breaks under a sub-path, such as `/components/`.
   Reuse the handling of a base path that `imp build` already applies to a built app, see
   `adr/production-bundling.md`. Take every link that the shell renders through that handling as
   well.
2. **An embed mode.** Inside a marketing page, the toolbar must drop the branding of `imp preview`,
   the path of the source file, and the link to all previews. It must **keep** the pickers for the
   theme and the direction. To change a whole gallery between light, dark, high contrast and RTL is
   the demonstration. Decide whether this is a query parameter on the page, or an option at the time
   of the export.
3. **What the index is for.** The index is a real imp page. It has a hero, a card per group, and a
   menu of components that a person can search. So it publishes as it is. Decide whether an embedded
   gallery uses that index, or whether the host site supplies its own nav, and links straight at the
   pages of a specimen. Say which one in the documentation.
4. **The size.** `bundlePreview` sets neither `minify` nor `splitting`. So every page bundles all of
   imp again, and the whole component that it imports. `imp build` already runs both. To turn them
   on for the export puts the library in one shared chunk, and leaves a small bundle per component.
   The export ships without this, so it can land second.

## How to embed the export in a page

The preview page mounts to `document.body`. It injects styles at document level. It carries its own
sticky toolbar. So it is a **document, and not a widget**. Embed it in an `iframe`. The host page
renders its own nav of components, and changes the `src` of the frame. To inline the page into a
host page would mean a rework of the runtime, so that the runtime accepts a target to mount into,
and scopes its document styles. That is not worth it. The frame also gives isolation of the theme,
and of `localStorage`, with no work.

## Documentation, skills and help

`imp preview --output` is a surface of a command that a user sees. So it lands with its block of
usage, and its prose, in `docs/cli.md`. It lands with its entry in `skills/preview.md`. It lands
with its help text in the CLI. Cover the story of a deploy plainly. Build the folder, upload it, and
it works anywhere that the output of `imp build` works.

## ADR impact

`adr/component-preview.md` describes the preview as a served page. When the export lands, extend
that ADR with the static output. There is one generator behind a served site, and behind an exported
site. Note that the page is inert, with no injection from the dev server.

## Open questions

- **How to keep the gallery of imp fresh.** Somebody must run the export again whenever a standard
  component changes, or whenever the published gallery differs from what imp ships. Connect the
  export to the build of the site, in place of committing generated output.
- **The prose per component.** Every standard component ships a `*.skill.md` file beside it. Does a
  page of the gallery show that text beside the specimen? Or does the site carry its own copy,
  written for a human reader? That is a decision of the site. It is also the reason not to fix the
  content of the gallery inside the exporter.
