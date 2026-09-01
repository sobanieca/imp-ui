# shell - the app frame: one nav tree, logo, content, aside, account, and the phone fold

**Reach for `shell` first when building an app, and customize it rather than replacing it.** Do not
hand-assemble a header-and-sidebar grid: build the frame with `shell` and let it draw the nav. An
app whose shape it genuinely does not fit writes its own frame component - that is a supported
ending, not a failure.

```js
import { shell } from 'imp/std/layout'

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
          icon: icon({ name: 'chart' }),
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

Call shape: `shell(props?, ...mainContent)` - the props object, when present, must be the **first**
argument. **Everything after it is the main content**, because it is the content.

| Prop       | Values                         | Default | Notes                                                        |
| ---------- | ------------------------------ | ------- | ------------------------------------------------------------ |
| `logo`     | DOM                            | none    | Brand block; heads the bar, the sidebar, or the drawer       |
| `navbar`   | **data** - see below           | none    | The sections; each may declare its own sidebar               |
| `sidebar`  | **data** - see below           | none    | The second level: names it, marks it, foots it               |
| `aside`    | DOM                            | none    | Right contextual column, into `<aside>`; gone below `48rem`  |
| `account`  | **data** - see below           | none    | The signed-in person; becomes a `userCard`                   |
| `extras`   | DOM, or an array of it         | none    | Theme picker, language picker, anything; sits by the account |
| `signedIn` | boolean, or a state - **live** | `true`  | `false` withholds the nav and shows only logo and sign-in    |
| `navOpen`  | boolean, or a state - **live** | `false` | Drawer state; the shell owns one if the prop is omitted      |
| `events`   | `{ navToggle, select }`        | -       | `navToggle` gives `{ open }`, `select` gives `{ id, item }`  |

**One nav tree drives three surfaces.** The `navbar` items are the sections; a section that carries
`groups` (or a bare `items` array, which is one unlabelled group) declares what the sidebar shows
while it is current. The bar lists the sections, the sidebar lists the current section's groups, and
the phone's bottom bar lists that section's items. Nothing is declared twice.

`navbar` keys:

| Key        | Values                              | Notes                                                          |
| ---------- | ----------------------------------- | -------------------------------------------------------------- |
| `items`    | array of sections - live            | See the section shape below                                    |
| `selected` | a section's `id`, or a state - live | Which section is current, and so which sidebar                 |
| `label`    | string, or a state                  | Names the bar's `<nav>`; defaults to a translated "Navigation" |

`sidebar` keys - **`groups` and `items` are read only when there is no `navbar`** (they warn and are
dropped beside one, because a section declares its own):

| Key        | Values                                 | Notes                                                  |
| ---------- | -------------------------------------- | ------------------------------------------------------ |
| `selected` | an item's `id`, or a state - live      | The row that gets `aria-current="page"`                |
| `label`    | string, or a state                     | Names the sidebar's `<nav>`; defaults to "Section"     |
| `footer`   | array of items                         | Rows pinned to the foot of the column - settings, help |
| `groups`   | array of `{ id?, label, tag?, items }` | Sidebar-only layout: the whole column                  |
| `items`    | array of items                         | Sidebar-only layout: one unlabelled group              |

A **section**: `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`. A **row**:
`{ id, label, icon, href, onClick, tag, disabled, children? }`, where `children` is a nested array
of the same. `icon` is any DOM, `tag` is `{ text, color }` data.

`account` keys: `name`, `description`, `picture`, `href`, `onSignIn`, `onSignOut` - each one a
`userCard` prop, each one accepting a state. Any other key warns and is dropped.

There is no `layout` enum: which props you pass is the arrangement.

| Layout                 | Props                                 | What you get                                            |
| ---------------------- | ------------------------------------- | ------------------------------------------------------- |
| Sections with sidebars | `navbar` (sections carrying `groups`) | Top bar of sections, column beneath for the current one |
| Sections only          | `navbar` (no section carries groups)  | Top bar, no column, content full width                  |
| Sidebar only           | `sidebar` with `groups` / `items`     | No bar at all: logo heads the column, account foots it  |

Sizes are custom properties, settable from the page because they inherit into the shell:

| Property                          | Default | Effect                                        |
| --------------------------------- | ------- | --------------------------------------------- |
| `--imp-shell-sidebar-inline-size` | `16rem` | Sidebar column, and the drawer's width        |
| `--imp-shell-aside-inline-size`   | `20rem` | Aside column                                  |
| `--imp-shell-bottom-bar-items`    | `4`     | Nav slots before **More**, clamped to `3`-`5` |

Rules an agent gets wrong:

- **`navbar` is the top level, and a section owns its own sidebar.** Do not keep a second array in
  sync by hand: put the second level inside the section as `groups`, drive `navbar.selected` and
  `sidebar.selected` from the route, and the frame does the rest.
- **The nav is data, not DOM.** Do not pass a `navMenu` - a node in `navbar` or `sidebar` warns and
  is dropped. The shell draws the rows itself because it draws each level more than once: the bar
  row is also a drawer column, the sidebar column is also a capped bottom bar. `logo`, `aside` and
  `extras` are still arbitrary DOM.
- **A section with no groups renders no sidebar at all**, and the content takes the full width. Do
  not fake an empty column with one row: the layout shift is the signal that the context changed.
- **A section is always selectable**, even with no `href` and no `onClick` - it renders a button and
  reports `select`, because choosing it is what changes the sidebar.
- **`children` nest one level and are collapsed by default.** The parent row gets a caret and
  `aria-expanded`; clicking it both selects the parent and toggles its children. Children never
  appear in the bottom bar.
- **Main content is the children**, not a `main` prop. `shell({ navbar }, page())`.
- **There is no `header` region and no `footer`.** Chrome is `logo`, `extras`, `account` and the
  sidebar's `footer` rows; anything else a page wants above its content - breadcrumbs, a page title,
  a toolbar - goes at the top of the main content you pass as children.
- **The shell is the one component that changes structure by width**, and its query is `48rem`. Do
  not copy the exception into your own components. It is a media query, so a shell embedded in a
  narrow panel on a wide screen keeps its desktop layout.
- **Below `48rem` the frame folds like a phone app.** The top bar becomes a hamburger and a two-line
  title - the section over the current row. **The sidebar becomes the bottom bar**, capped at
  `--imp-shell-bottom-bar-items` rows plus a **More** button opening a bottom sheet with the rest;
  groups flatten there. **The sections, `extras` and the account move into the hamburger drawer.**
  The aside is gone. When the current section has no sidebar, the bottom bar carries the
  **sections** instead - and the drawer then holds only the chrome, because a row lives in one place
  at a time.
- **The desktop sidebar collapses to an icon rail** from a toggle in its head, which also shows the
  current section's name. The rail is the shell's own state - there is no prop for it.
- **`signedIn: false` is the whole auth story.** The nav, the bottom bar and the aside are withheld,
  the drawer closes, and the shell falls back to a single top bar holding the logo and the sign-in
  button - which is `account.onSignIn`, so pass it if the app has a signed-out state at all. Omit
  `signedIn` and there is no auth concept: everything shows.
- **The drawer animates itself and holds the page still.** It slides in from the inline start over
  `--imp-duration-medium` behind a fading backdrop, slides back out on Escape, on a backdrop click
  and on close, drops to an instant open under `prefers-reduced-motion: reduce`, and stops the page
  behind it from scrolling while it is open. Choosing any nav row closes it.
- **`navOpen` is optional.** Without it the shell owns the drawer state; pass a **writable** state
  (never a `computed`) when the app needs to drive it, and listen with `events: { navToggle }` when
  it only needs to observe.
- **The rest of the region contents already ship.** `imp/std/shell` has `appLogo`, `breadcrumbs`,
  `themeSelect` and `langSelect`. `userCard` is there too, for a frame you write yourself - inside
  `shell` you pass `account` and the shell builds it.
- **The shell renders the `<nav>` landmarks itself**, named from each level's `label`. It also
  renders `<header>`, `<main>` and `<aside>`, is `100dvb` tall, and scrolls each region
  independently.

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
  sidebar: { selected: page, footer: [{ id: 'help', label: 'Help', href: '/help' }] },
  account,
  signedIn,
  events: { navToggle: (e) => log(e.detail.open), select: (e) => log(e.detail.id) },
}, page())
```

Related: imp skill std/navMenu - the same nav rows, for a menu outside the frame; imp skill
std/appLogo - the brand block the `logo` prop takes; imp skill std/userCard - what `account` is
rendered as, and the component to use in a frame of your own.
