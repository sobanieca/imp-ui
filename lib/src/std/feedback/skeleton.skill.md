# skeleton - a grey placeholder in the shape of content that loads

```js
import { skeleton } from 'imp/std/feedback'

skeleton()
skeleton({ lines: 3 })
skeleton({ shape: 'circle' })
skeleton({ shape: 'block' })
```

The call shape is `skeleton(props?)`. It takes no children.

| Prop    | Values                          | Default  | Notes                                                 |
| ------- | ------------------------------- | -------- | ----------------------------------------------------- |
| `shape` | `'text'`, `'circle'`, `'block'` | `'text'` | A line of text, an avatar, or an image or a card      |
| `lines` | whole number, 1 to 20           | `1`      | `text` only. The last of two or more lines is shorter |

| Shape    | Default size                       | Change it with                                            |
| -------- | ---------------------------------- | --------------------------------------------------------- |
| `text`   | the width of its parent            | `--imp-skeleton-inline-size`                              |
| `circle` | `2.5rem` wide, and as tall as wide | `--imp-skeleton-inline-size`                              |
| `block`  | the width of its parent, `8rem`    | `--imp-skeleton-inline-size`, `--imp-skeleton-block-size` |

Rules an agent gets wrong:

- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **The skeleton is decorative.** It carries `aria-hidden="true"`, so a screen reader gets nothing
  from it. Put `aria-busy: true` on the region that loads, and remove it when the content is there.
- **There are no `width` and `height` props.** Set the two custom properties in the `style` of a
  wrapper: `div({ style: { '--imp-skeleton-block-size': '12rem' } }, skeleton({ shape: 'block' }))`.
- **One text line is as tall as one line of body text.** So a paragraph of lines does not move the
  page when the real text replaces it.
- **Swap the skeleton for the content with a `view()` of a state.** The skeleton has no `loading`
  prop and no children.
- **Compose a layout from several skeletons** with `flex` and `stack`. There is no preset for a card
  or for a list row.
- **The pulse stops under `prefers-reduced-motion`.** Do not add your own animation.
- **Use `progress` when the wait has a measure, or when nothing takes the place of content.** A
  skeleton is for content whose shape you know.

```js
import { component } from 'imp'
import { div } from 'imp/html'
import { computed, initState } from 'imp/state'
import { text } from 'imp/std'
import { skeleton } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'

export const author = component('myapp-author', {
  setup: (self) => {
    const user = initState(self, 'myapp.author', null)
    return div(
      { 'aria-busy': computed([user], (value) => String(value === null)) },
      user.view((value) =>
        value === null
          ? flex({ gap: 3, verticalAlign: 'center' }, skeleton({ shape: 'circle' }), skeleton())
          : text(value.name)
      ),
    )
  },
})
```

Related: imp skill std/progress - a wait with a measure, and the spinner; imp skill state - `view()`
swaps the placeholder for the content.
