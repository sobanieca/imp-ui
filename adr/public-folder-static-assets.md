# Static assets ship from a `public/` folder

## Context

`imp build` emits a complete site that you can deploy, and not only a JavaScript bundle. Whatever
the bundler does not compile must still reach the output directory. A page needs its stylesheets,
its images and its fonts beside the built code.

The first implementation had no folder for assets. The project root _was_ the static root. So the
build copied the whole root into the output, and then subtracted what must not ship. It subtracted a
fixed list of directories, which were `.git`, `node_modules` and `.imp`. It subtracted a fixed list
of root files, which held `imp.json`. It subtracted the inputs of the bundler, taken from the
esbuild metafile. It subtracted the configured environment files, and the mocks folder.

That is a list of what to exclude, and it fails in the unsafe direction. imp publishes anything that
nobody thought to exclude. That could be a stray `.env.local`, a `notes/` folder, or a second
checkout. Each new kind of project file is one more entry that somebody must remember. The list was
also duplicated, with three different sets of contents, across the build, the watch of the dev
server, and the discovery of lint, fmt and test.

There was a related problem. A deployment under a sub-path, such as `example.com/my-app/`, needs
every URL that the build emits to carry that prefix. The router already had a concept for this,
which is the `IMP_BASEPATH` environment value. But the build ignored it. So the assets and the PWA
manifest pointed at the domain root.

## Decision

**`public/` is the root of the built site, and it is the only thing that imp copies into the
output.** imp copies its contents, and removes the folder name. So `public/assets/logo.png` ships as
`assets/logo.png`, and it answers at `/assets/logo.png`. The folder is optional, and its name is
fixed. There is no key in `imp.json` to rename it. A second name for the same concept buys nothing,
and every project that reads a config gains a case to handle.

These consequences follow from a list of what to include:

- **The build holds no exclusion list.** Module sources, `imp.json`, an environment file, the mocks
  folder, `.git`, `node_modules` and `.imp` are all excluded, because they are not in `public/`. imp
  does not read the esbuild metafile for this purpose.
- **The entry HTML stays at the project root.** imp processes that file. It bundles the scripts,
  injects the environment values, and adds the PWA tags. `public/` passes through without a change.
  The two roles are different, so they live in different places.
- **A collision is an error.** A file in `public/` whose path matches a file that the build
  generates fails the build, and imp names the path. One file does not overwrite the other in
  silence.
- **`imp start` serves `public/` at the site root**, over the project root, which imp still serves
  so that a module source loads during development. So a URL that resolves in development also
  resolves in the built site.

**`IMP_BASEPATH` is the one setting for a deployment on a sub-path.** `imp build` reads it from the
resolved environment. It puts the base in front of every root-absolute URL that it emits. That
covers an `href`, a `src` and a `poster` attribute in the page, each candidate of a `srcset` and an
`imagesrcset`, the `content` of an `og:image` and a `twitter:image` meta tag, the PWA manifest, the
apple-touch icon, the registration of the service worker, and the `start_url`, the `scope` and the
icon `src` values of the manifest. It also covers the precache list and the shell of the service
worker. imp does not change a URL inside the body of a `<script>`, an external URL, a
protocol-relative URL, or a path that is already relative. The CLI normalizes the value exactly as
the router does. So one value drives the asset URLs and the matching of a route.

The PWA URLs are root-absolute, and not relative. A relative URL resolves against the current
document. So a deep link, such as `/todos/42`, resolved such a URL against the wrong directory. A
root-absolute URL with the base in front is correct from any route.

## Consequences

- **`imp init` scaffolds `public/` with a favicon in it**, see `project-scaffold.md`. So the layout
  is visible from the first minute of a project.
- **A file that belongs at the site root lives in `public/`.** Examples are `favicon.ico`,
  `robots.txt`, `404.html` and `_redirects`.
- **There is slightly more ceremony than a file beside the page.** In exchange, there is an explicit
  answer to the question of what ships, and a person can inspect it. The build also cannot publish a
  project file because somebody forgot to exclude it.
- **Development is more permissive than the build**, because imp still serves the project root for a
  module source. So an asset at the root loads under `imp start`, and it is absent from the built
  site. The listing per file that `imp build` prints shows exactly what shipped.
- **An asset that a stylesheet references must use a URL relative to the stylesheet.** Such a URL
  resolves against the location of the stylesheet, and it stays correct under any base path. The
  build rewrites an HTML attribute, and not CSS.
- **One shared skip list remains**, for the discovery of lint, fmt and test, and for the watch of
  the dev server. It covers `.git`, `node_modules`, `dist` and `.imp`. That list answers the
  question of which files imp must not read. It has no relation to what a build publishes.
