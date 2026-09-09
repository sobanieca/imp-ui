# tooltip - a short label that appears beside a control on hover, on focus and on a touch hold

```js
import { tooltip } from 'imp/std/display'
import { button, icon } from 'imp/std'
import { luTrash } from 'imp/icons'

tooltip({ text: 'Delete' }, button({ label: 'Delete', events: { click: remove } }, icon(luTrash)))
```

The call shape is `tooltip(props, control)`. The props object comes first. The one child is the
control that the tooltip belongs to. The tooltip renders as a popover in the top layer, anchored to
the control with CSS anchor positioning, so no ancestor clips it and it needs no z-index.

| Prop   | Values                        | Default    | Notes                 |
| ------ | ----------------------------- | ---------- | --------------------- |
| `text` | string, or a state - **live** | - required | What the tooltip says |

There is no placement prop. imp picks the side from where the control sits on the screen when the
tooltip opens. A control near the start edge of the screen gets the tooltip at its inline end, and
one near the end edge gets it at its inline start. Every other control gets it below when it sits in
the upper half of the screen, and above when it sits in the lower half. When that side has no room,
the browser flips it.

Rules an agent gets wrong:

- **The tooltip is visual only. The control must carry its own accessible name.** imp hides the
  tooltip from assistive technology, because the name of an icon-only control is the `label` of the
  button, or the visually hidden text of a link. Give the control that name. Do not rely on the
  tooltip to name it.
- **Use it for an icon-only control.** A control with visible text does not need a tooltip that
  repeats the text. Keep `text` to a few words. It is a name, not a paragraph.
- **It opens three ways.** A pointer that rests on the control for a moment, the focus that lands on
  it, and a finger that holds it. A tap does not open it, so a tap still activates the control. It
  closes when the pointer leaves, the focus moves, the finger lifts, or on Escape.
- **There is no side to choose.** Do not look for a `placement` prop. The side follows the position
  of the control, so a toolbar at the top shows tooltips below, and a rail at the edge shows them
  beside the icons.
- **Pass one child, the control itself.** The tooltip wraps it in an inline box that it anchors to.
  So the host is as wide as the control. Do not pass a block of content as the child.
- **A `shell` in its icon rail does this by itself.** Every row in the rail shows its label as a
  tooltip. Do not wrap a nav row.

```js
tooltip({ text: 'Refresh' }, refreshButton)
tooltip({ text: status.text() }, statusIcon)
```

Related: imp skill std/button - the icon-only button that names itself with `label`; imp skill
std/shell - the icon rail that shows the same tooltips for its rows.
