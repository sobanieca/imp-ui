# build - the production build, and the PWA output

```
imp build [file.html|file.js] [--output dist] [--pwa] [--env <name>]
```

Writes plain static files (default `dist/`, **replaced on every run**) you upload to any host or
CDN - no imp runtime on the server, no import map, nothing to install. The same resolution as
`imp start`, fully offline: what you tested is what ships.

**The entry decides everything.** An HTML entry is a finished app; a JS entry is a module other
developers program against. There is no configuration switch for this.

**Unused code is dropped, imp's included.** An app carries only the subjects it imports and only the
standard components it renders - importing `button` does not pull in `link` or the router behind it.
Nothing to configure; do not hand-split imports to "help" it.

## HTML entry - an app

- Every `<script type="module" src="...">` is bundled and minified **to the same relative path**, so
  the HTML works unchanged. Inline module scripts are bundled and re-inlined.
- `import()` becomes separate hashed chunks under `chunks/` that load on demand; code shared by
  several entries is emitted once.
- **`public/` is the only folder copied**, and its contents land at the site root - see below.
- **All skill text is stripped**: none is injected, no `*.skill.md` is copied, and any `impSkill`
  arriving from a pre-built component is removed, in lazy chunks as much as in the main bundle.

## The `public/` folder - static assets

`public/` holds the files that ship verbatim, and **its contents are the root of the built site**;
the folder name never appears in a URL. `imp start` serves it at the root too, so one path works in
development and production.

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

- **The entry HTML stays at the project root**, never in `public/`: imp bundles its scripts, injects
  environment values and adds PWA tags, while `public/` is passthrough. A page found in `public/`
  fails the build with a message pointing at it, and `imp start` warns that it is ignored.
- **Nothing else reaches the output.** Not `imp.json`, not environment files, not the mocks folder,
  not your sources - they are already compiled in.
- **A collision is a build error**, not a silent overwrite: a `public/app.js` against a bundled
  `app.js` fails and names the path.
- **The name is fixed** - there is no key to configure it - and the folder is optional.
- Inside a stylesheet, write asset URLs relative to the stylesheet (`url(assets/logo.png)`) so they
  survive a base path.

## License notices - `LICENSES.txt`

`LICENSES.txt` is written verbatim at the root of the output directory from two merged sources:

| Source                                                                        | Covers                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `dependencies/<alias>/manifest.json` recorded by `imp install`                | SPDX id + license text of every bundled package |
| Legal comments in the bundled code (`/*! */`, `//!`, `@license`, `@preserve`) | Notices the source itself must carry            |

Duplicates within each source are merged; the two sources are **not** deduplicated against each
other, so a package may appear twice. Every emitted `.js` file - bundles, chunks, and inline module
scripts re-inlined into the page - opens with:

```js
/*! Third-party license notices: /LICENSES.txt */
```

Under `IMP_BASEPATH` that reference is prefixed like any other root-absolute URL. If neither source
yields a notice, no file and no comment are emitted. Nothing configures this.

- Only dependencies the build actually linked contribute - a declared but unimported one is dropped
  and contributes nothing.
- The build **fails** if a bundled package falls outside the `licenses` policy in `imp.json`
  (default `"permissive"`) - see [dependencies](dependencies.md). Nothing is emitted.
- A bundled dependency with no `manifest.json` **warns** and its licenses are missing from the file.
  Fix it with `imp install`, never by hand-writing the manifest.
- `imp install` also leaves a package's notice in the vendored bundle. Do not strip it by hand.

Not to be confused with `imp licenses`, which prints the notices for the tools inside the imp
binary, none of which ship in an app. See [update](update.md).

## Deploying under a sub-path

Set the `IMP_BASEPATH` environment value - see [config](config.md) - and `imp build` prefixes every
root-absolute URL it emits: your page's `href="/styles.css"`, the PWA manifest, icons, worker and
its precache list. External (`https://...`), protocol-relative (`//...`) and already-relative URLs
are left alone. The router reads the same value, so assets and navigation move together; see
[routing](routing.md).

## JS entry - a component

- One self-contained file with imp and every dependency compiled in, droppable into any app on any
  framework.
- A sibling `*.skill.md` is folded in as an `export const impSkill`, so the manual travels with the
  component. Only the **entry module's** skill survives - a barrel re-exporting several components
  loses theirs (ambiguous star exports are dropped), so publish one entry per component or describe
  them all in the barrel's own skill. See [components](components.md).
- **`targetImpHost: true`** in `imp.json` - see [config](config.md) - leaves every `imp` / `imp/...`
  import **bare** for a host imp app to provide, so the page holds one shared copy of imp instead of
  two. The host must actually provide it (an import map or bundler alias), and your component then
  runs on the host's imp version, which may be newer than the one you built against. When in doubt,
  leave it off and ship self-contained. It is ignored for an HTML entry - a page is its own host.

## `--pwa` (page builds only)

Requires a `pwa` block with at least `name` and `icon`. In one step imp:

- **generates the icon set** from that single source - 192px and 512px, a padded 512px maskable, and
  a 180px apple-touch-icon. SVG is preferred; a raster source should be >=512px on its longest edge
  or the build warns about upscaling;
- **writes `manifest.webmanifest`** with the fields browsers require to offer installation;
- **writes an offline `sw.js`** whose precache list is exactly this build's files - derived from the
  build, not by scanning a folder - and injects the manifest link, theme-color meta,
  apple-touch-icon link and the registration into `<head>`.

Caching defaults, not configurable: the page and its deep links network-first falling back to the
cached shell, hashed assets cache-first, and cross-origin responses, non-`GET` requests and error
responses never cached. A new deploy is a new cache, so users are never pinned to a stale version.

Without the flag a PWA project still builds plainly, and in development installability needs no flag
at all - but the **offline** worker only ever comes from `imp build --pwa`. See [start](start.md).

## Rules an agent gets wrong

- **Never hand-edit anything in the output directory** - it is deleted and rewritten on every run.
- **Deploy `LICENSES.txt` with the rest of the output.** Dropping it is what the licenses that
  produced it forbid; it is not a build artifact you can prune.
- **A static asset belongs in `public/`.** A stylesheet or image sitting next to your sources is not
  copied and 404s in production, even though `imp start` serves it - the dev server serves the whole
  project, the build ships `public/` and the bundles.
- **Do not run a build to test a change.** `imp start` serves the source with live reload; build
  when you are shipping.
- **Preview a `--pwa` build on a different port than `imp start`**, or its root-scope offline worker
  lingers and serves its cache to the dev server - which looks like stale content or broken live
  reload. If it happens: unregister the worker and clear site data in the browser's dev tools.
- **A deep link 404s in production** unless the host serves the entry HTML for unknown paths. imp
  emits portable files and stays out of it; see [routing](routing.md) for the per-host setting.
- `--env` selects an environment, exactly as on `imp start` - see [config](config.md). A missing
  shell variable behind a `$env.` value stops the build rather than shipping a half-configured app.
- **Feature flags are resolved here, not at runtime.** Every `flag('NAME')` becomes a literal and
  the dead branch - with the chunks only it reached - is dropped; the output holds no flag names or
  values. The build prints `flags folded in - NAME off, ...`. An undeclared or computed flag name
  fails the build. See [feature-flags](feature-flags.md).
