# imageUpload crops and resizes in the browser, and its value is a data URL

## Context

An app that takes a profile picture or a cover image has three needs that `fileUpload` does not
serve. The picture must fit a ratio, so the person must choose which part of it to keep. The server
must not receive a photo of 12 megapixels for a 256 pixel avatar. And the form must hold something
that shows a preview, that validates as `required`, and that survives a submit as plain data.

`fileUpload` holds `{ id, name, size, type }` entries and hands the `File` objects to `onFiles`.
That contract fits any file, but it cannot show a picture, and it cannot describe a crop. A `File`
cannot enter a state, see `state-plain-data-values.md`. The rich text editor already resizes a
pasted picture in the browser and embeds it as a data URL. So the library holds a working
client-side pipeline: `createImageBitmap` decodes, an `OffscreenCanvas` resamples, and
`convertToBlob` encodes.

## Decision

- **The crop and the resize run in the browser, before anything is sent.** The person picks one
  picture. imp opens it in a frame with the ratio of `aspect`, or 1:1 for `shape: 'circle'`, or the
  ratio of the picture when neither is set. The picture covers the frame. A drag, the arrow keys, a
  wheel, or the zoom slider move the frame over the picture. Done cuts that region out of the
  decoded original and fits it inside `maxWidth` by `maxHeight`. imp never upscales.
- **The value is a string: a data URL, or `undefined`.** A data URL is plain data. It sits in a
  form, it shows as a preview with no extra state, and it travels in JSON. A stored picture is any
  URL in the same place. The output `File` goes to `onImage`, for a `FormData` upload, and `null`
  follows a removal.
- **The crop and the pan use fractions, not pixels.** The state of the editor is a zoom and a centre
  as fractions of the picture. The visible region follows from the ratio and the zoom. So the
  picture is placed with percentages, the frame needs no measurement to render, and a resize of the
  page keeps the crop. Only a pointer drag reads the size of the frame, to turn pixels into
  fractions.
- **The output keeps the format family of the source.** A PNG, GIF, WebP or SVG source becomes a
  PNG, so transparency survives. Everything else becomes a JPEG at a fixed quality. This is the same
  rule as the embedded picture of `richTextEditor`, and both share one module.
- **A circle changes the frame and the preview, not the pixels.** The output of a circle is a square
  file. An app draws it round where it shows it. A round PNG with transparent corners costs several
  times the bytes of a square JPEG, and every place that shows an avatar draws it round anyway.
- **Nothing is written before Done.** A pick opens the editor and changes no value. Cancel returns
  to the previous value. So a form never holds a half-edited picture.
- **The placeholder and the preview share one box, and there is no size prop.** The empty state
  draws a box of that size with the prompt beside it, and the filled state draws the preview in the
  same box with the buttons beside it. So a form does not move when a picture arrives. The preview
  never grows past its own pixels, so a small output is not stretched and blurred. Only the editor
  is wider, because a crop needs room to drag.

## Consequences

- The server receives a picture of the size and the ratio that the app asked for. There is no
  server-side crop, no orientation fix, and no oversized upload.
- A data URL of a large output is a large string in the state. The defaults are 1920 by 1920 pixels.
  An app that stores the value in JSON sets `maxWidth` and `maxHeight` to what the page shows.
- Adjust works while the component holds the source `File`. A stored URL has no source, so the
  preview of a stored picture has no Adjust button. The component decodes the source again for
  Adjust, and it does not keep the decoded bitmap in memory after Done.
- The pipeline is the platform: `createImageBitmap`, `OffscreenCanvas` and `convertToBlob`. imp
  ships no codec and reads no EXIF. The browser applies the orientation of the source.
