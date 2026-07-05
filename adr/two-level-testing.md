# Two-level testing — in-process unit runner, per-spec e2e browser

## Context

imp needed first-class testing without breaking its constraints: the compiled binary embeds no Deno
tooling (`deno test` is not part of `denort`), users never see Deno or configure a third-party
framework, and the toolchain runs in-process (`in-process-toolchain.md`). Components touch the real
DOM directly (`real-dom-no-virtual-dom.md`), so unit tests need a real-enough DOM, and e2e tests
need a real browser. E2E suites also had to parallelize across CI machines, since sequential browser
runs dominate CI time.

## Decision

One command, `imp test`, with the level chosen by file name — `*.test.js` runs in-process against a
simulated DOM, `*.spec.js` runs against a served app in headless Chrome. Both import their API from
`imp/test` (`src/test.js`): `test`/`test.only`/`test.skip` with per-test timeouts,
`beforeAll`/`beforeEach`/`afterEach`/`afterAll`, and an `expect` matcher set. imp's file walker
feeds discovery; explicit paths run exactly those files.

- **Execution model.** The runner is imp's own, in-process. Each test file is bundled by the
  embedded esbuild engine (resolving `imp`, `imp/test`, vendored dependency aliases, and relative
  imports — same resolution as `imp bundle`) and executed via a `data:` URL dynamic import, which
  works identically under `deno run` and inside the compiled binary. Registration flows through a
  `Symbol.for`-keyed global registry, so the bundled copy of `imp/test` and the CLI share state
  without sharing module identity.
- **Unit environment.** happy-dom provides `document`, `window`, elements, and events, installed as
  globals before a test file is imported and restored after — a fresh window per file. happy-dom's
  window lives in a separate JS realm, so ECMAScript intrinsics (`Object`, `RegExp`, `Promise`, …)
  are explicitly _not_ copied onto the global — only DOM and browser APIs are; `expect`'s deep
  equality compares by structural tags rather than prototype identity for the same reason.
- **E2E environment.** Each spec file gets a fresh app instance: the `imp start` internals serve the
  entry page (default `index.html`, `test.entry` in `imp.json`) on an ephemeral port with the
  standard injection, so browser console and network telemetry stream to the terminal during runs;
  puppeteer-core drives a headless browser; tests receive `{ page, browser, baseUrl }` and share the
  page within a file (a spec reads as one user session). Failing tests save a screenshot under
  `.imp/screenshots/`. Nothing is shared between spec files, so `imp test <file>.spec.js` is a
  self-contained CI job; `imp test --e2e --list` emits the spec list as JSON for one-job-per-spec
  GitHub Actions matrices.
- **Browser resolution**, in order: `test.browser` in `imp.json`, the `IMP_BROWSER` environment
  variable, an installed Chrome/Chromium (covers GitHub Actions runners out of the box), else a
  Chrome for Testing build pinned by version and per-platform sha256 in `src/cli/test_browser.js`,
  downloaded once into the per-user `~/.imp/browser/` cache (never inside a project,
  `vendored-dependencies.md`) and extracted with a pure-JS unzip.
- **The browser is the sanctioned subprocess exception** to `in-process-toolchain.md`: it is the
  system under test, not a delegated tool. Runner, bundler, server, and assertions all stay
  in-process; unit tests spawn nothing.

## Consequences

- Unit tests run fast and offline anywhere the binary runs; dev mode and the compiled binary share
  one code path. E2E total time in CI drops to the slowest spec file, at the deliberate cost of each
  spec repeating its own setup state (e.g. logging in) — that repetition is what makes specs
  independently schedulable.
- Test files are bundled before running, so failures report per test with assertion detail but
  without original file/line stack traces — the per-file granularity and test names carry location.
- happy-dom and puppeteer-core add to the binary size (consistent with the fmt/lint engines); the
  pinned Chrome download is ~190 MB once per user per pinned version, and platforms without a pinned
  build must configure `test.browser`.
- A checksum pin means imp releases, not ambient browser updates, decide the managed e2e browser
  version; bumping it is a one-file change (version + hashes).
