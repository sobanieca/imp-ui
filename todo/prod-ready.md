# Production readiness - what still blocks a serious app shipping on imp

## Context

Missing third-party attribution in `imp build` output was found by asking a simple production
question - "may I legally ship this bundle?" - that imp had no answer for. It is being fixed, but it
is one instance of a class: imp is designed and tested from the author's side of the workflow
(`imp start`, `imp test`, `imp preview`) and thins out on the deploy side, where a build becomes an
artifact someone else operates, audits and debugs.

This file records the rest of that class, found by reading the CLI, the library and the ADRs against
the question "what does a team need before putting this in front of users?". Each item names the
gap, why it blocks production, and where it lands. Items are grouped by tier, roughly in the order
they should be closed; when one is implemented, delete it from this file (and record any
architectural decision it introduces as an ADR). When the last one goes, delete the file.

## Tier 1 - supply chain and compliance

The same family as the attribution gap, and the tier most likely to be a hard procurement blocker
rather than a preference.

- **Attribution is still structurally incomplete after the notices work.**
  `cli/src/license_notices.js` harvests only legal comments that survive minification
  (`legalComments` in `cli/src/build.js` and `cli/src/deps.js`). A package whose license lives in a
  `LICENSE` file, with no `/*! */` or `@license` header in its sources - the common shape for small
  MIT packages - contributes nothing to `LICENSES.txt`. The complete fix belongs at vendor time:
  `imp install` already resolves the exact package set (`bundledPackages` in `cli/src/deps.js`), so
  it can fetch each package's SPDX identifier and license text and record them beside the bundle,
  and `imp build` can merge those recorded notices with the legal comments it finds. Extends
  `adr/third-party-attribution.md` from imp's own redistribution to the app's.
- **Nothing records the resolved transitive graph.** `adr/vendored-dependencies.md` deliberately has
  no lock file, and `imp install` only prints the resolution to stdout. So there is no SBOM, no
  vulnerability scanning path, no `imp audit`, and no way to answer "which versions of what am I
  shipping?" from a fresh clone - the printed audit record does not survive the terminal scrollback.
  One per-dependency manifest written next to each vendored bundle (packages, exact versions, SPDX
  ids, resolve timestamp) closes attribution, SBOM and audit together, and does not reintroduce a
  lock file: the committed bytes remain the frozen state, the manifest only describes them.
- **No integrity or provenance check on install.** `latestVersion` in `cli/src/install.js` and the
  bundler's package fetches trust TLS alone - no npm `dist.integrity` verification, no provenance or
  attestation check. `imp update` already verifies the binary it downloads against its published
  SHA-256 (`cli/src/version_manager.js`), so the standard exists inside imp; dependency installs do
  not meet it.
- **`install.sh` verifies nothing.** It downloads the release asset and moves it into `INSTALL_DIR`
  with no checksum check, even though the release publishes `imp-{os}-{arch}.sha256` and every other
  download path in imp verifies against it (`adr/binary-distribution.md`). The first command a new
  user runs is the only unverified one. One-line fix, outsized value. (The script also prints a
  non-ASCII check mark, against the repo's ASCII rule.)
- **No license policy gate.** Teams need "fail the build on AGPL/GPL/unknown" as a build-time check,
  not a report read after the fact. Cheap once the vendor-time SPDX data of the first two items
  exists.

## Tier 2 - what `imp build` emits

- **No source maps anywhere.** `sourcemap` appears nowhere in `cli/src`. Output is minified with no
  maps, so every production stack trace is unreadable and no error reporting backend can
  symbolicate. Needs at least an opt-in external map that is emitted but not referenced from the
  bundle, so it can be uploaded to a reporting service without being served. Together with the
  missing global error seam below, this is the whole reason a production imp app is diagnostically
  blind.
- **Entry files are not content-hashed.** `cli/test/snapshots/build-app.txt` shows `app.js` emitted
  unhashed; only `chunks/` and `assets/` carry hashes. Long-term caching of the entry point is
  therefore impossible and every deploy depends on the host's cache headers being right. Related
  documentation drift: `docs/cli.md` describes the PWA precache as covering "every hashed script and
  chunk", which overstates what is emitted.
- **No CSP story.** `imp build` inlines module script bodies into the HTML (`replaceInlineScripts`)
  and injects `<script>globalThis.__IMP_ENV__ = ...</script>`, so a built page needs
  `script-src 'unsafe-inline'` unless imp emits hashes for what it inlined. Nothing in `docs/`
  mentions Content-Security-Policy at all. Serious deployments require a policy; imp should emit
  per-script SHA-256 hashes (or offer a nonce / external-file mode) and document a baseline policy
  that a built app satisfies as-is.
- **`envInjectionScript` does not escape `</script`.** `cli/src/environments.js` writes
  `JSON.stringify(env)` straight into an inline script, while `cli/src/build.js` explicitly guards
  the identical hazard for inline bundles. Environment values are author-controlled, so this is a
  build-breaking footgun rather than an injection hole, but the guard already exists ten lines away
  and should be consistent.
- **Missing build-side production hygiene:** no subresource integrity, no `modulepreload` hints for
  chunks the entry will pull, no precompressed (brotli/gzip) output, and no size budget for app
  builds - imp enforces a size limit on its own binary (`binary-size-limit.json`) but offers app
  authors no equivalent for `dist/`.

## Tier 3 - operating the app once it is live

- **No global error seam.** `lib/src/component.js` gives per-component `onError` boundaries
  (`adr/error-boundaries.md`), but nothing catches `error` or `unhandledrejection` at the app level,
  and there is no sink API for forwarding a crash to a backend. The emit-and-subscribe shape planned
  for analytics (`todo/analytics.md`) is the right one to reuse: imp owns the plumbing, the app
  chooses the destination.
- **Browser logging is console-only.** `lib/src/logger.js` has no sink registration - the CLI has
  `addLogSink`, the library has no counterpart - so production logs cannot be shipped anywhere, and
  the default level is `info`.
- **No SEO or metadata story.** The router never touches `document.title` or meta tags
  (`document.title` appears only in `lib/src/report.js`), and there is no prerender or static export
  for applications; `todo/preview-static-export.md` covers previews only. Any public-facing app
  needs at least a per-route title and description, set as part of navigation rather than by hand in
  a screen.
- **The PWA deploy lifecycle is unfinished** - `todo/pwa-update-lifecycle.md` and
  `todo/pwa-offline-fallback.md` are both open, and update behaviour is exactly what breaks on the
  first real deploy of an installed app.

## Tier 4 - can the app be built at all

- **The standard library is thin for an all-in-one toolkit.** What ships today: general (button,
  heading, link, text), a substantial inputs group, navigation (tabs, navMenu), display (emptyState
  alone), feedback (bugReport alone). The layout group has been removed in full and is being
  redesigned, and there is no table or data grid, no dialog, drawer, toast or tooltip. The stated
  target is dashboards, CRUD and internal tools; those cannot be assembled from the current catalog.
  Tracked in detail in `todo/stdlib-components.md` - listed here because it is the practical blocker
  a team hits first.
- **The accessibility baseline is a plan, not a guarantee.** `todo/accessibility.md` defines the
  contract, but its overlay and focus half cannot land until overlays land, and neither `imp lint`
  nor `imp test` runs any automated accessibility check, so nothing enforces the baseline across the
  catalog.

## Tier 5 - release and support policy

- **`0.1.0`, no Windows target, no stability policy.** The "no backward compatibility" rule in
  `CLAUDE.md` is correct for now, but it has to terminate at a documented 1.0 with a deprecation and
  support window before a team can responsibly pin imp in production; a pinned version
  (`adr/version-pinning-self-delegation.md`) is only worth pinning if its guarantees are written
  down. Windows remains unsupported (`adr/binary-distribution.md`).
- **Sealed CI has no documented path.** The e2e browser is downloaded on first use and checksum
  verified (`cli/src/test_browser.js`), which is right, but there is no documented mirror or cache
  override for an air-gapped or egress-restricted CI environment.

## Suggested order

Finish attribution the vendor-time way so that it also produces the resolved-graph manifest (tier 1,
first two items) - one change answers legal, SBOM and audit at once. Then source maps and the global
error seam, which together make a live app debuggable. Then CSP and hashed entry files. Then the
layout group, which is what unblocks building the app in the first place. `install.sh` checksum
verification is independent of all of it and should just be done.

## ADR impact

Several of these land decisions worth recording: a vendor-time license and package manifest (extends
or replaces `adr/third-party-attribution.md` and amends `adr/vendored-dependencies.md`'s "no
resolved-graph manifest" clause), a source map policy, a CSP and inline-script hashing decision for
`adr/production-bundling.md`, and an error-reporting seam alongside the analytics ADR. Each belongs
in `adr/` when the corresponding item lands, not before.
