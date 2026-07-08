# `imp resize` — image resize utility

Add an `imp resize` command that resizes an image asset, aimed at shrinking oversized committed
assets (pairs naturally with the `maxFileSize` lint/install check in `file-size-limit.md`). It is a
convenience utility for the common case, not a full image editor — anything advanced is out of scope
by design.

## Usage

```
imp resize <image> [-w|--width <px>] [-h|--height <px>]
```

- **Both `-w` and `-h`** — resize to exactly that width × height, **not** preserving aspect ratio
  (the user asked for a specific size and accepts the distortion).
- **Only one of `-w` / `-h`** — resize to that dimension and derive the other to **preserve the
  original aspect ratio**.
- **Neither** — do not modify the file. Instead inspect the image and **print a recommended
  `imp resize` command** the user can copy to reduce the asset's size (e.g. suggest a sensible max
  dimension based on the current dimensions / byte size), then exit. This makes the no-arg form a
  guidance mode, not an error.

Resize with **minimal compression** — prioritize quality, only downscaling pixels. Users who need
fine-grained compression/quality control should reach for a dedicated image tool; keep imp's surface
small and note that in the docs and in the no-arg guidance output.

## Scope — static images first

Support common static raster formats initially (PNG, JPEG, WebP — confirm what the chosen codec
covers). **Animated images (GIF, animated WebP) are explicitly out of scope for the first cut** but
should be considered later; detect them and fail with a clear "animated images not yet supported"
message rather than silently flattening to a single frame.

## In-process constraint — no subprocess

Per `adr/in-process-toolchain.md` the imp binary must never spawn a subprocess for its own tooling,
so resizing **cannot** shell out to ImageMagick / sharp / `ffmpeg`. It must run through a pure-wasm
or pure-JS decode + resize + encode pipeline, vendored and pinned by checksum and embedded with
`deno compile --include`, exactly like the esbuild-wasm module and the dprint fmt plugins
(`adr/in-process-dependency-bundling.md`, `cli/src/vendor`, `cli/src/fmt_plugins.js`). Pick one
codec that covers decode + resize + encode across the target formats; verify coverage before
committing to it. This is the **same image-pipeline decision** the PWA icon scaling needs
(`todo/pwa-command.md`) — resolve it once and share the module between both features.

## Output

- Decide the write behavior: overwrite in place vs. write a sibling file. Overwriting in place fits
  the "shrink a committed asset" use case, but confirm — possibly a `--out <path>` option,
  defaulting to in-place. Report the before/after byte size using the shared `formatSize` helper
  (`file-size-limit.md` proposes centralizing it).

## Wiring

- New command in `cli/src/main.js` dispatch and usage text, lazily importing a new
  `cli/src/resize.js`.
- Reuse the shared `formatSize` helper for size reporting.

## Docs

Document `imp resize` in `docs/cli.md`: the `-w`/`-h` rules (both = exact/aspect-breaking, one =
aspect-preserving, none = prints a recommended command), the minimal-compression stance with the
"use a dedicated tool for advanced needs" caveat, and the static-only / animated-later scope.

## ADR impact

Record an ADR for the image pipeline (the vendored wasm codec and the resize/scale behavior) shared
with the PWA icon work, and update the `adr/README.md` table. If any exception to
`adr/in-process-toolchain.md` is unavoidable, capture it there the way `test-command.md` scopes its
browser exception — but prefer a vendored wasm codec that keeps the no-subprocess guarantee intact.

## Open questions

- **Codec choice.** One wasm/JS library covering PNG/JPEG/WebP decode + resize + encode, small
  enough to embed. Shared with PWA icon scaling.
- **In-place vs. `--out`.** Default write target and whether to offer an explicit output path.
- **No-arg recommendation heuristic.** How to pick the suggested target dimension — a fixed max
  edge, or derived from current dimensions / file weight.
- **Upscaling.** Whether to allow resizing larger than the source, or clamp to the original size.
