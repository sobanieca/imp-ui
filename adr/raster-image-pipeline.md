# Raster image pipeline - resvg decode + resize, format-preserving encode, no new codec

## Context

Two features must resize a raster image in process. The first is the scaling of a PWA icon, see
`pwa-toolkit.md`. The second is `imp resize`, the utility that shrinks an oversized committed PNG or
JPEG. `in-process-toolchain.md` forbids a subprocess. So ImageMagick, sharp and ffmpeg are all out.
The pipeline must be pure wasm and JavaScript, vendored and put into the binary.

The PWA icons already solved half of this. The vendored `@resvg/resvg-wasm` rasterizer scales a
source image. It embeds the image in a wrapper SVG, and renders that SVG at a target size. But resvg
**encodes** PNG only. A general resize command cannot use resvg alone. If you gave it a JPEG and got
a PNG back, the file would usually become larger. That defeats the whole purpose of shrinking a
committed asset.

The obvious path was to vendor a dedicated raster codec, such as Photon or jSquash, which decodes,
resizes and encodes across PNG, JPEG and WebP. imp evaluated that path, and rejected it for the
first version. It adds a new wasm dependency, or several, with licence notices and prebundle work,
and the binary already carries both halves of a pipeline that keeps the format.

## Decision

imp builds the resize entirely from dependencies that the binary already holds. One shared module,
`cli/src/image.js`, exposes them:

- **The decode and the resample run through `@resvg/resvg-wasm`.** That is the same rasterizer that
  the PWA icons already use. imp embeds the source image as a data URI in a wrapper SVG, and sizes
  that SVG to the target. resvg decodes the PNG or the JPEG, resamples it to the requested
  dimensions, and exposes both the raw RGBA pixels and a PNG encoding of the result. `initResvg`,
  `renderSvg` and `dataUri` live in `cli/src/image.js`. `pwa.js` and `resize.js` both import them.
  So there is one initialization of the rasterizer, and one convention for the wrapper SVG.
- **The encode keeps the format of the source.** PNG output is the `asPng()` of resvg. JPEG output
  is encoded again from the resized RGBA pixels, with `jpeg-js`. imp already vendors `jpeg-js` for
  the recording of an e2e video, see `test-video-recording.md`. Its prebundle also exports
  `encodeJpeg`. So one copy of `jpeg-js` serves both features, and imp does not duplicate the codec.
- **The behaviour is fixed, and you do not configure it.** A resize only downscales. imp clamps a
  requested dimension that is larger than the source to the source, and never upscales. With one
  dimension, imp keeps the aspect ratio. With both dimensions, imp resizes to exactly that size, and
  accepts the distortion. imp encodes a JPEG again at a high fixed quality. That is minimal
  compression, and quality above the last byte. imp names a dedicated image tool as the way to get
  finer control. With neither dimension, `imp resize` writes nothing, and prints a recommended
  command. That is guidance, and not an error.

**The format scope is PNG and JPEG.** WebP and GIF are out of the first version. resvg has no WebP
encoder, and animation is out of scope. imp detects such a file and rejects it, with a clear message
that says the format is not supported yet. That includes an animated PNG. imp does not change the
format in silence, and it does not flatten the frames. To cover more formats later, somebody vendors
a codec for them. The shared module is the place where that codec plugs in.

## Consequences

- There is no new dependency, no new prebundle entry and no added licence notice. The resize command
  reuses the resvg rasterizer and the `jpeg-js` codec that the binary already ships. The scaling of
  a PWA icon and `imp resize` share one image module, in place of two setups of a rasterizer.
- The guarantee of no subprocess, from `in-process-toolchain.md`, holds. The whole pipeline is wasm
  and JavaScript, inside the binary.
- Output that keeps the format leaves a shrunk JPEG as a JPEG. So the byte size really falls. The
  PNG-only limit of resvg applies to a PNG source only.
- The reuse ties the format coverage of the resize to what resvg can decode, and to what `jpeg-js`
  can encode. imp defers WebP and animation on purpose, to a future codec behind the same shared
  module. imp does not design for them now.
