# Shrink the `imp` binary

The compiled binary grew from 153 MB to 200 MB when `imp test` landed. The +47 MB is not the test
feature itself — `deno compile` embeds the **entire npm package trees** of its dependencies: every
dist format, `.d.ts` files, source maps, and type-only transitive packages. Measured contributors:

- `happy-dom` ~19 MB per version, plus ~12 MB of `@types/*` it drags in
- `puppeteer-core` ~13 MB, `chromium-bidi` ~14 MB, `devtools-protocol` ~8 MB

## Fix: pre-bundle at build time (validated)

Bundle each package into a single minified ESM file with esbuild at build time and import that file
instead of the npm specifier — the same vendoring pattern as `tools/download_fmt_plugins.js`.
Measured results:

- `happy-dom@20.0.11` → **0.77 MB** (from ~31 MB embedded)
- `puppeteer-core@24.36.0` → **2.09 MB** (platform `node`, with `node:*` plus the optional native
  add-ons `supports-color`, `utf-8-validate`, `bufferutil` marked external — puppeteer already
  treats those as optional)

That takes the test feature's footprint from ~47 MB down to ~3 MB, i.e. the binary lands at ~156 MB
with zero behavior change and the full Puppeteer API kept.

Steps:

- Add a `tools/` script that pre-bundles both packages into `src/cli/vendor/*.js`
- Switch `src/cli/test.js` / `src/cli/test_dom.js` imports to the vendored files
- Drop the now-unused npm imports from `deno.json`, recompile, re-run the full suite

## Follow-up: the 153 MB baseline

The pre-existing baseline likely has the same disease — the embedded `eslint` package tree is a
prime suspect for another double-digit MB win. Probe it with the same esbuild pre-bundle approach.

## Rejected alternatives

- **obscura** (Rust headless browser, CDP-compatible): does not address binary size at all — it is a
  separate 70 MB browser binary that would replace the per-user Chrome _download_, not the client
  libraries inside the imp binary. It is also not Chromium (own engine + V8, built for scraping), so
  e2e results would stop proving the app works in a real browser, and imp's served pages rely on
  import maps, EventSource, and a service worker that a young custom engine may not cover. Could be
  revisited someday as an opt-in backend, never the default.
- **Hand-rolled CDP client over Deno's native WebSocket** to drop puppeteer-core entirely: only
  saves ~2 MB once pre-bundling exists, at the cost of the full Puppeteer page API the docs promise.
  Not worth it.
