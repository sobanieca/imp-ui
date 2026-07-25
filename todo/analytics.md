# Analytics — emit events, forward to any store

Give imp a built-in, provider-agnostic analytics seam: imp (and the app) **emit** analytics events
through one central dispatcher, and the user **reacts** to them and forwards each event to the
analytics store of their choice — Google Analytics, PostHog, Plausible, an internal endpoint,
`console`, whatever. imp never bundles or knows about any specific analytics provider; it only owns
the emit-and-subscribe plumbing.

**Import home: `imp/analytics`.** The emit-and-subscribe surface lands as its own specifier
(`adr/library-import-namespaces.md`), so an app's analytics wiring is visible in its import lines.

## Why imp owns this

Attaching analytics is possible today with raw DOM (real-DOM bubbling + `data-*` + a root delegated
listener) and with signal subscriptions, but every app re-invents the wiring. Centralizing it gives:

- **One event shape** every sink receives, so switching or fanning out to multiple providers is a
  handler swap, not an app-wide edit.
- **A single decoupling point.** Components and app code emit intent (`track('checkout')`); the
  binding to a concrete backend lives in exactly one place the user controls.
- **Automatic instrumentation** of stdlib interactions and route changes without threading callbacks
  through every component (the cross-cutting win of `adr/real-dom-no-virtual-dom.md`).

## Pieces

- `track(name, props?)` — emit an analytics event. Builds a plain, serializable record
  (`{ name, props, timestamp }`) and dispatches it to every registered sink. Pure and synchronous;
  callable from anywhere (component body, event handler, effect).
- `onAnalytics(handler)` — register a sink `({ name, props, timestamp }) => void`; returns an
  unsubscribe function and auto-unsubscribes when the calling scope disposes (via `onDispose` /
  `scopeSignal()`). **Multiple sinks are allowed** so an app can forward to several providers at
  once. This is the "react on analytics event" surface — the user's forwarder lives here:

  ```js
  onAnalytics(({ name, props }) => posthog.capture(name, props))
  onAnalytics(({ name, props }) =>
    fetch('/collect', { method: 'POST', body: JSON.stringify({ name, props }) })
  )
  ```

- A sink that throws is reported through the built-in logger (`todo/logger.md`) and skipped — one
  bad forwarder must never break dispatch to the others, and analytics must never crash the app.

## Automatic instrumentation (convention, opt-in)

imp turns two things into `track()` calls with no per-component callbacks:

- **Tagged interactions via `data-track`.** A single delegated listener installed at `mount` turns a
  click on any element carrying `data-track="checkout"` into `track('checkout', { ...dataset })`.
  Because `...rest` passes attributes straight through, this works on every stdlib component and raw
  element alike:

  ```js
  button({ 'data-track': 'signup' }, 'Sign up')
  card({ 'data-track': 'promo' }, ...)
  ```

  Delegation sidesteps the `events` same-name-clobber gotcha (a user `events: { input }` would
  otherwise override a component's own binding) and covers nodes added later by `each`/`router`.
- **Pageviews.** Subscribe to the route state via `useRoute()` (`adr/client-side-router.md`) and
  emit `track('pageview', { path })` on navigation. Opt-in so apps that don't want route analytics
  pay nothing.

Both are conveniences layered on the same `track`/`onAnalytics` core — an app can ignore them and
call `track()` by hand.

## Explicit emit from components and app code

Beyond the `data-track` convention, anything can emit directly:

```js
formBox({ events: { submit: () => track('lead_submitted', { plan: plan() }) } }, ...)
subscribe(query, (v) => track('search', { term: v }))   // state-change analytics
```

Stdlib components stay provider-agnostic: they emit **nothing by default**, and only when the app
opts a component in (a `data-track` tag or an explicit `track()` in a passed handler) does an event
fire. imp ships no hard-coded event names beyond the `pageview` convention.

## Provider-agnostic by construction

- imp bundles **no** analytics client and makes **no** network calls itself — transport is entirely
  the sink's job. This keeps the offline/self-contained guarantees intact and leaves consent,
  batching, sampling, and PII policy to the user's handler.
- The event record is plain data so any sink can reshape it for its provider's SDK.

## Open questions

- **Global vs. mount-scoped registry.** Whether `onAnalytics` sinks live in one module-global
  registry or per-`mount` root (matters for multi-root pages and `imp test` isolation).
- **Event beyond click.** Whether `data-track` auto-instrumentation covers only `click` or also
  `submit`/`change`/`focus`, and how the event type is encoded (`data-track-on`?).
- **Enrichment / context.** Whether to support a shared context layer (session id, current route)
  merged into every event's `props`, or leave enrichment to the sink.
- **Consent gating.** Whether imp offers a built-in "hold events until consent granted" buffer or
  leaves it entirely to the handler.
- **Naming.** `track` / `onAnalytics` vs. an `analytics.emit` / `analytics.on` object surface.

## Dependencies

Builds on the landed state layer and its scoped cleanup (`adr/event-propagated-state.md`) for scoped
sink cleanup and for state-change emits; pageview auto-instrumentation builds on the router
(`adr/client-side-router.md`); diagnostics route through the built-in logger (`todo/logger.md`). The
`data-track` delegation is pure real DOM and needs none of them.

## ADR impact

New ADR `provider-agnostic-analytics.md`: imp owns emit (`track`) and subscribe (`onAnalytics`) with
a plain event record and multiple sinks, ships no provider client and makes no network calls, and
offers `data-track` delegation + `pageview` as opt-in conventions on top. Update the ADR table and
document the emit/forward model, the `data-track` convention, and a couple of sink examples in
`docs/`.
