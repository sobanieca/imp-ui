# `imp test` command

Give imp a first-class way to test components, on two levels:

1. **Unit / integration tests** — run component logic against stubbed web APIs, no real browser.
2. **E2E tests** — drive a real browser with Puppeteer against a served app.

Both run through one command: `imp test [...paths]`. Crucially, `imp test my_e2e.spec.js` runs
exactly that spec file and exits with its result — so a whole app can be split into many e2e spec
files and executed as parallel CI jobs (e.g. a GitHub Actions matrix with one job per spec file).

## File conventions

Distinguish the two levels by file name, so no per-file configuration is needed:

- `*.test.js` — unit/integration, executed in-process with DOM stubs.
- `*.spec.js` — e2e, executed against a real browser.

`imp test` with no paths discovers and runs everything (imp's existing file walker feeds
discovery, same as fmt/lint); with explicit paths it runs only those files. Exit code reflects
failures, which is all CI parallelism needs.

## Level 1 — unit/integration with web API stubs

- Provide DOM and web APIs via `npm:happy-dom` — pure JS, so it can run fully in-process inside the
  compiled binary, consistent with `adr/in-process-toolchain.md`. Verify feasibility first: imp
  components touch the real DOM directly (`adr/real-dom-no-virtual-dom.md`), so happy-dom must
  cover the DOM surface imp's runtime uses (custom elements, events, attribute reflection). If it
  falls short, fall back to running unit tests through the same headless browser as level 2.
- imp needs its own test runner: the `deno test` runner is not part of `denort`, so it does not
  exist inside the compiled binary (same constraint that drove fmt/lint in-process). A minimal
  runner — `test()`, assertions, per-file reporting — is small, pure JS, and keeps dev mode and the
  compiled binary on one code path.
- The runner and assertion helpers are imported from imp itself (e.g. `import { test, assert }
  from 'imp/test'`) — users never see Deno or configure a third-party test framework.

## Level 2 — e2e with Puppeteer

- Each spec file gets a fresh app instance: `imp test` boots the dev server (`imp start`
  internals, ephemeral port), launches the browser via `npm:puppeteer-core`, and hands the spec a
  ready-made page handle pointed at the served app — again via `imp/test`, so specs stay
  imp-branded and boilerplate-free.
- Because every spec run is self-contained (own server, own port, own browser), spec files are
  trivially parallelizable across CI jobs; nothing is shared between them.
- Browser provisioning: `puppeteer-core` does not download a browser. Resolve one in this order —
  an explicitly configured executable path (works out of the box on GitHub Actions runners, which
  preinstall Chrome), else a browser downloaded into the per-user `~/.imp/` cache (never inside a
  project, `adr/no-lockfile-exact-versions.md`), pinned by version and checksum like the vendored
  wasm plugins.

## ADR impact

`adr/in-process-toolchain.md` states the imp binary never spawns a subprocess. E2E testing is a
deliberate, scoped exception: the browser is the system under test, not a delegated tool — imp's
own toolchain (runner, server, assertions) still runs in-process, and level 1 spawns nothing.
When implemented, amend that ADR to record the exception and add a new ADR for the testing
architecture; document both levels and the CI parallelization pattern in `docs/`.

## Open questions

- Console/network forwarding: `imp start` already pipes browser console and network activity to
  the terminal — reuse that in e2e runs so failing specs come with context.
- Watch mode (`imp test --watch`) for local development — nice to have, not needed for the CI
  story.
- Whether level 1 needs happy-dom at all for pure logic tests, or only when a component actually
  touches the DOM — lazy-init the stub environment per test file.
