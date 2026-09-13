# build - the production build, and the PWA output

```
imp build [file.html|file.js] [--output dist] [--pwa] [--env <name>]
```

`imp build` writes plain static files that you upload to any host or CDN. The default output
directory is `dist/`, and imp **replaces it on every run**. The server needs no imp runtime, no
import map and no installation. The build resolves imports exactly as `imp start` does, and it works
offline. So what you tested is what you ship.

**The entry decides everything.** An HTML entry is a finished app. A JS entry is a module that other
developers program against. There is no configuration switch for this.

**imp drops unused code, and its own code as well.** An app carries only the subjects that it
imports, and only the standard components that it renders. An import of `button` does not pull in
`link`, or the router behind it. There is nothing to configure. Do not split an import by hand to
help the build.

## HTML entry - an app

- imp bundles and minifies every `<script type="module" src="...">` **to the same relative path**.
  So the HTML works without a change. imp bundles an inline module script and inlines it again.
- imp turns an `import()` into a separate hashed chunk under `chunks/` that loads on demand. It
  emits code that several entries share once.
- **`public/` is the only folder that imp copies**, and its contents arrive at the site root. See
  below.
- **imp removes all skill text.** It injects none, copies no `*.skill.md`, and removes any
  `impSkill` that arrives from a pre-built component. It does this in a lazy chunk as well as in the
  main bundle.

## The `public/` folder - static assets

`public/` holds the files that ship without a change. **Its contents are the root of the built
site.** The folder name never appears in a URL. `imp start` also serves the folder at the root. So
one path works in development and in production.

```
my-app/
  index.html            <- the entry page, at the project root (bundled, not copied)
  app.js                <- compiled into the bundle
  public/
    styles.css          -> /styles.css
    favicon.ico         -> /favicon.ico
    assets/logo.png     -> /assets/logo.png
```

```html
<link rel="stylesheet" href="/styles.css">
<img src="/assets/logo.png" alt="">
```

- **Keep the entry HTML at the project root**, never in `public/`. imp bundles the scripts of the
  entry, injects the environment values and adds the PWA tags. `public/` passes through. A page in
  `public/` fails the build, and the message points at it. `imp start` warns that it ignores the
  page.
- **Nothing else reaches the output.** imp does not copy `imp.json`, an environment file, the mocks
  folder or your sources. Your sources are already compiled in.
- **A collision is a build error**, not a silent overwrite. A `public/app.js` against a bundled
  `app.js` fails the build, and the message names the path.
- **The folder name is fixed.** There is no key to configure it. The folder is optional.
- Inside a stylesheet, write an asset URL relative to the stylesheet, as in `url(assets/logo.png)`.
  The URL then survives a base path.

## License notices - `LICENSES.txt`

imp writes `LICENSES.txt` at the root of the output directory, without a change. It merges two
sources:

| Source                                                                        | Covers                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `dependencies/<alias>/manifest.json` recorded by `imp install`                | SPDX id + license text of every bundled package |
| Legal comments in the bundled code (`/*! */`, `//!`, `@license`, `@preserve`) | Notices the source itself must carry            |

imp merges a duplicate inside each source. It does **not** compare the two sources against each
other, so a package can appear twice. Every emitted `.js` file starts with the line below. This
covers a bundle, a chunk, and an inline module script that imp inlines again into the page:

```js
/*! Third-party license notices: /LICENSES.txt */
```

Under `IMP_BASEPATH`, imp prefixes that reference like any other root-absolute URL. When neither
source gives a notice, imp emits no file and no comment. There is no configuration for this.

- Only a dependency that the build links contributes. imp drops a dependency that you declare but do
  not import, and that dependency contributes nothing.
- The build **fails** when a bundled package falls outside the `licenses` policy in `imp.json`. The
  default policy is `"permissive"`, see [dependencies](dependencies.md). imp emits nothing.
- A bundled dependency with no `manifest.json` gives a **warning**, and its licenses are absent from
  the file. Fix it with `imp install`. Never write the manifest by hand.
- `imp install` also leaves the notice of a package in the vendored bundle. Do not remove it by
  hand.

Do not confuse this file with `imp licenses`. That command prints the notices for the tools inside
the imp binary. None of those tools ship in an app. See [update](update.md).

## How to deploy under a sub-path

Set the `IMP_BASEPATH` environment value, see [config](config.md). `imp build` then prefixes every
root-absolute URL that it emits. This covers the `href="/styles.css"` of your page, the PWA
manifest, the icons, the worker and its precache list. imp leaves an external `https://...` URL, a
protocol-relative `//...` URL and a relative URL as they are. The router reads the same value, so
the assets and the navigation move together. See [routing](routing.md).

## JS entry - a component

- imp writes one self-contained file. It compiles in imp and every dependency. You can drop the file
  into any app, on any framework.
- imp folds a sibling `*.skill.md` in as an `export const impSkill`. So the manual travels with the
  component. Only the skill of the **entry module** survives. A barrel that re-exports several
  components loses their skills, because imp drops an ambiguous star export. So publish one entry
  per component, or describe every component in the skill of the barrel. See
  [components](components.md).
- **`targetImpHost: true`** in `imp.json`, see [config](config.md), leaves every `imp` and `imp/...`
  import **bare**. A host imp app then provides the library, and the page holds one shared copy of
  imp instead of two. The host must really provide it, through an import map or a bundler alias.
  Your component then runs on the imp version of the host, which can be newer than the version that
  you built against. When you are not sure, leave the key off and ship a self-contained file. imp
  ignores the key for an HTML entry, because a page is its own host.

## `--pwa` (page builds only)

`--pwa` needs a `pwa` block with at least `name` and `icon`. In one step imp does the following:

- **imp generates the icon set** from that one source. It writes a 192px icon, a 512px icon, a
  padded 512px maskable icon and a 180px apple-touch-icon. Prefer an SVG source. A raster source
  must be 512px or more on its longest edge. If it is smaller, the build warns about upscaling.
- **imp writes `manifest.webmanifest`** with the fields that a browser needs to offer installation.
- **imp writes an offline `sw.js`.** Its precache list is exactly the files of this build, derived
  from the build and not from a folder scan. imp also injects the manifest link, the theme-color
  meta tag, the apple-touch-icon link and the registration into `<head>`.

The caching defaults are fixed and you cannot configure them. The page and its deep links are
network-first, and fall back to the cached shell. A hashed asset is cache-first. imp never caches a
cross-origin response, a request that is not a `GET`, or an error response. A new deploy is a new
cache, so a user is never held on a stale version.

Without the flag, a PWA project still builds normally. In development, installability needs no flag.
But the **offline** worker comes only from `imp build --pwa`. See [start](start.md).

When `imp.json` names a `serviceWorker`, every page build bundles that source and writes it as
`sw.js`. With `--pwa`, imp registers that worker in the HTML and writes no offline worker. Offline
behaviour is then the job of your worker. See [service-worker](service-worker.md).

## Rules an agent gets wrong

- **Never edit a file in the output directory.** imp deletes and writes the directory again on every
  run.
- **Deploy `LICENSES.txt` with the rest of the output.** The licenses that produce the file forbid
  you to leave it out. It is not a build artifact that you can remove.
- **A static asset belongs in `public/`.** imp does not copy a stylesheet or an image that sits next
  to your sources, and it returns 404 in production, although `imp start` serves it. The dev server
  serves the whole project. The build ships `public/` and the bundles.
- **Do not run a build to test a change.** `imp start` serves the source with live reload. Build
  when you ship.
- **Preview a `--pwa` build on a different port from `imp start`.** Its offline worker has root
  scope. It stays registered and serves its cache to the dev server, which looks like stale content
  or a broken live reload. If this happens, unregister the worker and clear the site data in the
  developer tools of the browser.
- **A deep link returns 404 in production** unless the host serves the entry HTML for an unknown
  path. imp emits portable files and does not control the host. See [routing](routing.md) for the
  setting of each host.
- `--env` selects an environment, exactly as on `imp start`, see [config](config.md). A shell
  variable that is missing behind a `$env.` value stops the build. imp does not ship an app that is
  half configured.
- **imp resolves a feature flag here, not at runtime.** Every `flag('NAME')` becomes a literal. imp
  drops the dead branch, and the chunks that only that branch reached. The output holds no flag name
  and no value. The build prints `flags folded in - NAME off, ...`. An undeclared flag name, or a
  computed one, fails the build. See [feature-flags](feature-flags.md).
