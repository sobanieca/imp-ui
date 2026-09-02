# PWA update lifecycle - decide between aggressive auto-update and wait-and-prompt

The service worker that `imp build --pwa` emits is `buildServiceWorker`, in `cli/src/pwa.js`. It
takes control as early as it can. It calls `self.skipWaiting()` in `install`, and
`self.clients.claim()` in `activate`. `activate` also deletes every cache whose name is not the hash
of the current build. So a new build becomes the controlling worker **in the middle of a session**,
and imp removes the precache of the previous build the moment when the new worker activates.

Somebody must make a deliberate decision here. This is an edge of correctness, and not a missing
feature.

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

## Options

- **Keep the aggressive auto-update, which is the state today.** That is the simplest option, and it
  always ships the newest code. It exposes the race about a chunk load, above. It is acceptable only
  with a mitigation, described below.
- **Wait and prompt.** The new worker installs, and it does **not** call `skipWaiting()`. It stays
  in the `waiting` state. The page detects that worker, and offers a control that says "a new
  version is available, reload". imp then calls `skipWaiting()` only when the user confirms. So the
  swap happens at a controlled moment, which is a reload, and never in the middle of a session. That
  is the mature default in the ecosystem.
- **A hybrid.** imp updates automatically, and **keeps the previous cache** for a period of grace.
  It does not delete the old hashes on `activate` immediately. So an old chunk that is in flight
  still resolves. imp cleans up on the next navigation. That keeps an update that needs no action,
  and it closes the race.

## Considerations

- The model of imp uses real DOM, and many imp apps do not split by route. So the race is narrow.
  Weigh how much machinery for a lifecycle is worth that, against the philosophy of opinionated
  defaults in `adr/pwa-toolkit.md`, which says that imp is not a collection of strategies.
- A flow that waits and prompts needs a hook on the client, which is a small script that imp injects
  beside the registration of the service worker, in `pwaHeadTags`. It also needs a signal that the
  app can see. Decide whether imp renders its own small prompt, or exposes an event that the app
  reacts to. The second option mirrors the position of imp about emitting and subscribing,
  elsewhere.
- Whichever option somebody chooses, the split between offline behaviour and live reload does not
  change. That is the split between the telemetry worker in development, and the offline worker in
  production. This decision covers production only.

## ADR impact

Update `adr/pwa-toolkit.md`. Replace the note about an open item, in _Scope and non-goals_, with the
lifecycle that somebody chose. Document the behaviour of an update in `docs/`, with any prompt or
event that a user can see.
