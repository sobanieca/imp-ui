# Third-party attribution - bundled dependencies ship with their license notices

## Context

imp is distributed as one self-contained binary. imp compiles that binary from vendored files that
**pre-bundle and redistribute** the code of other people. That covers the npm packages that imp
minifies into `cli/src/vendor/`, which are happy-dom, puppeteer-core, eslint, and now jpeg-js and
gifenc. It also covers the WebAssembly formatter plugins that `tools/` downloads, the esbuild
engine, `@zip-js/zip-js`, `@resvg/resvg-wasm` and the Deno standard library. On the first e2e run,
imp also downloads a Chrome for Testing build. Every one of those carries a licence, and the
obligations of its notice travel with the distribution. MIT and BSD require the copyright notice and
the permission notice to travel with a redistribution. Apache-2.0 requires the licence and any
NOTICE file. MPL-2.0 requires the licence text, and the availability of the source form of a covered
file. Minification during the prebundle removes an embedded licence header. So without a deliberate
step, the distributed binary would leave out a notice that it must carry. The addition of
`@resvg/resvg-wasm`, which is MPL-2.0, and of jpeg-js, which is BSD-3-Clause, made this concrete.
But it applies to everything that imp already bundled.

## Decision

imp keeps one record of attribution that somebody can audit, and imp ships that record with every
distributed artifact.

- **`THIRD-PARTY-LICENSES.md` at the repository root** lists every component that imp bundles or
  downloads, with its version, its SPDX licence and its source. After the list comes the full text
  of each licence family, which is MIT, BSD-3-Clause, Apache-2.0 and MPL-2.0, with the copyright
  holders that each one covers. That file is the one home for every third-party notice.
- **The file ships inside the binary**, through `deno compile --include THIRD-PARTY-LICENSES.md`.
  **`imp licenses`** prints it. So a person can get the notices from the distributed binary, and not
  only from the repository.
- **The prebundle keeps a notice.** `tools/prebundle-npm-deps.js` uses the esbuild option
  `legalComments: 'eof'`, and not `'none'`. So the licence comment of each dependency survives at
  the end of each vendored file. Minification does not remove it.
- **imp stays MIT.** imp bundles MPL-2.0 code, in `@resvg/resvg-wasm`, and Apache-2.0 code, in
  puppeteer-core. That does not change the MIT licence of imp itself. imp keeps the notice of each
  component, keeps the source form of an MPL-covered file available at its published version, and
  ships those components without a change. Deno is MIT, and that imposes nothing on the licence of
  imp.
- **This record covers the binary only.** imp distributes one other artifact, which is the `dist/`
  directory that `imp build` produces. That directory carries its own notices, through a separate
  mechanism. See `built-app-license-notices.md`.
- **Record a new bundled dependency here.** When you add a dependency that imp vendors, pre-bundles
  or downloads, add a row to `THIRD-PARTY-LICENSES.md`, with its licence text. That is the same rule
  as for a new runtime npm dependency, which must go through the prebundle tool. See
  `prebundled-npm-dependencies.md`.

## Consequences

- The redistribution of third-party code by imp is correct. The copyright text, the permission text
  and the NOTICE text travel with the repository and with the compiled binary. `imp licenses` shows
  them on demand.
- The change to the prebundle keeps a licence header in a vendored file, at a small cost in size.
  The aggregate file is the authoritative record in any case.
- Maintenance of the list is a manual step, and it follows a change to what imp bundles. That is the
  trade for one record of notices that somebody can audit, and that imp can ship. The alternative is
  a header in each file, spread across the tree.
