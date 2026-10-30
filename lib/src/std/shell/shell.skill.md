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
    map: app,
    nav: {
      [app.reports]: { icon: luChartColumn },
      [app.reports.money]: { group: true },
      [app.reports.money.revenue]: { tag: 'acme.reports.newCount' },
      [app.directory]: { icon: luUsers },
      [app.signIn]: { hidden: true },
    },
    logo: appLogo({ label: 'Acme' }),
    navbar: { label: 'Sections' },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ name: user.name, description: user.email })],
    signIn: app.signIn,
  },
  router({ map: app, guards, screens }),
)
```

The call shape is `shell(props?, ...mainContent)`. When a props object is present, it must be the
**first** argument. **Everything after it is the main content**, because it is the content.

| Prop          | Values                                       | Default  | Notes                                                              |
| ------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `map`         | the value of `appMap()`                      | none     | The only input of the nav; the router in the content fills it      |
| `nav`         | `{ [handle]: { icon, tag, group, hidden } }` | none     | The settings of one node each - see below                          |
| `navbar`      | omitted, `false`, or **data** - below        | shown    | `false` removes the bar                                            |
| `sidebar`     | **data** - see below                         | none     | Names the column, and adds app-wide `extras` under the rows        |
| `logo`        | DOM                                          | none     | Brand block; heads the bar, the sidebar, or the drawer             |
| `extras`      | DOM, or an array of it                       | none     | Theme picker, language picker, `userCard`, anything                |
| `signIn`      | a node handle of the map                     | none     | The sign-in node; it and its children show without the chrome      |
| `breadcrumbs` | `false`                                      | shown    | Turns the trail above the content off; needs a map                 |
| `navOpen`     | boolean, or a state - **live**               | `false`  | Drawer state; the shell owns one if the prop is omitted            |
| `gap`         | spacing step `0`-`6`                         | `0`      | Floats bar, column and bottom bar apart, rounded                   |
| `maxWidth`    | CSS length, or `'none'`                      | `125rem` | Widest the column and the content get; centred beyond it           |
| `background`  | DOM                                          | none     | Decorative layer under the whole frame; the animated backdrop      |
| `effect`      | `'none'`, `'fade'`, `'slide'`, `'zoom'`      | `'none'` | Animates a change of screen in the content area; a view transition |
| `events`      | `{ navToggle, select }`                      | -        | `navToggle` gives `{ open }`, `select` gives `{ id, item }`        |

**One map drives three surfaces and the trail.** With `map`, the router derives the sections, the
rows of the current section, the marked rows, the head of the sidebar and the crumbs. **The depth of
a node decides its surface.** The bar lists the top-level nodes, after the root when a screen
binds the root. The sidebar lists the static
children of the current context, which is the deepest param node on the path, or else the section.
A section with no children has no sidebar. The bottom bar of a phone lists the same rows. The trail
renders above the content, from the root crumb down. It hides on a top-level page. You declare
nothing twice. See imp skill routing for the map.

The keys of a `nav` entry are these:

| Key      | Values                                    | Notes                                                          |
| -------- | ----------------------------------------- | -------------------------------------------------------------- |
| `icon`   | a Lucide export, or any DOM               | The icon of the row or the section                             |
| `tag`    | a state name, or `{ text, color, title }` | A pill; a state holds `{ text, color, title }`, text or `null` |
| `group`  | `true`                                    | A sidebar node becomes a heading over its children             |
| `hidden` | `true`                                    | The node leaves the bar and the sidebar; the route stays       |

The `navbar` keys are these. `navbar: false` is the same as `navbar: { hidden: true }`:

| Key          | Values             | Notes                                                                |
| ------------ | ------------------ | -------------------------------------------------------------------- |
| `label`      | string, or a state | Names the bar's `<nav>`; defaults to a translated "Navigation"       |
| `hidden`     | `true`             | Removes the bar; the top bar of a phone stays and keeps `background` |
| `background` | DOM                | Decorative layer under the bar; hidden from assistive technology     |

The `sidebar` keys are these:

| Key          | Values                 | Notes                                                   |
| ------------ | ---------------------- | ------------------------------------------------------- |
| `label`      | string, or a state     | Names the sidebar's `<nav>`; defaults to "Section"      |
| `extras`     | DOM, or an array of it | App-wide block below the rows - support, upgrade, links |
| `background` | DOM                    | Decorative layer under the column, and the phone drawer |

There is no `layout` enum. The map and `navbar` are the arrangement.

| Layout                 | Props                           | What you get                                            |
| ---------------------- | ------------------------------- | ------------------------------------------------------- |
| Sections with sidebars | `map` (sections carry children) | Top bar of sections, column beneath for the current one |
| Sections only          | `map` (leaf sections)           | Top bar, no column, content full width                  |
| Sidebar only           | `map`, `navbar: false`          | No bar: the sections are the rows of the column         |

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

- **Pass the map, and put the router in the content.** `shell({ map })` mirrors
  `router({ map, screens })`. `map` alone shows nothing. The `router({ map })` inside the main
  content derives the nav and fills it. A shell with no map draws no nav.
- **`navbar: false` removes the bar.** The sections are then the rows of the sidebar, with
  their children under them. There is no other rule that hides the bar. Use
  `navbar: { hidden: true, background }` to keep a backdrop on the top bar of a phone.
- **Bind every setting of a node in `nav`, keyed by its handle.** Write
  `nav: { [app.reports]: { icon: luChartColumn } }`. None of it is a prop of the map. An area file
  cannot supply it, because the section row renders before its chunk loads. imp warns about a key
  that is not a node of the map, and about an unknown key of an entry.
- **`group: true` makes a sidebar node a heading over its children.** The heading is not a link.
  The direct children of the node are the rows under it, and their children nest under the rows.
  The heading text is the label of the node, so the message `appMap.<id>.label` translates it. A
  heading takes a `tag` like a row. **The bar has no groups.** imp warns about `group: true` on a
  node of the bar, and ignores it. So with the bar, put the group nodes one level under a section.
- **`hidden: true` keeps a node off the bar and the sidebar.** The route stays. Its page marks the
  nearest shown row above it.
- **A `tag` string is the name of a state.** The state holds `{ text, color, title }`, a string or
  a number, or `null` for no pill, and the pill stays live. An object `{ text, color, title }` is a
  fixed tag. The state must be initialized above the shell, as for the `states` of a router guard,
  so the root component of the app inits it and a screen can `useState` it later.
- **A tag `title` is the full form of a short `text`.** Write
  `{ text: 'main +2', title: 'main, backup, eu-west' }`. It shows as a tooltip on the tag and
  becomes the `aria-describedby` description of the row, so a screen reader reads the name, then the
  title. Do not repeat the label of the row in it. A heading tag with a title describes the list of
  the group.
- **The nav is data, not DOM.** imp warns about a node in `navbar` or `sidebar`, and drops it. The
  shell draws the rows itself, because it draws each level more than once. `logo` and `extras` are
  still any DOM that you want. An external link goes in `sidebar.extras`.
- **Sign-in is a node of the map, and the guard of the root covers the rest.** Bind it in
  `router({ guards: { [app]: signedIn } })`. Its check returns `true` for `node === app.signIn`
  first. Then it returns `wait` while the session is `undefined`, and a path to the sign-in node,
  with the requested path in `?next=`, while it is `null`. The sign-in screen reads `next` and
  navigates to `safeNext(next, app.href())` after it sets the session. Hide the sign-in node with
  `nav: { [app.signIn]: { hidden: true } }`.
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
  section is the guard of the router.
- **Keep the desktop `extras` to one or two icon buttons.** The sections and the extras share the
  bar. When they do not fit, the sections scroll with no visible scrollbar, so a section disappears
  and the extras stay. A `langSelect`, a `themeSelect` and a full `userCard` side by side take the
  place of two or three sections. Put them behind one avatar button, the `accountMenu`.
- **A multi-tenant app puts `orgSelect` beside the logo.** Write
  `logo: flex({ gap: 2, verticalAlign: 'center' }, appLogo({ label }), orgSelect({ orgs, selected }))`,
  or put it in `extras`. See imp skill std/orgSelect.
- **The trail is chrome.** With a map, the shell renders `breadcrumbs` above the content, and the
  phone title shows the last two crumbs. A top-level page, where the trail would be one crumb,
  shows the `logo` in the phone bar instead of the title. Do not render a second trail in a screen. Pass
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
- **A section with no children renders no sidebar**, and the content takes the full width. Do not
  build a false empty column with one row. The change of layout is the signal that the context
  changed. The one thing that keeps the column is `sidebar.extras`. That content then shows alone,
  under the name of the context.
- **`sidebar.extras` is app-wide, not per section.** It stays whichever section is current. It is
  DOM below the rows. The icon rail hides it. On a phone it joins the drawer.
- **`gap` floats the chrome.** Step `0` is the default. It is the edge-to-edge frame with hairline
  dividers. Any other step insets the frame by that much and draws each region as a bordered panel,
  rounded with `radius-container`. The content is not a panel. The frame publishes
  `--imp-shell-frame-gap`, `--imp-shell-frame-radius` and `--imp-shell-frame-inset`, so a `drawer`
  mounted in the main content floats in the same way.
- **`maxWidth` caps the frame, and it is on by default.** The column and the content together never
  get wider than `maxWidth`. On a wider screen they sit in the middle, and the background fills the
  rest. The content area still scrolls at the end edge of the screen, so the scrollbar is where a
  person expects it. The top bar keeps its surface edge to edge, and centres its controls over the content. With
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
- **`children` nest one level under a row, and are collapsed by default.** The children of a row
  are the one collapsible level. A group heading does not count as a level. The parent gets a caret
  and `aria-expanded`. The parent of the
  selected row starts expanded. A parent that the person folds stays folded until the selection
  moves to another parent. On a phone the parents are the bottom bar, and a tap opens the children
  in the **More** sheet, one column anchored above the tapped row. The title of that sheet is a link
  to the `href` of the parent, so the page of the parent stays reachable on a phone.
- **The main content is the children, not a `main` prop.** Write `shell({ map }, router(...))`.
- **There is no aside region. Do not ask for one.** Content that comes and goes is a `drawer` in the
  main content. Content that must stand beside the page is your own layout inside the main content,
  as in `shell({ map }, flex({ gap: 4 }, router(...), sideColumn()))`.
- **There is no `header` region and no `footer` region.** A page title and a toolbar go at the top
  of the main content that you pass as children. An app footer, with the legal links, Contact and
  a `bugReport({ as: 'link' })`, is the last child of the main content, after the router. Give its
  host `display: block; margin-block-start: auto`: the main region is a column flex box, so the
  footer then sits at the foot of a short page and under the content of a long one.
- **The shell is the one component that changes structure by width.** Its query is `48rem`. Below it
  the top bar becomes a hamburger and a two-line title (the `logo` on a top-level page, where it
  stays while the drawer is open and the drawer head reads "Menu"), the sidebar becomes the bottom bar capped at
  `--imp-shell-bottom-bar-items` rows with a **More** sheet, and the sections and both `extras` move
  into the drawer. The top bar slides away while the content scrolls down, and back on a scroll up,
  at the top of the content, or when a control in it takes focus. Do not write a scroll listener
  for it. The trail strip hides, and the title carries the crumbs. The
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
  map: app,
  extras: [
    notifications(),
    accountMenu({ name, description: email, onSignOut }, langSelect(), themeSelect()),
  ],
})
```

## Examples

```js
shell(
  {
    map: app,
    nav: { [app.signIn]: { hidden: true }, [app.reports]: { icon: luChartColumn } },
    logo: brand(),
    extras: [themeSelect(), userCard(person)],
    signIn: app.signIn,
  },
  router({ map: app, guards, screens }),
)
shell(
  {
    map: app,
    nav: { [app.settings]: { group: true } },
    navbar: false,
    logo: brand(),
    sidebar: { label: 'Pages', extras: supportCard() },
  },
  router({ map: app, screens }),
)
shell(
  {
    map: app,
    navbar: { background: barGlow() },
    sidebar: { background: columnImage() },
    gap: 3,
    background: driftingShapes(),
  },
  router({ map: app, screens }),
)
```

Related: imp skill std/drawer - the contextual panel that opens over the frame; imp skill
std/appLogo - the brand block the `logo` prop takes; imp skill std/accountMenu - the signed-in
person in `extras`; imp skill std/orgSelect - the tenant switcher beside the logo; imp skill
std/breadcrumbs - the trail the frame renders from the map; imp skill routing - the `guards` of the
router that decide the sign-in redirect.
