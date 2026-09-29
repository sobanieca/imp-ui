# In-process dependency bundling - esbuild-wasm plus the Deno esbuild plugin

## Context

`imp install` turns each `npm:` and `jsr:` dependency into a minified ESM bundle that the browser
can run. It vendors that bundle under `dependencies/`, see `vendored-dependencies.md`. The first
implementation used native `esbuild` with `@luca/esbuild-deno-loader`. Both fail inside the one
self-contained binary that `deno compile` produces:

- **Native esbuild starts a subprocess.** It launches an executable for the platform, and talks to
  it over a pipe. Inside the compiled binary, that launch fails with
  `Cannot read properties of undefined (reading 'unref')`. That also contradicts
  `in-process-toolchain.md`, which requires the binary to start no process.
- **`@luca/esbuild-deno-loader` cannot resolve a dependency there.** Its portable loader needs a
  `node_modules` directory. Its native loader calls the `deno` binary. Neither one exists on the
  machine of an end user who runs only the imp binary.

imp scoped a resolver-loader of its own for esbuild. That would cover npm registry metadata, semver,
a tarball fetch with an in-process extraction, a jsr manifest, transitive resolution and an
`exports` map. That is a large implementation of a package manager, and the risk is high.

## Decision

Dependency bundling runs fully in process, and imp writes no resolver of its own:

- **The engine is `esbuild-wasm`.** imp loads the ESM browser build, supplies the wasm module by
  hand, and sets `worker: false`, as in `esbuild.initialize({ wasmModule, worker: false })`. That is
  the one esbuild-wasm entry that works under `deno run` and after a compile. The default entry
  starts a worker script, and that script is absent from the virtual filesystem of the binary.
  `deno compile --include src` reaches the whole `src/` tree, and embeds the wasm. The npm package
  of esbuild-wasm carries its asset, and that asset is embedded as part of the package.
- **The resolver-loader is the official `@deno/esbuild-plugin`.** That plugin is built on
  `@deno/loader`, which is a wasm build of the same Rust crates that Deno itself uses. It resolves
  and fetches an `npm:` specifier from `registry.npmjs.org`, and a `jsr:` specifier from `jsr.io`,
  by itself, over the network. It needs no `node_modules`, no lock file, and no `deno` on the
  machine.

- **Every call to esbuild goes through one function, `runEsbuild`.** The browser build of
  esbuild-wasm has a virtual file system in the POSIX style. It accepts only a path that starts with
  `/`, so it rejects a Windows path such as `C:\app\main.js`. On Windows, `runEsbuild` turns each
  native path into a POSIX form before esbuild sees it: `C:\app\main.js` becomes `/C:/app/main.js`,
  and `\\server\share` becomes `/UNC/server/share`. That covers the entry points, the output folder,
  the working folder, and every path that a plugin returns. It turns each path that esbuild gives
  back into the native form again: the arguments of a plugin callback, the output files and the
  metafile. So no caller and no plugin handles a path of the other form. On other systems the two
  forms are the same, and the function changes nothing.
- **`runEsbuild` gives every file of the metafile as an absolute path.** esbuild writes it relative
  to the working folder. The callers compare an output with a file on disk, so one absolute form
  removes the guesswork. A key in another namespace, such as `imp-library:`, keeps its prefix.

`cli/src/deps.js` initializes esbuild-wasm on first use. It bundles each installed specifier with
`[denoPlugin()]`, minified. It emits a non-JS asset, such as a wasm file, an image, a font or a
stylesheet, as a sibling file in the vendor folder of the dependency.

## Consequences

- The compiled binary is self-contained for bundling. It needs no `deno` on the machine, no
  `node_modules` and no subprocess. That removes the last subprocess that the CLI depended on, and
  it fully satisfies `in-process-toolchain.md`.
- `imp install` needs the network, and `imp fmt` and `imp lint` do not. It fetches a package from
  the npm registry and from the jsr registry. A download lands in the global cache of Deno for that
  user, which is `DENO_DIR`. It never lands inside the project. The only output that the project
  sees is the vendored bundle, see `vendored-dependencies.md`.
- esbuild in wasm is about ten times slower than native esbuild. imp pays that cost once per
  `imp install`. It never pays it while it serves, or in CI.
- The resolution semantics match those of Deno, because the plugin uses the resolver crates of Deno.
  That is the same behaviour that an app gets from imp. `imp build` reuses the same engine and the
  same resolver, see `production-bundling.md`.
