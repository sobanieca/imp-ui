# imageUpload - pick one picture, crop it in a frame, and resize it on the client

```js
import { imageUpload, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'

imageUpload({
  field: 'avatar',
  label: 'Profile picture',
  shape: 'circle',
  maxWidth: 256,
  maxHeight: 256,
  onImage: (file) => {
    picture = file
  },
})
```

The call shape is `imageUpload(props?)`. It renders a native `<input type="file">` behind a drop
zone: a dashed box with the prompt inside it. A picked picture opens an editor: a frame with the
ratio of the crop, a zoom slider, and the buttons Done and Cancel. Done writes the cropped and
resized picture to the value, as a data URL. The value then shows as a preview in the same box, with
the buttons Change, Adjust and Remove under it.

| Prop        | Values                                     | Notes                                       |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| `field`     | dot path, e.g. `'profile.avatar'`          | Binds to that path of the surrounding form  |
| `value`     | a state, or a plain string                 | Standalone use, when there is no form       |
| `label`     | string, or a state holding one             | Rendered as a real `<label>` for the input  |
| `ariaLabel` | string                                     | Names it when there is no visible label     |
| `help`      | string, or a state holding one             | Hint under the control                      |
| `required`  | boolean                                    | Fails while there is no picture             |
| `disabled`  | boolean, or a state holding one - **live** | Blocks the pick, the editor and the buttons |

| Prop        | Values                          | Default       | Notes                                           |
| ----------- | ------------------------------- | ------------- | ----------------------------------------------- |
| `shape`     | `'rectangle'`, `'circle'`       | `'rectangle'` | The frame and the preview. Circle is 1:1        |
| `aspect`    | number, width over height       | -             | `1`, `16 / 9`. Absent: the ratio of the picture |
| `maxWidth`  | pixels                          | `1920`        | The output is never wider                       |
| `maxHeight` | pixels                          | `1920`        | The output is never taller                      |
| `maxSize`   | bytes                           | -             | The limit for the picked file                   |
| `accept`    | string, e.g. `'image/png,.jpg'` | `'image/*'`   | MIME types, `type/*` and `.extension`           |
| `compact`   | boolean                         | `false`       | A small box beside the prompt, for a form row   |
| `onImage`   | `(file: File \| null) => void`  | -             | The output `File`, or `null` on removal         |
| `validate`  | `(value) => message \| null`    | -             | `validateAsync` is the promise form             |

## The contract

- **The value is a string: a data URL of the output picture, or `undefined`.** It is plain data, so
  it sits in a form and travels in JSON. Seed the field with `undefined`. Put the URL of a stored
  picture there to show it. A stored URL shows the preview, and never reaches `onImage`.
- **`onImage` receives the output `File`.** imp calls it after Done, and with `null` after Remove or
  a reset of the form. Keep it in a variable and send it in `onSubmit`, in a `FormData`. Or send the
  data URL from the values and decode it on the server.
- **imp resizes on the client.** The output fits inside `maxWidth` by `maxHeight`, and it is never
  larger than the crop. A PNG, GIF, WebP or SVG source becomes a PNG. Every other source becomes a
  JPEG. The name of the output is the name of the source with that extension.
- **The frame keeps the ratio.** With `aspect`, the frame has that ratio and the picture covers it.
  With `shape: 'circle'`, the ratio is 1. Without both, the frame has the ratio of the picture. A
  drag, or the arrow keys on the focused frame, move the frame over the picture. The slider, the
  wheel, and `+` or `-` zoom up to four times.
- **A circle changes the frame and the preview, not the pixels.** The output is a square file. Draw
  it round where you show it, for example with `avatar`.
- **The placeholder and the preview share one box, and there is no size prop.** By default the box
  fills the width of the field, up to `24rem`, which is the width of the editor. Its ratio is
  `aspect`, or `16 / 9` without one. A circle is `12rem` wide. With `compact`, the box is `6rem`
  wide, square unless `aspect` says otherwise, and the prompt stands beside it. So the page does not
  move when a picture arrives. The preview never grows past its own pixels inside the box.

Rules an agent gets wrong:

- **`field` and `value` are alternatives.** Inside a form, use `field`. With both, imp warns and
  `field` wins. A `field` with no form around it is an error.
- **Do not put a `File` or a `Blob` in the value.** The value is a string.
- **Nothing is written before Done.** A pick opens the editor and changes no value. Cancel returns
  to what was there.
- **A data URL can be large.** For a photo, set `maxWidth` and `maxHeight` to what the page needs. A
  256 by 256 avatar is about 20 kB.
- **`compact` does not change the output.** `maxWidth` and `maxHeight` do. A box larger than the
  output shows the output at its own size, not stretched. Use `compact` for an avatar in a row of
  fields, and the default for a cover picture or a photo.
- **Adjust works only on a picture picked in this session.** It reopens the editor with the same
  crop. A stored URL has no source to adjust, so the button is hidden.
- **imp refuses a file outside `accept`, above `maxSize`, or one it cannot decode.** The field shows
  `imp.imageUpload.wrongType`, `imp.imageUpload.tooLarge` or `imp.imageUpload.unreadable`. The
  message goes away at the next pick, removal or submit. It does not block the submit.
- **`accept` is checked for a dropped file too.** A drop takes the first file only.
- **imp logs a rejected `onImage` promise.** Show your own message for a failed upload.
- **Pass the state itself to `disabled`, not `disabled.get()`.**
- imp warns about `aspect` with a circle, a `maxWidth`, `maxHeight`, `maxSize` or `aspect` that is
  not above 0, and about an unknown prop.

The keyboard support on the focused frame:

| Key             | Action                                      |
| --------------- | ------------------------------------------- |
| `Left`, `Right` | Move the frame by a twentieth of its width  |
| `Up`, `Down`    | Move the frame by a twentieth of its height |
| `+`, `=`        | Zoom in by a quarter                        |
| `-`             | Zoom out by a quarter                       |

The words are the keys `imp.imageUpload.prompt`, `imp.imageUpload.maxSize` with `{size}`,
`imp.imageUpload.tooLarge` with `{name}` and `{size}`, `imp.imageUpload.wrongType` and
`imp.imageUpload.unreadable` with `{name}`, `imp.imageUpload.preparing`, `imp.imageUpload.frame`,
`imp.imageUpload.zoom`, `imp.imageUpload.done`, `imp.imageUpload.cancel`, `imp.imageUpload.change`,
`imp.imageUpload.adjust`, `imp.imageUpload.remove` and `imp.imageUpload.preview`.

```js
const profileForm = () => {
  let picture = null
  return form(
    {
      initialValues: { name: '', avatar: undefined },
      onSubmit: async (values) => {
        const body = new FormData()
        body.append('name', values.name)
        if (picture) body.append('avatar', picture)
        await fetch('/profile', { method: 'POST', body })
      },
    },
    textField({ field: 'name', label: 'Name', required: true }),
    imageUpload({
      field: 'avatar',
      label: 'Profile picture',
      shape: 'circle',
      compact: true,
      maxWidth: 256,
      maxHeight: 256,
      onImage: (file) => {
        picture = file
      },
    }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  )
}
```

Related: imp skill std/form - the state that `field` writes to; imp skill std/fileUpload - any file,
with no editor; imp skill std/avatar - shows the picture round; imp skill i18n - how to translate
the `imp.imageUpload.*` keys.
