# shell - the app frame: the map drives the nav and the trail, logo, content, and the phone fold

**Use `shell` first when you build an app. Customize it. Do not replace it.** Do not assemble a
header and sidebar grid by hand. Build the frame with `shell`, hand it the application map, and let
it draw the nav and the trail. An app whose shape it truly does not fit writes its own frame
component. That is a supported result, not a failure.

```js
import { shell } from 'imp/std/shell'
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
      hide: [app.signIn],
      groups: { Money: [app.reports.revenue, app.reports.costs] },
      icons: { [app.reports]: luChartColumn, [app.directory]: luUsers },
      tags: { [app.reports.revenue]: revenueCount },
    },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ name: user.name, description: user.email })],
    signIn: app.signIn,
  },
  router({ map: app, access, need, screens }),
)
```

The call shape is `shell(props?, ...mainContent)`. When a props object is present, it must be the
**first** argument. **Everything after it is the main content**, because it is the content.

| Prop          | Values                                  | Default  | Notes                                                              |
| ------------- | --------------------------------------- | -------- | ------------------------------------------------------------------ |
| `logo`        | DOM                                     | none     | Brand block; heads the bar, the sidebar, or the drawer             |
| `navbar`      | **data** - see below                    | none     | The map, or plain sections for a frame with no router              |
| `sidebar`     | **data** - see below                    | none     | The second level: names it, foots it                               |
| `extras`      | DOM, or an array of it                  | none     | Theme picker, language picker, `userCard`, anything                |
| `signIn`      | a node handle of the map                | none     | The sign-in node; it and its children show without the chrome      |
| `breadcrumbs` | `false`                                 | shown    | Turns the trail above the content off; needs a map                 |
| `navOpen`     | boolean, or a state - **live**          | `false`  | Drawer state; the shell owns one if the prop is omitted            |
| `gap`         | spacing step `0`-`6`                    | `0`      | Floats bar, column and bottom bar apart, rounded                   |
| `maxWidth`    | CSS length, or `'none'`                 | `125rem` | Widest the column and the content get; centred beyond it           |
| `background`  | DOM                                     | none     | Decorative layer under the whole frame; the animated backdrop      |
| `effect`      | `'none'`, `'fade'`, `'slide'`, `'zoom'` | `'none'` | Animates a change of screen in the content area; a view transition |
| `events`      | `{ navToggle, select }`                 | -        | `navToggle` gives `{ open }`, `select` gives `{ id, item }`        |

**One map drives three surfaces and the trail.** With `navbar.map`, the router derives the sections,
the rows of the current section, the marked rows, the head of the sidebar and the crumbs. The bar
lists the top-level nodes. The sidebar lists the static children of the current context, which is
the deepest param node on the path, or else the section. The bottom bar of a phone lists the same
rows. The trail renders above the content. You declare nothing twice. See imp skill routing for the
map.

The `navbar` keys are these:

| Key          | Values                              | Notes                                                                        |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| `map`        | the value of `appMap()`             | The nav tree; the router in the content fills it                             |
| `hide`       | `[handle, ...]`                     | Nodes the nav does not show; the route stays                                 |
| `groups`     | `{ [title]: [handle, ...] }`        | Sidebar group titles; a title that is a message key is translated            |
| `icons`      | `{ [handle]: icon }`                | An icon per node: a Lucide export, or any DOM                                |
| `tags`       | `{ [handle]: tag }`                 | A pill per node: `{ text, color, title }`, or a state holding one, or `null` |
| `label`      | string, or a state                  | Names the bar's `<nav>`; defaults to a translated "Navigation"               |
| `items`      | array of sections - live            | Frame with no map only; see the section shape below                          |
| `selected`   | a section's `id`, or a state - live | Frame with no map only; which section is current                             |
| `background` | DOM                                 | Decorative layer under the bar; hidden from assistive technology             |

The `sidebar` keys are these. imp reads **`groups` and `items` only when there is no `navbar`**.
Beside a `navbar`, imp warns and drops them, because a section declares its own:

| Key          | Values                                 | Notes                                                   |
| ------------ | -------------------------------------- | ------------------------------------------------------- |
| `label`      | string, or a state                     | Names the sidebar's `<nav>`; defaults to "Section"      |
| `extras`     | DOM, or an array of it                 | App-wide block below the rows - support, upgrade, CTA   |
| `footer`     | array of items                         | App-wide rows at the foot of the column - settings      |
| `selected`   | an item's `id`, or a state - live      | Frame with no map only; the row with `aria-current`     |
| `groups`     | array of `{ id?, label, tag?, items }` | Sidebar-only layout: the whole column                   |
| `items`      | array of items                         | Sidebar-only layout: one unlabelled group               |
| `background` | DOM                                    | Decorative layer under the column, and the phone drawer |

Without a map, a **section** is `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`
and a **row** is `{ id, label, icon, href, onClick, tag, disabled, children? }`, where `children` is
a nested array of rows. `icon` is any DOM. `tag` is `{ text, color, title }` data. That form is for
a frame with no router, such as a preview. An `href` with an unsafe scheme, such as `javascript:`,
is dropped with a warning.

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

- **The content area is the screen region of the router.** A forward navigation scrolls it to the
  top, and a back navigation puts it back. Do not scroll the window; the frame is `100dvb` tall and
  the window never scrolls. `effect` animates a change of screen with a view transition. Only the
  content area moves. `'slide'` follows the reading direction and turns around on a back navigation.
  Reduced motion turns every effect off. A click during the animation reaches nothing, so a test
  that clicks right after a navigation waits for the animation to end.

- **Pass the map, and put the router in the content.** `navbar: { map }` alone shows nothing. The
  `router({ map })` inside the main content derives the nav and fills it. `navbar.items`,
  `navbar.selected` and `sidebar.selected` beside a map are warned about and dropped.
- **One section means no bar.** When the derived nav has one section and that section has rows, the
  frame draws the sidebar-only layout by itself. Write a one-section app with every page under the
  index node, `home: { dashboard: {}, reports: {} }`. Do not pass `sidebar.groups` to get the column
  beside a map.
- **`hide` and `groups` bind by handle too.** `hide: [app.signIn]` keeps a node off the bar and the
  sidebar. A hidden row is not drawn, and its page marks the nearest row above it.
  `groups: { Manage: [app.settings, app.billing] }` titles the consecutive rows that it names. The
  key is the title. When the messages of the app hold that key, the shell shows the message, so
  `groups: { 'acme.nav.manage': [...] }` follows the language.
- **`icons` and `tags` bind by handle, at the root.** Write `{ [app.reports]: luChartColumn }` and
  `{ [app.reports.revenue]: count }`. An icon is a Lucide export or any DOM. A tag is
  `{ text, color, title }`, or a **state** that holds one, or `null`; a state keeps the pill live.
  Neither is a prop of the map. An area file cannot supply either, because the section row renders
  before its chunk loads.
- **A tag `title` is the full form of a short `text`.** Write
  `{ text: 'main +2', title: 'main,
  backup, eu-west' }`. It shows as a tooltip on the tag and
  becomes the `aria-describedby` description of the row, so a screen reader reads the name, then the
  title. Do not repeat the label of the row in it. A group tag with a title describes the list of
  the group.
- **The nav is data, not DOM.** imp warns about a node in `navbar` or `sidebar`, and drops it. The
  shell draws the rows itself, because it draws each level more than once. `logo` and `extras` are
  still any DOM that you want.
- **Sign-in is a node of the map, and `access` guards the rest.** Give every private section a
  `need` in `router({ need })`. The guard returns `wait` while the session is `undefined`, and a
  path to the sign-in node, with the requested path in `?next=`, while it is `null`. The sign-in
  screen reads `next` and navigates to `safeNext(next, app.home.href())` after it sets the session.
  Give the sign-in node no `need`, and put it in `navbar.hide`.
- **The frame shows no chrome while it cannot know who may see the page.** While the verdict of the
  current node is `wait`, the frame shows the router content, which is its `loading` content, under
  the `logo`, centred, and nothing else: no bar, no column, no `extras`. While the current node is
  the `signIn` node or one of its children, the frame shows that screen the same way. A redirect
  keeps the layout until the next screen, so a signed-out visitor never sees the chrome. The centred
  content is `--imp-shell-bare-inline-size` wide, `28rem` by default.
- **The sign-in page is yours.** Bind a screen to the `signIn` node: a `form` with a password,
  buttons of the providers, a magic link, or a passkey. For an external identity provider, put the
  return URL under the `signIn` node too, so it also shows without the chrome. imp renders no form,
  holds no session and talks to no identity provider.
- **The frame has no account prop.** Put `accountMenu` in `extras`, with the pickers as its
  children and your sign-out as `onSignOut`. Whether a signed-in person sees a
  section is the `need` of the router.
- **Keep the desktop `extras` to one or two icon buttons.** The sections and the extras share the
  bar. When they do not fit, the sections scroll with no visible scrollbar, so a section disappears
  and the extras stay. A `langSelect`, a `themeSelect` and a full `userCard` side by side take the
  place of two or three sections. Put them behind one avatar button, the `accountMenu`.
- **A multi-tenant app puts `orgSelect` beside the logo.** Write
  `logo: flex({ gap: 2, verticalAlign: 'center' }, appLogo({ label }), orgSelect({ orgs, selected }))`,
  or put it in `extras`. See imp skill std/orgSelect.
- **The trail is chrome.** With a map, the shell renders `breadcrumbs` above the content, and the
  phone title shows the last two crumbs. Do not render a second trail in a screen. Pass
  `breadcrumbs: false` to drop the strip. The strip hides on its own on a top-level page, where the
  trail would be one crumb. A param crumb takes its label from the state `imp.routeLabels`, and
  shows the `loader` until the screen settles, see imp skill routing. The head of the column and the trail row share one height, `3.5rem`, so
  the top edge of the content lines up with the divider under the head. A gapped frame without a
  trail drops the top padding of the main region instead, so the content lines up with the top edge
  of the column. On a phone, where the trail hides, it does the same.
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
  `--imp-shell-frame-gap`, `--imp-shell-frame-radius` and `--imp-shell-frame-inset`, so a `drawer`
  mounted in the main content floats in the same way.
- **`maxWidth` caps the frame, and it is on by default.** The column and the content together never
  get wider than `maxWidth`. On a wider screen they sit in the middle, and the background fills the
  rest. The top bar keeps its surface edge to edge, and centres its controls over the content. With
  a `gap` the bar is a panel, and the panel is capped too. A `drawer` in the main content opens at
  the end edge of the content, not of the screen. Pass any CSS length, such as `'90rem'`, or
  `'none'` for a frame that always fills the screen.
- **The background is a theme token first.** The frame paints `background-app`. Pass `background`
  only for a backdrop that CSS cannot draw. It is one DOM node, stretched to the frame and painted
  under everything, hidden from assistive technology. So put nothing interactive in it.
- **The bar and the column take a backdrop of their own.** `navbar.background` is one DOM node under
  the top bar. `sidebar.background` is one DOM node under the column. Each is stretched to its
  panel, clipped to its corners, and hidden from assistive technology, like `background`. On a phone
  the column backdrop moves into the drawer with the rest of the column. A `drawer` in the main
  content takes its own `background` prop.
- **`children` nest one level, and are collapsed by default.** Static grandchildren of the context
  are the one collapsible level. The parent gets a caret and `aria-expanded`. The parent of the
  selected row starts expanded. A parent that the person folds stays folded until the selection
  moves to another parent. On a phone the parents are the bottom bar, and a tap opens the children
  in the **More** sheet, one column anchored above the tapped row. The title of that sheet is a link
  to the `href` of the parent, so the page of the parent stays reachable on a phone.
- **The main content is the children, not a `main` prop.** Write `shell({ navbar }, page())`.
- **There is no aside region. Do not ask for one.** Content that comes and goes is a `drawer` in the
  main content. Content that must stand beside the page is your own layout inside the main content,
  as in `shell({ navbar }, flex({ gap: 4 }, page(), sideColumn()))`.
- **There is no `header` region and no `footer` region.** A page title and a toolbar go at the top
  of the main content that you pass as children.
- **The shell is the one component that changes structure by width.** Its query is `48rem`. Below it
  the top bar becomes a hamburger and a two-line title, the sidebar becomes the bottom bar capped at
  `--imp-shell-bottom-bar-items` rows with a **More** sheet, and the sections, the footer rows and
  both `extras` move into the drawer. The trail strip hides, and the title carries the crumbs. The
  hamburger and the drawer are named "Menu" (`imp.shell.menu`). When the bottom bar holds every
  section, the drawer has no `<nav>`. The drawer is as tall as its content, up to the full height,
  and its nav scrolls when it does not fit.
- **The desktop sidebar collapses to an icon rail** from a toggle in its head. That head names the
  context, which is the param crumb when there is one. imp shows the toggle only when every row has
  an `icon`. In the rail, every row keeps its label for a screen reader and shows it as a tooltip on
  hover, on focus and on a touch hold.
- **`navOpen` is optional.** Without it, the shell owns the drawer state. Pass a **writable** state,
  never a `computed`, when the app must drive the drawer.
- **The shell renders the `<nav>` landmarks itself**, named from the `label` of each level. It also
  renders `<header>` and `<main>`, and a skip link as the first tab stop, shown on keyboard focus
  only. Its text is `imp.shell.skip`. It is `100dvb` tall, and it scrolls each region on its own.
  The main region is a column flex box. A child with `flex: 1` and `min-block-size: 0` takes the
  height that the trail leaves, and can scroll on its own inside the region.

## The account menu

`accountMenu` from `imp/std/shell` holds the person, the pickers and the sign-out behind one avatar
button. On a desktop the panel is a popover under the button. Below `48rem` the shell moves `extras`
into the drawer, and the panel shows inline there. See imp skill std/accountMenu.

```js
shell({
  navbar: { map: app },
  extras: [
    notifications(),
    accountMenu({ name, description: email, onSignOut }, langSelect({ languages }), themeSelect()),
  ],
})
```

## Examples

```js
shell(
  {
    logo: brand(),
    navbar: { map: app, hide: [app.signIn], icons, tags },
    extras: [themeSelect(), userCard(person)],
    signIn: app.signIn,
  },
  router({ map: app, access, need, screens }),
)
shell({ logo: brand(), sidebar: { label: 'Reports', groups, selected: page } }, page())
shell(
  {
    navbar: { map: app, icons },
    sidebar: { extras: supportCard(), footer: [{ id: 'help', label: 'Help', href: '/help' }] },
    gap: 3,
    background: driftingShapes(),
  },
  router({ map: app, screens }),
)
shell(
  {
    navbar: { map: app, background: barGlow() },
    sidebar: { background: columnImage() },
  },
  router({ map: app, screens }),
)
```

Related: imp skill std/drawer - the contextual panel that opens over the frame; imp skill
std/appLogo - the brand block the `logo` prop takes; imp skill std/accountMenu - the signed-in
person in `extras`; imp skill std/orgSelect - the tenant switcher beside the logo; imp skill
std/breadcrumbs - the trail the frame renders from the map; imp skill routing - the `access` guard
that decides the sign-in redirect.
