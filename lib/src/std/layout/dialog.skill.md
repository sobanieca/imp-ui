# dialog - one component for both overlay windows: the modal frame and the movable panel

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open }, form({ initialValues }, textField({ field: 'name' })))
dialog({ title: 'Inspector', modal: false, open: inspecting }, details())
```

The call shape is `dialog(props?, ...content)`. The props object comes first. Everything after it is
the content of the dialog. The component renders a real `<dialog>` and promotes it to the top layer
of the platform. So an ancestor never clips it, and it needs no z-index.

| Prop          | Values                            | Default | Notes                                          |
| ------------- | --------------------------------- | ------- | ---------------------------------------------- |
| `title`       | string, or a state - **live**     | -       | Names the dialog for a screen reader; give one |
| `modal`       | boolean - **read once, at mount** | `true`  | `false` is the movable, non-blocking window    |
| `open`        | boolean, or a state - **live**    | `false` | What opens and closes it                       |
| `beforeClose` | `() => boolean \| Promise`        | -       | Return `false` to stay open                    |
| `anchor`      | element - **read once, at mount** | -       | Non-modal only: the window opens next to it    |
| `content`     | `() => DOM`                       | -       | Built on each open, dropped after each close   |
| `events`      | `{ openToggle }`                  | -       | `detail: { open }`, on changes it makes itself |

| Property                   | Default |
| -------------------------- | ------- |
| `--imp-dialog-inline-size` | `32rem` |

## The two modes

|                      | `modal: true`               | `modal: false`                           |
| -------------------- | --------------------------- | ---------------------------------------- |
| Promotion            | `showModal()`               | `popover="manual"`                       |
| Page behind          | inert, dimmed by a backdrop | live and clickable                       |
| Page scroll          | held while open             | free - the point of the mode             |
| Escape               | dismisses it                | ignored, as the platform does            |
| Backdrop click       | dismisses it                | there is no backdrop                     |
| Moving it            | frozen in the centre        | dragged by its title bar, arrow keys too |
| Several open at once | one at a time               | as many as you mount                     |

Rules an agent gets wrong:

- **A form in a dialog goes in `content`.** `dialog({ title, open, content: () => form(...) })`
  builds the form each time the dialog opens, so it starts from its `initialValues` again. imp drops
  it after the closing animation. Do not wrap the content in `open.view(...)` yourself. Children are
  built once, and keep what the person typed.
- **Pass `content` or children, not both.** With both, imp warns and uses `content`.

- **Import the component from `imp/std/layout`**, not from `imp/std`. It **shadows the `dialog`
  element factory** from `imp/html`. A file that needs both gives one an alias:
  `import { dialog as dialogElement } from 'imp/html'`.
- **`open` is the whole API for opening the dialog.** There is no `show()` method, no `open()`
  method and no ref. Pass a **writable** state, never a `computed`, and set it. The dialog writes
  `false` back when the person dismisses it, so the state stays correct.
- **Guard unsaved work with `beforeClose`.** imp calls it on every dismissal by the person: Escape,
  a backdrop click and the close button. Return `false`, or a Promise of `false`, to keep the dialog
  open: `beforeClose: () => !dirty.get() || confirm(t('edit.discard'))`. A Promise can wait for your
  own confirmation dialog. `() => false` makes a dialog that only your code closes.
  `() => !saving.get()` holds it while a request runs.
- **Setting `open` to `false` never asks `beforeClose`.** Your code already decided. Close with
  `open.set(false)` after a save.
- **imp reads `modal` once, at mount.** It is not live. A change of modality would unwind one
  promotion and build the other, with the focus and the scroll state to reconcile. Render a
  different dialog instead.
- **The content is the children, and `title` is a prop.** The title bar belongs to the dialog. It
  carries the heading, the close button, and in a non-modal dialog the drag handle. Do not render
  your own title bar.
- **A non-modal dialog is a window, not a weaker modal.** It blocks nothing behind it. The page
  scrolls, its buttons work, and Escape does not close the dialog. Close it from your own UI, or
  with the close button. Mount several dialogs and they stack in the order in which they opened.
- **Dragging is included and needs no prop.** A non-modal dialog is movable because it is non-modal.
  The title bar takes the focus, and an arrow key moves the window 16px per step. imp clamps the
  window to the viewport as it moves, and when the viewport resizes. A dialog that opens again
  starts from its resting place again. imp never stores the position.
- **Pass the control that opens a window as `anchor`, so the window opens next to it.** Without an
  anchor a non-modal window opens in the centre of the viewport. On a tall or zoomed screen that is
  out of view. With `anchor: toggle` it opens under the control, centred on it, and above it when it
  does not fit below. It shrinks to the room it has and scrolls inside, and it follows the control
  when the page scrolls. `anchor` is an element, read once, and it is ignored by a modal.
- **The anchor must have a box, in the tree of the dialog.** Put the control and the dialog in the
  same component. A control inside a nested component is reached through its host, and a host has no
  box. So wrap an imp component in a `span` and pass the `span`. A control in an ancestor component
  is out of reach, and the window opens centred.
- **Do not animate the dialog yourself.** It fades and rises in, and it slides out. It obeys
  `prefers-reduced-motion`. Every imp overlay shares this animation.
- **The platform owns the focus.** In a modal, the close button is the first element, so the focus
  lands there. A non-modal window takes the focus on its panel, so a screen reader announces the
  title, and Tab reaches the title bar next. On close, the focus returns to the element that had it
  before the dialog opened.

Related: imp skill std/form - the usual content of a modal dialog; imp skill std/bugReport - a
worked example of a panel that floats above the page.
