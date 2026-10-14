# Third-party attribution - the binary ships the notices of everything it contains

## Context

imp is distributed as one self-contained binary. That binary **redistributes** the code of other
people:

- the Rust crates that the CLI compiles in, about 460 of them, together with QuickJS-ng, which
  `rquickjs-sys` compiles in,
- the browser build of puppeteer-core, vendored under `cli/vendor/puppeteer/`, see
  `vendored-browser-driver.md`,
- the third-party parts of the imp library: the Lucide icons, the Natural Earth data of `map`, and
  the QR code encoder of `qrCode`, which is adapted from the QR Code generator library of Project
  Nayuki,
- the fonts of the scaffold of `imp init`.

On the first test run, imp also downloads a Chrome for Testing build. Every one of those carries a
licence, and the obligations of its notice travel with the distribution. MIT, ISC and BSD require
the copyright notice and the permission notice to travel. Apache-2.0 requires the licence and any
NOTICE file. MPL-2.0 requires that the source form of a covered file stays available. A list that a
person keeps by hand names the direct dependencies and misses the rest.

## Decision

imp keeps one record of attribution that somebody can audit, and imp ships that record in the
binary.

- **`THIRD-PARTY-LICENSES.md` at the repository root is the record.** Its first part is written by
  hand. It lists every component that imp bundles or downloads, with its version, its SPDX licence
  and its source. After the list comes the full text of each licence family, with the copyright
  holders of the components that the first part names.
- **Two sections at the end are generated.** `cargo xtask licenses` follows the normal dependencies
  of the CLI through `cargo metadata`, and writes one line per crate: the name, the version, the
  SPDX expression, and the copyright lines from the licence files of the crate, or its authors when
  those files hold none. `cargo xtask vendor-puppeteer` writes one line per npm package inside the
  browser driver in the same form, when it bundles the driver.
- **The check keeps the record current.** `cargo xtask check` writes the crate section again, and
  `cargo verify` fails when the section differs from the dependency graph. Both fail when a line
  uses a licence that no family text covers. An `OR` expression needs one covered choice, and an
  `AND` expression needs all of them. A new family needs its text in the first part, by hand,
  verbatim from the licence file of a crate that uses it.
- **A test ties the driver to the record.** The CLI tests fail when `THIRD-PARTY-LICENSES.md` does
  not name the tool that a banner of a driver chunk names.
- **The file ships inside the binary**, through the embedding of `cli/build.rs`. **`imp licenses`**
  prints it. So a person can get the notices from the distributed binary, and not only from the
  repository.
- **imp stays MIT.** imp compiles crates under MPL-2.0 and Apache-2.0, and vendors Apache-2.0 code
  in puppeteer-core. That does not change the MIT licence of imp itself. imp keeps the notice of
  each component, keeps the source form of an MPL-covered crate available at its published version
  on crates.io, and ships those components without a change. Where a crate offers a choice of
  licences, imp uses it under one of them.
- **Code that the imp library adapts from another project keeps its notice in the source file.** The
  notice is a legal comment (`/*! ... */`) at the top of the module, verbatim. The QR code encoder
  of `qrCode` is such a module. The record lists the project in the table, and its licence family
  names its copyright holder. The legal comment is also what carries the notice into a built app.
- **This record covers the binary only.** The `dist/` directory that `imp build` produces carries
  its own notices, the notice of imp included. See `built-app-license-notices.md`.

## Consequences

- The copyright text, the permission text and the NOTICE text of every crate and every npm package
  in the binary travel with the repository and with the compiled binary. `imp licenses` shows them
  on demand.
- The record stays compact. A licence text appears once, and a crate costs one line. The copyright
  line is the part of a notice that differs from one crate to the next.
- A dependency update changes the record in the same change. `cargo verify` fails until somebody
  runs `cargo xtask licenses`, so the record cannot fall behind the binary.
- A copyright line that a crate keeps only in its source files, and not in a licence file, is not in
  the record. The crate then gets its authors from its manifest.
