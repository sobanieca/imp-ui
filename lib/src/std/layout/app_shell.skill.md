# appShell - the page frame: header, sidebar, main, footer and a mobile bottom bar

```js
import { appShell } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'

appShell(
  {
    header: brandRow(),
    sidebar: navMenu({ label: 'Sections', items, selected }),
    bottomBar: navMenu({ label: 'Sections', direction: 'row', items, selected }),
    footer: statusLine(),
    sidebarWidth: 'md',
    collapseBelow: 'md',
  },
  pageContent(),
)
```

Call shape: `appShell(props, ...content)` - **the children are the main region**; every other region
is a prop holding content.

| Prop            | Values                         | Default  | Notes                                         |
| --------------- | ------------------------------ | -------- | --------------------------------------------- |
| `header`        | any content                    | -        | Rendered in `<header>`, pinned at the top     |
| `sidebar`       | any content                    | -        | Rendered in `<aside>`, scrolls on its own     |
| `footer`        | any content                    | -        | Rendered in `<footer>`, pinned at the bottom  |
| `bottomBar`     | any content                    | -        | Below the footer - where a mobile navbar goes |
| `sidebarWidth`  | `'sm'`, `'md'`, `'lg'`         | `'md'`   | 12rem / 16rem / 20rem, from `--imp-sidebar-*` |
| `collapseBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'` | `'md'`   | Below it the sidebar becomes a drawer         |
| `menuLabel`     | string, or a state - live      | `'Menu'` | Accessible name of the drawer button          |
| `events`        | any DOM events                 | -        | Bound on the frame                            |

Rules an agent gets wrong:

- **It is a viewport frame, not a block that grows.** The frame is `100dvh` tall, the header, footer
  and bottom bar keep their size, and **`main` and the sidebar scroll on their own** - the document
  itself does not scroll. Put it at the top of the page with nothing around it, and reset the body
  margin, or that margin becomes a scrollbar.
- **Content goes in as children, regions go in as props.** `appShell(header(), content())` puts both
  in main; the header must be `appShell({ header: … }, content())`.
- **Do not build the collapse yourself.** Below `collapseBelow` the sidebar is hidden and a menu
  button appears in the header that opens it over the page with a backdrop; the rest of the frame
  goes `inert` while it is open, Escape and the backdrop close it, and a `select` event from
  anything inside it (a `navMenu` link, for instance) closes it too. Pass `collapseBelow: null` to
  keep the sidebar docked at every width.
- **The menu button only appears when there is both a `sidebar` and a `collapseBelow`.** It is
  rendered into the header - with no `header` prop, the shell still renders a header to hold it.
- **`bottomBar` is not hidden for you.** It renders at every width; make it a mobile-only bar with
  `hideAbove` on what you put in it, the way `navMenu({ direction: 'row', hideAbove: 'md' })` does.
- **The regions are landmarks** (`<header>`, `<aside>`, `<main>`, `<footer>`), so do not wrap your
  content in a second one. A `<nav>` inside them is right - that is what `navMenu` renders.
- Set the sidebar's own width through the theme (`--imp-sidebar-md`), not by styling the region.

```js
appShell(
  { sidebar: navMenu({ label: 'Files', items }), collapseBelow: null },
  scrollArea(document()),
)
```

Related: imp skill std/navMenu · imp skill std/toolbar · imp skill std/commandPalette
