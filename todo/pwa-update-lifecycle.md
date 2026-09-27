# PWA update lifecycle - automatic update with a grace cache

The service worker that `imp build --pwa` emits is `buildServiceWorker`, in `cli/src/pwa.js`. It
takes control as early as it can. It calls `self.skipWaiting()` in `install`, and
`self.clients.claim()` in `activate`. `activate` also deletes every cache whose name is not the hash
of the current build. So a new build becomes the controlling worker **in the middle of a session**,
and imp removes the precache of the previous build the moment when the new worker activates.

This is an edge of correctness, and not a missing feature. The decision is below.

## The problem

`imp build` splits a module that loads lazily into a separate hashed chunk, and that chunk loads on
demand. See `adr/production-bundling.md`. Suppose that a deploy happens while a tab is open:

1. The new worker installs, calls `skipWaiting()`, activates, and deletes the old cache.
2. The chunks of the old build are now gone from the cache. New hashes have also replaced them on
   the server.
3. An action of the user, in the page of the old build that still runs, triggers a lazy import. That
   import requests the URL of an old chunk, which returns 404. The chunk then fails to load, at
   runtime, and no reload rescues the session.

A navigation that is network-first recovers from this on the **next full navigation** only. It does
not recover a lazy load that is in flight in the current session. For an app that never splits by
route, this is harmless. For an app that does split, it is a real failure.

## Decision

**imp keeps the automatic update, and keeps the previous cache for a period of grace.** The new
worker still calls `skipWaiting()` and `clients.claim()`. On `activate`, it does not delete the
cache of the previous build. So a chunk of the old build that a running page requests still resolves
from that cache. On the next navigation request, the worker deletes every cache that is not the
current one or the previous one.

- **The app does nothing.** There is no prompt, no event and no script on the client. The update
  needs no action from a person.
- **Only one previous build stays.** Two deploys during one open session can still remove a chunk of
  the first build. That case is rare, and imp accepts it.
- **A wait and a prompt were not chosen.** They need a script on the client and a signal for the
  app, for a race that is narrow. Many imp apps do not split by route. `adr/pwa-toolkit.md` says
  that imp ships opinionated defaults, and not a collection of strategies.
- **The split between development and production does not change.** The telemetry worker runs in
  development, and the offline worker runs in production. This decision covers production only.
- **A project worker that calls `precacheBuild()` gets the same lifecycle**, see
  `todo/own-service-worker-offline-precache.md`.

## ADR impact

Update `adr/pwa-toolkit.md`. Replace the note about an open item, in _Scope and non-goals_, with the
lifecycle that somebody chose. Document the behaviour of an update in `docs/`.
