# Third-party attribution — bundled dependencies ship with their license notices

## Context

imp is distributed as a single self-contained binary, compiled from vendored files that **pre-bundle
and redistribute** other people's code: npm packages minified into `cli/src/vendor/` (happy-dom,
puppeteer-core, eslint, and now jpeg-js/gifenc), WebAssembly formatter plugins downloaded by
`tools/`, the esbuild engine, `@zip-js/zip-js`, `@resvg/resvg-wasm`, the Deno standard library, and
— downloaded on first e2e use — a Chrome for Testing build. Every one of those carries a license
whose notice obligations travel with the distribution: MIT and BSD require the copyright and
permission notice to accompany redistribution, Apache-2.0 requires the license and any NOTICE, and
MPL-2.0 requires the license text plus source-form availability of covered files. Minification
during prebundling strips embedded license headers, so without a deliberate step the distributed
binary would omit notices it is obligated to carry. Adding `@resvg/resvg-wasm` (MPL-2.0) and jpeg-js
(BSD-3-Clause) made this concrete, but it applies to everything imp already bundled.

## Decision

imp keeps a single auditable attribution record and ensures it ships with every distributed
artifact.

- **`THIRD_PARTY_LICENSES.md` at the repo root** lists every bundled or downloaded component, its
  version, its SPDX license, and its source, followed by the full text of each license family (MIT,
  BSD-3-Clause, Apache-2.0, MPL-2.0) with the covered copyright holders. It is the canonical home
  for all third-party notices.
- **The file ships inside the binary** via `deno compile --include THIRD_PARTY_LICENSES.md`, and
  **`imp licenses`** prints it — so the notices are retrievable from the distributed binary, not
  just the repo.
- **Prebundling preserves notices.** `tools/prebundle_npm_deps.js` uses esbuild
  `legalComments: 'eof'` (not `'none'`), so per-dependency license comments survive at the end of
  each vendored file rather than being stripped during minification.
- **imp stays MIT.** Bundling MPL-2.0 (`@resvg/resvg-wasm`) and Apache-2.0 (puppeteer-core) code
  does not change imp's own MIT license; imp preserves each component's notice, keeps MPL-covered
  source forms retrievable at their published versions, and ships those components unmodified. Deno
  being MIT imposes nothing on imp's license.
- **New bundled dependencies must be recorded here.** Adding a vendored/prebundled/downloaded
  dependency requires a row in `THIRD_PARTY_LICENSES.md` and its license text, the same way a new
  runtime npm dependency must route through the prebundle tool (`prebundled-npm-dependencies.md`).

## Consequences

- imp's redistribution of third-party code is correct: the required copyright, permission, and
  NOTICE text travels with both the repo and the compiled binary, and `imp licenses` surfaces it on
  demand.
- The prebundle change keeps license headers in vendored files at a small size cost; the aggregate
  file is the authoritative record regardless.
- Maintaining the list is a manual step tied to changing what imp bundles — the trade-off for having
  one auditable, shippable notice rather than scattered per-file headers.
