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

Last re-verified against the code on 2026-09-01; every item below was confirmed still open at that
date.

## Tier 1 - supply chain and compliance

The same family as the attribution gap, and the tier most likely to be a hard procurement blocker
rather than a preference.

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
- **Nothing consumes the recorded graph.** The per-dependency manifests answer "which versions of
  what am I shipping" only to a reader who opens them. There is no `imp audit`, no SBOM export in a
  standard interchange format (CycloneDX or SPDX), and no vulnerability-scanning path - each is now
  a transform over data already committed in the repository rather than new plumbing.

## Tier 2 - what `imp build` emits

- **No source maps anywhere.** `sourcemap` appears nowhere in `cli/src` (the esbuild options in
  `cli/src/build.js` never set it). Output is minified with no maps, so every production stack trace
  is unreadable and no error reporting backend can symbolicate. Needs at least an opt-in external
  map that is emitted but not referenced from the bundle, so it can be uploaded to a reporting
  service without being served. Together with the missing global error seam below, this is the whole
  reason a production imp app is diagnostically blind.
- **Entry files are not content-hashed.** Only `chunkNames` and `assetNames` carry `[hash]` in
  `cli/src/build.js`; entry outputs keep their plain names. Long-term caching of the entry point is
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
- **The build's HTML processing is regex-based.** `SCRIPT_TAG` and `rewriteRootAbsoluteUrls` in
  `cli/src/build.js` parse and rewrite HTML with regular expressions. This works for scaffolded
  pages but silently mishandles edge cases (script tags inside comments, attributes containing `>`).
  At minimum it needs adversarial test fixtures; longer-term, a real parser.
- **Missing build-side production hygiene:** no subresource integrity, no `modulepreload` hints for
  chunks the entry will pull, no precompressed (brotli/gzip) output, and no size budget for app
  builds - imp enforces a size limit on its own binary (`binary-size-limit.json`) but offers app
  authors no equivalent for `dist/`.

## Tier 3 - operating the app once it is live

- **No global error seam.** `lib/src/component.js` gives per-component `fallback` boundaries
  (`adr/error-boundaries.md`), but nothing catches `error` or `unhandledrejection` at the app level,
  and there is no sink API for forwarding a crash to a backend. Worse than silence: a state
  subscriber that throws is caught and logged to the console only (`lib/src/state.js`,
  `createNotifier`), so production failure mode is a partially-updated UI with zero telemetry. The
  emit-and-subscribe shape planned for analytics (`todo/analytics.md`) is the right one to reuse:
  imp owns the plumbing, the app chooses the destination.
- **Browser logging is console-only.** `lib/src/logger.js` has no sink registration - the CLI has
  `addLogSink` (`cli/src/logger.js`), the library has no counterpart - so production logs cannot be
  shipped anywhere, and the default level is `info`.
- **No SEO or metadata story.** The router never touches `document.title` or meta tags
  (`document.title` appears only in `lib/src/report.js`), and there is no prerender or static export
  for applications; `todo/preview-static-export.md` covers previews only. Any public-facing app
  needs at least a per-route title and description, set as part of navigation rather than by hand in
  a screen.
- **No-SSR is an unstated scope boundary.** Real DOM plus shadow-root components means a built app
  is an empty HTML shell until JS runs. That is a defensible choice for the internal-tools and
  dashboard 80%, but no ADR or doc says "public content sites are out of scope" the way the
  `virtualList` exclusion is recorded. Teams will discover it the hard way; it deserves an ADR.
- **No deployment or observability docs.** The docs corpus stops at `imp build` - nothing on cache
  headers, CSP, error reporting, or what to wire the (future) error and log seams to. One deployment
  page closes the loop once the seams above exist.
- **The PWA deploy lifecycle is unfinished** - `todo/pwa-update-lifecycle.md` and
  `todo/pwa-offline-fallback.md` are both open, and update behaviour is exactly what breaks on the
  first real deploy of an installed app.

## Tier 4 - can the app be built at all, and does it hold up at scale

- **State performance has no ceiling test.** Every `set` deep-walks the entire value twice - the
  structural compare in `inspectValue`, then `deepFreeze` - and a keyed `each` re-runs `valuesEqual`
  per retained item on every notification (`lib/src/state.js`). There is no update batching: N
  synchronous `set` calls produce N full notify-and-render passes. For the stated target -
  dashboards, CRUD, data grids - a large list state makes every keystroke O(total-data-size).
  Nothing proves this is fine: there is no benchmark or large-fixture test anywhere. Land one before
  the `table` / data-grid component does, because this is the architectural risk most likely to
  force a redesign.
- **Malformed URLs crash route matching instead of rendering notFound.**
  `decodeURIComponent(pathSegments[i])` in `lib/src/router.js` (`matchSegments`) throws `URIError`
  on garbage percent-encoding (`/user/%zz` arriving from any external link), which surfaces as a
  component mount error rather than the not-found page. Related:
  `Object.fromEntries(location.searchParams)` silently drops repeated query keys.
- **The standard library is still short of the target catalog.** Layout (`flex`, `stack`, `shell`,
  `dialog`), the `imp/std/shell` region group, the form layer, `tag` and `breadcrumbs` have landed,
  but there is still no table or data grid, no toast, tooltip, popover, card, comboBox or
  datePicker. The stated target is dashboards, CRUD and internal tools; those cannot yet be
  assembled from the catalog. Tracked in detail in `todo/stdlib-components.md` - listed here because
  it is the practical blocker a team hits first.
- **The accessibility baseline is enforced per component, not automatically.** Component tests
  assert role, name and keyboard operability, but neither `imp lint` nor `imp test` runs any
  automated accessibility audit over a rendered app, so app-level regressions (missing labels in app
  code, contrast in custom themes) have no net. The contract itself lives in
  `todo/accessibility.md`.

## Tier 5 - release and support policy

- **`0.1.0`, no Windows target, no stability policy.** The "no backward compatibility" rule in
  `CLAUDE.md` is correct for now, but it has to terminate at a documented 1.0 with a deprecation and
  support window before a team can responsibly pin imp in production; a pinned version
  (`adr/version-pinning-self-delegation.md`) is only worth pinning if its guarantees are written
  down. Windows remains unsupported (`adr/binary-distribution.md`) and CI builds no Windows binary,
  which excludes many teams outright.
- **Sealed CI has no documented path.** The e2e browser is downloaded on first use and checksum
  verified (`cli/src/test_browser.js`), which is right, but there is no documented mirror or cache
  override for an air-gapped or egress-restricted CI environment.

## Suggested order

Source maps and the global error/log sink seam first, which together make a live app debuggable.
Then CSP, hashed entry files, and the two one-liners (`install.sh` checksum, `envInjectionScript`
escaping). Then the state benchmark, before `table` lands. Then router URL hardening. Then the
no-SSR scope ADR and per-route metadata. The 1.0 stability policy and a Windows target are the items
that decide whether a team can adopt at all; the rest decide whether the app holds up once they do.

## ADR impact

Several of these land decisions worth recording: a source map policy, a CSP and inline-script
hashing decision for `adr/production-bundling.md`, an error-reporting seam alongside the analytics
ADR, and a client-side-rendering-only scope ADR. Each belongs in `adr/` when the corresponding item
lands, not before - except the no-SSR scope ADR, which records a decision already made and can be
written now.
