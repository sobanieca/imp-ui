# Raster image pipeline - resvg decode + resize, format-preserving encode, no new codec

## Context

Two features need to resize a raster image in-process: PWA icon scaling (`pwa-toolkit.md`) and
`imp resize`, the utility that shrinks an oversized committed PNG/JPEG. `in-process-toolchain.md`
forbids spawning a subprocess, so ImageMagick/sharp/ffmpeg are off the table - the pipeline must be
pure wasm/JS, vendored and baked into the binary.

PWA icons already solved half of this: the vendored `@resvg/resvg-wasm` rasterizer scales a source
image by embedding it in a wrapper SVG and rendering at a target size. But resvg only **encodes**
PNG. A general resize command cannot lean on resvg alone: feeding it a JPEG and getting a PNG back
would typically make the file larger, defeating the whole purpose of shrinking a committed asset.

The obvious path - vendoring a dedicated raster codec (Photon, jSquash, …) that decodes, resizes,
and encodes across PNG/JPEG/WebP - was evaluated and rejected for the first cut: it adds a new wasm
dependency (or several), license notices, and prebundle wiring, when the binary already carries both
halves of a format-preserving pipeline.

## Decision

Resizing is built entirely from dependencies already in the binary, exposed through one shared
module (`cli/src/image.js`):

- **Decode + resample** run through `@resvg/resvg-wasm` - the same rasterizer PWA icons already use.
  The source image is embedded as a data URI in a wrapper SVG sized to the target; resvg decodes the
  PNG or JPEG, resamples to the requested dimensions, and exposes both the raw RGBA pixels and a PNG
  encoding of the result. `initResvg`, `renderSvg`, and `dataUri` live in `cli/src/image.js`;
  `pwa.js` and `resize.js` both import them, so there is one rasterizer init and one wrapper-SVG
  convention.
- **Encode preserves the source format.** PNG output is resvg's own `asPng()`. JPEG output is
  re-encoded from the resized RGBA pixels with `jpeg-js`, which is already vendored for e2e video
  recording (`test-video-recording.md`); its prebundle now also exports `encodeJpeg`, so one copy of
  `jpeg-js` serves both features rather than duplicating the codec.
- **Behavior is fixed, not configured.** Resizing only downscales: a requested dimension larger than
  the source is clamped to the source, never upscaling. One dimension preserves aspect ratio; both
  given resize to exactly that size (accepting distortion). JPEG re-encodes at a high fixed
  quality - minimal compression, quality over the last byte - with a dedicated image tool named as
  the escape hatch for finer control. With neither dimension given, `imp resize` writes nothing and
  prints a recommended command instead (guidance, not an error).

**Format scope is PNG and JPEG.** WebP and GIF are out of the first cut - resvg has no WebP encoder
and no animation is in scope - and are detected and rejected with a clear "not yet supported"
message (animated PNG included) rather than silently changing format or flattening frames. Extending
coverage later means vendoring a codec for the missing formats; the shared module is the seam where
that would plug in.

## Consequences

- No new dependency, no new prebundle spec, no added license notices: the resize command reuses the
  resvg rasterizer and the `jpeg-js` codec the binary already ships, and PWA icon scaling and
  `imp resize` share one image module instead of two rasterizer setups.
- The no-subprocess guarantee (`in-process-toolchain.md`) holds - the whole pipeline is wasm/JS in
  the binary.
- Format-preserving output keeps a shrunk JPEG a JPEG, so the byte size actually drops; the PNG-only
  limitation of resvg is confined to PNG sources.
- The reuse ties resize's format coverage to what resvg can decode plus what `jpeg-js` can encode.
  Broadening to WebP/animated is deliberately deferred to a future codec added behind the same
  shared module, not designed for now.
