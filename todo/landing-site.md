# Landing site - the docs engine, the gallery index, and the open questions

The home page of imp lives in `site/`. It is a static site with three sections, Overview, Components
and Docs, under one navbar of the design system. `deno task site` builds it and serves it. The
Components page embeds the export of `imp preview` (`adr/preview-export.md`). The Docs pages render
`docs/*.md`. This item holds what the site still owes.

## The engine that turns Markdown into HTML

Today `tools/build-site.js` renders each `docs/*.md` file with the vendored `marked`. It writes
heading ids, rewrites a link to a sibling `*.md` file into the route of that page, and highlights
each fenced code block with the tokenizer of `codeBlock`.

**The engine stays a maintainer tool.** It does not become a command of imp. A docs site is not the
job of a frontend toolkit. An app that renders Markdown uses the `markdown` component.

## The gallery index

The gallery is the most persuasive page of the site, and its index is still a list of names in
cards. It owes a fast, visual way to find a component: a grid of specimens, where each component
shows as itself, with a search and a filter by group on top. The same page serves `imp preview` in
development and the export, so this work pays twice. See `adr/component-preview.md`.

## The frame

The site draws its own navbar in CSS, because the navbar of the design system is ink with white
text, and the `shell` bar takes the surface colour of the theme. The preview page draws the same
frame as components. The two share the tokens and the styles of `cli/src/design-styles.js`, so they
cannot drift in colour or type, only in layout.

## Versioned documentation

**The site publishes the documentation of the latest version only.** Before 1.0, imp keeps no
backward compatibility, so the docs of an old version have no reader. At 1.0, decide again, and
publish the docs per major version.

## Hosting

**The site is a GitHub Pages project site at `https://sobanieca.github.io/imp-ui/`.** There is no
custom domain. The install command on the overview page, and in `docs/cli.md`, already fetches
`install.sh` from that URL, and the build copies the script into `site/dist/`. Two things are left:

- **The site must work under the path `/imp-ui/`.** The pages link their assets and their pages from
  the root, as `/site.css`, `/fonts/` and `/docs/`. Under a project site, those links break. The
  build must take the base path from `IMP_SITE_URL`, and prefix every root link with it. That covers
  the pages, the navbar, the gallery export, the fonts, `sitemap.xml` and `robots.txt`.
- **A workflow must publish the site.** On a push to `main`, it runs
  `deno run -A tools/build-site.js` with `IMP_SITE_URL=https://sobanieca.github.io/imp-ui`, and it
  uploads `site/dist/` to GitHub Pages.
