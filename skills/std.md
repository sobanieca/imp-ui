# std - the built-in component library

The components come from `imp/std` and its groups. There is nothing to install, and no CSS to
include. Each component is a real imp component. It renders as its own element, such as
`<imp-button>`, with its styles sealed inside.

| Import             | Exports                                                                                                                                                                                                                                  | Per-component skill                                                                                                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/std`          | `button`, `menuButton`, `heading`, `text`, `link`, `icon`                                                                                                                                                                                | `imp skill std/button`, `std/menuButton`, `std/heading`, `std/text`, `std/link`, `std/icon`                                                                                                                                                                                                                                |
| `imp/std/layout`   | `flex`, `stack`, `tabs`, `dialog`, `drawer`                                                                                                                                                                                              | `imp skill std/flex`, `std/stack`, `std/tabs`, `std/dialog`, `std/drawer`                                                                                                                                                                                                                                                  |
| `imp/std/inputs`   | `form`, `submitForm`, `resetForm`, `textField`, `select`, `checkbox`, `toggle`, `radioGroup`, `segmented`, `comboBox`, `slider`, `colorPicker`, `datePicker`, `emojiPicker`, `fileUpload`, `imageUpload`, `codeEditor`, `richTextEditor` | `imp skill std/form`, `std/submitForm`, `std/resetForm`, `std/textField`, `std/select`, `std/checkbox`, `std/toggle`, `std/radioGroup`, `std/segmented`, `std/comboBox`, `std/slider`, `std/colorPicker`, `std/datePicker`, `std/emojiPicker`, `std/fileUpload`, `std/imageUpload`, `std/codeEditor`, `std/richTextEditor` |
| `imp/std/display`  | `card`, `codeBlock`, `emptyState`, `markdown`, `tag`, `tooltip`, `avatar`, `accordion`, `descriptionList`, `steps`                                                                                                                       | `imp skill std/card`, `std/codeBlock`, `std/emptyState`, `std/markdown`, `std/tag`, `std/tooltip`, `std/avatar`, `std/accordion`, `std/descriptionList`, `std/steps`                                                                                                                                                       |
| `imp/std/shell`    | `shell`, `appLogo`, `breadcrumbs`, `userCard`, `orgSelect`, `themeSelect`, `langSelect`, `notifications`                                                                                                                                 | `imp skill std/shell`, `std/appLogo`, `std/breadcrumbs`, `std/userCard`, `std/orgSelect`, `std/themeSelect`, `std/langSelect`, `std/notifications`                                                                                                                                                                         |
| `imp/std/feedback` | `bugReport`, `notice`, `loader`, `progress`, `skeleton`, `toast`, `notify`, `dismiss`, `reactions`                                                                                                                                       | `imp skill std/bugReport`, `std/notice`, `std/loader`, `std/progress`, `std/skeleton`, `std/toast`, `std/notify`, `std/dismiss`, `std/reactions`                                                                                                                                                                           |
| `imp/std/data`     | `table`, `list`, `tree`, `chart`, `gantt`, `calendar`, `map`                                                                                                                                                                             | `imp skill std/table`, `std/list`, `std/tree`, `std/chart`, `std/gantt`, `std/calendar`, `std/map`                                                                                                                                                                                                                         |

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
- **A child that you pass in moves into that shadow root, where your `styles` do not reach.** So
  `stack({}, div({ class: 'box' }))` renders the div without your `.box` rule, and imp warns in
  development. Give the box its own component, use a standard component, or set an inline `style`. A
  wrapper in your own tree, `div({ class: 'box' }, stack(...))`, keeps the rule.
- A component that you never call defines no element and compiles no styles.

## button

```js
button({ variant: 'primary', size: 'lg', events: { click: save } }, 'Save changes')
```

| Prop            | Values                                                    | Default     | Notes                                      |
| --------------- | --------------------------------------------------------- | ----------- | ------------------------------------------ |
| `variant`       | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Visual weight and intent                   |
| `size`          | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                      |
| `disabled`      | boolean - **live**                                        | `false`     | Blocks interaction                         |
| `loading`       | boolean - **live**                                        | `false`     | Loader, implies disabled, sets `aria-busy` |
| `block`         | boolean                                                   | `false`     | Fills its container's width                |
| `square`        | boolean                                                   | `false`     | Equal padding both ways, for an icon       |
| `label`         | string - **live**                                         | -           | `aria-label`, for an icon-only button      |
| `pressed`       | boolean - **live**                                        | -           | A toggle button, `aria-pressed`            |
| `expanded`      | boolean - **live**                                        | -           | Paints `aria-expanded`                     |
| `haspopup`      | `'menu'`, `'listbox'`                                     | -           | Paints `aria-haspopup`                     |
| `popoverTarget` | an element with `popover`                                 | -           | The button invokes that popover            |
| `popoverAction` | `'toggle'`, `'show'`, `'hide'`                            | `'toggle'`  | What a click does to `popoverTarget`       |
| `events`        | event map                                                 | -           | Handlers, as on any element                |

**There is no `type` prop and no submit button.** A button acts on its `click` handler. Submit from
there. `variant: 'link'` is a button that looks like a link. Use `link` when the target is a place
to go to.

**A button has no menu.** A button that opens a menu is `menuButton`, below. A row of joined
controls is `flex({ joined: true })`, see Layout below.

## menuButton

```js
menuButton({ items: SAVE_ACTIONS })
menuButton({ trigger: 'arrow', items: exportFormats }, 'Export')
flex(
  { joined: true },
  button({ variant: 'primary', events: { click: save } }, 'Save'),
  menuButton({ variant: 'primary', items: SAVE_ACTIONS }),
)
```

The children are the text of the trigger. With no children the trigger is a square icon. `items` are
the options of the menu.

| Prop       | Values                                                | Default     | Notes                                   |
| ---------- | ----------------------------------------------------- | ----------- | --------------------------------------- |
| `items`    | array of `{ id?, label, icon?, onClick?, disabled? }` | -           | The options of the menu                 |
| `trigger`  | `'more'`, `'arrow'`                                   | `'more'`    | Triple-dot or chevron                   |
| `variant`  | as on `button`                                        | `'default'` | The look of the trigger                 |
| `size`     | as on `button`                                        | `'md'`      | The size of the trigger                 |
| `disabled` | boolean - **live**                                    | `false`     | Disables the trigger and shuts the menu |
| `label`    | string - **live**                                     | -           | `aria-label` of the trigger             |
| `events`   | event map                                             | -           | Handlers on the host, such as `select`  |

A menu item is data, because its role and its place in the keyboard order must sit in one component.
A child is the text of the trigger, never an option. A split button is a joined `flex` with the
action button first and the menu button last. Give both the same `variant` and `size`.

When the person chooses an item, the host fires a `select` event that you can cancel, with
`detail: { id, item }`. imp then calls the `onClick` of that item. The menu is a `popover`, and the
browser places it. It flips above the trigger near the bottom of the screen. It closes on Escape,
and on a click away from it. It has no `placement` prop. `'more'` draws a triple-dot trigger, and
`'arrow'` draws a chevron. A trigger with text is named by that text. An icon-only trigger reads
"More actions" or "Choose an action" through `t()`. `label` replaces the name in both cases.

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
| `external` | boolean                    | `false`     | New tab, `rel="noopener"`                 |
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

## shell - from `imp/std/shell`

**Build the frame of an app with `shell`. Do not assemble a header and sidebar grid by hand.** The
application map, see [routing](routing.md), drives the bar, the column, the bottom bar of a phone
and the trail. `logo` and `extras` are DOM. The main content is the children, and the router sits in
it.

```js
import { appLogo, shell, themeSelect, userCard } from 'imp/std/shell'
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
    extras: [themeSelect(), userCard({ name: user.name, description: user.email })],
    signedIn: session,
    signIn: () => signInPage(),
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
| `signedIn`    | boolean, or a state - **live**  | -        | The gate: `undefined` waits, falsy shows `signIn`    |
| `signIn`      | DOM, or `() => DOM`             | -        | The sign-in page of the app, shown while signed out  |
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
- **`signedIn` gates the whole app, and `signIn` is your page.** While `signedIn` is `undefined`,
  the frame shows a `loader`. While it is `null` or `false`, it shows the `signIn` content and the
  logo, centred, and nothing else: the main content is not mounted, so no router runs. When it is
  truthy, the frame mounts the app. Pass the session state, with `null` for nobody. Write the
  sign-in page yourself, as a `form` or as buttons of the providers; imp renders no form and holds
  no session. `signIn` as a function is called once, the first time the gate shows. Without
  `signedIn`, everybody sees the app.
- **The frame has no account prop.** `userCard` in `extras` displays the person, and the sign-out
  action is a `button` or a `menuButton` of yours beside it. Whether a person sees a section is the
  `access` of the map.
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
  the person taps in the bottom bar opens its children in the More sheet, and the title of the sheet
  links to the page of the parent.
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
`div` that your own component styles. Keep that `div` in your own tree, around the layout. A `div`
passed as a child of `flex` or `stack` moves into the shadow root of the layout, where your `styles`
do not reach it, and imp warns in development.

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
| `joined`          | boolean                                      | `false`     | No gap, and the children share a seam    |

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
- **A styled `div` goes around a layout, never inside one.** A child of `flex` or `stack` is in the
  shadow root of the layout, and your `.box` rule does not reach it. imp warns in development. Give
  the box its own component, or set an inline `style`.
- **`joined` makes a row read as one control.** Each child squares only the corners that face a
  neighbour, in logical properties, so LTR and RTL both read correctly. Every std button and std
  input fits the seam. A split button is `flex({ joined: true }, button(...), menuButton(...))`. A
  joined row ignores `gap`.
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
drawer({ title: 'Details', modal: false, open: inspecting }, details())
```

| Prop         | Values                            | Default | Notes                                            |
| ------------ | --------------------------------- | ------- | ------------------------------------------------ |
| `title`      | string - **live**                 | -       | Names the drawer for a screen reader; give one   |
| `modal`      | boolean - **read once, at mount** | `true`  | `false` is the non-blocking panel                |
| `open`       | boolean, or a state - **live**    | `false` | What opens and closes it                         |
| `background` | DOM                               | -       | Decorative node under the panel; not interactive |
| `events`     | `{ openToggle }`                  | -       | `{ open }`, on changes the drawer makes itself   |

- **A drawer is a dialog docked to the end of the line.** That is the right edge under `dir="ltr"`,
  and the left edge under `dir="rtl"`. There is no side prop. The modes and the `open` contract are
  the same as for `dialog`.
- **A panel that stays open while the person works on the page is `modal: false`.** A modal drawer
  closes on a click outside it, and there is no pin. The non-modal panel never closes on an outside
  click, and the page behind it stays live.
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

## avatar - from `imp/std/display`

```js
import { avatar } from 'imp/std/display'

avatar({ name: 'Ada Lovelace' })
avatar({ name: 'Ada Lovelace', picture: '/ada.jpg', size: 'lg' })
avatar({ name: 'Platform Team', color: 'violet', decorative: true })
```

| Prop         | Values                               | Default     | Notes                                 |
| ------------ | ------------------------------------ | ----------- | ------------------------------------- |
| `name`       | string - **live**                    | required    | The initials and the accessible name  |
| `picture`    | URL - **live**                       | -           | The initials show when it is unset    |
| `size`       | `'sm'`, `'md'`, `'lg'`               | `'md'`      | 1.5rem, 2rem, 3rem                    |
| `color`      | `'primary'`, or a theme palette name | `'primary'` | The colour behind the initials        |
| `decorative` | boolean                              | `false`     | Hides the avatar from a screen reader |

The avatar is `role="img"`, and `name` is its `aria-label`. A picture that fails to load shows the
initials. Set `decorative: true` when the name is printed next to the avatar. There is no avatar
group. A row of people is `flex({ gap: 1 }, ...)`. Full manual: `imp skill std/avatar`.

## accordion - from `imp/std/display`

```js
import { accordion } from 'imp/std/display'

accordion({
  items: [
    { id: 'shipping', title: 'Shipping', content: shippingPanel(), open: true },
    { id: 'returns', title: 'Returns', content: 'Send it back within 30 days.' },
  ],
})
```

| Prop       | Values                                  | Default | Notes                                  |
| ---------- | --------------------------------------- | ------- | -------------------------------------- |
| `items`    | array of `{ id, title, content, open }` | `[]`    | `title` is live. imp reads `open` once |
| `multiple` | boolean                                 | `false` | `false`: one section is open at a time |
| `events`   | `{ toggle }`                            | -       | On the host, `detail: { id, open }`    |

Each item is a native `<details>` with a `<summary>`. So the browser owns the toggle and the
keyboard. A section goes in `items`, never in the children. Full manual: `imp skill std/accordion`.

## descriptionList - from `imp/std/display`

```js
import { descriptionList, tag } from 'imp/std/display'

descriptionList({
  items: [
    { term: 'Customer', details: 'Acme Inc.' },
    { term: 'Status', details: tag({ color: 'green' }, 'Paid') },
    { term: 'Notes', details: notes },
  ],
})
```

| Prop      | Values                       | Default        | Notes                                        |
| --------- | ---------------------------- | -------------- | -------------------------------------------- |
| `items`   | array of `{ term, details }` | `[]`           | Both keys are live. `details` is any content |
| `layout`  | `'horizontal'`, `'vertical'` | `'horizontal'` | The term beside the details, or above them   |
| `columns` | `1`, `2`, `3`                | `1`            | Pairs side by side, when they fit            |

imp renders a real `<dl>`. In the horizontal layout all terms share one column. The list adapts to
its own width through a container query, so write no media query. It has no frame. Put it in a
`card`. Full manual: `imp skill std/descriptionList`.

## emptyState - from `imp/std/display`

```js
import { emptyState } from 'imp/std/display'

emptyState({ variant: 'noResults' })
emptyState({ title: 'No invoices', description: 'They appear here once you send one.' }, action)
emptyState({ icon: luCircleCheck, kind: 'success', title: 'Payment received' }, action)
emptyState({ image: '/art/no-photos.svg', title: 'No photos yet' })
```

| Prop          | Values                                                     | Default     | Notes                            |
| ------------- | ---------------------------------------------------------- | ----------- | -------------------------------- |
| `variant`     | `'empty'`, `'noResults'`                                   | `'empty'`   | Which situation this is          |
| `title`       | string - **live**                                          | see below   | The line saying there is nothing |
| `description` | string - **live**                                          | -           | One sentence; omitted if unset   |
| `icon`        | an icon from `imp/icons`                                   | -           | Large and muted, above the title |
| `image`       | a DOM node, or an image URL                                | -           | A drawing above the title, 6rem  |
| `kind`        | `'neutral'`, `'success'`, `'error'`, `'warning'`, `'info'` | `'neutral'` | Tints the icon only              |

The children are the actions. imp puts them in a centered row under the text. With no `title`, the
component reads its own key. `imp.state.empty` gives "Nothing here yet", and `imp.state.noResults`
gives "No results". imp does not translate a `title` that you pass. To make it follow the language,
use `computed([lang], () => t('invoices.empty'))`. A result page is this component with an `icon`
and a `kind`. imp has no `result` component. With no `icon` and no `image`, imp draws its own mark.
`image` is an inline SVG node, any DOM, or a URL that renders as an `<img>`; it wins over `icon`.

## tag - from `imp/std/display`

```js
import { tag } from 'imp/std/display'

tag('Draft')
tag({ color: 'green', size: 'sm' }, 'Shipped')
tag({ color: 'green', dot: true }, 'Online')
tag({ color: 'red', dot: true, label: 'Offline' })
```

| Prop    | Values                               | Default     | Notes                              |
| ------- | ------------------------------------ | ----------- | ---------------------------------- |
| `color` | `'neutral'`, or a theme palette name | `'neutral'` | Tints the pill                     |
| `size`  | `'sm'`, `'md'`, `'lg'`               | `'md'`      | The type scale                     |
| `dot`   | boolean                              | `false`     | A filled circle before the label   |
| `label` | string - **live**                    | -           | The name of a dot that has no text |

The label is the children, not a prop. To render a live label, use `count.text()`. `color` names one
of the 16 palette colours of the theme, such as `'red'`, `'green'` or `'blue'`. It is never a CSS
colour. The pill is a faint tint of that colour with a border and text in the same hue, so every
pill stays readable in a light theme and in a dark theme. `dot: true` with no children draws a bare
status dot with no pill. Name it with `label`. A count bubble is a small red tag,
`tag({ color: 'red', size: 'sm' }, 12)`, next to the thing that it counts. imp has no `badge`
component and no badge that overlaps a corner. A nav row and a group of `shell` take the same value
as plain data, in `tag: { text, color }`. imp draws it at the small size, to match the row.

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
import { button } from 'imp/std'
import { form, select, submitForm, textField } from 'imp/std/inputs'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
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

| Component     | What it binds                                    | Its own props                                                           |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `form`        | Owns `imp.form`                                  | `initialValues`, `onSubmit`, `layout`, `gap`                            |
| `textField`   | A string, or a **number**                        | `type`, `rows`, `step`, `stepper`, `placeholder`, `readonly`            |
| `select`      | One value from `options`                         | `options`, `placeholder`                                                |
| `segmented`   | One value from `options`, or an array            | `options`, `multiple`, `size`, `block`                                  |
| `comboBox`    | One value from `options`, an array, or free text | `options`, `multiple`, `custom`, `onSearch`, `minSearch`, `placeholder` |
| `slider`      | A **number** in a range                          | `min`, `max`, `step`, `showValue`, `format`                             |
| `colorPicker` | A hex colour, `'#rrggbb'`                        | -                                                                       |
| `fileUpload`  | An array of `{ id, name, size, type }`           | `multiple`, `accept`, `maxSize`, `onFiles`                              |
| `imageUpload` | A data URL of the cropped, resized picture       | `shape`, `aspect`, `maxWidth`, `maxHeight`, `compact`, `onImage`        |
| `datePicker`  | A date, a date range, or a date with a time      | `range`, `time`, `min`, `max`, `placeholder`                            |
| `emojiPicker` | One emoji string, such as `'\u{1F680}'`          | `emojis`, `placeholder`                                                 |
| `checkbox`    | A boolean                                        | -                                                                       |
| `toggle`      | A boolean, drawn as a switch                     | -                                                                       |
| `radioGroup`  | One value from `options`                         | `options`, `orientation`                                                |

`submitForm(source)` and `resetForm(source)` are functions, not components. `source` is the click
event or any node inside the form. So `button({ events: { click: submitForm } }, 'Save')` is the
submit button, and `button({ events: { click: resetForm } }, 'Start over')` the reset button.

Rules an agent gets wrong:

- **There is no native form submit.** There is no `type: 'submit'` button and no
  `events: { submit }`. Put the handler in the `onSubmit` of the form, and give a `button` the
  `submitForm` function as its click handler. There is no `submitButton` and no `resetButton`
  component. Enter in a single-line field also submits. Enter in a multi-line `textField` does not.
- **A `field` with no `form` around it is an error.** A path that is not dot-separated is also an
  error.
- **`field` and `value` are alternatives.** With both, imp warns and `field` wins.
- **A label belongs to the control, not around it.** `label[for]` cannot cross a shadow root. So
  pass `label` as a prop. Your own `<label>` around a control names nothing.
- **`select` and `radioGroup` take their choices in `options`, never as children.**
- **`segmented` and `comboBox` take their choices in `options`, never as children.** With
  `multiple: true`, the value is an array. Seed it with `[]`.
- **There is no `toggleGroup` and no `tagInput`.** Use `segmented({ multiple: true })`, and
  `comboBox({ multiple: true, custom: true })`. Run `imp skill std/segmented` and
  `imp skill std/comboBox`.
- **On a `slider`, `min` and `max` set the range. They are not validation rules.** The value is a
  number. Run `imp skill std/slider`.
- **`colorPicker` holds a hex string, never an `rgb()` value.** A text that is not a hex colour
  fails with `imp.form.color`. Run `imp skill std/colorPicker`.
- **`emojiPicker` holds the emoji string itself.** Its panel searches 482 built-in emoji by name and
  keyword. `emojis` replaces that set with your own. Run `imp skill std/emojiPicker`.
- **`fileUpload` never puts a `File` in the form.** The field holds `{ id, name, size, type }`
  entries. `onFiles` receives the complete list of `File` objects at each change. Keep it, and send
  it in `onSubmit`. Run `imp skill std/fileUpload`.
- **`imageUpload` holds a data URL, and it crops and resizes on the client.** The person picks one
  picture, moves it in a frame of `aspect` or of `shape: 'circle'`, and clicks Done. The output fits
  `maxWidth` by `maxHeight`. `onImage` receives the output `File`. There is no size prop: the box
  fills the field, and `compact` makes it a small box beside the prompt. Run
  `imp skill std/imageUpload`.
- **`comboBox` with `onSearch` is the server-backed autocomplete.** imp debounces the text, calls
  `onSearch(text, { signal })` once, and aborts the signal when a newer text replaces it. Pass the
  signal to the HTTP client. `minSearch` holds the call until enough is typed.
- **`datePicker` holds ISO text, never a `Date`.** The value is `'2026-09-21'`, or `{ start, end }`
  with `range: true`, or `'2026-09-21T14:30'` with `time: true`. The empty value is `undefined`. See
  `imp skill std/datePicker`.
- **`textField` is the only text input.** `type` is `'text'`, `'email'`, `'tel'`, `'url'`,
  `'password'`, `'search'` or `'number'`. `rows` renders a `<textarea>`. Do not pass both.
- **Type `'number'` commits a number.** An empty field commits `undefined`.
- **imp hides an error until the person changes the field and leaves it, or tries to submit.** A Tab
  through an untouched field shows nothing. Do not add your own "show errors" flag.
- **Return the promise from an async `onSubmit`.** The guard against a double submit needs it, and
  `imp.form.submitting` is `true` meanwhile. A button that must spin reads that state and passes it
  as `loading`, in a small component of yours.
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

- **It is a multi-line `textField` with the code view of `codeBlock` behind the text.** Every form
  prop and rule of `textField` holds: `help`, `placeholder`, `required`, `disabled`, the validation
  props.
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
  rule of `textField` holds: `help`, `required`, `disabled`, the validation props.
- **An image is a data URL in the markdown.** imp resizes it in the browser to `imageSize` and
  embeds it. A placeholder holds the place while it runs. There is no upload.
- **An aligned paragraph is an HTML block**, `<p align="center">...</p>`. Markdown has no alignment.
- **Render the value with a markdown renderer.** Never put it in `innerHTML`.
- **Tab indents a list item, and nothing else.** Escape, then Tab, leaves a list.

Full manual: `imp skill std/richTextEditor`.

## tabs and steps - from `imp/std/layout` and `imp/std/display`

```js
import { tabs } from 'imp/std/layout'
import { steps } from 'imp/std/display'

tabs({
  label: 'Account sections',
  items: [
    { id: 'overview', label: 'Overview', content: overviewPanel() },
    { id: 'billing', label: 'Billing', content: billingPanel(), disabled: false },
  ],
})

steps({
  label: 'Checkout',
  current,
  items: [
    { id: 'cart', label: 'Cart' },
    { id: 'address', label: 'Address', description: 'Where we ship to' },
    { id: 'payment', label: 'Payment' },
  ],
  events: { select: (event) => current.set(event.detail.id) },
})
```

| Component | Props                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| `tabs`    | `items`, `selected` (live), `orientation`, `foldable`, `folded` (live), `label`, `events` |
| `steps`   | `items`, `current` (live), `orientation`, `label`, `events`                               |

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
- **`steps` shows the progress of a flow, and no panel.** Items before `current` are done. `steps`
  never changes `current` itself. Pass a state and set it from your flow.
- **`events: { select }` makes each done step a real button**, with `detail: { id, index }`. The
  current step and the upcoming steps are never buttons. An item with `status: 'error'` is a failed
  step. Full manual: `imp skill std/steps`.

## Data - from `imp/std/data`

```js
import { chart, gantt, map } from 'imp/std/data'

chart({
  type: 'column',
  label: 'Revenue per quarter',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Product', values: [12, 18, 9, 22], color: 'blue' }],
})

gantt({
  label: 'Release plan',
  tasks: [{ id: 'build', label: 'Build', start: '2026-09-10', end: '2026-10-02', progress: 40 }],
  events: { select: (event) => open(event.detail.id) },
})

map({
  label: 'Offices',
  center: [52.23, 21.01],
  zoom: 2,
  pins: [{ id: 'warsaw', lat: 52.23, lng: 21.01, label: 'Warsaw office' }],
})
```

| Component | Props                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| `chart`   | `type`, `label` (live), `labels` (live), `series` (live), `stacked`, `legend`, `format` |
| `gantt`   | `label` (live), `tasks` (live), `scale`, `events`                                       |
| `map`     | `label` (live), `center` (live), `zoom` (live), `maxZoom`, `pins` (live), `events`      |

Rules an agent gets wrong:

- **`chart` has one data shape.** Pass `labels` and `series: [{ name, values, color }]`, also for
  one series. `type` is `'column'`, `'bar'` or `'line'`. `stacked` works for `column` and `bar`.
- **A `color` is a theme palette name**, such as `'teal'`. It is never a CSS colour.
- **imp computes the axis.** There are no axis props. A column or bar axis starts at zero.
- **A gantt date is an ISO string**, `'2026-09-21'`, and `end` is inclusive. A task with `start`
  equal to `end` is a milestone.
- **`gantt` is read-only.** It has no dependency arrows, no drag and no resize. `events: { select }`
  makes each task a button and reports `detail: { id }`.
- **`map` makes no request.** The world, its lakes and its largest cities are bundled with the
  component. There is no tile server and no street level. `zoom: 0` fits the world to the box.
- **A pin is `{ id, lat, lng }`.** Without `content` it is a marker button named by `label`, and a
  click reports `select` with `{ id, pin }`. With `content`, any node, the map only positions it.
- **Always pass `label`.** It is the accessible name of the chart, of the timeline, or of the map.
  Full manuals: `imp skill std/chart`, `imp skill std/gantt`, `imp skill std/map`.

For `skills/imports.md`, the specifier is `imp/std/data`, with the exports `chart`, `gantt` and
`map`.

## table - from `imp/std/data`

```js
import { table } from 'imp/std/data'

table({
  label: 'Invoices',
  columns: [
    { key: 'number', label: 'Number', sortable: true },
    { key: 'total', label: 'Total', align: 'end', render: (row) => money(row.total) },
  ],
  rows,
  filter: query,
  selection: 'multiple',
  selected,
  hasMore,
  onLoadMore,
})
```

`rows`, `filter`, `selected` and `hasMore` are **live**. A row is plain data with a unique `id`, or
the property that `rowKey` names. A column is `{ key, label, align, sortable, sortValue, render }`.
Sorting is client-side. Call `preventDefault()` on the `sort` event to sort on the server.
`selection` is `'none'`, `'single'` or `'multiple'`, and `selected` is an array of row keys that the
table writes back. **There is no pagination.** imp calls `onLoadMore` when the end of the rows comes
into view, while `hasMore` is true. Append the page to the `rows` state. A narrow container shows
each row as a card.

Full manual: `imp skill std/table`.

## list - from `imp/std/data`

```js
import { list } from 'imp/std/data'

list({
  label: 'Team members',
  items: people,
  actions: (person) => editButton(person),
  hasMore,
  onLoadMore,
})
```

An item is plain data:
`{ id, title, description, picture, name, icon, tag: { text, color }, href }`. The title is a link
with `href`, and a button when you pass `events.select`. `select` is cancelable, with
`detail: { id, item }`. `actions` is a function that returns the trailing controls of a row.
Infinite scroll works as in `table`.

Full manual: `imp skill std/list`.

## tree - from `imp/std/data`

```js
import { tree } from 'imp/std/data'

tree({ label: 'Folders', items, selected: current, expanded: open, events: { select } })
```

An item is `{ id, label, icon, children }`. `selected` is an id and `expanded` is an array of ids.
Both take a writable state, and the tree writes it back. `expanded: 'all'` opens every parent at
mount. `select` has `detail: { id, item }`. The arrow keys, `Home`, `End`, `Enter`, `Space` and a
typed letter all work, and `Left` and `Right` mirror under `dir="rtl"`.

Full manual: `imp skill std/tree`.

## calendar - from `imp/std/data`

```js
import { calendar } from 'imp/std/data'

calendar({
  label: 'Team calendar',
  items: [{ id: 1, title: 'Standup', start: '2026-09-21T09:00', end: '2026-09-21T09:15' }],
  events: { select, slotSelect },
})
```

| Prop     | Values                                                  | Default   | Notes                                     |
| -------- | ------------------------------------------------------- | --------- | ----------------------------------------- |
| `label`  | string, or a state                                      | -         | Names the calendar                        |
| `items`  | array of `{ id, title, start, end, color }`, or a state | `[]`      | The entries - **live**                    |
| `view`   | `'month'`, `'week'`, `'day'`, or a state                | `'month'` | The toolbar writes a writable state       |
| `date`   | `'YYYY-MM-DD'`, or a state                              | today     | The toolbar writes a writable state       |
| `events` | `{ select, slotSelect }`                                | -         | `{ id, item }`; `{ start, end?, allDay }` |

The entries go in `items`, never in `events`. A `start` with no time makes an all-day entry, and its
`end` is inclusive. The calendar is read-only: handle `slotSelect`, open a `dialog` with a `form`,
and update the `items` state. The full manual is `imp skill std/calendar`.

## Shell parts - from `imp/std/shell`

These are ready-made contents for the regions of `shell`. Each one is optional. `logo` and `extras`
take DOM, so you can replace a piece that does not fit with your own.

```js
import {
  appLogo,
  breadcrumbs,
  langSelect,
  notifications,
  orgSelect,
  themeSelect,
  userCard,
} from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox } from 'imp/icons'

appLogo({ label: 'Acme', icon: icon(luBox, { size: 'lg' }) })
appLogo({ label: 'Acme', image: '/acme-wordmark.svg' })
breadcrumbs({ items: [{ id: 'home', label: 'Home', href: '/' }, { id: 'order', label: 'Order' }] })
userCard({ name: 'Ada Lovelace', description: user.email })
orgSelect({ orgs: memberships, selected: currentOrg, events: { select: switchOrg } })
themeSelect()
langSelect({ languages: ['en', 'pl'] })
```

| Component       | Props                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `appLogo`       | `label`, `tagline`, `href`, `src` (a string, or `{ light, dark }`), `alt`, `icon`, `image`, `compact`, `events` |
| `breadcrumbs`   | `items` (live, a crumb can carry `options`), `label` (live), `separator`, `events`                              |
| `userCard`      | `name`, `description`, `picture` (all live), `href`, `compact`, `events`                                        |
| `orgSelect`     | `orgs` (live), `selected` (live, writable), `label` (live), `variant`, `size`, `compact`, `events`              |
| `themeSelect`   | `themes`, `remember`, `label` (live), `variant`, `size`, `events`                                               |
| `langSelect`    | `languages`, `remember`, `label` (live), `variant`, `size`, `events`                                            |
| `notifications` | `label` (live), `variant`, `size`, `events`                                                                     |

Rules an agent gets wrong:

- **There is no sidebar-item component and no navbar-item component.** A row is a nav item, and its
  shape takes an `icon` and an `onClick`. Give those items to the frame as data.
- **The last crumb is the current page.** `breadcrumbs` renders it as text with
  `aria-current="page"`, never as a link. A crumb with `options` gets a picker of its siblings. The
  frame renders the trail from the map; call `breadcrumbs` yourself only outside `shell`.
- **`userCard` displays. It does not act.** It has no sign-in button, no sign-out button and no
  menu. Render a `button` or a `menuButton` of your own beside it for the account actions, and
  decide there how a sign-out works. imp holds no session, and it talks to no identity provider.
  Whether anybody is signed in is the `signedIn` gate of `shell`.
- **`themeSelect`, `langSelect` and `orgSelect` are menus.** Each renders a `menuButton` with the
  current choice on the trigger and a `menuitemradio` per option. There is no `<select>` in the
  frame.
- **`themeSelect` and `langSelect` own their setting.** They apply it, remember it in
  `localStorage`, and apply the remembered choice again on the next mount. Set `remember: false`
  when the app owns the setting. A remembered theme wins against the `applyTheme` of the app at
  startup. That is the purpose of remembering it.
- **`orgSelect` remembers nothing and navigates nowhere.** It marks `selected`, reports a cancelable
  `select` with `{ id, org }`, and writes the `id` into a writable `selected` state. The app
  navigates to the tenant, see `imp skill routing`. Put it in the `logo` slot beside `appLogo`, in a
  `flex`, or in `extras`.
- **`appLogo` with `image` is the whole logo as one picture.** No words render, and `label` is the
  `alt`. Use it for a brand that sets its name in a font of its own.
- **`compact` on `appLogo` and on `userCard` hides the words visually, not from assistive
  technology.** That is how a brand block with a mark only keeps its name.
- **Inside `shell`, `userCard` goes in `extras`.** The frame has no account prop. It places the
  extras in the bar on a wide screen and in the drawer on a phone.
- **Keep the desktop `extras` to one or two icon buttons.** When the bar is full, the sections give
  way, not the extras. Put `userCard`, `langSelect`, `themeSelect` and the sign-out in one account
  popover. `imp skill std/shell` has the recipe. The same panel shows inline in the phone drawer.

- **`notifications` is the bell, and it takes no data.** It lists what `notify` from
  `imp/std/feedback` raised. It renders its own modal drawer. Put it in `extras`, beside `userCard`.

Full manuals: `imp skill std/appLogo` | `std/breadcrumbs` | `std/userCard` | `std/orgSelect` |
`std/themeSelect` | `std/langSelect`.

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

```js
import { loader, notice, progress, skeleton } from 'imp/std/feedback'

loader({ label: 'Loading' })
loader({ label: 'Saving', size: 'sm', client: 'myapp.api' })
progress({ label: 'Uploading', value: 40, showValue: true })
progress({ label: 'CPU', shape: 'gauge', value: load, color: 'amber' })
skeleton({ lines: 3 })
notice({ kind: 'warning', title: 'Your trial ends in 3 days' }, 'Add a payment method.')
notice({ client: 'myapp.api' })
```

| Component  | Props                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| `loader`   | `label` (live), `size`, `color`, `client`                                              |
| `progress` | `label` (live), `value` (live), `max`, `shape`, `size`, `color`, `showValue`, `format` |
| `skeleton` | `shape`, `lines`                                                                       |
| `notice`   | `kind`, `title` (live), `icon`, `dismissible`, `open` (live), `client`, `events`       |

Rules an agent gets wrong:

- **`loader` is the spinner, and `progress` never spins.** `loader` is for a wait with no measure,
  in the shape that the `loader` token of the theme selects. `progress` is for a measured amount of
  work, and it warns without a `value`. There is no `statistic` and no `alert`. A `progress` gauge
  shows one number of a dashboard. The inline banner is `notice`, because an `alert` import shadows
  the `alert()` of the browser.
- **`progress` takes `shape`** `'bar'`, `'ring'` or `'gauge'`. `value` counts from `0` to `max`,
  which is `100` by default.
- **Always pass `label` to `loader` and to `progress`.** It is the accessible name. A bar and a
  gauge also show it. A `loader` announces it as a status.
- **`skeleton` is decorative.** Put `aria-busy` on the region that loads. Size a circle or a block
  with `--imp-skeleton-inline-size` and `--imp-skeleton-block-size` on a wrapper.
- **The description of a `notice` is its children.** `kind` is `'info'`, `'success'`, `'warning'` or
  `'error'`. A warning and an error are `role="alert"`. The other two are `role="status"`.
- **Show a `notice` later through a state in `open`.** The live region stays mounted, so a screen
  reader announces the words. A dismiss writes `false` into that state and fires `dismiss`.
- **`client` binds both to an HTTP client**, by name or as the client object. `loader` shows itself
  only while `pending` is above zero. `notice` shows `lastError` as an error that a person can
  dismiss. See `imp skill http`.

Full manuals: `imp skill std/loader`, `imp skill std/progress`, `imp skill std/skeleton`,
`imp skill std/notice`.

```js
import { dismiss, notify, toast } from 'imp/std/feedback'

shell({ extras: [notifications()] }, toast({ client: 'acme.api' }), router(routes))

notify({ kind: 'success', title: 'Report sent' })
const choice = await notify({
  id: 'invoice-1042',
  kind: 'warning',
  title: 'Invoice 1042 is overdue',
  actions: [{ id: 'remind', label: 'Send a reminder' }, { id: 'ignore', label: 'Ignore' }],
  duration: 0,
})
dismiss('invoice-1042')
```

| Export    | Shape                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------ |
| `toast`   | `duration`, `ttl`, `visible`, `limit`, `client`                                                  |
| `notify`  | `notify({ title, id, kind, description, icon, image, link, actions, duration, ttl })`, a promise |
| `dismiss` | `dismiss(id)`                                                                                    |

Rules an agent gets wrong:

- **`notify` and `dismiss` are functions, not components.** They take no `self`. Call them from a
  handler or a module. Never put them in a tree.
- **Mount `toast()` once**, as the first child of the content of `shell`. A second region warns and
  renders nothing.
- **Every key of `notify` is plain data.** `icon` is an export of `imp/icons`, never `icon(...)`.
  `description` is text with no markup.
- **Pass an `id` to update or to dismiss an entry later.** A call with a listed `id` replaces the
  entry.
- **The promise resolves with the `id` of the chosen action, or with `null`.**

Full manual: `imp skill std/toast`. It covers `notify` and `dismiss`.

## reactions - from `imp/std/feedback`

```js
import { card } from 'imp/std/display'
import { reactions } from 'imp/std/feedback'

reactions({ items, onReact: (emoji, reacted) => send(emoji, reacted) }, card(text('Shipped!')))
```

| Prop        | Values                                           | Default               | Notes                         |
| ----------- | ------------------------------------------------ | --------------------- | ----------------------------- |
| `items`     | array of `{ emoji, count, reacted }`, or a state | `[]`                  | A writable state gets changes |
| `onReact`   | `(emoji, reacted) => void \| Promise`            | -                     | Sends a change to the server  |
| `emojis`    | array of emoji or `{ emoji, name, keywords }`    | the built-in set      | What the add panel offers     |
| `disabled`  | boolean, or a state - **live**                   | `false`               | Counts only, no add button    |
| `ariaLabel` | string, or a state                               | `imp.reactions.label` | Names the bar                 |

- **It wraps any content.** The content renders first, and the reaction bar goes under it. With no
  content, it renders the bar alone.
- **imp changes the count at once, then calls `onReact`.** Return the promise. When it rejects, imp
  takes the change back.
- **A pick from the add panel only adds.** A click on a pressed chip takes the reaction back.

Full manual: `imp skill std/reactions`.
