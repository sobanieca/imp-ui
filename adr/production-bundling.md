# Production build - `imp build` over vendored bundles and the baked-in library

## Context

Development is buildless. `imp start` serves a source file without a change, and injects an import
map. That map points `imp` at the served library, and points each dependency alias from `imp.json`
at its vendored `dependencies/<alias>/` bundle, see `vendored-dependencies.md`. Production needs the
opposite shape. It needs self-contained, minified static files, with no import map and no imp
runtime, that you can upload to any static host. The output must resolve a specifier exactly as
development did. Otherwise what you tested is not what you ship. The question of the bundling engine
was already settled for `imp install`. It is esbuild-wasm with `@deno/esbuild-plugin`, fully in
process, see `in-process-dependency-bundling.md`. The bundling utilities of Deno are still not
available inside a compiled binary. `deno bundle` is removed from `denort`, and `Deno.bundle()`
throws in a compiled binary. imp probed both against Deno 2.9.

## Decision

The command is `imp build`, and not `imp bundle`. To bundle JavaScript is only part of the
production of a site that you can deploy. The command owns the whole step that produces the
production output, and it is expected to emit other generated files beside the bundled code. Planned
PWA support, for example, adds a manifest, icons and a service worker. `build` names that whole
step.

`imp build [file.html|file.js] [--output dist]` reuses the engine of `imp install` to build the
module graph of the app. It resolves a bare specifier in the same way as the import map of the dev
server, offline. An esbuild resolver that imp owns intercepts before the resolver of Deno:

- **`imp` resolves to the library source that imp baked into the binary.** imp loads it from the
  virtual filesystem of the compiled binary. imp addresses an entry point and a library module as an
  absolute `file://` URL. imp resolves a local entry path against the project before it bundles,
  because a relative path would otherwise resolve into that virtual filesystem, and not into the
  project.
- **Each dependency alias resolves to its vendored `dependencies/<alias>/` bundle.** imp contacts no
  registry. A declared alias with no vendored bundle fails the build, and the message suggests
  `imp install`.
- **An HTML entry hashes every script.** Every `<script type="module">` with a local `src` becomes
  an entry point. imp writes its bundled output to `chunks/<name>-<hash>.js`, and rewrites the `src`
  in the built HTML to match. The HTML file keeps its plain name. imp bundles an inline module
  script as another entry, and writes it as `chunks/inline-<n>-<hash>.js`. A module that loads
  lazily, through `import()`, and code that two entry points share, both go into a file under
  `chunks/`, with a content hash. An asset that the code imports goes there too. So every hashed
  file of a build lives under `chunks/`, and only there. A host caches that folder for a year and
  revalidates every other file on each load, with no special case. A `public/chunks/` folder stops
  the build, because a copied file with no hash must never get that cache.
- **A JS entry keeps its plain name.** A consumer imports that file by name, so a hash would break
  every import of it.
- **imp reads the HTML entry with a real HTML parser, parse5**, which follows the parsing rules of
  the HTML standard. So a script in a comment, in a `<textarea>` or in an attribute value is text,
  as it is for a browser. An attribute value that holds `>` does not end its tag. imp edits the
  source at the offsets that the parser reports, and it writes no page again from a tree. So the
  rest of the page keeps its layout, its case and its quotes. The dev server, the preview and the
  linter read a page with the same parser.
- **A static asset ships from `public/`.** imp copies its contents to the root of the output,
  without a change, and it copies nothing else. See `public-folder-static-assets.md`. The output
  directory, which is `dist/` by default and which imp replaces on each run, is the complete site to
  upload.
- **A JS entry emits a self-contained module.** imp compiles in imp and every dependency. So you can
  drop an imp component into any application, and it needs no runtime. imp copies no file in this
  mode.
- **`targetImpHost: true` in `imp.json`, for a JS entry only, keeps an `imp` import out of the
  bundle**, as a bare specifier for the host context to resolve. The import map of the dev server,
  and the `imp build` of a host app, both resolve a bare `imp`. So a component can share the single
  copy of imp of the host, in place of its own copy. `imp` is the only import that can stay bare.
  imp always compiles a declared dependency in, at the vendored, pinned version. That keeps the
  option one boolean, and not a list per import. An HTML entry compiles imp in anyway. The page is
  its own host, and its production output has no import map that could resolve a bare import.
- **A built page runs under a strict Content Security Policy**, with no hash, no nonce and no
  setting. The policy is `script-src 'self'; style-src 'self'`. The build output has no inline
  script. An inline module script becomes a hashed file under `chunks/`. The environment values go
  into a hashed `chunks/env-<hash>.js`, and the registration of the service worker goes into a
  hashed file too. A `style` prop that is a string sets `node.style.cssText`, which a policy does
  not check. The constructed stylesheets of the components are not checked either. An e2e test
  serves a built app, with the PWA and environment values, under that policy, and fails on any
  report of a violation. imp writes no policy. It emits no `<meta http-equiv>` tag and no host file,
  because the app owns its origins and the host owns the format of its headers. Trusted Types are
  out of scope: `require-trusted-types-for 'script'` blocks the `innerHTML` of `html()`.
- **A page build adds a `modulepreload` hint** for each chunk that an entry script imports
  statically, directly or through another chunk. A chunk behind `import()` gets no hint.
- **`build.maxSize` in `imp.json` is a budget for the whole output.** A build over it fails, names
  the largest files and removes the output folder, the same way as the `licenses` gate stops a
  build. imp adds no subresource integrity, because every script is same-origin and hashed. It does
  not compress in advance, because the host compresses.
- **imp writes no source map.** There is no flag and no key that turns one on. The error handling of
  the app identifies a production error, not a map back to the source.

## Consequences

- A production build is offline, and it is deterministic from the state of the repository. The pins
  in `imp.json`, and the committed bundles in `dependencies/`, fully determine the input. So imp
  needs no lock file, see `vendored-dependencies.md`.
- Development and production resolve a specifier in the same way. The output that you ship needs no
  import map, and no imp runtime.
- The dead-code elimination reaches the library itself, and not only the app. No library module does
  work when somebody imports it. So an app carries only the subjects and the components that it
  uses, see `tree-shakeable-library.md`.
- A development check in the library reads `globalThis.__IMP_DEV__`, and the build defines that
  expression as `false`. So the minifier drops the check, and the module that holds it leaves the
  bundle, see `development-checks.md`.
- The entry HTML is the one file of a page build that a host must revalidate on every load. Every
  script has a content hash, so a stale cache of the HTML is the only way to serve an old build.
- Each vendored bundle enters the graph as one opaque module that imp already minified. imp emits it
  once, and shares it across all the chunks. But a transitive package that two different vendored
  bundles hold stays duplicated in the output. imp accepts that deliberately, see
  `transitive-duplication-accepted.md`. The tree-shaking inside a vendored bundle is also limited to
  what its bundled form exposes.
- A bundle that you build for an imp host trades the guarantee of a frozen version for sharing. The
  component runs against the imp version that the host provides. So the version of the author and
  the version of the host can differ. A self-contained bundle never has that contract. In exchange,
  the host page holds one instance of imp, and that matters when imp carries shared state. The
  difference of version is limited to imp. Every other dependency ships frozen inside the bundle, at
  the cost of a possible duplicate between the host and the component, see
  `transitive-duplication-accepted.md`.
- `imp install` closes the consumer side of this contract. While it vendors a package, it treats
  `imp` as external. So a published bundle that somebody built with `targetImpHost` keeps its bare
  `imp` imports. imp does not resolve them against a registry. See `vendored-dependencies.md`.
- A stack trace from a production build points into minified code. So the app must implement proper
  error handling. It puts an error boundary around each subtree that can fail on its own, see
  `error-boundaries.md`. It catches the rejection of async work that is not part of a mount. It
  reports each error with a message and a context that identify the failure without the stack trace.
  The output has no second set of files to keep private or to upload to a service.
- esbuild in wasm is about ten times slower than native esbuild. imp pays that cost per `imp build`
  run, and never while it serves.
