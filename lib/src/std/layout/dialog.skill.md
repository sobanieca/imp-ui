# dialog - one component for both overlay windows: the modal frame and the movable panel

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open }, form({ initialValues }, textField({ field: 'name' })))
dialog({ title: 'Inspector', modal: false, open: inspecting }, details())
```

Call shape: `dialog(props?, ...content)` - the props object comes first, everything after it is the
dialog's content. It renders a real `<dialog>` and promotes it to the platform's top layer, so it is
never clipped by an ancestor and needs no z-index.

| Prop     | Values                            | Default | Notes                                          |
| -------- | --------------------------------- | ------- | ---------------------------------------------- |
| `title`  | string, or a state - **live**     | -       | Names the dialog for a screen reader; give one |
| `modal`  | boolean - **read once, at mount** | `true`  | `false` is the movable, non-blocking window    |
| `open`   | boolean, or a state - **live**    | `false` | What opens and closes it                       |
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

- **It imports from `imp/std/layout`**, not from `imp/std`, and it **shadows the `dialog` element
  factory** from `imp/html`. A file needing both aliases one:
  `import { dialog as dialogElement } from 'imp/html'`.
- **`open` is the whole API for opening it.** There is no `show()`, no `open()` method and no ref:
  pass a **writable** state (never a `computed`) and set it. The dialog writes `false` back when the
  user dismisses it, so the state stays true.
- **`modal` is read once, at mount**, not live. Switching modality would mean unwinding one
  promotion and building the other with focus and scroll state to reconcile; render a different
  dialog instead.
- **Content is the children, `title` is a prop.** The title bar is the dialog's own - it carries the
  heading, the close button, and in a non-modal dialog the drag handle - so do not render your own.
- **A non-modal dialog is a window, not a lesser modal.** Nothing behind it is blocked: the page
  scrolls, its buttons work, and Escape does not close it. Close it from your own UI or the close
  button. Mount several and they stack in the order they opened.
- **Dragging is free and needs no prop.** A non-modal dialog is movable because it is non-modal; the
  title bar takes focus and the arrow keys move it 16px a step, and the window is clamped to the
  viewport as it moves and when the viewport resizes. A reopened dialog is centred again - position
  is never persisted.
- **Do not animate it yourself.** It fades and rises in, slides out, and honours
  `prefers-reduced-motion` - all of it shared with every other imp overlay.
- **Focus is the platform's**, and the close button is the first thing in the dialog, so it is what
  focus lands on. On close, focus returns to whatever had it before the dialog opened.

Related: imp skill std/form - the usual content of a modal dialog; imp skill std/bugReport - a
worked example of a panel that floats above the page.
