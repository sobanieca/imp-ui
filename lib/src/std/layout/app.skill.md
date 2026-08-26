# app - the page frame: a navbar, sidebars, a footer and the main region

```js
import { app, footer, navbar, sidebar } from 'imp/std/layout'

app(
  { maxWidth: 'lg' },
  navbar({ label: 'Top bar' }, brand()),
  sidebar({ side: 'left', label: 'Sections' }, navMenu({ ... })),
  sidebar({ side: 'right', label: 'Settings' }, settingsPanel()),
  footer({ label: 'Page footer' }, copyright()),
  pageContent(),
)
```

Call shape: `app(props?, ...children)` - **the regions go in as children, not props.** app sorts its
direct children by what they are: every `navbar` goes on top, every `sidebar` down the side it
names, every `footer` at the bottom, and **everything left over becomes the main region**.

| Prop       | Values                                   | Default  | Notes                               |
| ---------- | ---------------------------------------- | -------- | ----------------------------------- |
| `maxWidth` | `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` | `'full'` | Caps the main region and centres it |
| `padding`  | spacing step `0`-`6`                     | `4`      | Inset around the main region        |
| `events`   | `{ click: handler }`                     | -        | Listeners on the frame              |

`maxWidth` and `padding` are responsive: pass one value or `{ mobile, desktop }`. `mobile` is under
48rem, `desktop` is 48rem and up.

Rules an agent gets wrong:

- **app fills the viewport and only the main region scrolls.** It is `100dvh`, so it is the
  outermost thing an app renders - do not put it inside a scrolling page, and do not nest one app in
  another.
- **`maxWidth` caps the content, not the chrome.** The navbar, the sidebars and the footer stay
  full-bleed; the main region is what gets centred. That is what makes a wide screen readable.
- **Regions are direct children only.** A `sidebar` wrapped in a `flex` is not a region any more -
  it lands in the main content. Pass it straight to `app`.
- **Order between the children does not matter**, except between sidebars on the same side: those
  stack outward in the order written.
- **There is no `header`/`sidebar`/`footer` prop.** `app({ sidebar: ... })` warns about an unknown
  prop and renders nothing.
- Anything else - a `flex`, a `grid`, a route outlet, plain text - is main content.

```js
app(
  { maxWidth: { mobile: 'full', desktop: 'xl' }, padding: 5 },
  navbar({ label: 'Top bar', justify: 'between' }, brand(), userMenu()),
  sidebar({ side: 'left', label: 'Sections', width: 'sm' }, navMenu({ ... })),
  sidebar({ side: 'left', label: 'Filters', collapsed: true }, filterList()),
  sidebar({ side: 'right', label: 'Activity' }, activityFeed()),
  footer({ label: 'Page footer' }, text({ size: 'sm' }, 'Acme Inc.')),
  routerOutlet(),
)
```

Related: sidebar (imp skill std/sidebar), navbar (imp skill std/navbar), footer (imp skill
std/footer), stack (imp skill std/stack)
