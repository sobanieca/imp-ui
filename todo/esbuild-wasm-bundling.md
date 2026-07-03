# Switch dependency bundling to esbuild-wasm for compiled binaries

`npm:esbuild` spawns a native binary at runtime. Inside a compiled imp binary that spawn fails
(`TypeError ... child.unref` from esbuild's `ensureServiceIsRunning`), breaking the `npm:`/`jsr:`
bundling in `src/cli/deps.js` and with it `imp start`'s `/@dep/` serving. This is the last
subprocess dependency left in the CLI — fmt and lint already run fully in-process (see
`adr/in-process-toolchain.md`).

The default `npm:esbuild-wasm` entry also fails (its Node path spawns a worker script missing from
the compiled binary's virtual filesystem). The variant that works — verified both under `deno run`
and compiled, against Deno 2.9 — is the ESM browser build with a manually supplied wasm module:

```js
import * as esbuild from 'npm:esbuild-wasm@^0.24/esm/browser.js'

const wasmUrl = new URL(import.meta.resolve('npm:esbuild-wasm@^0.24/esbuild.wasm'))
const wasmModule = await WebAssembly.compile(await Deno.readFile(wasmUrl))
await esbuild.initialize({ wasmModule, worker: false })
```

The `.wasm` file is embedded automatically by `deno compile` and readable in-process.

**Fix:** switch `deps.js` to this esbuild-wasm setup. Caveat: wasm esbuild is roughly 10× slower
than native (mitigated by the existing per-specifier cache in `deps.js`).

`@luca/esbuild-deno-loader` is now verified **not** to cover the compiled case: its `portable`
loader requires a `node_modules` directory to resolve `npm:` specifiers and its `native` loader
shells out to the `deno` binary. Resolution needs imp's own resolver-loader plugin — designed in
`bundle-command.md` and shared with `imp bundle`; implement it once for both.

Once implemented, extend the compiled-binary smoke test to cover `/@dep/` serving (compile, run
`imp start` against a fixture importing an `npm:` package, request the bundled module).
