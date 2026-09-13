# PWA toolkit - manifest, icons, and a build-graph service worker behind `imp build --pwa`

## Context

To ship an imp app as a Progressive Web App that a person can install, and that works offline, needs
three artifacts. Those are a web app manifest, an icon set at the sizes that a browser and a
platform require, and a service worker that serves the app offline. The manifest and the icons are
the basic requirement, and they are templating plus the scaling of an image. The service worker is
where a PWA really breaks. "Works offline" is a set of problems of correctness that are invisible in
development. They only affect a real user who is offline, who is on an unreliable network, or who
opens the app the day after a deploy. A precache list that misses a chunk fails with no message. A
simple worker that caches the HTML holds a user on a stale build forever.

A general tool, such as Workbox or `vite-plugin-pwa`, globs the output directory and hashes the
files again after the bundler ran, because it is separate from the bundler. imp is not separate.
`imp build`, see `production-bundling.md`, owns the module graph. It already knows the exact set of
files that it wrote, with their content hashes, from the esbuild metafile and from its own list of
emitted files. That is a structural advantage for a correct precache list. It is the reason why PWA
support earns real effort here, in place of a thin generator of a manifest.

The scaling of an icon is the one piece that is not the generation of a string.
`in-process-toolchain.md` forbids a subprocess. So imp cannot call ImageMagick or sharp, which is
how the asset generator of `vite-plugin-pwa` works.

## Decision

PWA support rides on the production build, behind one `--pwa` flag. The command is
`imp build [entry] [--output dist] [--pwa]`. There is no command of its own, and there is no
subcommand. A `pwa` block in `imp.json` describes the app once. `name` and `icon` are necessary.
`shortName`, `themeColor`, `backgroundColor`, `display`, `startUrl` and `scope` are optional.
`--pwa` is the trigger per build. So a PWA project still makes a plain build with a bare
`imp build`. imp rejects `--pwa`, with a clear message, when there is no `pwa` block, and when the
entry is a JS component, where a PWA means nothing.

With `--pwa` on an HTML entry, the build also does the following:

- **imp scales one source icon**, which is a `.svg` or a `.png` file, to the full set. That set is a
  192 app icon, a 512 app icon, a 512 maskable icon that imp insets to a safe zone over an opaque
  background, and a 180 apple-touch-icon. imp generates them again on every build. The scaling runs
  **in process**, through the vendored `@resvg/resvg-wasm` rasterizer. `deno.lock` pins that
  rasterizer, and imp bakes it into the binary, like `esbuild-wasm`, see
  `in-process-dependency-bundling.md`. Both formats go through one rasterizer. Each icon is a small
  wrapper SVG. That SVG embeds the source as a data URI, and controls the target size, the
  background and the inset. So the raster handling of resvg scales a PNG source, and imp needs no
  second codec. This keeps the guarantee of no subprocess, see `in-process-toolchain.md`.
- **imp writes `manifest.webmanifest`.** It guarantees the set that installability needs, which is
  the name, the 192 and 512 icons, the display mode and the `start_url`. imp injects the manifest
  link, the theme-color meta tag, the apple-touch-icon link and the registration of the service
  worker into the built HTML. So the page ships ready to install, and nobody edits the source.
- **imp writes an offline service worker, `sw.js`, and derives its precache list from the build
  graph.** imp does not glob a directory. The list is exactly the files that this build emitted,
  which are the hashed scripts, the chunks and the assets, plus the HTML entry, the manifest, the
  icons and the copied files from `public/`. Every URL that imp emits is root-absolute, and it
  carries the `IMP_BASEPATH` prefix, see `public-folder-static-assets.md`. That covers the manifest
  link, the icon links, the registration, the `start_url`, the `scope`, a precache entry, and the
  shell. A relative URL would resolve against the current document, and it would break on a deep
  link. imp keys the name of the cache to a content hash of that list. So each deploy is a new
  cache, which the worker reconciles on `activate`. It fetches what changed, and deletes what is
  gone. So a deploy is never stuck on a stale version. The caching strategy is a small set of
  opinionated defaults, and not a collection of strategies to configure. A navigation is
  network-first, and falls back to the cached app shell, so a deep link works offline. A precached
  asset is cache-first. imp never caches a cross-origin or opaque response, a request that is not a
  `GET`, or an error response.

Installability in development is automatic, and it needs no flag. When a `pwa` block is present,
`imp start` injects the tags for the manifest, the theme colour and the apple-touch-icon. It also
generates and serves the manifest and the icons while it runs, in `buildHeadInjection`. That mirrors
the automatic injection of the import map. The **offline** service worker stays in production only.
In development, the dev service worker keeps its place, see `service-worker-dev-mode.md`. That
worker reports network activity, and it caches nothing. So development keeps live reload and
telemetry, and production gets the offline behaviour.

A project that names its own `serviceWorker` in `imp.json` keeps that worker. `imp build --pwa` then
writes the manifest and the icons, registers the worker of the project, and writes no offline
worker. Two workers cannot share `sw.js` and root scope. Offline behaviour is then the job of that
worker. `todo/own-service-worker-offline-precache.md` tracks a precache that imp could hand to it.

## Consequences

- The precache list is complete and correct by construction. The ownership of the build graph by imp
  is the feature. imp needs no glob over a directory, and no hash of a file after the build.
- Offline behaviour is a property of a production build only. `imp start` never runs a caching
  worker that would fight live reload. The split of the service worker, between development and
  production, is deliberate, and imp documents it.
- One source image is the whole input for the icons. Nobody maintains an icon set by hand. An SVG
  source scales cleanly to any size. resvg scales a PNG source, and you must supply that source at
  or above the largest target, which is 512, to avoid a blur from an upscale.
- `@resvg/resvg-wasm` adds a vendored wasm rasterizer to the binary. The lock file pins it, like the
  other wasm engines that run in process. The generation of an icon calls nothing outside the
  binary.
- `imp.json` gains a `pwa` block that imp validates, beside `dependencies`, `fmt`, `lint` and
  `test`, in `cli/src/config.js`. Deno stays an implementation detail. A user edits `imp.json` only.

## Scope and non-goals

The term "PWA" covers far more in the wider ecosystem than what `--pwa` emits. This section fixes
the boundary. So nobody reads the decision as "offline is fully solved".

The emitted worker **does** cover the model of a precached app shell. That is a precache of the
exact build graph at install, a cache name with a content hash that the worker reconciles on
`activate`, a navigation that is network-first with a fallback to the cached shell, and a
cache-first strategy for a hashed asset on the same origin.

These are **deliberately out of scope**, and they stay out until a concrete need from a user argues
otherwise:

- **A set of strategies to configure.** There is no selection of a strategy per route, or per kind
  of request. That covers stale-while-revalidate, caching at runtime with an expiry or a maximum
  number of entries, cache-only, and network-only. imp ships one opinionated set of strategies. It
  is not a policy engine. That is the same reasoning as the bundling of the build graph, in place of
  an exposed config for esbuild.
- **Caching of dynamic data at runtime.** A request that the build did not emit passes through to
  the network, and imp caches nothing. That covers an API call, and an image that the app fetches at
  runtime. To cache mutable data is a concern of the app. It has its own policy for freshness and
  for eviction, and a build flag cannot decide it correctly.
- **A capability of the app that needs app code, and not a build artifact.** That covers Background
  Sync, a push notification, Periodic Background Sync, a Web Share Target, and a handler for a file
  or a protocol. `--pwa` generates infrastructure. The author of the app writes these behaviours.
- **A richer manifest**, beyond the set that installability needs. That covers `shortcuts`,
  `share_target`, `display_override` and `screenshots`. The manifest guarantees installability, and
  nothing more.

Two items are **open**, and `todo/` tracks them, because they are questions of correctness, and not
missing conveniences. The first is the **update lifecycle of the service worker**. The emitted
worker calls `skipWaiting()` and `clients.claim()`, and removes the old cache immediately. That can
take a chunk from a split of the code away from a live session, in the middle of a deploy. See
`todo/pwa-update-lifecycle.md`. The second is an **offline fallback page**, for a navigation that
imp did not cache, in place of a fallback to the app shell every time. See
`todo/pwa-offline-fallback.md`.
