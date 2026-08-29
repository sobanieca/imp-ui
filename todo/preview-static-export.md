# Static preview export - `imp preview --output <path>`

`imp preview` today only ever exists behind a running dev server. Add an export mode that writes the
same preview site to a folder as plain static files - an index plus one page per `*.preview.js` -
deployable to any static host with no imp process behind it.

Two audiences, one feature:

- **imp's own site.** The landing page (`todo/landing-site.md`) wants a section where a visitor
  browses the standard components: pick a component from a nav, see it rendered, switch themes, read
  the code that built it. That is exactly the page `imp preview` already generates; it just has to
  survive without the server.
- **Every imp user.** A team publishes its own component gallery - for designers, for reviewers, for
  a public design-system page - as a build step, the same way `imp build` ships the app.

## What it produces

```
imp preview --output site/components
```

Same URL shape the server uses, so the pages are the ones already exercised in development:

```
index.html                                 an index of every preview
preview/general/button.preview.html        one page per preview file
@imp/preview/general/button.preview.js     its bundle
```

No dev-server head injection - no live reload socket, no dev log, no console/network telemetry. The
output must be inert static files.

## Why this is close to free

The pieces are already in place, and a spike confirmed the whole flow end-to-end:

- `bundlePreview` returns a **self-contained** ESM bundle - imp, the component, the preview chrome,
  assets as data URLs. Scenario order and state declarations are extracted at bundle time into the
  entry's metadata, so nothing is fetched later.
- `preview_runtime.js` makes **no network calls**. Its only environment couplings are
  `location.search` for the `?scenario=` isolate view and `localStorage` for theme, language and
  direction - all fine on a static host.
- The dev-only behaviour enters through `injectImp`, a separate wrapping step around the page shell.
  Not calling it is the whole of "make it static".
- `selectPreviewFiles`, the page shell and the index page are already exported and already used by
  the server path, so export and serve stay one code path with one output.

Spike numbers over the 26 previews under `lib/src/std`: **16.3 s** cold for the full set, ~148 KB
per page unminified, **36 KB gzipped**. The exported pages render correctly in a headless browser
served from a plain static file server - toolbar, theme and direction pickers, the resizable stage
and the state panel all work.

## What has to change

1. **Base path.** Page and bundle URLs are root-absolute, and the shell's brand link home is a
   hardcoded `/`, so the site breaks under a sub-path like `/components/`. Reuse the base-path
   handling `imp build` already applies to a built app (`adr/production-bundling.md`) and take every
   link the shell renders through it too.
2. **Embed mode.** Embedded in a marketing page, the toolbar should drop the `imp preview` branding,
   the source file path and the "all previews" link, while **keeping** the theme and direction
   pickers - switching a whole gallery between light, dark, high-contrast and RTL is the demo.
   Decide whether this is a query parameter on the page or an export-time option.
3. **What the index is for.** The index is a real imp page - hero, per-category cards, a searchable
   component menu - so it publishes as-is. Decide whether an embedded gallery uses it or the host
   site supplies its own nav and links straight at the specimen pages, and say which in the docs.
4. **Size.** `bundlePreview` sets neither `minify` nor `splitting`, so every page re-bundles all of
   imp and the whole component it imports. `imp build` already runs both; turning them on for the
   export puts the library in one shared chunk and leaves small per-component bundles. Shippable
   without this, so it can land second.

## Embedding it in a page

The preview page mounts to `document.body`, injects document-level styles and carries its own sticky
toolbar, so it is a **document, not a widget**: embed it in an `iframe`, with the host page
rendering its own component nav and swapping the frame's `src`. Inlining it into a host page would
mean reworking the runtime to accept a mount target and scope its document styles - not worth it,
and the frame buys theme and `localStorage` isolation for free.

## Docs, skills and help

`imp preview --output` is a user-facing command surface, so it lands with its `docs/cli.md` usage
block and prose, its `skills/preview.md` entry, and the help text in the CLI. Cover the deploy story
plainly: build the folder, upload it, it works anywhere `imp build` output works.

## ADR impact

`adr/component-preview.md` describes the preview as a served page. Once export lands, extend it with
the static output - one generator behind both a served and an exported site - and note that the page
is inert without the dev-server injection.

## Open questions

- **Keeping imp's own gallery fresh.** The export has to re-run whenever the standard components
  change or the published gallery drifts from what ships. Wire it into the site build rather than
  committing generated output.
- **Per-component prose.** Every standard component ships a `*.skill.md` next to it. Whether a
  gallery page should show that text beside the specimen, or the site should carry its own copy
  written for a human reader, is a site decision - but it is the reason not to hardcode the
  gallery's content into the exporter.
