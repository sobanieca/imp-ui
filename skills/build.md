# build — the production build, and the PWA output

```
imp build [file.html|file.js] [--outdir dist] [--pwa] [--env <name>]
```

Writes plain static files (default `dist/`, **replaced on every run**) you upload to any host or CDN
— no imp runtime on the server, no import map, nothing to install. The same resolution as
`imp start`, fully offline: what you tested is what ships.

**The entry decides everything.** An HTML entry is a finished app; a JS entry is a module other
developers program against. There is no configuration switch for this.

## HTML entry — an app

- Every `<script type="module" src="…">` is bundled and minified **to the same relative path**, so
  the HTML works unchanged. Inline module scripts are bundled and re-inlined.
- `import()` becomes separate hashed chunks under `chunks/` that load on demand; code shared by
  several entries is emitted once.
- Files compiled into the bundles (your sources, vendored bundles) are omitted; **every other
  project file is copied verbatim** — stylesheets, images, fonts — so the output is the whole site.
- **All skill text is stripped**: none is injected, no `*.skill.md` is copied, and any `impSkill`
  arriving from a pre-built component is removed, in lazy chunks as much as in the main bundle.

## JS entry — a component

- One self-contained file with imp and every dependency compiled in, droppable into any app on any
  framework.
- A sibling `*.skill.md` is folded in as an `export const impSkill`, so the manual travels with the
  component. Only the **entry module's** skill survives — a barrel re-exporting several components
  loses theirs (ambiguous star exports are dropped), so publish one entry per component or describe
  them all in the barrel's own skill. See [components](components.md).
- **`targetImpHost: true`** in `imp.json` — see [config](config.md) — leaves every `imp` / `imp/…`
  import **bare** for a host imp app to provide, so the page holds one shared copy of imp instead of
  two. The host must actually provide it (an import map or bundler alias), and your component then
  runs on the host's imp version, which may be newer than the one you built against. When in doubt,
  leave it off and ship self-contained. It is ignored for an HTML entry — a page is its own host.

## `--pwa` (page builds only)

Requires a `pwa` block with at least `name` and `icon`. In one step imp:

- **generates the icon set** from that single source — 192px and 512px, a padded 512px maskable, and
  a 180px apple-touch-icon. SVG is preferred; a raster source should be ≥512px on its longest edge
  or the build warns about upscaling;
- **writes `manifest.webmanifest`** with the fields browsers require to offer installation;
- **writes an offline `sw.js`** whose precache list is exactly this build's files — derived from the
  build, not by scanning a folder — and injects the manifest link, theme-color meta,
  apple-touch-icon link and the registration into `<head>`.

Caching defaults, not configurable: the page and its deep links network-first falling back to the
cached shell, hashed assets cache-first, and cross-origin responses, non-`GET` requests and error
responses never cached. A new deploy is a new cache, so users are never pinned to a stale version.

Without the flag a PWA project still builds plainly, and in development installability needs no flag
at all — but the **offline** worker only ever comes from `imp build --pwa`. See [start](start.md).

## Rules an agent gets wrong

- **Never hand-edit anything in the output directory** — it is deleted and rewritten on every run.
- **Do not run a build to test a change.** `imp start` serves the source with live reload; build
  when you are shipping.
- **Preview a `--pwa` build on a different port than `imp start`**, or its root-scope offline worker
  lingers and serves its cache to the dev server — which looks like stale content or broken live
  reload. If it happens: unregister the worker and clear site data in the browser's dev tools.
- **A deep link 404s in production** unless the host serves the entry HTML for unknown paths. imp
  emits portable files and stays out of it; see [routing](routing.md) for the per-host setting.
- `--env` selects an environment, exactly as on `imp start` — see [config](config.md). A missing
  shell variable behind a `$env.` value stops the build rather than shipping a half-configured app.
