# Landing site - the docs engine, the gallery index, and the open questions

The home page of imp lives in `site/`. It is a static site with three sections, Overview, Components
and Docs, under one navbar of the design system. `deno task site` builds it and serves it. The
Components page embeds the export of `imp preview` (`adr/preview-export.md`). The Docs pages render
`docs/*.md`. This item holds what the site still owes.

## The engine that turns Markdown into HTML

Today `tools/build-site.js` renders each `docs/*.md` file with the vendored `marked`. It writes
heading ids, rewrites a link to a sibling `*.md` file into the route of that page, and highlights
each fenced code block with the tokenizer of `codeBlock`. One thing remains:

- **Decide whether the engine becomes a command of imp.** A maintainer tool is enough for the site
  of imp. A user who wants a docs site from Markdown has no command. If the engine ships, it must
  run in process, see `adr/in-process-toolchain.md`.

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

## Open questions

- **Versioned documentation.** Does imp publish the documentation per version, or the latest only?
- **Where the site is hosted, and what builds it.** The site assumes GitHub Pages. The install
  command on the overview page, and in `docs/cli.md`, fetches `install.sh` from
  `https://sobanieca.github.io/imp-ui`, and the build copies the script into `site/dist/`. Set
  `IMP_SITE_URL` to another origin, and the command follows it. Nothing publishes the site yet. A
  workflow must run `deno task site:build` and upload `site/dist/`. The pages link their assets from
  the root, as `/site.css`, so the site needs its own origin: a custom domain, or the root site of
  the account. A project site under `/imp-ui/` breaks those links.
