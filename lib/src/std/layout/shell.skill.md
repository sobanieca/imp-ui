# shell - the app frame: one nav tree, logo, content, account, and the phone fold

**Use `shell` first when you build an app. Customize it. Do not replace it.** Do not assemble a
header and sidebar grid by hand. Build the frame with `shell` and let it draw the nav. An app whose
shape it truly does not fit writes its own frame component. That is a supported result, not a
failure.

```js
import { shell } from 'imp/std/layout'
import { luChartColumn } from 'imp/icons'

shell(
  {
    logo: appLogo({ label: 'Acme' }),
    navbar: {
      label: 'Sections',
      selected: section,
      items: [
        {
          id: 'reports',
          label: 'Reports',
          icon: icon(luChartColumn),
          groups: [
            { label: 'Money', items: [{ id: 'revenue', label: 'Revenue', href: '/revenue' }] },
          ],
        },
        { id: 'directory', label: 'Directory', href: '/directory' },
      ],
    },
    sidebar: { label: 'Reports', selected: page },
    extras: themeSelect(),
    account: { name: 'Ada Lovelace', description: 'ada@example.com', onSignOut },
    signedIn,
  },
  router({ routes }),
)
```

The call shape is `shell(props?, ...mainContent)`. When a props object is present, it must be the
**first** argument. **Everything after it is the main content**, because it is the content.

| Prop         | Values                         | Default | Notes                                                        |
| ------------ | ------------------------------ | ------- | ------------------------------------------------------------ |
| `logo`       | DOM                            | none    | Brand block; heads the bar, the sidebar, or the drawer       |
| `navbar`     | **data** - see below           | none    | The sections; each may declare its own sidebar               |
| `sidebar`    | **data** - see below           | none    | The second level: names it, marks it, foots it               |
| `account`    | **data** - see below           | none    | The signed-in person; becomes a `userCard`                   |
| `extras`     | DOM, or an array of it         | none    | Theme picker, language picker, anything; sits by the account |
| `signedIn`   | boolean, or a state - **live** | `true`  | `false` withholds the nav and shows only logo and sign-in    |
| `navOpen`    | boolean, or a state - **live** | `false` | Drawer state; the shell owns one if the prop is omitted      |
| `gap`        | spacing step `0`-`6`           | `0`     | Floats bar, column and bottom bar apart, rounded             |
| `background` | DOM                            | none    | Decorative layer under everything; the animated backdrop     |
| `events`     | `{ navToggle, select }`        | -       | `navToggle` gives `{ open }`, `select` gives `{ id, item }`  |

**One nav tree drives three surfaces.** The `navbar` items are the sections. A section that carries
`groups` declares what the sidebar shows while that section is current. A bare `items` array is one
group with no label, and it does the same. The bar lists the sections. The sidebar lists the groups
of the current section. The bottom bar of a phone lists the items of that section. You declare
nothing twice.

The `navbar` keys are these:

| Key        | Values                              | Notes                                                          |
| ---------- | ----------------------------------- | -------------------------------------------------------------- |
| `items`    | array of sections - live            | See the section shape below                                    |
| `selected` | a section's `id`, or a state - live | Which section is current, and so which sidebar                 |
| `label`    | string, or a state                  | Names the bar's `<nav>`; defaults to a translated "Navigation" |

The `sidebar` keys are these. imp reads **`groups` and `items` only when there is no `navbar`**.
Beside a `navbar`, imp warns and drops them, because a section declares its own:

| Key        | Values                                 | Notes                                                 |
| ---------- | -------------------------------------- | ----------------------------------------------------- |
| `selected` | an item's `id`, or a state - live      | The row that gets `aria-current="page"`               |
| `label`    | string, or a state                     | Names the sidebar's `<nav>`; defaults to "Section"    |
| `extras`   | DOM, or an array of it                 | App-wide block below the rows - support, upgrade, CTA |
| `footer`   | array of items                         | App-wide rows at the foot of the column - settings    |
| `groups`   | array of `{ id?, label, tag?, items }` | Sidebar-only layout: the whole column                 |
| `items`    | array of items                         | Sidebar-only layout: one unlabelled group             |

A **section** is `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`. A **row** is
`{ id, label, icon, href, onClick, tag, disabled, children? }`, where `children` is a nested array
of rows. `icon` is any DOM. `tag` is `{ text, color }` data.

The `account` keys are `name`, `description`, `picture`, `href`, `onSignIn` and `onSignOut`. Each
one is a `userCard` prop, and each one accepts a state. imp warns about any other key and drops it.

There is no `layout` enum. The props that you pass are the arrangement.

**A screen cannot push markup into the nav. It pushes data.** Keep a nav state beside the shell and
compute `items` from it. The screen contributes on mount and withdraws on unmount. The withdrawal
runs in `onRemove`, where `useState(self, name)` returns the handle that `setup` resolved:

```js
const projectScreen = component('acme-project', {
  setup: (self, projectId) => {
    useState(self, 'acme.nav.project').set({ id: projectId })
    return overview(projectId)
  },
  onRemove: (self) => useState(self, 'acme.nav.project').set(null),
})
```

| Layout                 | Props                                 | What you get                                            |
| ---------------------- | ------------------------------------- | ------------------------------------------------------- |
| Sections with sidebars | `navbar` (sections carrying `groups`) | Top bar of sections, column beneath for the current one |
| Sections only          | `navbar` (no section carries groups)  | Top bar, no column, content full width                  |
| Sidebar only           | `sidebar` with `groups` / `items`     | No bar at all: logo heads the column, account foots it  |

The sizes are custom properties. You can set them from the page, because they inherit into the
shell:

| Property                          | Default | Effect                                        |
| --------------------------------- | ------- | --------------------------------------------- |
| `--imp-shell-sidebar-inline-size` | `16rem` | Sidebar column, and the drawer's width        |
| `--imp-shell-bottom-bar-items`    | `4`     | Nav slots before **More**, clamped to `3`-`5` |

Rules an agent gets wrong:

- **`navbar` is the top level, and a section owns its own sidebar.** Do not keep a second array in
  step by hand. Put the second level inside the section as `groups`. Drive `navbar.selected` and
  `sidebar.selected` from the route. The frame does the rest.
- **The nav is data, not DOM.** imp warns about a node in `navbar` or `sidebar`, and drops it. The
  shell draws the rows itself, because it draws each level more than once. The bar row is also a
  drawer column. The sidebar column is also a capped bottom bar. `logo` and `extras` are still any
  DOM that you want.
- **Page CSS does not reach a region.** imp puts `logo`, `extras`, `sidebar.extras` and the main
  content inside the shadow root of the shell. So a rule in the stylesheet of the app never styles
  them. Only an inherited property and an `--imp-*` custom property cross the boundary. This is
  deliberate. Pass imp components, such as `appLogo`, `themeSelect` and your own `component()`. They
  carry their own styles. Style raw DOM in a region inline, or do not style it. imp also moves that
  DOM between the bar, the column and the drawer. An imp component survives the move. An `<iframe>`
  or a third-party element does not.
- **A section with no groups renders no sidebar**, and the content takes the full width. Do not
  build a false empty column with one row. The change of layout is the signal that the context
  changed. The one thing that keeps the column is app-wide content, which is `sidebar.extras` or
  `sidebar.footer`. That content then shows alone, under the name of the section.
- **`sidebar.extras` and `sidebar.footer` are app-wide, not per section.** They stay whichever
  section is current. So a support card, an upgrade prompt or a help link belongs there, and never
  in the `groups` of a section. `extras` is DOM below the rows and above the `footer` rows. The icon
  rail hides `extras` and keeps the footer icons. So a footer row needs an icon before imp offers
  the rail. On a phone both join the drawer. imp merges `extras` with the `extras` of the shell
  above the account, and puts the footer rows below the sections.
- **`gap` floats the chrome.** Step `0` is the default. It is the edge-to-edge frame with hairline
  dividers. Any other step insets the frame by that much. It separates the bar, the column and the
  bottom bar from each other and from the content. It draws each one as a bordered panel, rounded
  with `radius-container`. So the radius of a theme reaches the frame only through `gap`. At step
  `0` it does not, because a rounded corner against the edge of a screen looks broken. The content
  is not a panel. It sits on the background. The phone drawer also floats. It is inset by the gap,
  bordered and rounded. The frame publishes `--imp-shell-frame-gap` and `--imp-shell-frame-radius`,
  so a `drawer` mounted in the main content floats in the same way.
- **The background is a theme token first.** The frame paints `background-app`, which takes a colour
  or a gradient and defaults to `color-surface`. Every chrome panel paints `color-surface-sunken`
  over it. Pass `background` only for a backdrop that CSS cannot draw, such as moving shapes or a
  canvas. It is one DOM node, stretched to the frame and painted under everything. imp keeps it
  behind every panel and behind the drawer, and hides it from assistive technology. So put nothing
  interactive in it.
- **A section is always selectable**, also with no `href` and no `onClick`. It renders a button and
  reports `select`, because a choice of section is what changes the sidebar.
- **`children` nest one level, and are collapsed by default.** The parent row gets a caret and
  `aria-expanded`. A click on it selects the parent and toggles its children. A parent with no
  `href` and no `onClick` still renders a button, so a mouse and a keyboard can expand it. The
  parent of the selected row starts expanded. On a phone the parents are the bottom bar. A tap on
  one opens its children in the **More** sheet, titled with the label of the parent. So a catalog of
  collapsible groups works on both. Give each parent an `icon`, and imp offers the rail as well.
- **The main content is the children, not a `main` prop.** Write `shell({ navbar }, page())`.
- **There is no aside region. Do not ask for one.** Every region that the frame owns has a phone
  form. A contextual side column has none, so the shell does not offer it. The frame is for an app
  that suits a desktop and a phone at the same time. Content that comes and goes, such as filters,
  an inspector or a detail view, is a `drawer`. Mount it in the main content and open it from a
  control there. Content that must stand beside the page is your own layout inside the main content,
  as in `shell({ navbar }, flex({ gap: 4 }, page(), sideColumn()))`. The media query of your
  component then decides when the column wraps below the page.
- **There is no `header` region and no `footer` region.** The chrome is `logo`, `extras`, `account`
  and the `footer` rows of the sidebar. Everything else that a page wants above its content, such as
  breadcrumbs, a page title or a toolbar, goes at the top of the main content that you pass as
  children.
- **The shell is the one component that changes structure by width.** Its query is `48rem`. Do not
  copy the exception into your own components. It is a media query. So a shell inside a narrow panel
  on a wide screen keeps its desktop layout.
- **Below `48rem` the frame folds like a phone app.** The top bar becomes a hamburger and a two-line
  title, with the section over the current row. **The sidebar becomes the bottom bar.** imp caps it
  at `--imp-shell-bottom-bar-items` rows, and adds a **More** button that opens a bottom sheet with
  the rest. The groups flatten there. **The sections, the footer rows, both `extras` and the account
  move into the hamburger drawer.** When the current section has no sidebar, the bottom bar carries
  the **sections** instead. The drawer then holds the chrome only, because a row lives in one place
  at a time.
- **The desktop sidebar collapses to an icon rail** from a toggle in its head. That head also shows
  the name of the current section. The rail is state of the shell. There is no prop for it. **imp
  shows the toggle only when every row has an `icon`.** That means each row of the current section
  and each `footer` row. A rail of blank rows shows nothing. So give every row an icon, or accept a
  column that does not collapse. The rail hides everything but the icons. It hides the logo,
  `sidebar.extras`, the `extras` of the shell, and the account card at the foot.
- **`signedIn: false` is the whole authentication story.** imp withholds the nav and the bottom bar,
  closes the drawer, and falls back to one top bar with the logo and the sign-in button. That button
  is `account.onSignIn`, so pass it when the app has a signed-out state. Leave `signedIn` out and
  there is no authentication concept. Everything then shows.
- **The drawer animates itself and holds the page still.** It slides in from the inline start over
  `--imp-duration-medium`, behind a backdrop that fades in. It slides back out on Escape, on a
  backdrop click and on close. Under `prefers-reduced-motion: reduce` it opens instantly. While it
  is open, the page behind it does not scroll. A choice of any nav row closes it.
- **`navOpen` is optional.** Without it, the shell owns the drawer state. Pass a **writable** state,
  never a `computed`, when the app must drive the drawer. Listen with `events: { navToggle }` when
  the app only observes it.
- **The other region contents already ship.** `imp/std/shell` has `appLogo`, `breadcrumbs`,
  `themeSelect` and `langSelect`. It also has `userCard`, for a frame that you write yourself.
  Inside `shell` you pass `account`, and the shell builds the card.
- **The shell renders the `<nav>` landmarks itself**, named from the `label` of each level. It also
  renders `<header>` and `<main>`. It is `100dvb` tall, and it scrolls each region on its own.

```js
shell({
  logo: brand(),
  navbar: { items: sections, selected: section },
  sidebar: { selected: page },
  account,
}, router({ routes }))
shell({ logo: brand(), sidebar: { label: 'Reports', groups, selected: page } }, page())
shell({
  navbar: { items: sections, selected: section },
  sidebar: {
    selected: page,
    extras: supportCard(),
    footer: [{ id: 'help', label: 'Help', href: '/help' }],
  },
  gap: 3,
  background: driftingShapes(),
}, page())
shell({
  navbar: { items: sections, selected: section },
  sidebar: { selected: page, footer: [{ id: 'help', label: 'Help', href: '/help' }] },
  account,
  signedIn,
  events: { navToggle: (e) => log(e.detail.open), select: (e) => log(e.detail.id) },
}, page())
```

Related: imp skill std/drawer - the contextual panel that opens over the frame; imp skill
std/appLogo - the brand block the `logo` prop takes; imp skill std/userCard - what `account` is
rendered as, and the component to use in a frame of your own.
