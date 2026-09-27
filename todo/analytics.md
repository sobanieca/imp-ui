# Analytics - emit events, forward to any store

Give imp a built-in seam for analytics, and let that seam work with any provider. imp, and the app,
**emit** an analytics event, through one central dispatcher. The user **reacts** to that event, and
forwards it to the analytics store of their choice. That store can be Google Analytics, PostHog,
Plausible, an internal endpoint, the `console`, or anything else. imp never bundles a specific
provider, and it knows about none. It owns the plumbing that emits, and that lets somebody
subscribe.

**The home for the import is `imp/analytics`.** The surface that emits and subscribes lands as its
own specifier, see `adr/library-import-namespaces.md`. So the analytics wiring of an app is visible
in its import lines.

## Why imp owns this

An app can attach analytics today, with raw DOM, through bubbling in real DOM, a `data-*` attribute,
and one delegated listener at the root. It can also attach analytics through a subscription to a
signal. But every app writes that wiring again. To centralize it gives three things:

- **One shape of an event**, which every sink receives. So to change a provider, or to send an event
  to several providers, is a change of one handler, and not an edit across the app.
- **One point of decoupling.** A component, and app code, emit an intent, as in `track('checkout')`.
  The binding to a concrete backend lives in exactly one place, and the user controls that place.
- **Automatic instrumentation** of an interaction with a standard component, and of a change of
  route. Nobody passes a callback through every component. That is the cross-cutting gain of
  `adr/real-dom-no-virtual-dom.md`.

## Pieces

- `track(name, props?)` emits an analytics event. It builds a plain record that somebody can
  serialize, which is `{ name, props, timestamp }`. It dispatches that record to every registered
  sink. It is pure and synchronous. You can call it anywhere, from the body of a component, from an
  event handler, and from an effect.
- `onAnalytics(handler)` registers a sink. That sink is `({ name, props, timestamp }) => void`. The
  call returns a function that unsubscribes. It also unsubscribes automatically when the calling
  scope disposes, through `onDispose` or `scopeSignal()`. **imp allows several sinks.** So an app
  can forward to several providers at once. This is the surface that reacts to an analytics event,
  and the forwarder of the user lives here:

  ```js
  onAnalytics(({ name, props }) => posthog.capture(name, props))
  onAnalytics(({ name, props }) =>
    fetch('/collect', { method: 'POST', body: JSON.stringify({ name, props }) })
  )
  ```

- imp reports a sink that throws, through the built-in logger, see `adr/built-in-logger.md`, and
  skips it. One bad forwarder must never break the dispatch to the others. Analytics must also never
  break the app.

## Automatic instrumentation, as a convention that you turn on

imp turns two things into a `track()` call, and no component takes a callback:

- **A tagged interaction, through `data-track`.** imp installs one delegated listener at `mount`. It
  turns a click on any element that carries `data-track="checkout"` into
  `track('checkout', { ...dataset })`. `...rest` passes an attribute straight through. So this works
  on every standard component, and on a raw element:

  ```js
  button({ 'data-track': 'signup' }, 'Sign up')
  card({ 'data-track': 'promo' }, ...)
  ```

  The delegation avoids the trap where two handlers share a name. A user `events: { input }` would
  otherwise override the binding of a component. The delegation also covers a node that `each` or
  `router` adds later.
- **A pageview.** Subscribe to the state of the route, through `useRoute()`, see
  `adr/client-side-router.md`. Emit `track('pageview', { path })` on a navigation. This is a choice
  that an app makes. So an app that does not want analytics for a route pays nothing.

Both are conveniences on top of the same core of `track` and `onAnalytics`. An app can ignore both,
and call `track()` by hand.

## An explicit emit, from a component and from app code

Beyond the convention of `data-track`, anything can emit directly:

```js
formBox({ events: { submit: () => track('lead_submitted', { plan: plan() }) } }, ...)
subscribe(query, (v) => track('search', { term: v }))   // state-change analytics
```

A standard component stays agnostic about a provider. It emits **nothing by default**. An event
fires only when the app opts a component in, with a `data-track` tag, or with an explicit `track()`
in a handler that the app passes. imp ships no fixed name of an event, beyond the `pageview`
convention.

## Agnostic about a provider, by construction

- imp bundles **no** analytics client, and imp itself makes **no** network call. The transport is
  entirely the job of the sink. That keeps the guarantees about offline work, and about a
  self-contained build. It also leaves the consent, the batching, the sampling and the policy about
  personal data to the handler of the user.
- The record of an event is plain data. So any sink can reshape it, for the SDK of its provider.

## Decisions

- **One global registry.** The sinks of `onAnalytics` live in one registry. They do not live in one
  registry per `mount` root. An app has one set of destinations. The cleanup of a scope removes a
  sink, and that keeps the tests of `imp test` isolated.
- **`data-track` fires on `click` by default.** The attribute `data-track-on` selects another event,
  as in `data-track-on="submit"` or `data-track-on="change"`. imp supports `click`, `submit` and
  `change` only.
- **The sink adds the context.** imp merges nothing into `props`. The record stays
  `{ name, props, timestamp }`. A sink that wants a session id or the current route adds it in one
  line. The docs show that line.
- **The handler owns the consent.** imp has no buffer for consent. The rules for consent differ per
  region and per provider. The docs show a short buffer in a handler.
- **The names are `track` and `onAnalytics`.** Plain functions match `onMount` and `onDispose`, and
  a bundler drops them when an app does not use them. The seam for an error, `onError`, and the seam
  for a log, `onLog`, use the same shape, see `todo/prod-ready.md`.

## Dependencies

This builds on the state layer that landed, and on its scoped cleanup, see
`adr/event-propagated-state.md`. That covers the cleanup of a sink in a scope, and an emit on a
change of a state. The automatic instrumentation of a pageview builds on the router, see
`adr/client-side-router.md`. A diagnostic goes through the built-in logger, see
`adr/built-in-logger.md`. The delegation of `data-track` is pure real DOM, and it needs none of
them.

## ADR impact

Write a new ADR, `provider-agnostic-analytics.md`. It says that imp owns the emit, through `track`,
and the subscribe, through `onAnalytics`. It says that an event is a plain record, and that imp
allows several sinks. It says that imp ships no client of a provider, and that imp makes no network
call. It says that imp offers the delegation of `data-track`, and a `pageview` event, as conventions
on top, which an app turns on. Update the table of ADRs. Document the model of emitting and
forwarding, the convention of `data-track`, and two examples of a sink, in `docs/`.
