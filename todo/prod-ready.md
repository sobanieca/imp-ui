# Production readiness - what still blocks a serious app shipping on imp

## Context

imp is designed and tested from the side of the author, through `imp start`, `imp test` and
`imp preview`. It is thin on the side of the deploy, where a build becomes an artifact that somebody
else operates, audits and debugs. This file lists the gaps on that side.

Each item names the gap, says why it blocks production, and gives the decision. The tiers are in the
rough order in which the gaps must close. When an item is implemented, delete it from this file, and
record its decision as an ADR. When the last item goes, delete the file.

Somebody verified this against the code again on 2026-09-23. Every item below was still open at that
date.

## Tier 3 - how to operate the app after it is live

- **Errors in production reach the app through analytics. imp adds no second seam for them.**
  `imp build` writes no source map, see `adr/production-bundling.md`. So a stack trace from
  production points into minified code, and nobody can read it. A failure is identified by its
  message and its context: the page, the view and the source. The `error` record of
  `todo/analytics.md` carries exactly that. It covers an uncaught error, an unhandled rejection, an
  error boundary, a failed `imp/http` request, and a state subscriber that throws. An `onError` seam
  would deliver the same errors a second time, with only an unreadable stack in addition.
  **Decision:** imp has no `onError`. `todo/analytics.md` owns the error reporting. An app that
  wants only its errors registers a sink that forwards the `error` records.
- **Logs from the browser stay in the console. imp adds no log sink.** The CLI has `addLogSink`, in
  `cli/src/logger.js`, and the library has no counterpart. The question that production asks is
  "what breaks, where, and how often?". The `error` records and the `broken` number of the analytics
  report answer it. A stream of log lines needs storage, a volume limit and rules for personal data.
  Those are the job of the provider of the app, not of imp. **Decision:** imp has no `onLog`. A team
  that needs a stream of logs uses the SDK of its provider directly.
- **There is no page about a deployment.** The docs stop at `imp build`. There is nothing about the
  cache headers, the CSP, the update of a PWA, or where the errors of a live app go. **Decision:**
  write `docs/deploy.md` after the items of tier 2 land, because it documents their output. The page
  gives these rules for the host:
  - `Cache-Control: no-cache` for each HTML file, so every load checks for a new deploy.
  - `Cache-Control: public, max-age=31536000, immutable` for every other file. After the hash on an
    entry file lands, every file that is not HTML has a hash in its name. So the rule has no special
    case, and a wrong header cannot serve a stale entry after a deploy.
  - The baseline CSP of the CSP item, as a header that the host sends.
  - The update of a PWA, and the error reporting through a sink that forwards the `error` records,
    with a link to the analytics page.

  Add the same rules to `skills/build.md`.

## Tracked in other items

One gap blocks production too, but it has its own file:

- **No automatic check catches an accessibility regression at the level of the app**, such as a
  missing label in app code or the contrast of a custom theme, see `todo/accessibility.md`.

## The suggested order

1. Do the CSP, the hash on an entry file and the external `env.js` first. They change what every
   deploy ships.
2. Write the deploy page, after tier 2 lands.

The error reporting lands with `todo/analytics.md`, and not in this order.

## ADR impact

The CSP, with no inline script and the hashed entry files, goes into `adr/production-bundling.md`
when that item lands, and not before.
