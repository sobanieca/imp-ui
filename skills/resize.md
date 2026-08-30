# resize - shrink an oversized PNG or JPEG asset

```
imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]
```

For the common repository bloat: an image committed far larger than the page ever displays it. It is
a downscaler, not an image editor - anything beyond a straight resize is out of scope.

| Flags given           | What happens                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| neither `-w` nor `-h` | **inspect mode** - reports dimensions and byte size, writes nothing, and prints a ready-to-run resize command if the asset is oversized |
| one of `-w` / `-h`    | resizes to that dimension, computing the other from the aspect ratio                                                                    |
| both                  | scales to the largest size that **fits inside** that width x height box                                                                 |
| both plus `--stretch` | resizes to exactly that size, distorting the picture                                                                                    |

```
imp resize assets/hero.png                 # check first - this is the natural first step
imp resize assets/hero.png -w 1200         # then downscale in place
imp resize assets/hero.png -w 1200 --output assets/hero-small.png
```

## Rules an agent gets wrong

- **The file is overwritten by default.** That fits the purpose - shrinking a committed asset - but
  pass `--output` when the original must survive. Either way imp reports before and after.
- **It never upscales.** A request larger than the source is clamped to the source.
- **Aspect ratio is always preserved** unless you explicitly pass `--stretch`.
- **Only static PNG and JPEG.** WebP, GIF, and animated images (animated PNG included) are detected
  and rejected with a message rather than silently losing frames or changing format.
- **Quality is prioritised over the last byte** - minimal compression, pixels only. For fine-grained
  control of compression or quality, use a dedicated image tool.
- Inspect mode doubles as a quick way to read any PNG or JPEG's dimensions from the terminal.

An asset over `maxFileSize` (200 kB by default) fails [lint](lint.md) - resizing it is usually the
right fix, and exempting it in `maxFileSizeIgnore`, see [config](config.md), is the deliberate
alternative.
