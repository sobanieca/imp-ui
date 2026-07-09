# PWA toolkit — manifest, icons, and a build-graph service worker behind `imp build --pwa`

## Context

Shipping an imp app as an installable, offline-capable Progressive Web App needs three artifacts: a
web app manifest, an icon set at the sizes browsers and platforms require, and a service worker that
serves the app offline. The manifest and icons are table stakes — templating plus image scaling. The
service worker is where PWAs actually break: "works offline" is a set of correctness problems that
are invisible in development and only bite a real user who is offline, on a flaky network, or
opening the app the day after a deploy. A precache list that misses a chunk fails silently; a naive
"cache the HTML" worker pins users to a stale build forever.

General-purpose tools (Workbox, `vite-plugin-pwa`) glob the output directory and re-hash files after
the bundler has run, because they are decoupled from it. imp is not: `imp build`
(`production-bundling.md`) owns the module graph and already knows the exact set of files it wrote,
with their content hashes, from the esbuild metafile and its own emitted-file list. That is a
structural advantage for building a correct precache list — the reason PWA support earns real effort
here rather than being a thin manifest generator.

Icon scaling is the one piece that is not string generation, and `in-process-toolchain.md` forbids
spawning a subprocess — so shelling out to ImageMagick/sharp (how `vite-plugin-pwa`'s asset
generator works) is not open to imp.

## Decision

PWA support rides on the production build behind a single `--pwa` flag —
`imp build [entry] [--outdir
dist] [--pwa]` — with no dedicated command and no subcommands. A `pwa`
block in `imp.json` (`name` + `icon` required; optional `shortName`, `themeColor`,
`backgroundColor`, `display`, `startUrl`, `scope`) describes the app once; `--pwa` is the per-build
trigger, so a PWA project still makes a plain build with a bare `imp build`. `--pwa` is rejected
with a clear message when there is no `pwa` block or on a JS-component entry, where a PWA is
meaningless.

With `--pwa` on an HTML entry, the build additionally:

- **Scales one source icon** (`.svg` or `.png`) to the full set — 192 and 512 app icons, a 512
  maskable icon inset to a safe zone over an opaque background, and a 180 apple-touch-icon —
  regenerated every build. Scaling runs **in-process** via the vendored `@resvg/resvg-wasm`
  rasterizer, pinned by `deno.lock` and baked into the binary like `esbuild-wasm`
  (`in-process-dependency-bundling.md`). Both formats go through one rasterizer: each icon is a
  small wrapper SVG that embeds the source as a data URI and controls target size, background, and
  inset — so a PNG source is scaled by resvg's raster handling, needing no second codec. This keeps
  the no-subprocess guarantee (`in-process-toolchain.md`) intact.
- **Writes `manifest.webmanifest`**, guaranteeing the installability set (name, 192 + 512 icons,
  display, start_url), and injects the manifest link, theme-color meta, apple-touch-icon link, and
  service-worker registration into the built HTML — the page ships install-ready with no source
  edits.
- **Writes an offline service worker (`sw.js`) whose precache list is derived from the build
  graph,** not globbed: exactly the files this build emitted (hashed scripts, chunks, assets) plus
  the HTML entry, manifest, and icons. The cache name is keyed to a content hash of that list, so
  each deploy is a new cache that the worker reconciles on `activate` (fetch what changed, delete
  what's gone) — deploys are never stuck stale. The caching strategy is a small opinionated default,
  not a configurable strategy zoo: navigations are network-first with a cached-app-shell fallback
  (deep links work offline), precached assets are cache-first, and cross-origin/opaque responses,
  non-`GET` requests, and error responses are never cached.

Installability in development is automatic and needs no flag: when a `pwa` block is present,
`imp start` injects the manifest/theme-color/apple-touch-icon tags and serves a generated manifest
and icons on the fly (`buildHeadInjection`), mirroring how the import map is auto-injected. The
**offline** service worker stays production-only: in development the dev telemetry service worker at
`/@imp/sw.js` keeps its slot (it reports network activity and does no caching), so development keeps
live reload and telemetry while production gets offline.

## Consequences

- The precache list is complete and correct by construction — imp's ownership of the build graph is
  the feature, and it needs no directory globbing or post-build re-hashing.
- Offline is a production-build property only; `imp start` never runs a caching worker that would
  fight live reload. The dev-vs-production service-worker split is deliberate and documented.
- One source image is the entire icon input; there is no hand-maintained icon set. An SVG source
  scales cleanly to any size; a PNG source is scaled by resvg and is best supplied at or above the
  largest target (512) to avoid upscaling blur.
- `@resvg/resvg-wasm` adds a vendored wasm rasterizer to the binary, pinned by the lockfile like the
  other in-process wasm engines; icon generation shells out to nothing.
- `imp.json` gains a validated `pwa` block alongside `dependencies`/`fmt`/`lint`/`test`
  (`cli/src/config.js`); Deno remains an implementation detail — users only ever edit `imp.json`.

## Scope and non-goals

"PWA" in the wider ecosystem spans far more than what `--pwa` emits. This section fixes the boundary
so the decision is not mistaken for "offline is fully solved."

What the emitted worker **does** cover: the precached app-shell model — an install-time precache of
the exact build graph, a content-hashed cache name reconciled on `activate`, network-first
navigations with a cached-shell fallback, and cache-first for hashed same-origin assets.

What is **deliberately out of scope**, and stays out unless a concrete user need argues otherwise:

- **A configurable strategy zoo.** No per-route or per-request-type strategy selection
  (stale-while-revalidate, runtime caching with expiry/max-entries, cache-only, network-only). imp
  ships one opinionated set of strategies, not a policy engine — the same reasoning as bundling the
  build graph rather than exposing esbuild config.
- **Dynamic/runtime data caching.** Requests the build did not emit (API calls, runtime-fetched
  images) pass through to the network uncached. Caching mutable data is an app concern with its own
  freshness and eviction policy, not something a build flag can decide correctly.
- **App-feature capabilities that require app code**, not a build artifact: Background Sync, Push
  notifications, Periodic Background Sync, Web Share Target, file/protocol handlers. `--pwa`
  generates infrastructure; these are behaviors the app author must author.
- **A richer manifest** beyond the installability set — `shortcuts`, `share_target`,
  `display_override`, `screenshots`, etc. The manifest guarantees installability, nothing more.

Two items are **open**, tracked in `todo/` because they are correctness questions rather than
missing conveniences: the service-worker **update lifecycle** (the emitted worker calls
`skipWaiting()` / `clients.claim()` and purges the old cache immediately, which can pull code-split
chunks out from under a live session mid-deploy — see `todo/pwa-update-lifecycle.md`) and an
**offline fallback page** for uncached navigations instead of always falling back to the app shell
(see `todo/pwa-offline-fallback.md`).
