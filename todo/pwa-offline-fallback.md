# PWA offline fallback page - a branded offline page for uncached navigations

The service worker that `imp build --pwa` emits is `buildServiceWorker`, in `cli/src/pwa.js`. When
the network is not available, and the requested navigation is not in the cache, that worker falls
back to the cached app shell, which is `SHELL`. That is the correct behaviour for an SPA with an app
shell, where the shell can render any route. It is wrong for a multi-page app, and for any deep link
that the shell cannot render offline. The user then gets the chrome of the shell around nothing, or
a broken page, in place of an honest screen that says "you are offline".

## Proposal

Precache a document that is the offline fallback. Serve it when a `navigate` request cannot be
satisfied from the network **or** from the cache. Serve it in place of the app shell, or beside it.
That is cheap to build, and it has high value. It also fits the spirit of opinionated defaults, in
`adr/pwa-toolkit.md`.

## Pieces

- **A default fallback page**, which the build generates. So every app with `--pwa` gets one, with
  no work. imp brands it from the existing `pwa` block, through `name`, `themeColor`,
  `backgroundColor` and the icon. So it matches the app, and the author writes nothing.
- **An optional override.** A `pwa.offline` path in `imp.json` points at the HTML of the author.
  When that path is present, imp precaches it in place of the default page.
- **The wiring in the fetch handler.** On a `navigate` request, try the network, then the cache,
  which holds the shell and a deep link, then the offline fallback, in that order. So a cached deep
  link still wins, and the fallback is the last resort.

## Open questions

- Does the fallback replace the fallback to the app shell completely? Or does imp use it only when
  there is no cached match for the shell? That interacts with the style of the app. An SPA renders
  everything from the shell, and a multi-page app does not.
- Does imp precache one offline page, or does it allow a fallback per scope? One page is probably
  the correct answer, and a fallback per scope is probably out of scope.
- What is the budget for the assets? The fallback must be self-contained, with inline CSS and an
  embedded icon. So it never depends on another cached asset, which can be missing.

## ADR impact

Update `adr/pwa-toolkit.md`. Fold this item into the _Scope and non-goals_ section, and remove it
from the open items. Note the new `pwa.offline` option, when imp adopts it. Document the offline
fallback in `docs/`.
