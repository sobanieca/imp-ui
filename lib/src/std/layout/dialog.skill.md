# dialog - one component for both overlay windows: the modal frame and the movable panel

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open }, form({ initialValues }, textField({ field: 'name' })))
dialog({ title: 'Inspector', modal: false, open: inspecting }, details())
```

The call shape is `dialog(props?, ...content)`. The props object comes first. Everything after it is
the content of the dialog. The component renders a real `<dialog>` and promotes it to the top layer
of the platform. So an ancestor never clips it, and it needs no z-index.

| Prop     | Values                            | Default | Notes                                          |
| -------- | --------------------------------- | ------- | ---------------------------------------------- |
| `title`  | string, or a state - **live**     | -       | Names the dialog for a screen reader; give one |
| `modal`  | boolean - **read once, at mount** | `true`  | `false` is the movable, non-blocking window    |
| `open`   | boolean, or a state - **live**    | `false` | What opens and closes it                       |
| `anchor` | element - **read once, at mount** | -       | Non-modal only: the window opens next to it    |
| `events` | `{ openToggle }`                  | -       | `detail: { open }`, on changes it makes itself |

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

- **Import the component from `imp/std/layout`**, not from `imp/std`. It **shadows the `dialog`
  element factory** from `imp/html`. A file that needs both gives one an alias:
  `import { dialog as dialogElement } from 'imp/html'`.
- **`open` is the whole API for opening the dialog.** There is no `show()` method, no `open()`
  method and no ref. Pass a **writable** state, never a `computed`, and set it. The dialog writes
  `false` back when the person dismisses it, so the state stays correct.
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
- **The platform owns the focus.** The close button is the first element in the dialog, so the focus
  lands there. On close, the focus returns to the element that had it before the dialog opened.

Related: imp skill std/form - the usual content of a modal dialog; imp skill std/bugReport - a
worked example of a panel that floats above the page.
