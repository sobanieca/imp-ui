# splitPane - two panes with a handle between them that a person drags or moves with the keys

```js
import { splitPane } from 'imp/std/layout'

splitPane({ label: 'Resize the mail list', size: 35 }, mailList(), mailReader())
splitPane({ orientation: 'vertical', size: layout, min: 20 }, editor(), console())
```

The call shape is `splitPane(props?, start, end)`. It takes **exactly two children**: the start pane
and the end pane. For three panes, put a `splitPane` in a pane.

| Prop          | Values                                   | Default                | Notes                                         |
| ------------- | ---------------------------------------- | ---------------------- | --------------------------------------------- |
| `orientation` | `'horizontal'`, `'vertical'`             | `'horizontal'`         | Horizontal puts the panes side by side        |
| `size`        | percent `0`-`100`, or a state - **live** | `50`                   | The share of the start pane; a move writes it |
| `min`         | percent `0`-`100`                        | `10`                   | The smallest share of the start pane          |
| `max`         | percent `0`-`100`                        | `90`                   | The largest share of the start pane           |
| `label`       | string, or a state - **live**            | `imp.splitPane.resize` | The accessible name of the handle             |
| `events`      | `{ resize }`                             | -                      | Fires on the host with `detail.size`          |

The handle is a focusable `role="separator"` with `aria-valuenow`, `aria-valuemin` and
`aria-valuemax`, and `aria-controls` names the start pane. These keys move it:

| Key                    | Does                                               |
| ---------------------- | -------------------------------------------------- |
| ArrowLeft / ArrowRight | Horizontal: moves the handle 5 points to that side |
| ArrowUp / ArrowDown    | Vertical: moves the handle 5 points                |
| PageUp / PageDown      | Moves it 25 points toward the start or the end     |
| Home / End             | Moves it to `min` or to `max`                      |

Rules an agent gets wrong:

- **Import the component from `imp/std/layout`**, not from `imp/std`.
- **`size` is the start pane, in percent, not in pixels.** The end pane takes the rest. The handle
  sits between them, outside both shares.
- **A vertical split needs a height.** The host fills the block size of its parent. A parent with no
  height of its own makes the panes only as tall as their content.
- **The start pane follows the reading direction.** Under `dir="rtl"` the start pane is on the
  right. An arrow key moves the handle toward its own side of the screen in both directions.
- **Pass a writable state as `size` to keep the split.** A drag and a key write the new share into
  it. Store it with the preferences of the person to restore it on the next visit.
- **A pane scrolls.** Each pane has `overflow: auto`, so a long list scrolls inside its pane.
- imp warns about a child count that is not two, about a percent outside `0`-`100`, and about a
  `min` above `max`.

```js
import { component } from 'imp'
import { initState } from 'imp/state'
import { splitPane } from 'imp/std/layout'

const inbox = component('myapp-inbox', {
  styles: ':host { display: block; block-size: 70dvb }',
  setup: (self) => {
    const share = initState(self, 'myapp.inbox.split', 35)
    return splitPane({ size: share, min: 20, max: 60 }, mailList(), mailReader())
  },
})
```

Related: imp skill std/flex - a row that does not resize; imp skill std/stack - a column.
