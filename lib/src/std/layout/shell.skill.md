# shell - the app frame: header, rail, sidebar, content, aside and a mobile drawer

**Reach for `shell` first when building an app, and customize it rather than replacing it.** Do not
hand-assemble a header-and-sidebar grid: build the frame with `shell` and put your markup in its
regions. An app whose shape it genuinely does not fit writes its own frame component - that is a
supported ending, not a failure.

```js
import { shell } from 'imp/std/layout'

shell(
  {
    header: flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, logo(), userMenu()),
    sidebar: navMenu({ label: 'Sections', items, selected }),
  },
  router({ routes }),
)
```

Call shape: `shell(props?, ...mainContent)` - the props object, when present, must be the **first**
argument. **Everything after it is the main content**, because it is the content; every other region
is a prop taking DOM.

| Prop         | Values                         | Default  | Notes                                                     |
| ------------ | ------------------------------ | -------- | --------------------------------------------------------- |
| `header`     | DOM                            | none     | Rendered into `<header>`                                  |
| `rail`       | DOM                            | none     | The thin far-left column                                  |
| `sidebar`    | DOM                            | none     | The nav column; becomes a drawer below `48rem`            |
| `aside`      | DOM                            | none     | Right contextual column, rendered into `<aside>`          |
| `bottomNav`  | DOM                            | none     | Shown **only** below `48rem`; suppresses the drawer       |
| `headerSpan` | `'full'`, `'content'`          | `'full'` | `'content'` starts the header after the rail and sidebar  |
| `navOpen`    | boolean, or a state - **live** | `false`  | Drawer state; the shell owns one if the prop is omitted   |
| `events`     | `{ navToggle }`                | -        | `detail: { open }`, when the shell opens or closes itself |

There is no `layout` enum: region presence plus `headerSpan` is the arrangement.

| Layout                   | Props                                        |
| ------------------------ | -------------------------------------------- |
| Sidebar + top navbar     | `header`, `sidebar`                          |
| Full-height sidebar      | `header`, `sidebar`, `headerSpan: 'content'` |
| Rail + secondary sidebar | `rail`, `sidebar`, `headerSpan: 'content'`   |
| Layout with right aside  | `header`, `sidebar`, `aside`                 |
| Mobile bottom navigation | `header`, `sidebar`, `bottomNav`             |

Region widths are custom properties, settable from the page because they inherit into the shell:

| Property                          | Default  |
| --------------------------------- | -------- |
| `--imp-shell-rail-inline-size`    | `3.5rem` |
| `--imp-shell-sidebar-inline-size` | `16rem`  |
| `--imp-shell-aside-inline-size`   | `20rem`  |

Rules an agent gets wrong:

- **A region prop is DOM, not data.** A command palette in the header, a checkbox under the sidebar
  nav, a tenant switcher above it - all of them are just DOM you pass. The shell never looks inside
  a region, so nothing needs a new prop.
- **Main content is the children**, not a `main` prop. `shell({ sidebar }, page())`.
- **The nav item registry is the data half.** The array `navMenu` renders is plain state,
  contributed to under an owner key on mount and withdrawn on unmount. The rule of thumb: **app
  author at the call site -> DOM; screen at runtime -> data.** A state _name_ may cross that
  boundary; a state helper may not, being no plain data. A widget contributed into the sidebar
  resolves state from the shell's scope, not from the screen that asked for it.
- **The shell is the one component that changes structure by width**, and its query is `48rem`. Do
  not copy the exception into your own components.
- **Below `48rem` the rail and aside collapse to nothing** and the sidebar becomes a modal drawer
  opened by a trigger the shell renders in the header. Passing `bottomNav` suppresses the drawer -
  presence is the switch, so there is no `compact` mode prop. The same `items` state can feed a
  column `navMenu` in the sidebar and a `direction: 'row'` one in `bottomNav`.
- **The drawer animates itself and holds the page still.** It slides in from the inline start over
  `--imp-duration-medium` behind a fading backdrop, slides back out on Escape, on a backdrop click
  and on close, drops to an instant open under `prefers-reduced-motion: reduce`, and stops the page
  behind it from scrolling while it is open. It is the shell's own `<dialog>`, so do not animate the
  region DOM you pass, and note the sidebar stays inside the drawer until the closing slide has
  finished.
- **`navOpen` is optional.** Without it the shell owns the drawer state; pass a **writable** state
  (never a `computed`) when the app needs to close the drawer after navigating, and listen with
  `events: { navToggle }` when it only needs to observe.
- **There is no width prop and no `footer` region.** Sizes are the three custom properties above;
  anything else goes in the region DOM you pass.
- **The shell renders no `<nav>`** - your `navMenu` brings that. It does render `<header>`, `<main>`
  and `<aside>`, is `100dvh` tall, and scrolls each region independently.

```js
shell({ rail: iconRail(), sidebar: sections(), headerSpan: 'content' }, router({ routes }))
shell(
  { header: bar(), sidebar: sections(), bottomNav: navMenu({ direction: 'row', items }) },
  page(),
)
shell({
  header: bar(),
  sidebar: sections(),
  navOpen,
  events: { navToggle: (e) => log(e.detail.open) },
}, page())
```

Related: imp skill std/navMenu - the nav rows a sidebar, rail or bottom nav is usually built from.
