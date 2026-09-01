# In-process toolchain - fmt and lint never spawn a subprocess

## Context

imp is distributed as a single self-contained binary produced by `deno compile`. That build embeds
the CLI into `denort`, a stripped runtime with none of Deno's tooling subcommands - there is no lint
or fmt code inside the binary, and the runtime-side `Deno.lint` API is gated to `deno test`. The
original implementation delegated `imp lint` / `imp fmt` to `Deno.execPath()`, which works from
source but self-recurses unboundedly in a compiled binary. Alternatives - downloading a `deno`
binary into a managed cache, embedding oxlint/oxfmt native binaries, requiring a user-installed
Deno, or becoming a Vite plugin - all either need network access at runtime, spawn external
processes, or break the principle that Deno stays an implementation detail.

## Decision

Everything `imp fmt` and `imp lint` do runs in-process via wasm and pure-JS engines embedded in the
binary at compile time. The imp binary never spawns a subprocess for its own toolchain - the
deliberate exceptions both belong to `imp test` (`two-level-testing.md`): launching the e2e browser,
which is the system under test rather than a delegated tool, and the level fan-out, where
`imp test --unit`/`--e2e` reinvokes imp itself as one `imp test <file>` worker per file to run a
whole level in parallel. Neither shells out to an external tool - the browser is the system under
test, the workers are imp's own copies - and within any single worker the test runner, server,
bundler, and assertions all still run in-process.

- **`imp fmt`** drives dprint wasm plugins through `@dprint/formatter`'s multi-plugin context - the
  same engines `deno fmt` multiplexes, including the identical third-party crates for CSS (`malva`),
  HTML (`markup_fmt`), and YAML (`pretty_yaml`). The JavaScript plugin runs with its `deno` preset
  so JS output matches `deno fmt`. TypeScript is deliberately out of scope for both commands - imp
  is buildless, apps are plain JavaScript. Embedded `<script>`/`<style>` in HTML are formatted via
  the context's host delegation. Plugin wasm files are pinned by version and checksum in
  `cli/src/fmt_plugins.js`, downloaded by `tools/download_fmt_plugins.js`, and embedded with
  `deno compile --include`.
- **`imp lint`** runs ESLint's core `Linter` (`eslint/universal` - pure JS, no filesystem) with the
  `@eslint/js` recommended rules, browser globals, and imp's own rules from `cli/src/lint_rules.js`.
  HTML files are linted by extracting inline `<script>` blocks and remapping diagnostics to their
  original lines, and the same embedded `Linter` drives the whole-project dead-code pass
  (`project-wide-dead-code.md`). imp's file walker feeds both commands.
- **Directives are imp-branded:** formatter ignore comments are configured as `imp-fmt-ignore` /
  `imp-fmt-ignore-file`, and `imp-lint-ignore` / `imp-lint-ignore-file` comments are rewritten to
  the engine's directive syntax before linting.

## Consequences

- The binary is fully self-contained and works offline: no toolchain downloads, no ambient `deno`,
  no version skew between imp and its tools - an imp release pins its formatter and linter behavior.
  `deno task imp` in this repo runs that same compiled binary, so there is no second code path that
  could drift from it.
- `imp fmt` formats CSS/HTML/YAML out of the box (stock `deno fmt` gates these behind unstable
  flags) and `imp lint` covers inline scripts in HTML, which `deno lint` cannot.
- Lint rule names follow ESLint conventions, and new imp rules are written against ESLint's plugin
  API. Linting is slower than native-Rust linters - acceptable at the scale of buildless projects
  imp targets, with oxlint available as a future drop-in if that changes.
- The wasm plugins add ~10 MB and the pre-bundled ESLint ~1.3 MB to the binary
  (`prebundled-npm-dependencies.md`). `deno run -A tools/download_fmt_plugins.js` and
  `deno run -A tools/prebundle_npm_deps.js` must run before compiling (wired into the `compile`
  task, which every task that invokes imp goes through).
- User-supplied lint plugins (dynamic import of user JS inside a compiled binary) are not supported
  until verified separately.
