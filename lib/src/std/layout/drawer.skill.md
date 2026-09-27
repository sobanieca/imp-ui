# drawer - a panel that slides in from the side of the screen, modal or not, on any width

```js
import { drawer } from 'imp/std/layout'

drawer({ title: 'Filters', open: filtering }, filterForm())
drawer({ title: 'Details', modal: false, open: inspecting }, details())
```

The call shape is `drawer(props?, ...content)`. The props object comes first. Everything after it is
the content of the drawer. The component renders a real `<dialog>`, promoted to the top layer of the
platform. So an ancestor never clips it, and it needs no z-index. You can mount it anywhere: in a
page, in a card, in a `shell` region, or in another component.

| Prop          | Values                            | Default | Notes                                          |
| ------------- | --------------------------------- | ------- | ---------------------------------------------- |
| `title`       | string, or a state - **live**     | -       | Names the drawer for a screen reader; give one |
| `modal`       | boolean - **read once, at mount** | `true`  | `false` is the non-blocking panel              |
| `open`        | boolean, or a state - **live**    | `false` | What opens and closes it                       |
| `beforeClose` | `() => boolean \| Promise`        | -       | Return `false` to stay open                    |
| `background`  | DOM                               | none    | Decorative layer under the bar and the content |
| `events`      | `{ openToggle }`                  | -       | `{ open }`, on changes the drawer makes itself |

| Property                   | Default | Notes                                                  |
| -------------------------- | ------- | ------------------------------------------------------ |
| `--imp-drawer-inline-size` | `24rem` | Its width; capped at `85dvi`, so a phone keeps an edge |

Inside a `shell`, the drawer follows the frame. It opens at the end edge of the content, so on a
screen wider than the `maxWidth` of the frame it does not sit at the edge of the screen. In a frame
that has a `gap`, it also insets itself by the gap from the top and the bottom, and it rounds its
corners with `radius-container`, like the bar and the column. So it reads as one more floating
panel. It does this by reading the custom properties that the frame publishes, which are
`--imp-shell-frame-inset`, `--imp-shell-frame-gap` and `--imp-shell-frame-radius`. All are `0`
outside a frame. The inset is measured from the width of the screen, so it lines up with the content
only when the frame fills the screen.

## The two modes

|                      | `modal: true`               | `modal: false`                |
| -------------------- | --------------------------- | ----------------------------- |
| Promotion            | `showModal()`               | `popover="manual"`            |
| Page behind          | inert, dimmed by a backdrop | live and clickable            |
| Page scroll          | held while open             | free                          |
| Escape               | dismisses it                | ignored, as the platform does |
| Backdrop click       | dismisses it                | there is no backdrop          |
| Several open at once | one at a time               | as many as you mount          |

Rules an agent gets wrong:

- **The drawer always opens at the end of the line.** That is the right edge under `dir="ltr"`, and
  the left edge under `dir="rtl"`. There is no side prop. A drawer is the contextual panel, and the
  contextual panel has one place. A menu from the start of the line is the drawer of the `shell`.
- **One drawer serves every width.** It is the same panel on a desktop and on a phone. Its width is
  `min(--imp-drawer-inline-size, 85dvi)`. So it fills most of a phone, and it stays a column on a
  wide screen. There is no breakpoint, no bottom-sheet mode, and nothing to configure per width.
- **`open` is the whole API for opening the drawer.** There is no `show()` and no ref. Pass a
  **writable** state, never a `computed`, and set it. The drawer writes `false` back when the person
  dismisses it, so the state stays correct.
- **A panel that must stay open while the person works on the page is `modal: false`.** A modal
  drawer dims the page and holds it inert, so a click outside it dismisses it. `beforeClose` can
  refuse that click, but the page stays inert. Use the non-modal panel instead. It never closes on
  an outside click, and the page behind it stays live.
- **Guard unsaved work with `beforeClose`.** imp calls it on every dismissal by the person: Escape,
  a backdrop click and the close button. Return `false`, or a Promise of `false`, to keep the drawer
  open: `beforeClose: () => !dirty.get() || confirm(t('edit.discard'))`. A Promise can wait for your
  own confirmation dialog. `() => false` makes a drawer that only your code closes.
  `() => !saving.get()` holds it while a request runs.
- **Setting `open` to `false` never asks `beforeClose`.** Your code already decided. Close with
  `open.set(false)` after a save.
- **imp reads `modal` once, at mount.** Render a different drawer instead of a change on a live one.
- **The content is the children, and `title` is a prop.** The title bar belongs to the drawer, with
  the heading and the close button. Do not render your own title bar.
- **A non-modal drawer covers the page. It does not push the page.** It sits in the top layer, over
  the content along its edge. The page behind it still scrolls and still works, and Escape does not
  close the drawer. Close it from your own UI, or with the close button. For a permanent side
  column, lay one out yourself with `flex`.
- **This is the contextual panel of a `shell` app.** Use it for filters, an inspector or a detail
  view. Mount the drawer in the main content and open it from a control there. The frame has no side
  region for it, because a panel that comes and goes is an overlay, not a column.
- **Do not animate the drawer yourself.** It slides in from its edge and slides back out. It obeys
  `prefers-reduced-motion`. Every imp overlay shares this animation.
- **The platform owns the focus.** In a modal drawer, the close button is the first element, so the
  focus lands there. A non-modal drawer takes the focus on its panel, so a screen reader announces
  the title, and Tab reaches the close button next. On close, the focus returns to the element that
  had it before the drawer opened.
- **`background` is one DOM node under the panel.** imp stretches it to the panel, clips it to the
  corners of the panel, and hides it from assistive technology. Use it for an image or an animation
  that CSS cannot draw. Put nothing interactive in it. The panel still paints `color-surface`, so a
  translucent node tints it.

Related: imp skill std/dialog - the centred window, same modes; imp skill std/shell - the frame a
drawer usually opens inside; imp skill std/form - the usual content of a filters drawer.
