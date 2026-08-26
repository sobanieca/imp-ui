# sidebar - a collapsible side region of the app frame, stackable on either side

```js
import { app, sidebar } from 'imp/std/layout'

app(
  sidebar({ side: 'left', label: 'Sections' }, navMenu({ ... })),
  sidebar({ side: 'right', label: 'Settings', width: 'sm' }, settingsPanel()),
  pageContent(),
)
```

Call shape: `sidebar(props?, ...children)` - the children are the panel's content. A sidebar is only
a region when it is a **direct child of `app`**; anywhere else it renders as a plain box.

| Prop          | Values                | Default  | Notes                                          |
| ------------- | --------------------- | -------- | ---------------------------------------------- |
| `side`        | `'left'`, `'right'`   | `'left'` | Follows the reading direction                  |
| `label`       | string or state       | -        | **Required in practice** - names the landmark  |
| `width`       | scale keyword         | `'md'`   | From the theme's sidebar scale                 |
| `resizable`   | boolean               | `false`  | Adds a drag handle on the edge facing the page |
| `minWidth`    | scale keyword         | `'xs'`   | Narrow end of the drag range                   |
| `maxWidth`    | scale keyword         | `'xl'`   | Wide end of the drag range                     |
| `collapsible` | boolean               | `true`   | `false` drops the rail, never the drawer tab   |
| `collapsed`   | boolean or state      | `false`  | Starting state on a wide screen                |
| `events`      | `{ select: handler }` | -        | Listeners on the panel                         |

The scale keyword for `width`, `minWidth` and `maxWidth` is one of `'xs'`, `'sm'`, `'md'`, `'lg'`,
`'xl'` - the theme's `--imp-sidebar-*` tokens, 10rem to 24rem out of the box.

Rules an agent gets wrong:

- **Always pass `label`.** A sidebar is a `complementary` landmark and it names the toggle button
  too. Two unlabelled sidebars are indistinguishable to a screen reader, so a missing one warns.
- **`side: 'left'` means the inline start edge.** In an RTL page it renders on the right. That is
  deliberate - the frame follows the text direction.
- **Stack them by writing more than one.** Two `side: 'left'` sidebars sit side by side, in the
  order written, outward from the main region. There is no limit and no `order` prop.
- **Below 48rem every sidebar is a drawer.** It leaves the flow, collapses to a tab pinned to its
  screen edge, and slides over the page when tapped, dimming the rest. Opening one closes the
  others; Escape, the backdrop, and choosing something inside it all close it. **Do not write your
  own breakpoint for this** and do not pair it with `hideOnMobile` on the content.
- **`collapsed` is the wide-screen state.** A drawer always starts closed on a narrow screen
  whatever this says. Bind a state to it to drive the collapse from elsewhere.
- Collapsed on a wide screen leaves a rail with just the toggle - the panel is inert, not removed.
- **`collapsible: false` is a wide-screen statement only.** It takes the toggle off the column so
  the sidebar cannot be collapsed to a rail, but below 48rem the sidebar is still a drawer and still
  keeps its tab - otherwise its content would be unreachable on a phone.
- **`resizable: true` is what turns on dragging** - `minWidth` and `maxWidth` alone do nothing and
  warn. The handle takes mouse, touch and pen alike, and the keyboard: arrow keys move it one step,
  Home and End go to the ends, a double click restores `width`.
- **`minWidth` and `maxWidth` are scale keywords, not lengths.** `maxWidth: '40rem'` warns and falls
  back. Widen the range by retuning the theme's `--imp-sidebar-*` tokens, not by passing a length.
- **Keep `width` inside the range** - a `width` outside it warns, and the sidebar opens at the
  nearest end because the range wins.
- **The handle disappears when the sidebar is collapsed or is a drawer**, and the width a user
  dragged to survives both - it comes back when the sidebar expands again.

```js
sidebar(
  {
    side: 'left',
    label: t('nav.sections'),
    width: 'sm',
    resizable: true,
    minWidth: 'xs',
    maxWidth: 'lg',
    collapsed: navCollapsed,
  },
  navMenu({ label: t('nav.sections'), items, selected }),
)
```

Related: app (imp skill std/app), navbar (imp skill std/navbar), navMenu (imp skill std/navMenu)
