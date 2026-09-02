# resize - shrink an oversized PNG or JPEG asset

```
imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]
```

`imp resize` corrects the most common cause of repository bloat. An image is committed much larger
than the page shows it. The command is a downscaler, not an image editor. Any operation other than a
resize is out of scope.

| Flags given           | What happens                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| neither `-w` nor `-h` | **inspect mode**. imp reports the dimensions and the byte size. It writes no file. If the asset is oversized, it prints a resize command that you can run. |
| one of `-w` / `-h`    | imp resizes to that dimension. It computes the other dimension from the aspect ratio.                                                                      |
| both                  | imp scales to the largest size that **fits inside** that width x height box.                                                                               |
| both plus `--stretch` | imp resizes to exactly that size. The picture is distorted.                                                                                                |

```
imp resize assets/hero.png                 # check first, this is the natural first step
imp resize assets/hero.png -w 1200         # then downscale in place
imp resize assets/hero.png -w 1200 --output assets/hero-small.png
```

## Rules an agent gets wrong

- **imp overwrites the file by default.** This fits the purpose of the command, which is to shrink a
  committed asset. To keep the original, pass `--output`. In both cases imp reports the size before
  and after.
- **imp never upscales.** imp clamps a request that is larger than the source to the source size.
- **imp always keeps the aspect ratio.** To change it, pass `--stretch`.
- **imp accepts static PNG and JPEG only.** imp detects WebP, GIF and animated images, and animated
  PNG. It rejects them with a message. It does not remove frames or change the format in silence.
- **imp keeps the quality high.** It applies minimal compression and changes the pixels only. For
  control of the compression or the quality, use a dedicated image tool.
- You can also use inspect mode to read the dimensions of any PNG or JPEG from the terminal.

An asset that is larger than `maxFileSize` fails [lint](lint.md). The default limit is 200 kB.
Usually the correct fix is to resize the asset. The other option is to add an exemption in
`maxFileSizeIgnore`, see [config](config.md).
