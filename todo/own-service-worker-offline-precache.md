# Offline precache for a project's own service worker

`imp build --pwa` writes an offline worker whose precache list is the exact build graph, see
`adr/pwa-toolkit.md`. A project that names its own `serviceWorker` in `imp.json` keeps its worker,
and gets no precache. The worker of the project would have to list the hashed files by hand, which
is what the build-graph precache exists to avoid.

## Decision

Export `precacheBuild()` from `imp/service-worker`. It takes no options.

- **It installs the same behaviour as the emitted offline worker.** That covers the precache, the
  navigation with the fallback to the app shell, the cache-first hashed assets, and the update
  lifecycle, see `todo/pwa-update-lifecycle.md`. A project worker that calls it behaves the same as
  the worker that imp writes.
- **`imp build --pwa` injects the precache list and the cache name** into the bundle of the project
  worker, the way it injects the environment values.
- **In development, the function does nothing.** The dev server caches nothing, so the fetch
  listener of `startDevMode()` always wins.

## ADR impact

Update `adr/service-worker-dev-mode.md` and `adr/pwa-toolkit.md` with the chosen call and its
limits.
