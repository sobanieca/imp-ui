# Control box per size - one height for every single-line control

## Context

A form row puts controls of different kinds side by side: a text field, a date picker and a submit
button, or a text input between two step buttons. The row reads as one line only when every control
has the same height. A joined row (`joined-control-seam.md`) depends on it, because two neighbours
of a different height cannot share one border line.

Each control used to set its own font size, line height and padding, and a text input took the
`line-height-normal` of running text while a button took `line-height-tight`. So an input was taller
than a button of the same size, and the difference showed in every row that mixed the two.

## Decision

**Every single-line control takes its box from one helper.** `controlBox(size, inline)` in
`lib/src/std/shared/css.js` sets the font size, the line height, the block padding, the inline
padding and a `min-block-size` of the control height. `controlHeight(size)` is that height, one line
of `line-height-tight` plus the block padding and the border, so a control with an icon or a chip
instead of text is as tall as one with text. `controlBoxRules()` writes the three sizes as
`.size-sm`, `.size-md` and `.size-lg`, and a `.square` control takes the same height as its minimum
inline size.

| Control                                | Box                                         |
| -------------------------------------- | ------------------------------------------- |
| `button`, `segmented`                  | `controlBoxRules()`, inline padding by size |
| `input`, `select` of `controlStyles`   | `controlBox('md', 'space-3')`               |
| trigger of `datePicker`, `emojiPicker` | `controlBox('md', 'space-3')`               |
| frame of `comboBox`                    | `min-block-size: controlHeight('md')`       |

A native `select` lays its text out on its own and ignores the line height, so it takes
`controlHeight('md')` as its `block-size`. The label of a `square` button is one `lh` tall, so an
icon larger than the line, such as the default `md` icon, centres on the line and the button keeps
the control height.

The inline padding of a button is wider than the inline padding of an input, on purpose. A button
centres a short label. An input starts a line of text. The height is the shared part.

A multi-line surface is not a control in this sense. A `textarea`, the rich text editor and the code
editor keep `line-height-normal` and have no minimum height, because a person reads lines there. A
checkbox, a radio button, a toggle and a slider have their own geometry and never sit in a row of
text controls.

## Consequences

- A row of mixed controls has one top edge and one bottom edge, at every size, in a joined row and
  in a row with a gap. An e2e test renders every single-line control in one row and asserts one
  height.
- A text input is as tall as a button, not as tall as a line of running text with its padding. The
  smallest control is above the 24px target size of WCAG 2.5.8.
- A new single-line control must take `controlBox()` or `controlHeight()`. A unit test asserts the
  box in the stylesheet of every standard control.
- A control can be taller than the minimum when its content needs it, such as a `comboBox` with two
  rows of chips. It never gets shorter.
