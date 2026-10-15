# Native toolchain - one Rust binary, no subprocess for its own tools

## Context

imp is distributed as one self-contained binary. Every command must work on a machine that has only
that binary: no runtime to install, no `node_modules`, and no network for `imp fmt`, `imp lint`,
`imp build` or `imp test`. The tools that imp needs are a formatter, a linter, a bundler, an image
encoder, a static analyzer for the dead-code checks, and a JavaScript engine for the code that a
user writes for the CLI itself: a mock and an application map. A tool that runs as a separate
process would need its own binary on the machine, and a tool that runs on a JavaScript runtime would
need that runtime in the binary, with the size and the startup time that it costs.

## Decision

imp is a Rust program. Every tool that it needs is a Rust crate that compiles into the one binary,
and imp never starts a subprocess for its own toolchain.

- **`imp fmt` formats JavaScript with `oxc_formatter`,** the formatter of the oxc project. It shares
  the parser of `imp lint` and of the bundler, so the binary holds one JavaScript parser.
  `dprint-plugin-json` formats JSON and `dprint-plugin-markdown` formats Markdown. `malva` formats CSS, `markup_fmt` formats HTML and `pretty_yaml` formats YAML. The
  Markdown and HTML formatters hand an embedded code block, a `<script>` or a `<style>` to the
  formatter of its language. The `singleQuote` setting applies to JavaScript and to CSS. TypeScript
  is out of scope. imp is buildless, and an app is plain JavaScript.
- **`imp lint` runs on the oxc parser and its semantic analysis.** imp implements the recommended
  rules and its own rules against that analysis. A rule keeps the name and the behaviour that it has
  in ESLint, so `no-unused-vars` skips a name that starts with `_`. imp lints an inline `<script>` of
  an HTML file, and maps each finding back to its line. The same parser drives the dead-code pass
  over the whole project, see `project-wide-dead-code.md`.
- **The bundler is rolldown,** with one imp plugin. The plugin resolves `imp` and its subpaths to
  the library that the binary embeds, a vendored alias to its folder under `dependencies/`, and an
  `npm:` specifier through the resolver of imp, see `dependency-bundling-with-rolldown.md`.
  `imp build`, `imp start`, `imp preview`, `imp install` and `imp test` share that one bundler.
- **Code that a user writes for the CLI runs in an embedded QuickJS,** through `rquickjs`. That
  covers the mocks of `imp start`, see `dev-server-mocks.md`, and the application map of
  `imp map`, see `application-map.md`. Such code has the language and `console`, and the mocks also
  get timers. It has no DOM and no network.
- **The binary embeds its assets at compile time.** `cli/build.rs` lists the library in `lib/src`,
  the skills, the browser modules in `cli/js`, the templates, the vendored browser driver and the
  licence files, and `include_bytes!` puts each one in the binary.
- **The directives carry the imp brand.** The formatter honours `imp-fmt-ignore` and
  `imp-fmt-ignore-file`. In JavaScript, imp renames an `imp-fmt-ignore` comment to the marker of
  `oxc_formatter` before the format, and back after it. The linter honours `imp-lint-ignore` and `imp-lint-ignore-file`.

## Consequences

- The binary is fully self-contained, and it works offline. There is no runtime and no toolchain to
  download, and no difference of version between imp and its tools. An imp release pins the
  behaviour of its formatter, its linter and its bundler.
- `oxc_formatter` is not published on crates.io. The workspace takes it from the git tag of the oxc
  release, and a `[patch.crates-io]` table takes every other oxc crate from the same tag. So
  rolldown, the linter and the formatter compile against one copy of oxc. An upgrade of oxc moves
  that tag in both places, together with the version of rolldown.
- A rule of the recommended set exists only when imp implements it. A user cannot load a lint plugin
  of their own.
- `imp test` keeps two approved exceptions about a subprocess, see `two-level-testing.md`: the
  browser, which is the system under test, and the fan-out of a level over copies of imp itself.
- In this repository, `cargo imp <args>` builds the binary and runs it. There is no second code path
  that could differ from the binary that users get.
