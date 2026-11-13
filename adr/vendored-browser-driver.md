# Vendored browser driver - puppeteer-core runs in the runner page

## Context

`imp test` drives Chrome. The runner of a test file runs in a page of that Chrome, see
`two-level-testing.md`. A spec needs the Puppeteer API, which is what a developer knows for page
automation. The imp binary has no JavaScript runtime outside the browser, see
`native-toolchain.md`.

## Decision

The browser build of `puppeteer-core` runs in the runner page of a spec, and connects to its own
browser over the DevTools WebSocket that imp hands it. A unit file does not load it.

- `cargo xtask vendor-puppeteer` bundles the browser entry of a pinned `puppeteer-core` version with
  the bundler of imp, split into chunks, and writes them to `cli/vendor/puppeteer/`. Each chunk
  starts with a banner that names the package and the version.
- The chunks are committed, and the binary embeds them. The runner page loads them from the
  `/@imp/puppeteer/` path of the test server.
- `THIRD-PARTY-LICENSES.md` names `puppeteer-core`, and a test checks that it names every tool that
  a chunk banner names.

## Consequences

- A test run downloads no driver, and works offline.
- A version change is one edit of the pin in `xtask/src/vendor.rs`, then `cargo xtask
  vendor-puppeteer`, and a commit of the new chunks.
- The driver adds about 1 MB to the binary.
