# Production readiness - what still blocks a serious app shipping on imp

## Context

Somebody asked a simple question about production. That question was "can I legally ship this
bundle?", and imp had no answer for it. That found the missing attribution of a third party in the
output of `imp build`. Somebody is fixing that. But it is one instance of a class. imp is designed
and tested from the side of the author of a workflow, through `imp start`, `imp test` and
`imp preview`. It becomes thin on the side of the deploy, where a build becomes an artifact that
somebody else operates, audits and debugs.

This file records the rest of that class. Somebody found each item by reading the CLI, the library
and the ADRs, against the question "what does a team need, before it puts this in front of a user?".
Each item names the gap, says why it blocks production, and says where the fix lands. The items are
grouped by tier, roughly in the order in which somebody must close them. When somebody implements an
item, delete it from this file, and record any architectural decision that it introduces, as an ADR.
When the last item goes, delete the file.

Somebody verified this against the code again on 2026-09-23. Every item below was still open at that
date.

## Tier 1 - the supply chain, and compliance

This is the same family as the gap in the attribution. It is also the tier that is most likely to
block a procurement, in place of being a preference.

- **There is no check of integrity, and no check of provenance, at install.** `latestVersion`, in
  `cli/src/install.js`, and the package fetches of the bundler, trust TLS alone. There is no check
  of the npm `dist.integrity` field. There is no check of a provenance or of an attestation.
  `imp update` already verifies the binary that it downloads, against its published SHA-256, see
  `cli/src/version-manager.js`. So the standard exists inside imp. The install of a dependency does
  not meet it. **Decision:** `imp install` always checks each package against its `dist.integrity`,
  and it refuses the install on a mismatch. The manifest per dependency records whether a package
  has a provenance attestation. imp does not enforce a provenance yet.
- **Nothing consumes the recorded graph.** The manifest per dependency answers the question "which
  versions of what do I ship?", and only for a reader who opens it. There is no `imp audit`. There
  is no export of a software bill of materials, in a standard format for interchange, such as
  CycloneDX or SPDX. There is no path to scan for a vulnerability. Each one of those is now a
  transform over data that is already committed in the repository. None of them is new plumbing.
  **Decision:** one command, `imp audit`, reads the manifests and checks every package against the
  OSV database, which needs no key. `imp audit --sbom` writes a CycloneDX file. imp does not write
  SPDX.

## Tier 2 - what `imp build` emits

- **There is no source map anywhere.** The word `sourcemap` appears nowhere in `cli/src`. The
  esbuild options in `cli/src/build.js` never set it. So the output is minified, with no map. Every
  stack trace in production is unreadable, and no backend for error reporting can symbolicate it.
  imp needs at least an external map that a person turns on. imp must emit that map, and not
  reference it from the bundle. So somebody can upload it to a service for reporting, and nobody
  serves it. With the missing global seam for an error, below, this is the whole reason why an imp
  app in production is blind about diagnostics. **Decision:** `imp build` always writes external
  source maps. There is no flag and no key. The maps go into a sibling folder of the output, such as
  `dist-sourcemaps/`, and no bundle references them. So an upload of `dist/` as it is never exposes
  the source.
- **imp does not put a content hash on an entry file.** Only `chunkNames` and `assetNames` carry
  `[hash]`, in `cli/src/build.js`. The output of an entry keeps its plain name. So a long-term cache
  of the entry point is impossible, and every deploy depends on the cache headers of the host being
  correct. There is related drift in the documentation. `docs/cli.md` describes the precache of the
  PWA as covering "every hashed script and chunk", and that says more than imp emits. **Decision:**
  the build of an HTML entry always hashes the entry scripts, and it rewrites the HTML to match. The
  HTML file keeps its plain name. The build of a JS entry keeps the plain name, because a consumer
  imports that file by name.
- **There is no story about a CSP.** `imp build` inlines the body of a module script into the HTML,
  through `replaceInlineScripts`. It also injects `<script>globalThis.__IMP_ENV__ = ...</script>`.
  So a built page needs `script-src 'unsafe-inline'`, unless imp emits a hash for what it inlined.
  Nothing in `docs/` mentions a Content Security Policy at all. A serious deployment requires a
  policy. imp must emit a SHA-256 hash per script, or offer a mode with a nonce, or a mode with an
  external file. imp must also document a baseline policy that a built app satisfies as it is.
  **Decision:** the build output has no inline script. The body of an inline module script goes into
  an external hashed file. The environment values go into a hashed `env.js`. So a strict
  `script-src 'self'` works with no hash, no nonce and no setting. The docs give that baseline
  policy.
- **`envInjectionScript` does not escape `</script`.** `cli/src/environments.js` writes
  `JSON.stringify(env)` straight into an inline script. `cli/src/build.js` explicitly guards the
  same hazard, for an inline bundle. An environment value comes from the author. So this is a trap
  that breaks a build, and not a hole for an injection. **Decision:** the external `env.js` of the
  CSP item removes the inline script, and the hazard with it. `imp start` still injects the values
  inline, so the dev path uses the same guard as `cli/src/build.js`.
- **The build processes HTML with a regular expression.** `SCRIPT_TAG`, and
  `rewriteRootAbsoluteUrls`, in `cli/src/build.js`, parse and rewrite HTML with a regular
  expression. That works for a scaffolded page. It handles an edge case wrongly, with no message.
  Two examples are a script tag inside a comment, and an attribute that contains `>`. At a minimum,
  this needs adversarial fixtures in a test. In the longer term, it needs a real parser.
  **Decision:** add the adversarial fixtures first. Then replace the regular expressions with a
  vendored HTML parser in pure JavaScript, such as parse5. The build edits the source at the
  locations that the parser reports, so the layout of the rest of the page does not change.
- **Some hygiene for production is missing on the side of the build.** There is no subresource
  integrity. There is no `modulepreload` hint for a chunk that the entry will pull. There is no
  output that imp compressed in advance, with brotli or gzip. There is no budget for the size of an
  app build. imp enforces a limit on the size of its own binary, through `binary-size-limit.json`.
  It offers the author of an app no equivalent for `dist/`. **Decision:** the build always writes a
  `modulepreload` hint for each chunk that an entry imports statically. A size budget for `dist/`
  goes into `imp.json`, and `imp build` fails when the output is over it, the same way as the
  `licenses` gate. imp does not add subresource integrity, because every script is same-origin and
  hashed. imp does not compress in advance, because the host compresses.

## Tier 3 - how to operate the app after it is live

- **There is no global seam for an error.** `lib/src/component.js` gives an `error` boundary per
  component, see `adr/error-boundaries.md`. But nothing catches an `error` event, or an
  `unhandledrejection` event, at the level of the app. There is also no API for a sink, to forward a
  crash to a backend. The situation is worse than silence. A state subscriber that throws is caught,
  and logged to the console only, see `createNotifier` in `lib/src/state.js`. So the failure mode in
  production is a UI that updated in part, with no telemetry. The shape that emits and subscribes,
  which somebody planned for analytics, see `todo/analytics.md`, is the correct shape to reuse. imp
  owns the plumbing, and the app chooses the destination. **Decision:** `onError(handler)` registers
  a sink, in the same shape as `onAnalytics`. imp sends to it every `error` event, every
  `unhandledrejection` event, and every error that a state subscriber throws. A sink that throws is
  skipped, and the others still run.
- **Logging in the browser goes to the console only.** `lib/src/logger.js` has no registration of a
  sink. The CLI has `addLogSink`, in `cli/src/logger.js`, and the library has no counterpart. So
  nobody can ship a log from production anywhere. The default level is also `info`. **Decision:**
  `imp/log` exports `onLog(handler)`, in the same shape as `onAnalytics` and `onError`. The default
  level of a built app is `warn`. `IMP_LOG_LEVEL` still sets another level.
- **There is no story about metadata.** The router sets `document.title` per navigation, and nothing
  else. It never touches a meta tag. Any app that faces the public needs at least a description per
  route, which imp sets as part of a navigation, in place of a person setting it by hand in a
  screen. **Decision:** a route in the application map takes a `description`, and the router writes
  it to `<meta name="description">` on each navigation. imp sets no other meta tag.
- **The absence of SSR is a boundary of the scope that nobody states.** Real DOM, with a component
  in a shadow root, means that a built app is an empty HTML shell until the JavaScript runs. That is
  a defensible choice for the 80% that is an internal tool, or a dashboard. But no ADR, and no
  document, says "a public content site is out of scope", in the way that somebody recorded the
  exclusion of `virtualList`. A team will find that out the hard way. **Decision:** write the ADR
  `client-rendered-only.md`. imp renders on the client only. imp has no server rendering, no
  prerender and no static export. A public content site that needs its HTML before the JavaScript
  runs is out of scope. The docs say so.
- **There is no documentation about a deployment, and none about observability.** The corpus of the
  documentation stops at `imp build`. There is nothing about a cache header, about a CSP, about
  reporting an error, or about what to connect the future seams for an error and for a log to. One
  page about a deployment closes the loop, after the seams above exist.
- **The lifecycle of a PWA deploy is unfinished.** `todo/pwa-update-lifecycle.md` is open. The
  behaviour of an update is exactly what breaks on the first real deploy of an installed app.

## Tier 4 - can somebody build the app at all, and does it hold up at scale

- **A malformed URL breaks the match of a route. It does not render `notFound`.**
  `decodeURIComponent(segment)`, in `matchMap` in `lib/src/app-map.js`, throws a `URIError` on bad
  percent encoding. An example is `/user/%zz`, which arrives from any external link. That surfaces
  as an error during the mount of a component, in place of the not-found page. There is a related
  problem. `Object.fromEntries(location.searchParams)` drops a repeated key of a query, and says
  nothing. **Decision:** a path with a malformed percent encoding renders `notFound`. `query` stays
  an object of plain strings, and the first value of a repeated key wins. The route also exposes the
  native `URLSearchParams` as `searchParams`, and an app reads a repeated key with `getAll()`.
- **imp enforces the accessibility baseline per component, and not automatically.** A test of a
  component asserts the role, the name and the operability from a keyboard. But neither `imp lint`
  nor `imp test` runs an automated audit of accessibility, over a rendered app. So a regression at
  the level of the app has no net. Two examples are a missing label in app code, and the contrast of
  a custom theme. The contract itself lives in `todo/accessibility.md`. **Decision:** two lint
  rules, a matcher in `imp/test`, and a contrast check in the theme editor. That file gives the
  details.

## Tier 5 - the policy about a release, and about support

- **The version is `0.1.0`. There is no Windows target. There is no policy about stability.** The
  rule about no backward compatibility, in `CLAUDE.md`, is correct for now. But it must end at a
  documented 1.0, with a window for a deprecation and for support, before a team can responsibly pin
  imp in production. A pinned version, see `adr/version-pinning-self-delegation.md`, is worth
  pinning only when somebody writes its guarantees down. Windows is still unsupported, see
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

## The suggested order

Do the source maps, and the global seam for an error and for a log, first. Together they make a live
app possible to debug. Then do the CSP, the hash on an entry file, and the change of one line, which
is the escaping in `envInjectionScript`. Then harden the URLs in the router. Then write the ADR
about the scope with no SSR, and the metadata per route. The policy about stability at 1.0, and a
Windows target, are the items that decide whether a team can adopt imp at all. The rest decide
whether the app holds up after they adopt it.

## ADR impact

Several of these items land a decision that is worth a record. Those are a policy about a source
map, a decision about a CSP and about the hash of an inline script, for
`adr/production-bundling.md`, a seam for reporting an error, beside the ADR about analytics, and an
ADR about a scope that renders on the client only. Each one belongs in `adr/` when the matching item
lands, and not before. The one exception is `client-rendered-only.md`. It records a decision that
somebody already made, and somebody can write it now.
