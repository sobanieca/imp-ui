# Injected browser code lives in modules, and the CLI injects the source of a function

## Context

The dev server puts one classic inline `<script>` into the head of every page that it serves. That
script opens the reload channel, captures the console, page errors and the network for the
telemetry, registers the dev worker, and draws the review widget (`in-page-review-capture.md`). It
is more than 500 lines of browser code.

When that code is a template literal in a CLI module, no tool reads it as code. `deno lint` sees one
string. An undefined name, an empty block or a typo reaches the browser and fails only at runtime,
in a page that a test must open. The interpolations hide the inputs of the code, and every backtick
and `${` inside the script must be escaped by hand.

The script must stay inline and classic. It must run before the app module, and a page that the
developer wrote must not need a new request or a module script to get it. The compiled binary must
produce the same text as a test that imports the CLI module from source.

## Decision

**Browser code that the CLI injects as a script is a real module in `cli/src/browser/`. The module
exports one function. The CLI imports that function and injects its source text, called with its
inputs as JSON.**

- `cli/src/browser/dev-client.js` exports `devClient`. `cli/src/browser/review-widget.js` exports
  `reviewWidget`.
- `browserScript(run, input)` in `cli/src/browser-script.js` returns `(<source of run>)(<input>)`.
  The source comes from `Function.prototype.toString`, and the input from `scriptSafeJson`, which
  escapes `<` so that the JSON cannot close the `<script>` element.
- A browser function is self-contained. It reads every value that the CLI owns from its one
  argument: endpoints, storage keys, limits, labels and the markup of the widget. It does not read a
  name from the scope of its module, because only the function text reaches the page.
- A conditional part of the script is an input, not a string that the CLI leaves out. For example,
  `workerPath` is `null` when the project has its own service worker, and the client then registers
  no worker.

There is no build step and no file read at runtime. The function is ordinary code in the module
graph of the CLI, so the compiled binary holds it like any other module. V8 keeps the source text of
every function, so `toString` returns the same text from source and from the binary.

A text import (`with { type: 'text' }`) gives the text of the whole module. A module with an
`export` is not a valid classic script, so the CLI must edit that text. A file with no export must
read its inputs from a global name, and no linter knows that name. A bundle with esbuild at startup
costs time on every `imp start`, and gives nothing for code that has no imports.

## Consequences

- `deno lint` and `deno fmt` check the browser code like any other source. `deno task check` also
  runs `imp lint` in `cli/src/browser/`. That rule set knows the browser globals, so it reports an
  undefined name, which `deno lint` does not check.
- A browser function must not use a name from outside its own body, apart from browser globals. No
  tool checks this. A mistake shows as a `ReferenceError` in the page, which the e2e tests of the
  review widget and the dev server catch.
- The injected text is the formatted source of the function, so the script in the page keeps the
  formatting of the repo.
- The CSS and the HTML of the review widget stay template literals in `cli/src/review.js`. They are
  not JavaScript, and the widget gets them through its `html` input.
- `cli/src/preview-runtime.js` is not in this folder. It is already a module that esbuild bundles
  into the preview app. Its template literals are CSS only.
