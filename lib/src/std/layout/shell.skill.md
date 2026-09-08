# shell - the app frame: the map drives the nav and the trail, logo, content, and the phone fold

**Use `shell` first when you build an app. Customize it. Do not replace it.** Do not assemble a
header and sidebar grid by hand. Build the frame with `shell`, hand it the application map, and let
it draw the nav and the trail. An app whose shape it truly does not fit writes its own frame
component. That is a supported result, not a failure.

```js
import { shell } from 'imp/std/layout'
import { appLogo, themeSelect, userCard } from 'imp/std/shell'
import { router } from 'imp/router'
import { luChartColumn, luUsers } from 'imp/icons'
import { app } from './app-map.js'

shell(
  {
    logo: appLogo({ label: 'Acme' }),
    navbar: {
      label: 'Sections',
      map: app,
      icons: { [app.reports]: luChartColumn, [app.directory]: luUsers },
      tags: { [app.reports.revenue]: revenueCount },
    },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ signedIn: session, name, onSignIn, onSignOut })],
  },
  router({ map: app, access, screens, options }),
)
```

The call shape is `shell(props?, ...mainContent)`. When a props object is present, it must be the
**first** argument. **Everything after it is the main content**, because it is the content.

| Prop          | Values                         | Default | Notes                                                       |
| ------------- | ------------------------------ | ------- | ----------------------------------------------------------- |
| `logo`        | DOM                            | none    | Brand block; heads the bar, the sidebar, or the drawer      |
| `navbar`      | **data** - see below           | none    | The map, or plain sections for a frame with no router       |
| `sidebar`     | **data** - see below           | none    | The second level: names it, foots it                        |
| `extras`      | DOM, or an array of it         | none    | Theme picker, language picker, `userCard`, anything         |
| `breadcrumbs` | `false`                        | shown   | Turns the trail above the content off; needs a map          |
| `navOpen`     | boolean, or a state - **live** | `false` | Drawer state; the shell owns one if the prop is omitted     |
| `gap`         | spacing step `0`-`6`           | `0`     | Floats bar, column and bottom bar apart, rounded            |
| `background`  | DOM                            | none    | Decorative layer under everything; the animated backdrop    |
| `events`      | `{ navToggle, select }`        | -       | `navToggle` gives `{ open }`, `select` gives `{ id, item }` |

**One map drives three surfaces and the trail.** With `navbar.map`, the router derives the sections,
the rows of the current section, the marked rows, the head of the sidebar and the crumbs. The bar
lists the top-level nodes. The sidebar lists the static children of the current context, which is
the deepest param node on the path, or else the section. The bottom bar of a phone lists the same
rows. The trail renders above the content. You declare nothing twice. See imp skill routing for the
map.

The `navbar` keys are these:

| Key        | Values                              | Notes                                                                 |
| ---------- | ----------------------------------- | --------------------------------------------------------------------- |
| `map`      | the value of `appMap()`             | The nav tree; the router in the content fills it                      |
| `icons`    | `{ [handle]: icon }`                | An icon per node: a Lucide export, or any DOM                         |
| `tags`     | `{ [handle]: tag }`                 | A pill per node: `{ text, color }`, or a state holding one, or `null` |
| `label`    | string, or a state                  | Names the bar's `<nav>`; defaults to a translated "Navigation"        |
| `items`    | array of sections - live            | Frame with no map only; see the section shape below                   |
| `selected` | a section's `id`, or a state - live | Frame with no map only; which section is current                      |

The `sidebar` keys are these. imp reads **`groups` and `items` only when there is no `navbar`**.
Beside a `navbar`, imp warns and drops them, because a section declares its own:

| Key        | Values                                 | Notes                                                 |
| ---------- | -------------------------------------- | ----------------------------------------------------- |
| `label`    | string, or a state                     | Names the sidebar's `<nav>`; defaults to "Section"    |
| `extras`   | DOM, or an array of it                 | App-wide block below the rows - support, upgrade, CTA |
| `footer`   | array of items                         | App-wide rows at the foot of the column - settings    |
| `selected` | an item's `id`, or a state - live      | Frame with no map only; the row with `aria-current`   |
| `groups`   | array of `{ id?, label, tag?, items }` | Sidebar-only layout: the whole column                 |
| `items`    | array of items                         | Sidebar-only layout: one unlabelled group             |

Without a map, a **section** is `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`
and a **row** is `{ id, label, icon, href, onClick, tag, disabled, children? }`, where `children` is
a nested array of rows. `icon` is any DOM. `tag` is `{ text, color }` data. That form is for a frame
with no router, such as a preview.

There is no `layout` enum. The props that you pass are the arrangement.

| Layout                 | Props                                  | What you get                                            |
| ---------------------- | -------------------------------------- | ------------------------------------------------------- |
| Sections with sidebars | `navbar.map` (sections carry children) | Top bar of sections, column beneath for the current one |
| Sections only          | `navbar.map` (leaf sections)           | Top bar, no column, content full width                  |
| Sidebar only           | `sidebar` with `groups` / `items`      | No bar at all: logo heads the column, extras foot it    |
| One section            | `navbar.map`, one section with rows    | Sidebar only; the frame drops the bar on its own        |

The sizes are custom properties. You can set them from the page, because they inherit into the
shell:

| Property                          | Default | Effect                                        |
| --------------------------------- | ------- | --------------------------------------------- |
| `--imp-shell-sidebar-inline-size` | `16rem` | Sidebar column, and the drawer's width        |
| `--imp-shell-bottom-bar-items`    | `4`     | Nav slots before **More**, clamped to `3`-`5` |

Rules an agent gets wrong:

- **Pass the map, and put the router in the content.** `navbar: { map }` alone shows nothing. The
  `router({ map })` inside the main content derives the nav and fills it. `navbar.items`,
  `navbar.selected` and `sidebar.selected` beside a map are warned about and dropped.
- **One section means no bar.** When the derived nav has one section and that section has rows, the
  frame draws the sidebar-only layout by itself. Write a one-section app with every page under the
  index node, `app: { path: '/', dashboard: {}, reports: {} }`. Do not pass `sidebar.groups` to get
  the column beside a map.
- **`icons` and `tags` bind by handle, at the root.** Write `{ [app.reports]: luChartColumn }` and
  `{ [app.reports.revenue]: count }`. An icon is a Lucide export or any DOM. A tag is
  `{ text, color }`, or a **state** that holds one, or `null`; a state keeps the pill live. Neither
  is a prop of the map. An area file cannot supply either, because the section row renders before
  its chunk loads.
- **The nav is data, not DOM.** imp warns about a node in `navbar` or `sidebar`, and drops it. The
  shell draws the rows itself, because it draws each level more than once. `logo` and `extras` are
  still any DOM that you want.
- **Who is signed in is not a prop of the frame.** Put `userCard` in `extras`; it owns the sign-in
  button and the sign-out action. Whether a signed-out visitor sees a section is the `access` of the
  map.
- **The trail is chrome.** With a map, the shell renders `breadcrumbs` above the content, and the
  phone title shows the last two crumbs. Do not render a second trail in a screen. Pass
  `breadcrumbs: false` to drop the strip.
- **Page CSS does not reach a region.** imp puts `logo`, `extras`, `sidebar.extras` and the main
  content inside the shadow root of the shell. So a rule in the stylesheet of the app never styles
  them. Only an inherited property and an `--imp-*` custom property cross the boundary. This is
  deliberate. Pass imp components, such as `appLogo`, `themeSelect` and your own `component()`. They
  carry their own styles. imp also moves that DOM between the bar, the column and the drawer. An imp
  component survives the move. An `<iframe>` or a third-party element does not.
- **A section with no rows renders no sidebar**, and the content takes the full width. Do not build
  a false empty column with one row. The change of layout is the signal that the context changed.
  The one thing that keeps the column is app-wide content, which is `sidebar.extras` or
  `sidebar.footer`. That content then shows alone, under the name of the context.
- **`sidebar.extras` and `sidebar.footer` are app-wide, not per section.** They stay whichever
  section is current. `extras` is DOM below the rows and above the `footer` rows. The icon rail
  hides `extras` and keeps the footer icons. So a footer row needs an icon before imp offers the
  rail. On a phone both join the drawer.
- **`gap` floats the chrome.** Step `0` is the default. It is the edge-to-edge frame with hairline
  dividers. Any other step insets the frame by that much and draws each region as a bordered panel,
  rounded with `radius-container`. The content is not a panel. The frame publishes
  `--imp-shell-frame-gap` and `--imp-shell-frame-radius`, so a `drawer` mounted in the main content
  floats in the same way.
- **The background is a theme token first.** The frame paints `background-app`. Pass `background`
  only for a backdrop that CSS cannot draw. It is one DOM node, stretched to the frame and painted
  under everything, hidden from assistive technology. So put nothing interactive in it.
- **`children` nest one level, and are collapsed by default.** Static grandchildren of the context
  are the one collapsible level. The parent gets a caret and `aria-expanded`. The parent of the
  selected row starts expanded. On a phone the parents are the bottom bar, and a tap opens the
  children in the **More** sheet, one column anchored above the tapped row.
- **The main content is the children, not a `main` prop.** Write `shell({ navbar }, page())`.
- **There is no aside region. Do not ask for one.** Content that comes and goes is a `drawer` in the
  main content. Content that must stand beside the page is your own layout inside the main content,
  as in `shell({ navbar }, flex({ gap: 4 }, page(), sideColumn()))`.
- **There is no `header` region and no `footer` region.** A page title and a toolbar go at the top
  of the main content that you pass as children.
- **The shell is the one component that changes structure by width.** Its query is `48rem`. Below it
  the top bar becomes a hamburger and a two-line title, the sidebar becomes the bottom bar capped at
  `--imp-shell-bottom-bar-items` rows with a **More** sheet, and the sections, the footer rows and
  both `extras` move into the drawer. The trail strip hides, and the title carries the crumbs.
- **The desktop sidebar collapses to an icon rail** from a toggle in its head. That head names the
  context, which is the param crumb when there is one. imp shows the toggle only when every row has
  an `icon`.
- **`navOpen` is optional.** Without it, the shell owns the drawer state. Pass a **writable** state,
  never a `computed`, when the app must drive the drawer.
- **The shell renders the `<nav>` landmarks itself**, named from the `label` of each level. It also
  renders `<header>` and `<main>`. It is `100dvb` tall, and it scrolls each region on its own.

```js
shell(
  { logo: brand(), navbar: { map: app, icons, tags }, extras: [themeSelect(), userCard(person)] },
  router({ map: app, access, screens, options }),
)
shell({ logo: brand(), sidebar: { label: 'Reports', groups, selected: page } }, page())
shell({
  navbar: { map: app, icons },
  sidebar: { extras: supportCard(), footer: [{ id: 'help', label: 'Help', href: '/help' }] },
  gap: 3,
  background: driftingShapes(),
}, router({ map: app, screens }))
```

Related: imp skill std/drawer - the contextual panel that opens over the frame; imp skill
std/appLogo - the brand block the `logo` prop takes; imp skill std/userCard - the signed-in person
in `extras`; imp skill std/breadcrumbs - the trail the frame renders from the map.
