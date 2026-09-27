# imp-ui - Standard components

imp ships a component library, and you import it from **`imp/std`**. There is no UI package to add,
no CSS file to include, and no build step to configure:

```js
import { mount } from 'imp'
import { section } from 'imp/html'
import { button, heading, text } from 'imp/std'

mount(
  '#app',
  section(
    heading('Billing'),
    text({ tone: 'secondary' }, 'Your plan renews on the 1st.'),
    button({ variant: 'primary', events: { click: upgrade } }, 'Upgrade'),
  ),
)
```

Every standard component is a real imp component. It renders as its own element, with its styles
sealed inside it. Nothing that you write on the page can reach in and break it, and nothing that it
defines reaches out onto your page.

This page gives the rules that hold across the whole library, and the few decisions that shape an
app before you write its first screen. It is not the catalog.

## Browse the components

**The catalog is the [component gallery](/components).** Every component renders there as itself, in
light and in dark. The gallery shows its props, its variants, and the code that produced each
specimen. Select a component, look at it, and copy the call.

The gallery is not written by hand. It comes from `imp preview`, the same tool the CLI serves for
your own components while you build them. See **[CLI](cli.md)**. The reference that you read comes
from the components themselves, and it cannot drift from them.

An AI agent reads the same information through `imp skill`. Every component ships a **skill**: the
call shape, the prop table, and the mistakes that the component invites. `imp skill std/button`
prints it. Your own components publish a skill the same way. See **[Components](components.md)**.

## Where components come from

`imp` and its subpaths are the framework: the element factories, `component`, the state, the routing
and the theming. See **[Imports](imports.md)**. `imp/std` is the component library, split by group:

| Import             | What it holds                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `imp/std`          | The base set: `button`, `menuButton`, `heading`, `text`, `link`, `icon`                   |
| `imp/std/layout`   | The two arrangement primitives, `tabs` and the overlay frames                             |
| `imp/std/inputs`   | `form` and every control that binds to one                                                |
| `imp/std/display`  | Components that present content, such as `card`, `tag`, `markdown` and `steps`            |
| `imp/std/shell`    | The app frame, and ready-made contents for its regions                                    |
| `imp/std/feedback` | Telling the person what happens, and hearing back                                         |
| `imp/std/data`     | Records, numbers and places: `table`, `list`, `tree`, `chart`, `gantt`, `calendar`, `map` |

An import line names the part of the library that a file uses. An import of a group that does not
exist is an error, and the message lists the groups that exist.

A few names match an element factory. `button` is a plain `<button>` from `imp/html`, and it is also
the styled component from `imp/std`. The two never collide, because they arrive through different
imports. In the rare file that wants both, give one an alias:

```js
import { button } from 'imp/html'
import { button as styledButton } from 'imp/std'
```

## The rules that hold everywhere

After you use one component, you can predict the rest.

**Props and children separate by type, exactly as on an element.** A plain object is props. A
string, an element and another component are content. A call to a component reads the same way as a
call to `div()`:

```js
button({ variant: 'danger' }, 'Delete') // props, then content
button('Delete') // content only
```

Pass one props object per call. Compose the props into a single object before the call. The
`imp/single-props-object` lint rule catches a second object. See **[Linting](lint.md)**.

**A component accepts its documented props only.** It does not forward an unknown prop to an inner
element. imp logs a prop that it does not recognize, and a value outside the allowed list, and the
component uses its default. Your app keeps running.

**A prop that changes takes a state.** A prop that the gallery marks as **live** accepts a value or
a state. With a state, the component subscribes and updates that one attribute in place. Nothing
renders again, and imp disturbs nothing that you focused or typed into:

```js
const saving = initState(self, 'billing.saving', false)

button({ variant: 'primary', loading: saving }, 'Save')

saving.set(true) // the button is now busy - no re-render
```

**A component is themed. You do not style it.** Every component reads its colors, its spacing, its
radii and its type from the `--imp-*` design tokens. See **[Theming](theming.md)**. A new theme
re-skins the whole library at once. Every component also uses CSS logical properties, so it mirrors
correctly when the `dir` of the document is right to left.

**A component has no outer margin.** The space between two components is the `gap` of the parent
that lays them out. This keeps the rhythm consistent, and it avoids a fight with collapsing margins.

**The words of a component are translatable, and imp already wrote them.** The **No results** of an
empty table and the **Cancel** of a dialog belong to the component. Each word lives under an `imp.`
key, with the English wording as its fallback. Write that key in your own translations, and your
wording takes over. See **[Translations](i18n.md)**.

**Accessibility is the job of the component, not yours.** imp renders the native element wherever
one exists, so the roles, the states and the keyboard behavior come from the browser. Every pointer
interaction has a keyboard equivalent. Every interactive element carries an accessible name. The
ARIA state binds to the same state that drives the visuals, so the two cannot drift apart. An app
that you assemble from these components clears the common accessibility bar, and you connect none of
it by hand.

## Start an app with the frame

**`shell` is the recommended way to start an app.** It gives you a brand block, a top-level navbar,
a nav column, a breadcrumb trail, a content area, and a place for the signed-in person and the
pickers. imp lays all of that out, scrolls each region on its own, and makes it work on a phone.

```js
import { luChartColumn, luUsers } from 'imp/icons'
import { router } from 'imp/router'
import { appLogo, shell, themeSelect, userCard } from 'imp/std/shell'
import { app } from './app-map.js'

shell(
  {
    logo: appLogo({ label: 'Acme' }),
    navbar: { label: 'Sections', map: app, icons: { [app.reports]: luChartColumn } },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ name: user.name, description: user.email })],
    signedIn: session,
    signIn: () => signInPage(),
  },
  router({ map: app, access, screens }),
)
```

**The frame gates the app behind a session.** `signedIn` is a boolean or a state. While it is
`undefined`, the app does not know yet, and the frame shows a loader. While it is `null` or `false`,
the frame shows your `signIn` content and the logo in the middle of the screen, and nothing else.
The main content is not mounted, so no screen loads and no router runs. When it becomes truthy, the
frame mounts the app. The sign-in page is yours, because it differs with every app: a form with a
password, buttons for social providers, a magic link, or a passkey. imp renders no form and talks to
no identity provider. Sign-out is a plain `button` or a `menuButton` that you put beside `userCard`.

**A multi-tenant app gets a switcher.** `orgSelect` lists the organizations that a person belongs
to, shows the current one on its trigger, and reports a choice. Put it beside the logo, or in
`extras`. What a switch means is yours: a navigation to the URL of the tenant, or a new token.

**The application map drives the whole nav.** You describe the app once, as a map. See
**[Routing](routing.md)**. The top-level nodes are the sections in the bar. The children of the
current section fill the column. The trail above the content lists the levels down to the current
page. A section with no children gets no column, and the content takes the full width. You declare
nothing twice, and a change to the map arrives everywhere at once.

**The frame folds on a phone.** The bar becomes a hamburger and a title. The column becomes a bottom
bar, where a thumb can reach it. A tap on a row with children opens them in a sheet above the bar.
The title of that sheet is a link to the page of the row itself, when the row has one. The pickers
and the extras move into the drawer of the hamburger. imp drops nothing. On a desktop the column
collapses to an icon rail when every row has an icon.

**There is no aside region, on purpose.** A contextual side column has no phone form. Content that
comes and goes, such as filters or an inspector, is a `drawer` that you mount in the main content.
Content that must stand beside the page is your own layout inside the content, where you decide what
a phone does with it.

**The frame is ready for a keyboard and a screen reader.** Each navigation level is a named `<nav>`
landmark, the content is `<main>`, and a "Skip to the content" link is the first tab stop of the
page. The link is hidden until the keyboard moves the focus to it, and it moves the focus into the
content. A tap never shows it.

`imp/std/shell` ships the pieces that usually fill the regions of the frame: `appLogo`, `userCard`,
`orgSelect`, `themeSelect`, `langSelect` and the `notifications` bell. The three pickers are menus,
with the current choice on the trigger. Each region takes plain DOM, so you replace a piece that
does not fit with a component of your own. The gallery shows every prop of the frame, its floating
panels, its backdrops and its maximum width.

## Lay a page out with two components

Inside the frame, two components lay a page out. **`flex` is a row.** **`stack` is a column.**

```js
stack(
  { gap: 4 },
  flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Team'), button('Invite')),
  stack({ gap: 2 }, ...members.map((member) => memberRow(member))),
  flex({ horizontalAlign: 'end', gap: 2 }, button('Cancel'), button('Save')),
)
```

That is the whole layout library. There is no grid, no box, and no wrapper with padding and width
props. **When a row and a column cannot express what you want, write the CSS.** A dashboard of cards
is `display: grid` in the `styles` of your own component, next to the thing that it affects:

```js
component('invoice-grid', {
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
  `,
  setup: () => div({ class: 'grid' }, ...cards()),
})
```

The `div` with the `.grid` class stays in the tree of `invoice-grid`, so the rule reaches it. A node
that you pass into `stack`, `flex` or `card` moves into the shadow root of that component, and your
rules stop at that boundary. So `stack({ gap: 2 }, div({ class: 'box' }))` renders the div without
your `.box` rule. In development, imp warns about it in the console when the page renders. Give such
a box its own component, or set an inline `style`.

Two rules follow, and they hold across the library:

- **Spacing is a `gap`, and it is a step, not a length.** `gap` is a step on the spacing scale of
  the theme, from `0` to `6`, never `'1rem'`. The steps from `3` up grow with the viewport, so one
  number gives the correct amount of space on a phone and on a desktop.
- **Alignment is `start` and `end`, never `left` and `right`.** `horizontalAlign: 'start'` is the
  left edge in English and the right edge in Arabic. A toolbar that you write once is correct in
  both directions. `verticalAlign` keeps `top` and `bottom`, because the vertical axis never
  mirrors.

Write your own components with the same logical properties, `padding-inline` rather than
`padding-left`. An imp app then mirrors as a whole, and not in parts.

## Icons are built in, and you pay only for the ones you draw

The whole of **Lucide** ships inside imp. There is nothing to install and no icon font to load.

```js
import { icon } from 'imp/std'
import { luHouse, luStar, luTrash } from 'imp/icons'

icon(luHouse)
icon(luStar, { size: 'lg', color: 'warning' })
icon(luTrash, { size: 'sm', label: 'Delete invoice' })
```

An icon is an **imported name**, not a string. The export is `lu` plus the Lucide name in
PascalCase, so `chart-column` is `luChartColumn`. Search the set at <https://lucide.dev/icons>. Your
build carries the drawing data for the icons that you imported, and nothing else. Never write
`import * as icons from 'imp/icons'`. The `imp/icons-by-name` lint rule catches that line for you.

`color` names a theme token, such as `'primary'` or `'danger'`, so an icon re-skins with the theme.
The default takes the color of the text around it. Every icon prop in the library accepts any DOM,
so your own `<svg>` goes wherever a Lucide export goes. `imp build` writes the Lucide license notice
into `LICENSES.txt`. Deploy that file with the rest of the build.

## Forms are state, not a framework

**The values of a form are ordinary imp state.** Each control says which field of that state it
owns:

```js
import { button } from 'imp/std'
import { form, select, submitForm, textField } from 'imp/std/inputs'

form(
  {
    initialValues: { user: { firstName: 'Ada', email: '' }, plan: 'pro' },
    onSubmit: (values) => save(values),
  },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
)
```

There is no store to create, no field to register, and no `onChange` to pass through your code. Each
control finds the form by its position in the tree, however deep you nest it. `field` is a dot path
into the values, so a nested shape needs nothing more.

**Every control shares one contract.** It takes `field` inside a `form`, or `value` outside one. It
takes `label`, `help`, `required`, `disabled`, `validate` and `validateAsync`. It renders its own
label, its hint and its error, because a `<label>` finds its input by id, and an id cannot cross a
component boundary. Validation runs on blur and on submit, not on every keystroke. The value is
always plain data: a string, a number, an array, or an ISO date. Never a `Date` or a `File`.

**A submit is an ordinary button.** `submitForm` and `resetForm` are functions. Pass one as the
click handler of any `button`, at any depth inside the form, and the function finds the form. A
submit checks every field again. When one field fails, `onSubmit` does not run, the bad fields show
their messages, and the focus moves to the first of them. Return a promise from `onSubmit`, and the
form ignores a second submit until it settles. The state `imp.form.submitting` is `true` meanwhile,
so a button of yours can spin.

The controls range from `textField` and `select` to `comboBox`, `datePicker`, `slider`,
`colorPicker`, `fileUpload`, `imageUpload`, `codeEditor` and `richTextEditor`. The gallery shows
each one with its props.

**A picture is cropped and resized before it leaves the browser.** `imageUpload` takes one picture
and opens it in a frame with the ratio that you set, round or rectangular. The person drags the
picture, zooms it, and clicks Done. imp then cuts the frame out of the original and shrinks it to
the size you set. A photo of 12 megapixels becomes a 256 by 256 avatar of about 20 kB, and the
server never receives the original. The value is a data URL, so it sits in the form and travels in
JSON. The output `File` is handed to `onImage` for a `FormData` upload. The control keeps one box
for the placeholder and for the preview, so the page does not move when a picture arrives. The box
fills the field by default, and `compact` makes it a small box beside the prompt.

```js
imageUpload({
  field: 'avatar',
  label: 'Profile picture',
  shape: 'circle',
  compact: true,
  maxWidth: 256,
  maxHeight: 256,
  onImage: (file) => {
    picture = file
  },
})
```

**A search box that asks the server is `comboBox` with `onSearch`.** imp waits until the person
stops typing, calls your function once with the text, and shows what it returns. The function gets
an abort signal, so a request that a newer text replaces is cancelled. `minSearch` holds the search
until enough letters are typed.

## Overlays use the platform, not a z-index war

Anything that imp opens over your page is a real `<dialog>` or a popover in the **top layer** of the
browser. This covers `dialog`, `drawer`, the menu of `menuButton`, `tooltip`, and the panel of a
`datePicker`. An ancestor with `overflow: hidden` cannot clip it. Nothing paints over it. It needs
no z-index, no portal and no placement prop.

```js
import { dialog, drawer } from 'imp/std/layout'

dialog({ title: 'Edit user', open: editing }, form({ initialValues }, textField({ field: 'name' })))
drawer({ title: 'Filters', open: filtering }, form({ initialValues: filters }, ...fields))
```

**`open` is the whole API.** Pass a writable state, and set it to open the window. imp sets it back
to `false` when the person closes the window. The state is always the truth about what is on the
screen. A modal takes the page over: the rest becomes inert, the focus moves in and returns, and
Escape dismisses it. Nearly all of that comes from the browser, not from imp.

A `drawer` slides in from the end of the line, the right edge in English and the left edge under
`dir="rtl"`. A `menuButton` opens its `items` as a menu that the browser places under the trigger,
and flips when there is no room.

## Tell the person what is happening

`imp/std/feedback` holds the components that report on the app. `loader` is the spinner, in the
shape that the theme selects with its `loader` token, for a wait with no known end. `progress` is a
bar, a ring or a gauge for a measured amount of work. `skeleton` holds the place of content that
loads. `notice` is a message banner inside the page.

`toast()` draws popups in the corner, and `notify()` sends one from anywhere in your code. imp keeps
every notification. The `notifications` bell in the frame opens a list of them, so a person who
looked away can still read the message and answer its question:

```js
import { notify, toast } from 'imp/std/feedback'
import { notifications } from 'imp/std/shell'

shell({ extras: [notifications()] }, toast(), router({ map: app, screens }))

const choice = await notify({
  kind: 'warning',
  title: 'Invoice 1042 is overdue',
  actions: [{ id: 'remind', label: 'Send a reminder' }, { id: 'ignore', label: 'Ignore' }],
})
```

`loader`, `notice` and `toast` take a `client` prop, the name of an HTTP client. They then show a
request in flight and the last error on their own. See **[HTTP](http.md)**.

## Put things on a map, with no map server

`map` from `imp/std/data` shows the world with your markers on it, and it sends no request. The
countries, the lakes and the cities come with the component, from the public domain Natural Earth
data set. So a map needs no key, no account and no tile server. It works offline, and it costs your
app about 50 kB, only when a page draws one.

```js
import { userCard } from 'imp/std/shell'
import { map } from 'imp/std/data'

map({
  label: 'Offices',
  center: [50, 10],
  zoom: 2,
  pins: [
    { id: 'warsaw', lat: 52.23, lng: 21.01, label: 'Warsaw office' },
    { id: 'lisbon', lat: 38.72, lng: -9.14, content: userCard({ name: 'Ana' }), anchor: 'bottom' },
  ],
  events: { select: (event) => showOffice(event.detail.id) },
})
```

A person drags the map, turns the wheel, pinches on a phone, or uses the arrow keys and `+` and `-`.
`zoom: 0` fits the whole world to the box, and each step doubles it. `center` and `zoom` can be
states. Then the map moves when your app sets them, and it writes them back when the person moves
the map, so a list next to the map can follow the view.

A pin is any coordinate. Without `content` it is a marker button, named by its `label`, and a click
reports `select`. With `content` it is your own element or component, placed on the coordinate and
left alone. So a pin can be a button, a card, or anything with its own clicks and keys.

**`detail` decides how much of the world ships.** The default, `'low'`, draws 177 countries, the 24
largest lakes and 243 cities, for 50 kB. `'medium'` draws the finer 1:50m world, with every small
island, 412 lakes and 1251 cities, for 360 kB. `'high'` adds the major and secondary highways of the
world on top of that, for 1.1 MB, or 640 kB compressed. Each level is a separate chunk of your app,
and a page loads only the chunk of the level it draws. Pick `'low'` for a card that shows a few
offices, and `'high'` for a full-page map that a person zooms into.

```js
map({ label: 'Europe', detail: 'high', center: [50, 10], zoom: 3, pins })
```

The detail stops there. The map has no streets and no towns, because that needs a map server, and
imp does not ship one. For a street map, use a tile provider of your own in a custom component.

## The name that you look for

The library has one component per job. A name from another library often maps to a prop here:

| You look for       | Use                                                                      |
| ------------------ | ------------------------------------------------------------------------ |
| badge              | `tag`, in the reading order next to the thing that it counts             |
| spinner            | `loader`                                                                 |
| statistic          | `progress({ shape: 'gauge' })`                                           |
| alert              | `notice`, because an import named `alert` hides `alert()` of the browser |
| result page        | `emptyState` with a `kind`                                               |
| illustration       | `emptyState` with an `image`                                             |
| submit button      | a `button` whose click is `submitForm`                                   |
| workspace switcher | `orgSelect`                                                              |
| avatar group       | a `flex` of avatars, with a `tag` for "+4"                               |
| button group       | `flex({ joined: true })`                                                 |
| split button       | a joined `flex` of a `button` and a `menuButton`                         |
| pagination         | `hasMore` and `onLoadMore` on `table` and `list`                         |
| menu, sidebar item | a node of the application map                                            |
| aside              | a `drawer` in the content, or your own layout                            |
| grid               | `display: grid` in the styles of your own component                      |

## Custom elements next to yours

Each standard component defines its own element the first time you call it. `button` renders as
`<imp-button>`, and `heading` renders as `<imp-heading>`. Two things follow from that:

- **The `imp-` prefix is reserved.** Name your own components with the prefix of your app, such as
  `my-app-profile`, as usual.
- **imp registers nothing until you use it.** A component that you never call defines no element and
  compiles no stylesheet. An import of a whole group costs you nothing at startup.

The content of a component lives inside its own element, so `host.textContent` is empty by design. A
test walks the `shadowRoot`, and an end-to-end selector uses the deep combinator. See
**[Testing](testing.md)**.

The library does not cover every app. When you build a component that the library lacks, follow the
rules that the standard components follow. Read the theme, mirror in a right-to-left script, bring
its own words, and work from a keyboard. See **[Custom components](custom-components.md)**.
