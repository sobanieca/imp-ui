# PWA update lifecycle — decide between aggressive auto-update and wait-and-prompt

The service worker emitted by `imp build --pwa` (`buildServiceWorker` in `cli/src/pwa.js`) takes
control as eagerly as possible: it calls `self.skipWaiting()` in `install` and
`self.clients.claim()` in `activate`, and `activate` deletes every cache whose name is not the
current build's hash. A new build therefore becomes the controlling worker **mid-session**, and the
previous build's precache is purged the moment it activates.

This needs a deliberate decision, because it is a correctness edge, not a missing feature.

## The problem

`imp build` code-splits lazy-loaded modules into separate hashed chunks that load on demand (see
`adr/production-bundling.md`). If a deploy happens while a tab is open:

1. The new worker installs, `skipWaiting()`s, activates, and deletes the old cache.
2. The old build's chunks are now gone from the cache **and** replaced on the server by new hashes.
3. A user action in the still-running old page that triggers a lazy import requests an old chunk URL
   that 404s → a runtime chunk-load failure, with no reload to rescue it.

Network-first navigation only recovers this on the **next full navigation**, not for an in-flight
lazy load in the current session. For apps that never route-split this is harmless; for those that
do, it is a real failure.

## Options

- **Keep aggressive auto-update (status quo).** Simplest, always ships the newest code, but exposes
  the chunk-load race above. Acceptable only if paired with mitigation (below).
- **Wait-and-prompt.** The new worker installs but does **not** `skipWaiting()`; it stays `waiting`.
  The page detects the waiting worker and surfaces a "new version available — reload" affordance;
  `skipWaiting()` fires only on user confirm, so the swap happens at a controlled moment (a reload),
  never mid-session. This is the mature default in the ecosystem.
- **Hybrid.** Auto-update, but **retain the previous cache** for a grace window (don't delete old
  hashes on `activate` immediately) so in-flight old chunks still resolve, cleaning up on the next
  navigation instead. Keeps zero-touch updates while closing the race.

## Considerations

- imp's real-DOM model plus the fact that many imp apps won't route-split means the race is narrow —
  weigh how much lifecycle machinery is worth versus the opinionated-default philosophy of
  `adr/pwa-toolkit.md` ("not a strategy zoo").
- A wait-and-prompt flow needs a client-side hook (a small script injected alongside the SW
  registration in `pwaHeadTags`) and an app-visible signal — decide whether imp renders its own
  minimal prompt or exposes an event the app reacts to, mirroring the emit/subscribe stance
  elsewhere.
- Whichever is chosen, the offline-vs-live-reload split (dev telemetry worker vs. production offline
  worker) is unaffected — this is production-only.

## ADR impact

Update `adr/pwa-toolkit.md`: replace the "open item" note in _Scope and non-goals_ with the chosen
lifecycle, and document the update behavior (and any user-facing update prompt/event) in `docs/`.
