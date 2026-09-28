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

## Tier 1 - the supply chain, and compliance

This tier is the most likely to block a procurement, in place of being a preference.

- **Nothing consumes the recorded graph.** The manifest per dependency answers the question "which
  versions of what do I ship?", and only for a reader who opens it. There is no `imp audit`. There
  is no export of a software bill of materials, in a standard format for interchange, such as
  CycloneDX or SPDX. There is no path to scan for a vulnerability. Each one of those is a transform
  over data that is already committed in the repository. None of them is new plumbing. **Decision:**
  one command, `imp audit`, reads the manifests and checks every package against the OSV database,
  which needs no key. `imp audit --sbom` writes a CycloneDX file. imp does not write SPDX.

## Tier 2 - what `imp build` emits

- **Some hygiene for production is missing on the side of the build.** There is no `modulepreload`
  hint for a chunk that the entry will pull. There is no budget for the size of an app build. imp
  enforces a limit on the size of its own binary, through `binary-size-limit.json`, and it offers
  the author of an app no equivalent for `dist/`. The default log level of a built app is `info`, so
  a built app fills the console of every user. **Decision:**
  - The build always writes a `modulepreload` hint for each chunk that an entry imports statically.
  - A size budget for `dist/` goes into `imp.json`. `imp build` fails when the output is over it,
    the same way as the `licenses` gate.
  - The default log level of a built app is `warn`. `IMP_LOG_LEVEL` still sets another level.
  - imp does not add subresource integrity, because every script is same-origin and hashed.
  - imp does not compress in advance, because the host compresses.

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

## Tier 4 - the router, and the scope of an app

- **A malformed URL breaks the match of a route. It does not render `notFound`.**
  `decodeURIComponent(segment)`, in `matchMap` in `lib/src/app-map.js`, throws a `URIError` on bad
  percent encoding. An example is `/user/%zz`, which arrives from any external link. That surfaces
  as an error during the mount of a component, in place of the not-found page. There is a related
  problem. `Object.fromEntries(location.searchParams)` drops a repeated key of a query, and says
  nothing. **Decision:** a path with a malformed percent encoding renders `notFound`. `query` stays
  an object of plain strings, and the first value of a repeated key wins. The route also exposes the
  native `URLSearchParams` as `searchParams`, and an app reads a repeated key with `getAll()`.
- **There is no story about metadata.** The router sets `document.title` per navigation, and nothing
  else. It never touches a meta tag. Any app that faces the public needs at least a description per
  route. **Decision:** a route in the application map takes a `description`, and the router writes
  it to `<meta name="description">` on each navigation. imp sets no other meta tag.
- **The absence of SSR is a boundary of the scope that nobody states.** Real DOM, with a component
  in a shadow root, means that a built app is an empty HTML shell until the JavaScript runs. That is
  a defensible choice for an internal tool or a dashboard. But no ADR and no document says "a public
  content site is out of scope", in the way that the exclusion of `virtualList` is recorded. A team
  finds that out only after it has adopted imp. **Decision:** write the ADR
  `client-rendered-only.md`. imp renders on the client only. imp has no server rendering, no
  prerender and no static export. A public content site that needs its HTML before the JavaScript
  runs is out of scope. The docs say so.

## Tier 5 - the policy about a release, and about support

- **The version is `0.1.0`. There is no Windows target. There is no policy about stability.** The
  rule about no backward compatibility, in `CLAUDE.md`, is correct for now. But it must end at a
  documented 1.0, with a window for a deprecation and for support, before a team can responsibly pin
  imp in production. A pinned version, see `adr/version-pinning-self-delegation.md`, is worth
  pinning only when its guarantees are written down. Windows is still unsupported, see
  `adr/binary-distribution.md`, and CI builds no binary for Windows. That excludes many teams
  completely. **Decision:** from 1.0, imp follows semantic versioning. A breaking change goes into a
  major version only. A deprecation warns for at least one minor version before the removal.
  **Windows is a target before 1.0.** CI builds, tests and releases a Windows binary.
- **A sealed CI system has no documented path.** imp downloads the e2e browser on first use, and
  verifies its checksum, see `cli/src/test-browser.js`. `test.browser` and `IMP_BROWSER` point at a
  browser that is already there. But there is no documented mirror, and no override of the cache
  folder, for a CI environment that has no network, or that restricts its outbound traffic.
  **Decision:** add `IMP_CACHE_DIR`, which moves the cache folder of imp. Document `IMP_BROWSER` and
  `test.browser` as the path for a sealed CI. imp adds no mirror.

## Tracked in other items

One gap blocks production too, but it has its own file:

- **No automatic check catches an accessibility regression at the level of the app**, such as a
  missing label in app code or the contrast of a custom theme, see `todo/accessibility.md`.

## The suggested order

1. Do the CSP, the hash on an entry file and the external `env.js` first. They change what every
   deploy ships.
2. Harden the URLs in the router.
3. Write `client-rendered-only.md`, and add the metadata per route.
4. Write the deploy page, after tier 2 lands.
5. Settle the 1.0 policy and the Windows target. They decide whether a team can adopt imp at all.
6. Close the supply chain items. They decide whether a procurement passes.

The error reporting lands with `todo/analytics.md`, and not in this order.

## ADR impact

Two items land a decision that is worth a record. The CSP, with no inline script and the hashed
entry files, goes into `adr/production-bundling.md`. The scope with no server rendering goes into a
new `adr/client-rendered-only.md`. Each one belongs in `adr/` when the matching item lands, and not
before. The one exception is `client-rendered-only.md`. It records a decision that is already made,
so somebody can write it now.
