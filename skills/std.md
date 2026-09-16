# std - the built-in component library

The components come from `imp/std` and its groups. There is nothing to install, and no CSS to
include. Each component is a real imp component. It renders as its own element, such as
`<imp-button>`, with its styles sealed inside.

| Import               | Exports                                                                                                                                                                                     | Per-component skill                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/std`            | `button`, `buttonGroup`, `heading`, `text`, `link`, `icon`                                                                                                                                  | `imp skill std/button`, `std/buttonGroup`, `std/heading`, `std/text`, `std/link`, `std/icon`                                                                                                                                                                  |
| `imp/std/layout`     | `shell`, `flex`, `stack`, `dialog`, `drawer`                                                                                                                                                | `imp skill std/shell`, `std/flex`, `std/stack`, `std/dialog`, `std/drawer`                                                                                                                                                                                    |
| `imp/std/inputs`     | `form`, `textField`, `passwordField`, `searchField`, `textArea`, `codeEditor`, `richTextEditor`, `numberField`, `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton`, `resetButton` | `imp skill std/form`, `std/textField`, `std/passwordField`, `std/searchField`, `std/textArea`, `std/codeEditor`, `std/richTextEditor`, `std/numberField`, `std/select`, `std/checkbox`, `std/toggle`, `std/radioGroup`, `std/submitButton`, `std/resetButton` |
| `imp/std/display`    | `card`, `codeBlock`, `emptyState`, `markdown`, `tag`, `tooltip`                                                                                                                             | `imp skill std/card`, `std/codeBlock`, `std/emptyState`, `std/markdown`, `std/tag`, `std/tooltip`                                                                                                                                                             |
| `imp/std/navigation` | `tabs`                                                                                                                                                                                      | `imp skill std/tabs`                                                                                                                                                                                                                                          |
| `imp/std/shell`      | `appLogo`, `breadcrumbs`, `userCard`, `themeSelect`, `langSelect`                                                                                                                           | `imp skill std/appLogo`, `std/breadcrumbs`, `std/userCard`, `std/themeSelect`, `std/langSelect`                                                                                                                                                               |
| `imp/std/feedback`   | `bugReport`                                                                                                                                                                                 | `imp skill std/bugReport`                                                                                                                                                                                                                                     |

Read the skill of a component before you use it. This page gives the shared contract and a summary
of the props only.

```js
import { section } from 'imp/html'
import { button, heading, text } from 'imp/std'

section(
  heading('Billing'),
  text({ tone: 'secondary' }, 'Your plan renews on the 1st.'),
  button({ variant: 'primary', events: { click: upgrade } }, 'Upgrade'),
)
```

## The shared rules

- **imp separates props from children by type**, exactly as on an element. A plain object is props.
  Everything else is content. Pass one props object per call, see the `imp/single-props-object` lint
  rule.
- **A component accepts a documented prop only.** It forwards nothing to an inner element. imp logs
  an unknown prop, or a value outside the allowed list, together with the accepted values. It then
  uses the default.
- **A prop marked live takes the state itself**, not `state.get()`. The component then updates that
  one attribute in place, and renders nothing again.
- **A component is themed. You do not style it.** Every value comes from an `--imp-*` token of
  [theming](theming.md). So a new theme re-skins the library. The components use CSS logical
  properties, so they mirror under `dir="rtl"`.
- **The words of a component are translatable, and imp already wrote them.** imp finds them under an
  `imp.` key and falls back to English. Your translation of that key wins. See [i18n](i18n.md).
- **A component has no outer margin.** Spacing is the job of whatever lays the components out.
- **The `imp-` element prefix is reserved.** Name your own components `my-app-*`.
- **The content lives in a shadow root.** `host.textContent` is empty by design. A unit test walks
  the `shadowRoot`. An e2e selector goes through a shadow root on its own. See
  [testing](testing.md).
- A component that you never call defines no element and compiles no styles.

## button

```js
button({ variant: 'primary', size: 'lg', events: { click: save } }, 'Save changes')
```

| Prop            | Values                                                    | Default     | Notes                                       |
| --------------- | --------------------------------------------------------- | ----------- | ------------------------------------------- |
| `variant`       | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Visual weight and intent                    |
| `size`          | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                       |
| `disabled`      | boolean - **live**                                        | `false`     | Blocks interaction                          |
| `loading`       | boolean - **live**                                        | `false`     | Spinner, implies disabled, sets `aria-busy` |
| `block`         | boolean                                                   | `false`     | Fills its container's width                 |
| `square`        | boolean                                                   | `false`     | Equal padding both ways, for an icon        |
| `label`         | string - **live**                                         | -           | `aria-label`, for an icon-only button       |
| `pressed`       | boolean - **live**                                        | -           | A toggle button, `aria-pressed`             |
| `expanded`      | boolean - **live**                                        | -           | Paints `aria-expanded`                      |
| `haspopup`      | `'menu'`, `'listbox'`                                     | -           | Paints `aria-haspopup`                      |
| `popoverTarget` | an element with `popover`                                 | -           | The button invokes that popover             |
| `popoverAction` | `'toggle'`, `'show'`, `'hide'`                            | `'toggle'`  | What a click does to `popoverTarget`        |
| `events`        | event map                                                 | -           | Handlers, as on any element                 |

**There is no `type` prop and no submit button.** A button acts on its `click` handler. Submit from
there. `variant: 'link'` is a button that looks like a link. Use `link` when the target is a place
to go to.

**A button has no menu.** A button with a menu, a dropdown, or a row of joined controls is
`buttonGroup`, below.

## buttonGroup

```js
buttonGroup(
  { items: SAVE_ACTIONS },
  button({ variant: 'primary', events: { click: save } }, 'Save'),
)
buttonGroup({ label: 'Zoom' }, button({ label: 'Zoom out' }, icon(luMinus)), '100%', zoomIn)
```

The children are the visible controls, joined side by side with no gap. `items` adds a square
trigger at the end of the row, and the trigger opens the items as a menu. Pass children only,
`items` only, or both.

| Prop       | Values                                                | Default     | Notes                                   |
| ---------- | ----------------------------------------------------- | ----------- | --------------------------------------- |
| `items`    | array of `{ id?, label, icon?, onClick?, disabled? }` | -           | Adds the trigger and the menu           |
| `trigger`  | `'more'`, `'arrow'`                                   | `'more'`    | Triple-dot or chevron. Needs `items`    |
| `variant`  | as on `button`                                        | `'default'` | Styles the trigger only                 |
| `size`     | as on `button`                                        | `'md'`      | Styles the trigger and a text segment   |
| `disabled` | boolean - **live**                                    | `false`     | Disables the trigger only               |
| `label`    | string - **live**                                     | -           | `aria-label` on the `role="group"`      |
| `events`   | event map                                             | -           | Handlers on the group, such as `select` |

Every child carries its own props. The group sets no `variant`, `size` or `disabled` on a child, so
write `button({ variant: 'primary' }, ...)` for each button that must be primary. Any node goes in
as it is. Plain text, or a state text, becomes a read-only segment. A menu item is data, because its
role and its place in the keyboard order must sit in one component. A child never goes into the
menu.

When the person chooses an item, the host fires a `select` event that you can cancel, with
`detail: { id, item }`. imp then calls the `onClick` of that item. The menu is a `popover`, and the
browser places it. It flips above the row near the bottom of the screen. It closes on Escape, and on
a click away from it. It has no `placement` prop. `'more'` draws a triple-dot trigger, and `'arrow'`
draws a chevron. A group with `items` and no children is a plain dropdown.

Each control squares only the corners that face a neighbour, in logical properties, so LTR and RTL
both read correctly. Every std button and std input fits the seam.

## heading

```js
heading({ level: 2 }, 'Recent activity')
```

| Prop    | Values                         | Default     | Notes                          |
| ------- | ------------------------------ | ----------- | ------------------------------ |
| `level` | `1`-`6`                        | `1`         | Renders the real `h1`-`h6` tag |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted         |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment                 |

The type size follows the level. Never select a font size by hand.

## text

```js
text({ tone: 'secondary', size: 'sm' }, 'Prices exclude VAT.')
text('You have ', text({ inline: true, weight: 'bold' }, '3 days'), ' left.')
```

| Prop     | Values                         | Default     | Notes                     |
| -------- | ------------------------------ | ----------- | ------------------------- |
| `tone`   | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted    |
| `size`   | `'sm'`, `'md'`, `'lg'`         | `'md'`      | Type size                 |
| `weight` | `'normal'`, `'bold'`           | `'normal'`  | Type weight               |
| `align`  | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment            |
| `inline` | boolean                        | `false`     | `<span>` instead of `<p>` |

## link

```js
link({ href: '/settings' }, 'Settings')
link({ href: 'https://example.com', external: true }, 'Read the docs')
```

| Prop       | Values                     | Default     | Notes                                     |
| ---------- | -------------------------- | ----------- | ----------------------------------------- |
| `href`     | string - **required**      | -           | App-root path, no base path - imp adds it |
| `external` | boolean                    | `false`     | New tab, `rel="noreferrer noopener"`      |
| `tone`     | `'default'`, `'secondary'` | `'default'` | Link color or muted                       |
| `size`     | `'sm'`, `'md'`, `'lg'`     | `'md'`      | Type size                                 |
| `weight`   | `'normal'`, `'bold'`       | `'normal'`  | Type weight                               |
| `events`   | event map                  | -           | Handlers, as on any element               |

`link` renders a real anchor. The router handles a plain left-click on an in-app path. The browser
handles a middle-click, a click with a modifier key, an `external` link and an off-site URL.

## icon

```js
import { icon } from 'imp/std'
import { luHouse, luTrash } from 'imp/icons'

icon(luHouse)
icon(luTrash, { size: 'sm', color: 'danger', label: 'Delete invoice' })
```

| Prop    | Values                                    | Default     | Notes                                       |
| ------- | ----------------------------------------- | ----------- | ------------------------------------------- |
| `icon`  | an export from `imp/icons` - **required** | -           | Also accepted positionally                  |
| `size`  | `'sm'`, `'md'`, `'lg'`, or a CSS length   | `'md'`      | `1rem`, `1.5rem`, `2rem` square             |
| `color` | a theme colour name, or `'current'`       | `'current'` | `'primary'`, `'danger'`, any palette hue    |
| `label` | string - **live**                         | -           | Names the icon; without it it is decorative |

**imp contains the whole of Lucide.** `imp/icons` holds 1791 icons. Each name is `lu` plus the
Lucide name in PascalCase. The icon is an imported name, not a string. So the bundle carries only
the icons that you draw. Never write `import * as icons from 'imp/icons'`. [icons](icons.md) gives
the naming scheme and the licence obligation.

**A decorative icon takes no `label`.** Name the control around it instead. There is no `src` and no
icon font. For an icon that Lucide does not draw, write your own inline `<svg>`. Every icon prop in
the library accepts any DOM.

## shell - from `imp/std/layout`

**Build the frame of an app with `shell`. Do not assemble a header and sidebar grid by hand.** The
application map, see [routing](routing.md), drives the bar, the column, the bottom bar of a phone
and the trail. `logo` and `extras` are DOM. The main content is the children, and the router sits in
it.

```js
import { shell } from 'imp/std/layout'
import { appLogo, themeSelect, userCard } from 'imp/std/shell'
import { router } from 'imp/router'
import { luChartColumn } from 'imp/icons'
import { app } from './app-map.js'

shell(
  {
    logo: appLogo({ label: 'Acme' }),
    navbar: {
      label: 'Sections',
      map: app,
      icons: { [app.reports]: luChartColumn },
      tags: { [app.reports.revenue]: revenueCount },
    },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ signedIn, name: 'Ada Lovelace', onSignOut })],
  },
  router({ map: app, access, screens, options }),
)
```

| Prop          | Values                          | Default  | Notes                                                |
| ------------- | ------------------------------- | -------- | ---------------------------------------------------- |
| `logo`        | DOM                             | -        | Heads the bar, the column, or the drawer             |
| `navbar`      | **data** `{ map, icons, tags }` | -        | The map; or plain `items` for a frame with no router |
| `sidebar`     | **data** `{ label, ... }`       | -        | Names and foots the second level                     |
| `extras`      | DOM, or an array of it          | -        | Theme/language pickers, `userCard`, anything         |
| `breadcrumbs` | `false`                         | shown    | Drops the trail the frame renders from the map       |
| `navOpen`     | boolean, or a state - **live**  | `false`  | Drawer state; shell-owned when omitted               |
| `gap`         | spacing step `0`-`6`            | `0`      | Floats the chrome apart as rounded, bordered panels  |
| `maxWidth`    | CSS length, or `'none'`         | `125rem` | Caps column and content, centred on a wider screen   |
| `background`  | DOM                             | -        | Decorative layer under everything, e.g. an animation |
| `events`      | `{ navToggle, select }`         | -        | `{ open }` on every drawer change; `{ id, item }`    |

`navbar` takes `map`, `icons` and `tags` keyed by handle, and `label`. With no map it takes `items`,
which are the sections and are live, and `selected`. `sidebar` takes `label`, an app-wide `extras`
of DOM, and `footer` rows. `sidebar` also takes `groups`, `items` and `selected`, but **only when
there is no `navbar`**. That is the sidebar-only layout. Beside a `navbar`, imp warns and drops
them.

Without a map, a section is `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`. A
row is `{ id, label, icon, href, onClick, tag, disabled, children? }`. A group is
`{ id?, label, tag?, items }`.

| Layout                 | Props                                | What you get                                     |
| ---------------------- | ------------------------------------ | ------------------------------------------------ |
| Sections with sidebars | `navbar.map`, sections with children | Top bar of sections, column for the current one  |
| Sections only          | `navbar.map`, leaf sections          | Top bar, no column, content full width           |
| Sidebar only           | `sidebar` with `groups` / `items`    | No bar: logo heads the column, extras foot it    |
| One section            | `navbar.map`, one section with rows  | Sidebar only; the frame drops the bar on its own |

The sizes are custom properties, not props. They are `--imp-shell-sidebar-inline-size`, which
defaults to `16rem`, and `--imp-shell-bottom-bar-items`, which defaults to `4` and is clamped
between 3 and 5.

Rules an agent gets wrong:

- **Pass the map, and put `router({ map })` in the content.** The router derives the sections, the
  rows, the marked rows and the crumbs, and the frame draws them. Do not keep a second array in step
  by hand. `navbar.selected` and `sidebar.selected` beside a map are dropped.
- **`icons` and `tags` bind by handle**, as `{ [app.reports]: luChartColumn }` and
  `{ [app.reports.revenue]: count }`. An icon is a Lucide export or any DOM. A tag is
  `{ text, color }`, a state that holds one, or `null`. Neither is a prop of the map. Bind them at
  the root, not in an area file.
- **The nav is data, not DOM.** imp warns about a node in `navbar` or `sidebar`, and drops it. The
  shell draws the rows, because it draws each level more than once. The main content is the
  children, as in `shell({ navbar }, page())`. There is no `header`, `footer` or `layout` prop. Put
  a page toolbar at the top of the main content. The trail is the frame's; do not add a second one.
- **Who is signed in is `userCard` in `extras`.** The frame has no account prop and no signed-in
  flag. Whether a visitor sees a section is the `access` of the map.
- **Page CSS does not reach a region.** `logo`, `extras` and the main content sit in the shadow root
  of the shell. This is deliberate. Pass imp components, which carry their own styles. Style raw DOM
  there inline, or do not style it.
- **A section with no rows renders no sidebar**, and the content goes full width. Do not build a
  false column with one row. Only app-wide content keeps the column. **`sidebar.extras` and
  `sidebar.footer` stay whichever section is current.** So a support card or a help link goes there,
  never under a section of the map.
- **`gap: 0` is the edge-to-edge frame. Any other step floats the chrome** as bordered panels,
  rounded with `radius-container`, and inset from the screen and from each other. This covers the
  phone drawer and any `drawer` inside the frame. The frame paints the `background-app` token, which
  is a colour or a gradient, and defaults to `color-surface`. `background` is a DOM node under
  everything. Use it for a backdrop that CSS cannot draw. imp hides it from assistive technology.
  `navbar.background` and `sidebar.background` are the same kind of node under the bar and under the
  column. The column backdrop follows the column into the phone drawer.
- **The frame is capped at `125rem` by default.** Beyond `maxWidth` the column and the content sit
  in the middle, the background fills the rest, and the top bar centres its controls over them. A
  `drawer` in the content opens at the end edge of the content. Pass `'none'` to fill the screen.
- **Static grandchildren of the context nest one level, and are collapsed by default**, behind a
  caret with `aria-expanded`. The parent of the selected row starts expanded. A parent that the
  person folds stays folded until the selection moves to another parent. On a phone, a parent that
  the person taps in the bottom bar opens its children in the More sheet.
- **Below `48rem` the frame changes.** The top bar becomes a hamburger and a two-line title, which
  is the last two crumbs. The sidebar becomes the bottom bar, capped at
  `--imp-shell-bottom-bar-items`, with a **More** bottom sheet and flattened groups. The sections,
  the footer rows and both `extras` move into the drawer. The trail strip hides. When the current
  section has no sidebar, the bottom bar carries the **sections**, and the drawer holds the chrome
  only.
- **There is no aside region.** Every region of the frame has a phone form, and a side column has
  none. Content that comes and goes is a `drawer` in the main content. Content that stands beside
  the page is your own `flex` inside the main content. Make it wrap below the page under your own
  media query.
- **The desktop column collapses to an icon rail** from a toggle in its head. That head names the
  context, which is the param crumb when there is one. imp offers the toggle only when every row and
  every footer row has an `icon`. The rail hides the logo, `sidebar.extras` and the `extras` of the
  shell. A rail row shows its label as a tooltip on hover, on focus and on a touch hold.
- **`navOpen` must be writable if you pass it.** Never pass a `computed`. The shell writes back when
  the drawer closes itself.
- **The shell is the only breakpoint exception in imp.** The width is `48rem`, and it is a **media
  query**. So a shell that sits in a panel narrower than that, on a wide screen, keeps its desktop
  layout. Do not copy the exception into your own components. The shell renders `<header>`, `<main>`
  and one `<nav>` per level, named from the `label` of that level.
- **The shell is `100dvb` on its own host.** To embed one in a shorter box, set `block-size` on the
  element.

Full manual: `imp skill std/shell`.

## Layout - from `imp/std/layout`

There are two flex primitives and nothing else. `flex` is a row, and `stack` is a column. There is
no `grid` and no `box`. There is no padding, width or background prop. A box that needs those is a
`div` that your own component styles.

```js
import { flex, stack } from 'imp/std/layout'

stack(
  { gap: 4 },
  flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Invoices'), button('New')),
  text('12 unpaid.'),
)
```

### flex

| Prop              | Values                                       | Default     | Notes                                    |
| ----------------- | -------------------------------------------- | ----------- | ---------------------------------------- |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'justify'`  | `'start'`   | Along the row; `'justify'` spreads apart |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'stretch'` | `'stretch'` | Across the row                           |
| `wrap`            | boolean                                      | `false`     | Lets the row break onto more lines       |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children                   |

### stack

| Prop              | Values                                       | Default     | Notes                          |
| ----------------- | -------------------------------------------- | ----------- | ------------------------------ |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'stretch'`  | `'stretch'` | Across the stack               |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'justify'` | `'top'`     | Along the stack, in spare room |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children         |

- **`gap` is a step number from the theme scale, never a length.** Write `gap: 4`, not
  `gap: '1rem'`. The scale is fluid, so one step is correct at every width. imp warns about a bad
  value and falls back to `3`.
- **`verticalAlign` on a `stack` needs a height from the parent.** A stack is as tall as its
  children until the parent sets a `block-size` on the host. Then the stack fills it, and
  `verticalAlign` places the children in the spare room.
- **`horizontalAlign` takes `'start'` and `'end'`, never `'left'` and `'right'`.** It follows the
  reading direction. So `'start'` is the right edge under `dir="rtl"`, and one call is correct in
  both directions. `verticalAlign` keeps `'top'` and `'bottom'`, because direction never mirrors the
  vertical axis.
- **Space two components apart with a `gap`**, because no standard component has an outer margin.
- A layout that must change shape below some width needs a media query in the `styles` of your own
  component. No prop varies with the size of the screen.

## dialog - from `imp/std/layout`

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open: editing }, form({ initialValues }, textField({ field: 'name' })))
dialog({ title: 'Inspector', modal: false, open: inspecting }, details())
```

| Prop     | Values                            | Default | Notes                                          |
| -------- | --------------------------------- | ------- | ---------------------------------------------- |
| `title`  | string - **live**                 | -       | Names the dialog for a screen reader; give one |
| `modal`  | boolean - **read once, at mount** | `true`  | `false` is the movable, non-blocking window    |
| `open`   | boolean, or a state - **live**    | `false` | What opens and closes it                       |
| `events` | `{ openToggle }`                  | -       | `detail: { open }`, on changes it makes itself |

- **`dialog` is both overlay windows.** `modal: true` is the default. It freezes the page behind a
  backdrop, closes on Escape, and holds the page scroll. `modal: false` is a movable window. It
  blocks nothing, ignores Escape, and you can open several at a time. imp reads `modal` once, at
  mount.
- **`open` is the only way to open a dialog.** Pass a writable state. The dialog writes `false` back
  into it when the person closes the dialog. There is no `show()` and no handle.
- **`dialog` shadows the `dialog` element factory** from `imp/html`. A file that needs both gives
  one an alias.

Full manual: `imp skill std/dialog`.

## drawer - from `imp/std/layout`

```js
import { drawer } from 'imp/std/layout'

drawer({ title: 'Filters', open: filtering }, form({ initialValues }, ...fields))
drawer({ title: 'Filters', open: filtering, pin: true }, form({ initialValues }, ...fields))
drawer({ title: 'Details', modal: false, open: inspecting }, details())
```

| Prop         | Values                            | Default | Notes                                              |
| ------------ | --------------------------------- | ------- | -------------------------------------------------- |
| `title`      | string - **live**                 | -       | Names the drawer for a screen reader; give one     |
| `modal`      | boolean - **read once, at mount** | `true`  | `false` is the non-blocking panel                  |
| `open`       | boolean, or a state - **live**    | `false` | What opens and closes it                           |
| `pin`        | boolean, or a state - **live**    | `false` | Pinned, a click outside leaves it open; modal only |
| `background` | DOM                               | -       | Decorative node under the panel; not interactive   |
| `events`     | `{ openToggle, pinToggle }`       | -       | `{ open }` / `{ pinned }`, on changes it makes     |

- **A drawer is a dialog docked to the end of the line.** That is the right edge under `dir="ltr"`,
  and the left edge under `dir="rtl"`. There is no side prop. The modes and the `open` contract are
  the same as for `dialog`.
- **`pin` keeps a modal drawer open across a click outside it.** The toggle is in the bar of the
  drawer. The drawer writes back into a writable `pin` state. Escape and the close button still
  close the drawer.
- **One panel serves every width**, at `min(--imp-drawer-inline-size, 85dvi)`. There is no
  bottom-sheet mode.
- **The drawer is the contextual panel of a `shell` app.** Mount it in the main content, and open it
  from a control there. It covers the page. It never pushes the page.

Full manual: `imp skill std/drawer`.

## card - from `imp/std/display`

```js
import { card } from 'imp/std/display'

card(text('A block of content on a surface.'))
card({ header: heading({ level: 2 }, 'Invoices'), footer: actions }, invoiceList)
card({ href: '/projects/42', label: 'Atlas' }, thumbnail)
```

| Prop      | Values                   | Default | Notes                                          |
| --------- | ------------------------ | ------- | ---------------------------------------------- |
| `header`  | string or DOM - **live** | -       | Above the body, under a rule                   |
| `footer`  | string or DOM - **live** | -       | Below the body, over a rule                    |
| `href`    | string                   | -       | The whole card is one `a`, routed in the app   |
| `label`   | string                   | -       | The accessible name of a link card or a region |
| `padding` | `'sm'`, `'md'`, `'lg'`   | `'md'`  | `space-3`, `space-4` or `space-6`              |

The children are the body. The panel reads `color-surface`, `color-border`, `radius-container` and
`shadow-sm` from the theme, so a flat theme gives a flat card. The host is a block that fills the
height of its grid cell. A link card must hold no control, and it takes a `label` when its body is
not text. The grid around a set of cards is CSS grid in your own component.

Full manual: `imp skill std/card`.

## emptyState - from `imp/std/display`

```js
import { emptyState } from 'imp/std/display'

emptyState({ variant: 'noResults' })
emptyState({ title: 'No invoices', description: 'They appear here once you send one.' }, action)
```

| Prop          | Values                   | Default   | Notes                            |
| ------------- | ------------------------ | --------- | -------------------------------- |
| `variant`     | `'empty'`, `'noResults'` | `'empty'` | Which situation this is          |
| `title`       | string - **live**        | see below | The line saying there is nothing |
| `description` | string - **live**        | -         | One sentence; omitted if unset   |

The children are the actions. imp puts them in a centered row under the text. With no `title`, the
component reads its own key. `imp.state.empty` gives "Nothing here yet", and `imp.state.noResults`
gives "No results". imp does not translate a `title` that you pass. To make it follow the language,
use `computed([lang], () => t('invoices.empty'))`.

## tag - from `imp/std/display`

```js
import { tag } from 'imp/std/display'

tag('Draft')
tag({ color: 'green', size: 'sm' }, 'Shipped')
```

| Prop    | Values                               | Default     | Notes          |
| ------- | ------------------------------------ | ----------- | -------------- |
| `color` | `'neutral'`, or a theme palette name | `'neutral'` | Tints the pill |
| `size`  | `'sm'`, `'md'`, `'lg'`               | `'md'`      | The type scale |

The label is the children, not a prop. To render a live label, use `count.text()`. `color` names one
of the 16 palette colours of the theme, such as `'red'`, `'green'` or `'blue'`. It is never a CSS
colour. The pill is a faint tint of that colour with a border and text in the same hue, so every
pill stays readable in a light theme and in a dark theme. A nav row and a group of `shell` take the
same value as plain data, in `tag: { text, color }`. imp draws it at the small size, to match the
row.

## tooltip - from `imp/std/display`

```js
import { tooltip } from 'imp/std/display'

tooltip({ text: 'Delete' }, button({ label: 'Delete' }, icon(luTrash)))
tooltip({ text: 'Refresh' }, refreshButton)
```

| Prop   | Values                        | Default    | Notes                 |
| ------ | ----------------------------- | ---------- | --------------------- |
| `text` | string, or a state - **live** | - required | What the tooltip says |

- **The one child is the control.** The tooltip anchors a popover to it, in the top layer, so no
  ancestor clips it.
- **There is no placement prop.** imp picks the side from where the control sits: beside it near a
  screen edge, below it in the upper half, above it in the lower half. The browser flips it when
  that side has no room.
- **It opens on a resting pointer, on focus, and on a touch hold.** A tap activates the control and
  opens nothing. It closes when the pointer leaves, the focus moves, the finger lifts, or on Escape.
- **It is visual only.** The control must carry its own accessible name, such as the `label` of an
  icon-only button. imp hides the tooltip from assistive technology.
- **The icon rail of `shell` shows one per row by itself.** Do not wrap a nav row.

Full manual: `imp skill std/tooltip`.

## codeBlock - from `imp/std/display`

```js
import { codeBlock } from 'imp/std/display'

codeBlock({ language: 'js', code: source })
codeBlock({ language: 'bash', lineNumbers: true, id: 'install', code: script })
```

| Prop          | Values                        | Default  | Notes                                                       |
| ------------- | ----------------------------- | -------- | ----------------------------------------------------------- |
| `code`        | string, or a state - **live** | `''`     | The code to show                                            |
| `language`    | string                        | `'text'` | `js`, `ts`, `html`, `css`, `json`, `bash`, `python`, ...    |
| `lineNumbers` | boolean                       | `false`  | Numbers the lines. A number is a link that selects the line |
| `id`          | string                        | -        | Names the block in the fragment: `#install-L12`             |
| `label`       | string                        | -        | The accessible name, such as the file name                  |

- **The code is a prop, not a child.** imp drops one line break at each end of the string, so a
  template literal can open and close on its own line.
- **The copy button is built in.** It copies the whole code without the line numbers.
- **A click on a line number writes `#L12` into the address in place**, and a Shift-click extends it
  to `#L12-L20`. A page opened with that fragment highlights the lines and scrolls to them. Give
  every numbered block on a page an `id`.
- **An unknown language is logged and shown as plain text.** Every colour comes from the theme.
- **`codeEditor` renders a line the same way.** The two share one code view, and they are two
  imports, so a listing does not ship the editor.

Full manual: `imp skill std/codeBlock`.

## Responsive: fluid values, and your own media query

**No prop takes a value per screen, and no component hides itself at a width.** Every prop takes one
value, and that value applies at every width. `shell` is the one exception, because the app frame
changes its structure at `48rem`. That exception does not permit the same in your own components.

Most pages need nothing more. Spacing and type are **fluid**. `--imp-space-3` and the larger steps
are `clamp()` values that grow with the viewport. So a gap and a page gutter are already correct at
every width.

When a layout must change its axis or disappear, write a media query in the `styles` of your own
component. The query is then scoped to that component:

```js
component('invoice-filters', {
  styles: `
    .filters { display: flex; flex-direction: column; gap: var(--imp-space-4); }

    @media (min-width: 48rem) {
      .filters { flex-direction: row; }
    }
  `,
  setup: () => div({ class: 'filters' }, ...filters()),
})
```

`48rem` is the width where imp itself splits, and it is the theme token `--imp-breakpoint-desktop`.
Use the token anywhere a length goes, such as in `calc()`, `min()` and `max-inline-size`, and when
you read the number from JavaScript. **A media query needs the literal value**, because CSS cannot
read a custom property inside a query.

Rules an agent gets wrong:

- **The arrangement components are `flex` and `stack` only.** `shell` is the page frame, not a box.
  Everything else that a box needs, such as padding, a background, a width or a grid, is plain CSS
  in the `styles` of your own component.
- **Spacing is a `gap` on the parent, never a margin on a child.** No std component has an outer
  margin.

## Forms - from `imp/std/inputs`

**The values of a form are ordinary state.** `form({ initialValues })` calls
`initState(self, 'imp.form', initialValues ?? null)` on itself. A control names the field that it
owns with a **dot path**. It resolves the form from its own position, and it reads and writes that
one path. This works at any depth, so a layout component in between changes nothing.

```js
import { form, select, submitButton, textField } from 'imp/std/inputs'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  submitButton('Save'),
)
```

Every control takes the same binding props and labelling props:

| Prop        | Values                         | Notes                                     |
| ----------- | ------------------------------ | ----------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`  | Binds one path of the surrounding form    |
| `value`     | a state, or a plain value      | Standalone use, when there is no form     |
| `label`     | string, or a state holding one | A real `<label>`, rendered by the control |
| `ariaLabel` | string                         | Names it when there is no visible label   |
| `help`      | string, or a state holding one | Hint under the control                    |
| `required`  | boolean                        | Marks it and validates it is filled in    |
| `disabled`  | boolean, or a state - **live** | Blocks interaction                        |

The validation props are `required`, `minLength`, `maxLength`, `min`, `max`, `pattern` and
`validate`. `validate` returns a message, or `null` when the value is correct. The built-in messages
live under `imp.form.*`. `validateAsync` returns a **promise** of a message or of `null`. It runs on
blur and on submit only. A submit waits for it. A synchronous failure skips it. A rejected promise
blocks the submit with `imp.form.checkFailed`.

| Component       | What it binds                | Its own props                                     |
| --------------- | ---------------------------- | ------------------------------------------------- |
| `form`          | Owns `imp.form`              | `initialValues`, `onSubmit`, `layout`, `gap`      |
| `textField`     | A string                     | `type`, `placeholder`, `readonly`, `autocomplete` |
| `passwordField` | A string, masked             | `placeholder`, `autocomplete`                     |
| `searchField`   | A string                     | `placeholder`, `autocomplete`                     |
| `textArea`      | A multi-line string          | `rows`, `placeholder`, `readonly`                 |
| `numberField`   | A **number**                 | `step`, `placeholder`, `readonly`                 |
| `select`        | One value from `options`     | `options`, `placeholder`                          |
| `checkbox`      | A boolean                    | -                                                 |
| `toggle`        | A boolean, drawn as a switch | -                                                 |
| `radioGroup`    | One value from `options`     | `options`, `orientation`                          |
| `submitButton`  | -                            | `variant`, `size`, `disabled`                     |
| `resetButton`   | -                            | `variant`, `size`, `disabled`                     |

Rules an agent gets wrong:

- **There is no native form submit.** There is no `type: 'submit'` button and no
  `events: { submit }`. Put the handler in the `onSubmit` of the form, and render `submitButton()`.
  Enter in a single-line field also submits. Enter in a `textArea` does not.
- **A `field` with no `form` around it is an error.** A path that is not dot-separated is also an
  error.
- **`field` and `value` are alternatives.** With both, imp warns and `field` wins.
- **A label belongs to the control, not around it.** `label[for]` cannot cross a shadow root. So
  pass `label` as a prop. Your own `<label>` around a control names nothing.
- **`select` and `radioGroup` take their choices in `options`, never as children.**
- **`numberField` commits a number.** An empty field commits `undefined`.
- **imp hides an error until the person leaves the field, or tries to submit.** Do not add your own
  "show errors" flag.
- **Return the promise from an async `onSubmit`.** The spinner of the submit button and the guard
  against a double submit both need it.
- **`validate` is synchronous, and `validateAsync` is the promise form.** A promise returned from
  `validate` does not work, because a promise is truthy and every value then looks invalid. An async
  check runs on blur and on submit only, never on a keystroke. Debounce it yourself if you need
  more.
- To read the values anywhere in the subtree, call `useState(self, 'imp.form')`.

## codeEditor - from `imp/std/inputs`

```js
import { codeEditor } from 'imp/std/inputs'

codeEditor({ field: 'config', label: 'imp.json', language: 'json', rows: 8 })
codeEditor({ value: source, label: 'Script', language: 'js', lineNumbers: true })
```

| Prop          | Values                         | Default  | Notes                                        |
| ------------- | ------------------------------ | -------- | -------------------------------------------- |
| `field`       | dot path                       | -        | Binds to that path of the surrounding form   |
| `value`       | a state, or a plain string     | -        | Standalone use, when there is no form        |
| `language`    | string                         | `'text'` | Same names as `codeBlock`                    |
| `rows`        | positive integer               | `10`     | The visible lines. The editor scrolls inside |
| `lineNumbers` | boolean                        | `false`  | Numbers the lines in a rail beside the text  |
| `label`       | string, or a state holding one | -        | Rendered as a real `<label>`                 |
| `readonly`    | boolean                        | `false`  | Selectable, not editable                     |

- **It is `textArea` with the code view of `codeBlock` behind the text.** Every form prop and rule
  of `textArea` holds: `help`, `placeholder`, `required`, `disabled`, the validation props.
- **The value is the whole text, on every keystroke.** Put a parse check in `validate`. The error
  shows after the person leaves the editor, not while they type.
- **Tab indents two spaces, Shift-Tab outdents, Enter keeps the indentation.** Escape, then Tab,
  reaches the copy button, and the next Tab leaves. Escape also closes a `dialog` or `drawer`.
- **The copy button is built in, and a line number is a plain number, not a link.** Use `codeBlock`
  for a read-only listing with linkable lines.
- **No wrapping and no growth.** Set `rows`.

Full manual: `imp skill std/codeEditor`.

## richTextEditor - from `imp/std/inputs`

```js
import { richTextEditor } from 'imp/std/inputs'

richTextEditor({ field: 'body', label: 'Post', rows: 8 })
richTextEditor({ value: note, label: 'Note', imageSize: 800 })
```

| Prop          | Values                         | Default | Notes                                         |
| ------------- | ------------------------------ | ------- | --------------------------------------------- |
| `field`       | dot path                       | -       | Binds to that path of the surrounding form    |
| `value`       | a state, or a plain string     | -       | Standalone use, when there is no form         |
| `rows`        | positive integer               | `6`     | The minimum height, in lines. It grows        |
| `imageSize`   | positive integer               | `1280`  | Longest edge, in pixels, of an embedded image |
| `label`       | string, or a state holding one | -       | Names the text box                            |
| `placeholder` | string                         | -       | Shown while the editor is empty               |
| `readonly`    | boolean                        | `false` | No toolbar. Selectable, not editable          |

- **The person sees rich text. The value is a markdown string.** Bold, italic, strikethrough, code,
  headings 1 to 3, quote, code block, lists, link, image, emoji and alignment. Every form prop and
  rule of `textArea` holds: `help`, `required`, `disabled`, the validation props.
- **An image is a data URL in the markdown.** imp resizes it in the browser to `imageSize` and
  embeds it. A placeholder holds the place while it runs. There is no upload.
- **An aligned paragraph is an HTML block**, `<p align="center">...</p>`. Markdown has no alignment.
- **Render the value with a markdown renderer.** Never put it in `innerHTML`.
- **Tab indents a list item, and nothing else.** Escape, then Tab, leaves a list.

Full manual: `imp skill std/richTextEditor`.

## Navigation - from `imp/std/navigation`

```js
import { tabs } from 'imp/std/navigation'

tabs({
  label: 'Account sections',
  items: [
    { id: 'overview', label: 'Overview', content: overviewPanel() },
    { id: 'billing', label: 'Billing', content: billingPanel(), disabled: false },
  ],
})
```

| Component | Props                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| `tabs`    | `items`, `selected` (live), `orientation`, `foldable`, `folded` (live), `label`, `events` |

Rules an agent gets wrong:

- **A panel goes in `items`, never in the children.** A tab and its panel reference each other by
  id, and an id cannot cross a shadow root. So one component must render both.
- **`selected` is optional.** Without it, `tabs` selects the first enabled item and manages the
  selection itself. Pass a state when the app owns the selection, and listen with
  `events: { select }`.
- **`select` fires only for a choice by the person.** So a state that is bound in both directions
  cannot loop.
- The arrow keys, `Home`, `End` and the RTL mirroring are included. Write no key handling.
- **`foldable: true` on a vertical strip adds a fold button at its foot.** `folded` takes a boolean
  or a state, and `events: { fold }` reports a tap. The host's `block-size` sets the height of the
  strip, so the button sits at the foot. A folded strip moves the button to the head.
- **A menu of destinations is the `shell` nav.** There is no separate menu component. Give the rows
  to the frame as `navbar` or `sidebar` data. Full manual: `imp skill std/tabs`.

## Shell parts - from `imp/std/shell`

These are ready-made contents for the regions of `shell`. Each one is optional. `logo` and `extras`
take DOM, so you can replace a piece that does not fit with your own.

```js
import { appLogo, breadcrumbs, langSelect, themeSelect, userCard } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox } from 'imp/icons'

appLogo({ label: 'Acme', icon: icon(luBox, { size: 'lg' }) })
breadcrumbs({ items: [{ id: 'home', label: 'Home', href: '/' }, { id: 'order', label: 'Order' }] })
userCard({ signedIn: session, name: 'Ada Lovelace', description: user.email, onSignOut: signOut })
themeSelect()
langSelect({ languages: ['en', 'pl'] })
```

| Component     | Props                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `appLogo`     | `label`, `tagline`, `href`, `src` (a string, or `{ light, dark }`), `alt`, `icon`, `compact`, `events`                                    |
| `breadcrumbs` | `items` (live, a crumb can carry `options`), `label` (live), `separator`, `events`                                                        |
| `userCard`    | `signedIn`, `name`, `description`, `picture` (all live), `href`, `compact`, `onSignIn`, `onSignOut`, `variant`, `size`, `block`, `events` |
| `themeSelect` | `themes`, `remember`, `label` (live), `events`                                                                                            |
| `langSelect`  | `languages`, `remember`, `label` (live), `events`                                                                                         |

Rules an agent gets wrong:

- **There is no sidebar-item component and no navbar-item component.** A row is a nav item, and its
  shape takes an `icon` and an `onClick`. Give those items to the frame as data.
- **The last crumb is the current page.** `breadcrumbs` renders it as text with
  `aria-current="page"`, never as a link. A crumb with `options` gets a picker of its siblings. The
  frame renders the trail from the map; call `breadcrumbs` yourself only outside `shell`.
- **`onSignIn` and `onSignOut` are function props, not `events`.** Return the promise, and the
  button spins until the promise settles. imp holds no session, and it talks to no identity
  provider.
- **`themeSelect` and `langSelect` own their setting.** They apply it, remember it in
  `localStorage`, and apply the remembered choice again on the next mount. Set `remember: false`
  when the app owns the setting. A remembered theme wins against the `applyTheme` of the app at
  startup. That is the purpose of remembering it.
- **`userCard` is one component with two states.** Signed out, it is a single sign-in button. Signed
  in, it is the person, and a sign-out button stands beside them only when you pass `onSignOut`.
  Leave that prop out for a card that only displays. `signedIn` defaults to `false`, so a card with
  a `name` only shows the sign-in button. There is no menu inside the card.
- **`compact` on `appLogo` and on `userCard` hides the words visually, not from assistive
  technology.** That is how a brand block with a mark only keeps its name.
- **Inside `shell`, `userCard` goes in `extras`.** The frame has no account prop. It places the
  extras in the bar on a wide screen and in the drawer on a phone.

Full manuals: `imp skill std/appLogo` | `std/breadcrumbs` | `std/userCard` | `std/themeSelect` |
`std/langSelect`.

## Feedback - from `imp/std/feedback`

```js
import { bugReport } from 'imp/std/feedback'

bugReport({
  onSubmit: (report) =>
    fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    }),
})
```

| Component   | Props                                                         |
| ----------- | ------------------------------------------------------------- |
| `bugReport` | `onSubmit`, `as`, `variant`, `size`, `label` (live), `events` |

Rules an agent gets wrong:

- **`onSubmit` is a prop, not an `events` entry**, because storing a report is asynchronous and can
  fail. Return a promise. When it rejects, the panel stays open and shows an error that the person
  can retry.
- **imp stores nothing.** There is no endpoint, no `localStorage` fallback and no queue. The app
  decides what `onSubmit` does with the report. The app also decides what private content to remove
  from the report first.
- **The person never sees the element path.** They pick an element by clicking it, and it stays
  outlined while they type. The path is in the report, for the person who reads it.
- **`as: 'link'` still renders a `<button>`.** It performs an action, so it is never an `<a>`.
- **`bugReport` is not `imp review`**, see `imp skill review`. `imp review` is the widget of the dev
  server, and it writes to `.imp/reviews/`. The two share one capture engine, so a report has the
  same shape in both.

Full manual: `imp skill std/bugReport`.
