# qrCode - a QR code of a text or a link, drawn as one SVG image

```js
import { qrCode } from 'imp/std/display'
import { link } from 'imp/std'

qrCode({ value: 'https://shop.example.com/order/42', label: 'QR code of the order link' })
link({ href: 'https://shop.example.com/order/42' }, 'shop.example.com/order/42')
```

The call shape is `qrCode(props)`. It takes no children.

| Prop              | Values                        | Default         | Notes                                     |
| ----------------- | ----------------------------- | --------------- | ----------------------------------------- |
| `value`           | string, or a state - **live** | -               | Necessary. The text that the code holds   |
| `label`           | string, or a state - **live** | `t()` 'QR code' | The accessible name of the image          |
| `errorCorrection` | `'L'`, `'M'`, `'Q'`, `'H'`    | `'M'`           | How much damage a scanner can repair      |
| `size`            | `'sm'`, `'md'`, `'lg'`        | `'md'`          | The side of the image: 6rem, 10rem, 16rem |

The code holds the UTF-8 bytes of `value`. imp picks the smallest QR version that fits, from 1 to
40. The default label comes from the key `imp.qrCode.label`.

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **Show the value as text next to the code.** A person cannot read a QR code, and a screen reader
  reads only the label. Put the link or the text beside it, as a `link` or a `text`.
- **The code is dark on white in every theme.** Many scanners cannot read light modules on a dark
  ground. Do not recolour it. In forced-colours mode it uses the system colours.
- **Keep the value short.** A link is best. More bytes give a denser code that a camera reads worse.
  At `'L'` a code holds at most 2953 bytes, and at `'H'` 1273. A longer value draws nothing, and imp
  warns.
- **`'H'` is for a code that gets damaged or covered**, such as a print with a logo on top. The
  default `'M'` suits a screen.
- **An empty value draws nothing.** imp hides the image until the value has text.
