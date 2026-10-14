# Injected browser code lives in modules, and the CLI injects the source of a function

## Context

The dev server puts one classic inline `<script>` into the head of every page that it serves. That
script opens the reload channel, captures the console, page errors and the network for the
telemetry, registers the dev worker, and draws the review widget (`in-page-review-capture.md`). It
is more than 500 lines of browser code. The test runner, the preview element and the mock runtime
are more browser code of the same kind.

When that code is a string in a CLI source file, no tool reads it as code. An undefined name, an
empty block or a typo reaches the browser and fails only at runtime, in a page that a test must
open. The interpolations hide the inputs of the code, and every quote inside the script must be
escaped by hand.

The script must stay inline and classic. It must run before the app module, and a page that the
developer wrote must not need a new request or a module script to get it.

## Decision

**Browser code that the CLI injects as a script is a real module in `cli/js/`. The module exports
one function as `export const name = (input) => { ... }`. The CLI injects the source text of that
function, called with its inputs as JSON.**

- `cli/js/dev-client.js` exports `devClient`. `cli/js/review-widget.js` exports `reviewWidget`.
- `browser_script(module, input)` in `cli/src/browser-script.rs` returns
  `(<source of the function>)(<input>)`. The source is the text of the module after
  `export const <name> = `, read from the files that the binary embeds. The input comes from
  `script_safe_json`, which escapes `<` so that the JSON cannot close the `<script>` element.
- A browser function is self-contained. It reads every value that the CLI owns from its one
  argument: endpoints, storage keys, limits, labels and the markup of the widget. It does not read a
  name from the scope of its module, because only the function text reaches the page.
- A conditional part of the script is an input, not a string that the CLI leaves out. For example,
  `workerPath` is `null` when the project has its own service worker, and the client then registers
  no worker.
- The same rule serves the code that runs in the embedded QuickJS of the CLI, such as
  `cli/js/mock-runtime.js` and `cli/js/map-reader.js`, see `native-toolchain.md`.

There is no build step at runtime. The binary embeds `cli/js/` at compile time, see `cli/build.rs`,
so the injected text is exactly the text of the file in the repository.

## Consequences

- `cargo xtask check` formats the browser code and lints it with the recommended rules, like any
  other JavaScript in the repository.
- A browser function must not use a name from outside its own body, apart from browser globals. No
  tool checks this. A mistake shows as a `ReferenceError` in the page, which the e2e tests of the
  review widget and the dev server catch.
- A module in `cli/js/` holds its function and nothing else at its top, because the CLI cuts the
  text after `export const <name> = `.
- The CSS and the HTML of the review widget are files in `cli/templates/`. They are not JavaScript,
  and the widget gets them through its `html` input.
- A module that the CLI bundles into a page, such as `cli/js/preview-runtime.js`, is imported, not
  injected, so the one-function rule does not apply to it.
