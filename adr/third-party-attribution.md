# Third-party attribution - bundled dependencies ship with their license notices

## Context

imp is distributed as one self-contained binary. That binary **redistributes** the code of other
people:

- the JavaScript runtime that executes imp,
- the npm packages that `tools/prebundle-npm-deps.js` minifies into `cli/src/vendor/`, together with
  every package that they depend on,
- the WebAssembly formatter plugins that `tools/` downloads, and the esbuild engine,
- `@zip-js/zip-js`, `@resvg/resvg-wasm`, `@deno/esbuild-plugin` and the Deno standard library.
- the third-party parts of the imp library: the Lucide icons, the Natural Earth data of `map`, and
  the QR code encoder of `qrCode`, which is adapted from the QR Code generator library of Project
  Nayuki.

On the first e2e run, imp also downloads a Chrome for Testing build. Every one of those carries a
licence, and the obligations of its notice travel with the distribution. MIT, ISC and BSD require
the copyright notice and the permission notice to travel. Apache-2.0 requires the licence and any
NOTICE file. MPL-2.0 requires that the source form of a covered file stays available.

A prebundled tool holds many packages. The eslint bundle holds more than 30, and the puppeteer-core
bundle holds more than 50. Most of them carry no licence comment in their code, so minification
leaves no trace of their notices. A list that a person keeps by hand names the top-level package and
misses the rest.

## Decision

imp keeps one record of attribution that somebody can audit, and imp ships that record in the
binary.

- **`THIRD-PARTY-LICENSES.md` at the repository root is the record.** Its first part is written by
  hand. It lists every component that imp bundles or downloads, with its version, its SPDX licence
  and its source. After the list comes the full text of each licence family, with the copyright
  holders that each one covers. The runtime has its own entry, Deno.
- **The prebundle generates the last part.** `tools/prebundle-npm-deps.js` builds each tool with an
  esbuild metafile. It reads every npm package in that metafile. It writes one line per package: the
  name, the version, the SPDX licence, and the copyright lines of the package. The full text of each
  licence family is in the first part, once. It writes one section per tool, under the heading
  `## Packages inside the prebundled tools`. The heading of a section is the version banner of the
  tool. A section that is missing, or a banner that changed, makes the tool bundle again. So the
  record changes in the same step as the bundle.
- **A test ties the two parts to the bundles.** For every file in `cli/src/vendor/`, the CLI tests
  require a generated section with its banner, and a table row with the name and the version of each
  package in the banner.
- **The file ships inside the binary**, through `deno compile --include THIRD-PARTY-LICENSES.md`.
  **`imp licenses`** prints it. So a person can get the notices from the distributed binary, and not
  only from the repository.
- **The prebundle keeps a licence comment.** It uses the esbuild option `legalComments: 'eof'`. A
  dependency that marks its notice in the code keeps that notice at the end of the vendored file.
- **imp stays MIT.** imp bundles MPL-2.0 code, in `@resvg/resvg-wasm`, and Apache-2.0 code, in
  puppeteer-core and its dependencies. That does not change the MIT licence of imp itself. imp keeps
  the notice of each component, keeps the source form of an MPL-covered file available at its
  published version, and ships those components without a change.
- **Code that the imp library adapts from another project keeps its notice in the source file.** The
  notice is a legal comment (`/*! ... */`) at the top of the module, verbatim. The QR code encoder
  of `qrCode` is such a module. The record lists the project in the table, and its licence family
  names its copyright holder. The legal comment is also what carries the notice into a built app.
- **This record covers the binary only.** The `dist/` directory that `imp build` produces carries
  its own notices, the notice of imp included. See `built-app-license-notices.md`.
- **Record a new bundled component here.** For a new npm tool, add it to `PREBUNDLES` and a row to
  the table. The prebundle writes its section. For any other component, add a row and its licence
  text by hand. A new runtime npm dependency must go through the prebundle tool. See
  `prebundled-npm-dependencies.md`.

## Consequences

- The copyright text, the permission text and the NOTICE text of every npm package in the binary
  travel with the repository and with the compiled binary. `imp licenses` shows them on demand.
- The record stays compact. A licence text appears once, and a package costs one line. The copyright
  line is the part of a notice that differs from one package to the next.
- The copyright lines come from a pattern match on three places: the licence file, the leading
  comments of each bundled file, and the README when the first two hold none. Many packages keep the
  notice only in a file header, which the minifier removes. A package with no copyright line
  anywhere gets its name, its version and its licence only.
- Each licence family in the first part says that it applies to the packages that the last section
  lists under its SPDX identifier. The CLI tests fail when the generated list uses an identifier
  that no family covers. A new family needs its text in the first part, by hand.
- The runtime and the WebAssembly plugins are compiled components, and each one has one entry. The
  record does not list the Rust crates, the C++ libraries or the Go runtime that they are built
  from.
