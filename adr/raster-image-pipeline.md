# Raster image pipeline - native decode, resize and encode, format kept

## Context

Two features must resize a raster image in process. The first is the scaling of a PWA icon, see
`pwa-toolkit.md`. The second is `imp resize`, which shrinks an oversized PNG or JPEG asset in place.
`native-toolchain.md` forbids a subprocess. So ImageMagick, sharp and ffmpeg are all out. The
pipeline must be code that compiles into the binary.

## Decision

The pipeline uses two crates, and one module of imp, `cli/src/image.rs`, exposes them:

- **The PWA icons render through `resvg`.** imp embeds the source image in a wrapper SVG with the
  background and the inset of the icon, and renders that SVG at the target size. An SVG source and a
  raster source go through the same path.
- **`imp resize` decodes, resamples and encodes through the `image` crate.** It decodes the PNG or
  the JPEG, resamples it with a Lanczos3 filter, and encodes the result again.
- **The encode keeps the format of the source.** A PNG stays a PNG, encoded at the best compression.
  A JPEG stays a JPEG, encoded at a fixed quality of 92. imp never changes the format in silence.
- **The behaviour is fixed, and you do not configure it.** A resize only downscales. imp clamps a
  requested dimension that is larger than the source to the source, and never upscales. With one
  dimension, imp keeps the aspect ratio. With both dimensions, imp resizes to exactly that size, and
  accepts the distortion. imp names a dedicated image tool as the way to get finer control. With
  neither dimension, `imp resize` writes nothing, and prints a recommended command. That is
  guidance, and not an error.

**The format scope is PNG and JPEG.** WebP and GIF are out, and so is animation. imp detects such a
file and rejects it, with a clear message that says the format is not supported. That includes an
animated PNG. imp does not flatten the frames.

## Consequences

- The scaling of a PWA icon and `imp resize` share one image module.
- The guarantee of no subprocess, from `native-toolchain.md`, holds. The whole pipeline is native
  code inside the binary.
- Output that keeps the format leaves a shrunk JPEG as a JPEG. So the byte size really falls.
- To cover more formats later, somebody enables a codec of the `image` crate. The shared module is
  the place where that codec plugs in.
