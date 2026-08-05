# toolbar - a named group of controls laid out in a line

```js
import { toolbar } from 'imp/std/layout'
import { button } from 'imp/std'

toolbar(
  { label: 'Document actions', variant: 'surface', gap: 2 },
  button({ variant: 'ghost' }, 'Undo'),
  button({ variant: 'ghost' }, 'Redo'),
  button('Save'),
)
```

Call shape: `toolbar(props, ...controls)` - the children are the controls.

| Prop          | Values                                 | Default        | Notes                                           |
| ------------- | -------------------------------------- | -------------- | ----------------------------------------------- |
| `label`       | string, or a state holding one - live  | -              | **Required in practice** - names the landmark   |
| `orientation` | `'horizontal'`, `'vertical'`           | `'horizontal'` | Also sets `aria-orientation`                    |
| `variant`     | `'plain'`, `'surface'`                 | `'plain'`      | `surface` adds the card background and border   |
| `gap`         | spacing step `0`-`6` - **responsive**  | `2`            | Between controls                                |
| `justify`     | `start`, `center`, `end`, `between`, … | `'start'`      | **Responsive**, as on `row`                     |
| `align`       | `start`, `center`, `end`, `stretch`, … | `'center'`     | **Responsive**, as on `row`                     |
| `wrap`        | boolean - **responsive**               | `false`        | A horizontal toolbar scrolls instead by default |
| `events`      | any DOM events                         | -              | Bound on the group                              |

Also takes `hideBelow` / `hideAbove` like every layout component.

Rules an agent gets wrong:

- **`label` is not optional.** A toolbar is a landmark; without a name it is announced as an
  unlabelled group, so the component warns when it is missing.
- **`orientation` is not responsive**, unlike the spacing props: it is announced through
  `aria-orientation`, and a value that changes with the viewport would tell a screen reader
  something the user cannot verify.
- **Its controls keep their own tab stops.** A toolbar in the ARIA pattern moves focus between its
  controls with the arrow keys and holds one tab stop, which cannot be done here: every control is
  its own custom element with its own shadow root, and focus cannot be delegated across that
  boundary from the outside. So Tab walks the controls, and no arrow-key handling is added that
  would only half work.
- **It is not a layout for content.** For a plain line of anything, use `row` - `toolbar` exists to
  name and group **controls**, and its `role="toolbar"` says exactly that.
- Put it in `appShell`'s `header` for a page toolbar (`imp skill std/appShell`).

Related: imp skill std/row · imp skill std/appShell
