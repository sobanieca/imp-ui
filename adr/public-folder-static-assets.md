# Static assets ship from a `public/` folder

## Context

`imp build` emits a complete deployable site, not just a JavaScript bundle: whatever the bundler
does not compile still has to reach the output directory, because a page needs its stylesheets,
images and fonts alongside the built code.

The first implementation had no designated asset folder. The project root _was_ the static root, so
the build mirrored the whole root into the output and subtracted what should not ship: a hardcoded
list of directories (`.git`, `node_modules`, `.imp`), a hardcoded list of root files (`imp.json`,
`imp.lock`), the bundler's own inputs derived from the esbuild metafile, the configured environment
files, and the mocks folder.

That is a denylist, and it fails in the unsafe direction. Anything nobody thought to exclude is
published - a stray `.env.local`, a `notes/` folder, a second checkout - and each new kind of
project file is one more entry somebody has to remember. The list was also duplicated, with three
different sets of contents, across build, dev-server watching, and lint/fmt/test discovery.

A related problem: a deployment under a sub-path (`example.com/my-app/`) needs every URL the build
emits to carry that prefix. The router already had a concept for this, the `IMP_BASEPATH`
environment value, but the build ignored it, so assets and the PWA manifest pointed at the domain
root.

## Decision

**`public/` is the root of the built site, and the only thing copied into it.** Its contents are
copied with the folder name stripped, so `public/assets/logo.png` ships as `assets/logo.png` and is
served at `/assets/logo.png`. The folder is optional, and its name is fixed - there is no key in
`imp.json` to rename it, because a second name for the same concept buys nothing and every project
that reads a config gains a case to handle.

Consequences of making this an allowlist:

- **No exclusion lists in the build at all.** Module sources, `imp.json`, environment files, the
  mocks folder, `.git`, `node_modules` and `.imp` are excluded by not being in `public/`, so the
  esbuild metafile is no longer consulted for this purpose and the hardcoded sets are gone.
- **The entry HTML stays at the project root.** imp processes that file - bundling its scripts,
  injecting environment values and PWA tags - whereas `public/` is verbatim passthrough. The two
  roles are distinct, so they live in different places.
- **A collision is an error.** A file in `public/` whose path matches something the build generates
  fails the build naming the path, rather than one silently overwriting the other.
- **`imp start` serves `public/` at the site root**, layered over the project root, which is still
  served so module sources load during development. A URL that resolves in development therefore
  resolves in the built site.

**`IMP_BASEPATH` is the one setting for a sub-path deployment.** `imp build` reads it from the
resolved environment and prefixes the root-absolute URLs it emits: `href`/`src` attributes in the
page, the PWA manifest, apple-touch icon and service worker registration, and the manifest's
`start_url`, `scope`, icon `src`s plus the service worker's precache list and shell. URLs inside
`<script>` bodies, external URLs, protocol-relative URLs and already-relative paths are untouched.
The CLI normalizes the value exactly as the router does, so one value drives both asset URLs and
route matching.

PWA URLs became root-absolute rather than relative as part of this. Relative URLs resolve against
the current document, so a deep link (`/todos/42`) resolved them against the wrong directory; a
base-prefixed root-absolute URL is correct from any route.

## Consequences

- **Breaking for existing projects.** Assets at the project root are no longer published and must
  move into `public/`. Taken deliberately while imp is pre-1.0; `imp init` scaffolds `public/` with
  a favicon in it (`project-scaffold.md`), so the layout is visible from a project's first minute.
- **Site-root files live in `public/`** - `favicon.ico`, `robots.txt`, `404.html`, `_redirects`.
- **Slightly more ceremony than dropping a file next to the page**, in exchange for an explicit,
  inspectable answer to what ships and a build that cannot leak a project file by omission.
- **Development is more permissive than the build**, because the project root stays served for
  module sources. A root-level asset therefore loads in `imp start` and is absent from the built
  site; the per-file listing `imp build` prints is what shows exactly what shipped.
- **Assets referenced from a stylesheet should use stylesheet-relative URLs**, which resolve against
  the stylesheet's own location and stay correct under any base path; the build rewrites HTML
  attributes, not CSS.
- **One shared skip list remains**, for lint/fmt/test discovery and dev-server watching, covering
  `.git`, `node_modules`, `dist` and `.imp`. That is a "files imp should not read" concern,
  unrelated to what a build publishes.
