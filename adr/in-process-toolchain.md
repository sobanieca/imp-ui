# In-process toolchain - fmt and lint never spawn a subprocess

## Context

imp is distributed as one self-contained binary that `deno compile` produces. That build embeds the
CLI into `denort`, which is a reduced runtime with none of the tooling subcommands of Deno. There is
no lint code and no fmt code inside the binary, and the runtime `Deno.lint` API is limited to
`deno test`. The first implementation delegated `imp lint` and `imp fmt` to `Deno.execPath()`. That
works from source, but in a compiled binary it calls itself without an end. imp evaluated the
alternatives. Each one fails. A download of a `deno` binary into a managed cache needs the network
at runtime. An embedded native binary of oxlint or oxfmt starts a process. A requirement that the
user installs Deno, and a move to a Vite plugin, both break the principle that Deno stays an
implementation detail.

## Decision

Everything that `imp fmt` and `imp lint` do runs in process, through a wasm engine and a pure
JavaScript engine that imp embeds in the binary at compile time. The imp binary never starts a
subprocess for its own toolchain. There are two deliberate exceptions, and both belong to
`imp test`, see `two-level-testing.md`. The first is the launch of the e2e browser, which is the
system under test and not a delegated tool. The second is the fan-out over a level, where
`imp test --unit` and `imp test --e2e` invoke imp again, as one `imp test <file>` worker per file,
to run a whole level in parallel. Neither one calls an external tool. The browser is the system
under test, and a worker is a copy of imp. Inside any single worker, the test runner, the server,
the bundler and the assertions all still run in process.

- **`imp fmt` drives the dprint wasm plugins**, through the multi-plugin context of
  `@dprint/formatter`. Those are the same engines that `deno fmt` uses. They include the same
  third-party crates for CSS, which is `malva`, for HTML, which is `markup_fmt`, and for YAML, which
  is `pretty_yaml`. The JavaScript plugin runs with its `deno` preset, so the JavaScript output
  matches `deno fmt`. TypeScript is deliberately out of scope for both commands. imp is buildless,
  and an app is plain JavaScript. imp formats an embedded `<script>` and `<style>` in HTML through
  the host delegation of the context. `cli/src/fmt-plugins.js` pins each plugin wasm file by version
  and by checksum. `tools/download-fmt-plugins.js` downloads them, and `deno compile --include`
  embeds them.
- **`imp lint` runs the core `Linter` of ESLint.** That is `eslint/universal`, which is pure
  JavaScript and needs no filesystem. imp runs it with the recommended rules of `@eslint/js`, the
  browser globals, and the rules of imp from `cli/src/lint-rules.js`. imp lints an HTML file by
  extracting each inline `<script>` block, and by mapping a diagnostic back to its original line.
  The same embedded `Linter` drives the dead-code pass over the whole project, see
  `project-wide-dead-code.md`. The file walker of imp feeds both commands.
- **The directives carry the imp brand.** imp configures the ignore comments of the formatter as
  `imp-fmt-ignore` and `imp-fmt-ignore-file`. imp rewrites an `imp-lint-ignore` and an
  `imp-lint-ignore-file` comment to the directive syntax of the engine, before it lints.

## Consequences

- The binary is fully self-contained, and it works offline. There is no toolchain to download, no
  `deno` on the machine, and no difference of version between imp and its tools. An imp release pins
  the behaviour of its formatter and of its linter. `deno task imp` in this repository runs that
  same compiled binary. So there is no second code path that could differ from it.
- `imp fmt` formats CSS, HTML and YAML with no setup, and a plain `deno fmt` puts these behind an
  unstable flag. `imp lint` covers an inline script in HTML, and `deno lint` cannot.
- A lint rule name follows the conventions of ESLint, and somebody writes a new imp rule against the
  plugin API of ESLint. Linting is slower than a native linter in Rust. That is acceptable at the
  scale of the buildless projects that imp targets. oxlint is available as a replacement later, if
  that changes.
- The wasm plugins add about 10 MB to the binary. The pre-bundled ESLint adds about 1.3 MB, see
  `prebundled-npm-dependencies.md`. `deno run -A tools/download-fmt-plugins.js` and
  `deno run -A tools/prebundle-npm-deps.js` must run before a compile. The `compile` task runs both,
  and every task that invokes imp goes through that task.
- imp does not support a lint plugin that a user supplies. That would need a dynamic import of user
  JavaScript inside a compiled binary, and imp must verify that separately.
