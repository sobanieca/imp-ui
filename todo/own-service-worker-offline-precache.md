# Offline precache for a project's own service worker

`imp build --pwa` writes an offline worker whose precache list is the exact build graph, see
`adr/pwa-toolkit.md`. A project that names its own `serviceWorker` in `imp.json` keeps its worker,
and gets no precache. The worker of the project would have to list the hashed files by hand, which
is what the build-graph precache exists to avoid.

## Proposal

Export a function from `imp/service-worker`, such as `precacheBuild()`, that installs the same
precache and the same fetch strategy as the emitted offline worker. `imp build --pwa` would inject
the precache list and the cache name into the bundle of the project worker, the way it injects the
environment values. In development the function would do nothing, because the dev server caches
nothing.

## Open questions

- Does the function take over navigation, or only the hashed assets? The emitted worker does both.
- How does the call interact with `startDevMode()` when both run? The dev fetch listener must win.

## ADR impact

Update `adr/service-worker-dev-mode.md` and `adr/pwa-toolkit.md` with the chosen call and its
limits.
