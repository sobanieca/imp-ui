# Preview export - the gallery as one element that any page embeds

## Context

`imp preview` serves the gallery of a project from a dev server (`component-preview.md`). Two
audiences need the same gallery with no server behind it. The home page of imp shows the standard
components in a section of its own. A team publishes the gallery of its design system as a static
page. In both cases the gallery is a part of a page that somebody else owns, and that page has its
own navigation, its own styles and its own address.

Two facts decide the shape. The preview page mounts to `document.body`, writes styles at document
level, applies a theme to the document element, and pins the direction of the page. So it is a
document, not a widget. And an imp app defines its custom elements once per document. A second imp,
loaded next to the imp of a host app, fails on the first element name that both define. So the
exported gallery cannot share a document with an imp app.

The router keeps the route in the path of the page (`client-side-router.md`). A gallery inside a
page that it does not own cannot push a path, because a reload of that path would reach the host
with an address the host does not serve.

## Decision

**`imp preview --output <dir>` writes the gallery as a folder of static files. One script in it,
`imp-preview.js`, defines the custom element `<imp-preview>`. A page loads that script and places
the element. The element shows the same page that the dev server serves, with no server behind it.**

- **The element hosts the page in an iframe on a blob URL.** The page HTML is embedded in the
  script. The element creates a blob of it, and points the frame at that URL. A blob URL carries the
  origin of the host, so the frame reads the same `localStorage`, and the host reads the frame. A
  blob document has a URL of its own, so the router can push a history entry with a fragment. An
  iframe with `srcdoc` cannot: its base URL is the URL of the parent, and the platform rejects every
  history entry for it. The frame isolates the document, the custom element registry, the theme and
  the direction. So the host app and the gallery each keep their own imp.
- **The page loads its app by an absolute address.** The element resolves `app.js` next to its own
  script through `import.meta.url`, and writes that address into the page before it creates the
  blob. A blob document resolves a relative address against the blob URL, which points at nothing.
  The app then loads its own chunks relative to its own module address, which is a real one.
- **The links of the entry page resolve against the host page.** Before it creates the blob, the
  element resolves the `href` of each `link` and the `src` of each `script` against the address of
  the host document. So the entry page links a self-hosted font as `/fonts/fonts.css`, the same path
  that `imp preview` serves from `public/`. The host site serves the same file at that path.
- **The route lives in the fragment.** The page sets `IMP_ROUTING` to `hash`, so the router of the
  library reads and writes `#/<group>/<name>?scenario=<id>` in place of the path. The library owns
  that mode, see `client-side-router.md`. The chrome of the preview does not change for it.
- **The element mirrors the route into the address of the host page, and follows it back.** The app
  inside the frame dispatches a route event on its frame element, and the element replaces the
  fragment of the host address with the route. The index leaves the fragment empty. A change of the
  host fragment moves the frame to that route. On the first load the element seeds the frame from
  the host fragment. So a deep link to one scenario is the address of the host page plus the
  fragment, and a reload keeps the place.
- **The theme crosses the frame through an attribute and an event.** The host sets `theme` on the
  element to the name of a theme in the menu of the gallery. The element writes the name onto its
  frame as a data attribute, and the page inside observes that attribute and applies the theme. A
  pick inside the gallery dispatches an event on the frame element, as the route does. The element
  writes the name back into `theme` and dispatches `imp-preview-theme` on itself. So a host page
  with a theme switch of its own keeps the gallery in step, and a pick in the gallery reaches the
  host. Storage cannot carry this, because the host and the gallery name their themes differently,
  and a change in storage reaches the other document only on a reload.
- **The export splits by group.** The app bundle holds the chrome, the library and the catalog. One
  bundle per group holds the preview files of that group, and the shared code sits in chunks. A
  click on a group in the sidebar loads that group. The dev server uses the same split, so one
  bundler configuration serves both. The output is minified, and the legal comments of bundled code
  stay inline.
- **The embedded page drops the brand of imp.** The sidebar of the export has no logo and no link to
  a home. The host page owns the brand and the navigation above the gallery. The pickers for the
  theme, the language and the direction stay, because to switch a whole gallery is the
  demonstration.
- **The export has no dev server behind it.** No client script is injected, there is no reload
  socket, no telemetry and no review widget. `--env` still selects an environment, so a component
  that reads `env` gets its values. A preview file that fails to build fails the export. A gallery
  that publishes with a broken card is worse than no gallery.
- **The output folder belongs to the export.** imp empties it before it writes, as `imp build` does
  with its output folder. The folder must not contain the project.

## Consequences

- One generator serves the dev page and the exported page. What a person exercised in development is
  what publishes.
- A host page embeds the gallery with two lines: a module script and an element. The element sizes
  itself to `100dvb` by default, and the host overrides that with CSS.
- The host page carries the fragment of the gallery. A host that uses the fragment for its own
  purpose must not embed the gallery, or must accept that the two share the fragment. Only a
  fragment that starts with `#/` is a route.
- The frame owns its history entries. The back button of the browser steps through the components a
  person visited, and the mirror keeps the host address in step after each step.
- The host site must serve every root-relative file that the entry page links, at the same path. A
  host page with a content security policy must allow `blob:` frames.
- The home page of imp runs this export as its Components section, so a change to the export is
  checked by the page that depends on it most.
