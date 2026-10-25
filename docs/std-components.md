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

| Import             | What it holds                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `imp/std`          | The base set: `button`, `menuButton`, `heading`, `text`, `link`, `icon`                               |
| `imp/std/layout`   | The two arrangement primitives, `tabs` and the overlay frames                                         |
| `imp/std/inputs`   | `form` and every control that binds to one                                                            |
| `imp/std/display`  | Components that present content, such as `card`, `tag`, `markdown` and `steps`                        |
| `imp/std/shell`    | The app frame, and ready-made contents for its regions                                                |
| `imp/std/feedback` | Telling the person what happens, and hearing back                                                     |
| `imp/std/data`     | Records, numbers and places: `table`, `list`, `timeline`, `tree`, `chart`, `gantt`, `calendar`, `map` |

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

**Every control is as tall as a button of the same size.** A text field, a select, a date picker, a
combo box and a button share one height, so a form row has one top edge and one bottom edge. A
button is wider inside than an input, because it centres a short label, but the height is the same.
A multi-line editor keeps its own line height.

**A prop that changes takes a state.** A prop that the gallery marks as **live** accepts a value or
a state. With a state, the component subscribes and updates that one attribute in place. Nothing
renders again, and imp disturbs nothing that you focused or typed into:

```js
const saving = initState(self, 'billing.saving', false)

button({ variant: 'primary', loading: saving }, 'Save')

saving.set(true) // the button is now busy - no re-render
```

**A button keeps the focus while it is busy.** When a focused button turns busy or disabled, it
stays focused and ignores a click. It takes the native disabled state when the focus leaves it. So a
person who presses Save with the keyboard stays on Save, and a screen reader does not lose its
place.

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

**A link follows a safe address only.** Every component that renders a link from an `href` checks
the address first: `link`, `card`, `userCard`, `appLogo`, `breadcrumbs`, the navigation items of the
`shell`, `list` and `timeline`. It accepts `http:`, `https:`, `mailto:` and `tel:`, a path, a query
and a `#` fragment. It drops any other scheme, such as `javascript:`, `data:` or `vbscript:`, and
logs a warning. An `href` with such a scheme runs script in the page when a person clicks it. The
component then renders as it does with no `href`. So an address that comes from user data cannot run
script through a standard component.

**Accessibility is the job of the component, not yours.** imp renders the native element wherever
one exists, so the roles, the states and the keyboard behavior come from the browser. Every pointer
interaction has a keyboard equivalent. Every interactive element carries an accessible name. The
ARIA state binds to the same state that drives the visuals, so the two cannot drift apart. An app
that you assemble from these components clears the common accessibility bar, and you connect none of
it by hand. See **[Accessibility](accessibility.md)** for the full contract, and for the few things
that stay with your app, such as a name for an icon-only button.

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
    navbar: {
      label: 'Sections',
      map: app,
      hide: [app.signIn],
      groups: { Money: [app.reports.revenue, app.reports.costs] },
      icons: { [app.reports]: luChartColumn },
    },
    sidebar: { label: 'Pages' },
    extras: [themeSelect(), userCard({ name: user.name, description: user.email })],
    signIn: app.signIn,
  },
  router({ map: app, access, need, screens }),
)
```

**The nav shows every node of the map, unless you hide it.** `navbar.hide` lists the nodes that the
bar and the sidebar leave out, such as the sign-in page. The route of a hidden node still works.
`navbar.groups` puts consecutive sidebar rows under a title. The key is the title, and the value
lists the rows. When the translations of the app hold a key of `groups`, the shell shows that
message, so a group title follows the language.

**A param crumb takes its label from your data.** A screen writes the name of a project to the state
`imp.routeLabels`, and the trail shows it. While the screen loads, the crumb shows a small loader,
never the raw id. See [Routing](routing.md).

**A nav row can carry a short tag.** Bind it in `navbar.tags`, keyed by the handle of the node, as
`{ text, color, title }` or a state that holds one. The tag shows `text` at the small size. Give it
a `title` when `text` is short for something longer, such as `main +2` for a list of three servers.
The title shows as a tooltip when the pointer is on the tag. A screen reader reads it as the
description of the row, after the name of the row:

```js
const serversTag = { text: 'main +2', title: 'main, backup, eu-west' }

shell({ navbar: { label: 'Sections', map: app, tags: { [app.servers]: serversTag } } }, page())
```

**The sign-in page is a page of your map.** Add a node for it, and give a `need` to every section
that needs a session. The `access` guard of the router returns `wait` while the session is
not known yet, and redirects a visitor with no session to the sign-in page. Put the requested path
in the redirect, such as `/sign-in?next=/todos/3`. After the sign-in, navigate to
`safeNext(next, fallback)` from `imp/router`. It drops a `next` value that leaves your app. A deep
link then works for a signed-out visitor too.

```js
export const app = appMap({
  signIn: {},
  reports: {},
  directory: {},
})

const access = guard(['acme.session'], (session, { need, path }) => {
  if (session === undefined) return wait
  if (!session) return `/sign-in?next=${encodeURIComponent(path)}`
  return need === 'user' || session.roles.includes(need) || '/forbidden'
})

const need = { [app.reports]: 'user', [app.directory]: 'admin' }
```

**The frame shows no chrome until it knows who may see the page.** Pass the sign-in node to the
frame as `signIn`. On that node, and on its children, the frame shows the screen and the logo in the
middle of the screen, and nothing else: no bar, no column, no extras. It does the same while the
guard of the current page waits, with the loading content of the router. A redirect keeps the layout
until the next screen shows. So a signed-out visitor goes from the loading content to the sign-in
page and never sees the navbar.

**The sign-in page is yours, because it differs with every app.** Write a form with a password,
buttons for social providers, a magic link, or a passkey. For an external identity provider, put its
return URL under the sign-in node, so that it also shows without the chrome. imp renders no form and
talks to no identity provider. Sign-out is your own function, which you pass to `accountMenu` as
`onSignOut`. The sign-in page is an ordinary page, so analytics counts its views.

**Keep the bar light, and group the account controls.** The sections and the extras share the top
bar. A language picker, a theme picker and a user card side by side take the place of two or three
sections, and a section that does not fit scrolls out of view. So put those controls in one
`accountMenu`: an avatar button that opens a small popover with the person, the pickers and the
sign-out.

```js
accountMenu(
  { name: user.name, description: user.email, onSignOut },
  langSelect({ languages }),
  themeSelect(),
)
```

On a desktop the browser runs the popover, and CSS anchor positioning places it under the avatar.
The panel closes when the focus leaves it, so an open panel never covers the focused control. On a
phone the shell moves the extras into its drawer, and the same panel shows inline there, without the
button.

**A multi-tenant app gets a switcher.** `orgSelect` lists the organizations that a person belongs
to, shows the current one on its trigger, and reports a choice. Put it beside the logo, or in
`extras`. What a switch means is yours: a navigation to the URL of the tenant, or a new token.

**The application map drives the whole nav.** You describe the app once, as a map. See
**[Routing](routing.md)**. The top-level nodes are the sections in the bar. The children of the
current section fill the column. The trail above the content lists the levels down to the current
page, and it hides on a top-level page, where it would repeat the one word in the bar. A section
with no children gets no column, and the content takes the full width. You declare nothing twice,
and a change to the map arrives everywhere at once.

**The frame folds on a phone.** The bar becomes a hamburger and a title. The column becomes a bottom
bar, where a thumb can reach it. A tap on a row with children opens them in a sheet above the bar.
The title of that sheet is a link to the page of the row itself, when the row has one. The pickers
and the extras move into the drawer of the hamburger. imp drops nothing. A screen reader names the
hamburger and its drawer "Menu". When the bottom bar holds every section, the drawer has no
navigation region, so the reader does not find an empty one. The drawer is as tall as its content,
up to the height of the screen, so a drawer with only the extras leaves no empty panel. On a desktop
the column collapses to an icon rail when every row has an icon.

**The content area is the screen region of the router, and it can animate.** A forward navigation
scrolls it to the top, and the back button puts it back where it was. The change itself can animate
with a view transition of the browser: `effect: 'fade'` cross-fades, `'slide'` moves the screens
along the reading direction, and `'zoom'` scales the new screen in. The default is `'none'`. The
bar, the column and the trail never move. See **[Routing](routing.md#screen-transitions)**.

**There is no aside region, on purpose.** A contextual side column has no phone form. Content that
comes and goes, such as filters or an inspector, is a `drawer` that you mount in the main content.
Content that must stand beside the page is your own layout inside the content, where you decide what
a phone does with it.

**The frame is ready for a keyboard and a screen reader.** Each navigation level is a named `<nav>`
landmark, the content is `<main>`, and a "Skip to the content" link is the first tab stop of the
page. The link is hidden until the keyboard moves the focus to it, and it moves the focus into the
content. A tap never shows it.

`imp/std/shell` ships the pieces that usually fill the regions of the frame: `appLogo`, `userCard`,
`accountMenu`, `orgSelect`, `themeSelect`, `langSelect` and the `notifications` bell. The three pickers are menus,
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

**Two panes that a person resizes are `splitPane`.** A mail list beside a reader, or an editor over
its output, gets a handle between the panes. The person drags the handle, or focuses it and moves it
with the arrow keys, Home and End. A screen reader hears a separator with its value in percent. The
CSS `resize` property drags one corner only and has no keyboard path, so imp draws the handle:

```js
const share = initState(self, 'mail.split', 35)

splitPane({ size: share, min: 20, max: 60, label: t('mail.resize') }, mailList(), mailReader())
```

`size` is the share of the start pane, in percent. A drag writes it into the state, so the app can
store it with the preferences of the person. `orientation: 'vertical'` stacks the panes, and then
its parent needs a height. For a third pane, put a `splitPane` in a pane. The start pane follows the
reading direction, so it is on the right in a right-to-left page. The line of the handle is thin,
but a pointer or a finger can grab it 12px to each side. So the touch target is 24px wide.

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
import { form, select, textField } from 'imp/std/inputs'

form(
  {
    initialValues: { user: { firstName: 'Ada', email: '' }, plan: 'pro' },
    onSubmit: (values) => save(values),
  },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
  button({ variant: 'primary', submit: true }, 'Save'),
)
```

There is no store to create, no field to register, and no `onChange` to pass through your code. Each
control finds the form by its position in the tree, however deep you nest it. `field` is a dot path
into the values, so a nested shape needs nothing more. A segment that is a number indexes an array.
So `items.0.name` is the name of the first row, and imp builds the array when it is not there yet. A
form with repeatable rows keeps the rows in one array, and renders a control per row with
`items.each`, where the path of each control carries the index of its row.

**Every control shares one contract.** It takes `field` inside a `form`, or `value` outside one. It
takes `label`, `help`, `required`, `disabled`, `validate` and `validateAsync`. It renders its own
label, its hint and its error, because a `<label>` finds its input by id, and an id cannot cross a
component boundary. Validation runs on blur and on submit, not on every keystroke. The value is
always plain data: a string, a number, an array, or an ISO date. Never a `Date` or a `File`.

**An error shows when the person can act on it.** A control shows its error after the person changes
it and leaves it, or after a submit. A person who moves through the form with Tab, or with a screen
reader, does not hear "This field is required" from every field that they pass. A field that is back
at its first value shows its error at the next submit.

**Only the fields on the page can block a submit.** A field that leaves the page drops its error.
This covers a field on a tab that is not open, or a field behind a condition that is now false. So
the person never meets a blocked submit with no message on the screen. The value of the field stays
in the form and goes to `onSubmit`. When the field comes back, the next submit validates it again.

**A submit is an ordinary button.** `button({ submit: true })` submits the form around it, at any
depth, and spins while the form submits. `submitForm` and `resetForm` are the same actions as
functions, for a click handler of your own. A submit checks every field again. When one field fails,
`onSubmit` does not run, the bad fields show their messages, and the focus moves to the first of
them. Return a promise from `onSubmit`, and the form ignores a second submit until it settles. The
state `imp.form.submitting` is `true` meanwhile.

**A check can compare two fields.** Every `validate` receives `(value, { values })`, and `values` is
the whole form. When one form can be sent for two reasons, such as a draft and a publish, keep the
reason in the values, for example a `status` field. `onSubmit` and every `validate` then read
`values.status`.

**A field can follow another field.** The values of the form are one state, `imp.form`. In a
component inside the form, read it with `useState`. Watch one field through a `computed`, and write
another field with `set` and a function:

```js
const values = useState(self, 'imp.form')
computed([values], (all) => all.teamId).watch(self, (teamId) =>
  values.set((all) => ({ ...all, partners: membersOf(teamId) })),
)
```

A `computed` skips an equal value, so the watcher runs only when `teamId` changes.

**A choice keeps its type.** `select`, `radioGroup` and `segmented` write the value of an option as
you wrote it. An option `{ value: 4 }` gives the number `4`, and `{ value: null, label: 'None' }`
gives `null`.

**A failed save shows above the buttons.** When `onSubmit` throws, or its promise rejects, the form
shows an error `notice` above its last child, which holds the buttons. A screen reader announces it.
The next submit removes it. So a failure that belongs to no single field needs no code of yours.

**Only a message that you wrote for a person reaches the person.** The text of an ordinary error,
such as `TypeError: Cannot read properties of undefined`, means nothing to the reader of your app.
So the form shows a translated generic message, "We could not send the form - try again", and logs
the original error. When your API sends a sentence for the person, pass `errorMessage` to the form.
It is a function that reads the text from the error, such as `(error) => error.body?.error`. When it
returns nothing, the form shows the generic message. To show a message of your own, throw a
`FormError` from `imp/std/inputs`, and route its text through `t()`:

```js
import { HttpError } from 'imp/http'
import { t } from 'imp/i18n'
import { FormError } from 'imp/std/inputs'

const save = async (values) => {
  try {
    await api.post('/signup', values)
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      throw new FormError(t('signup.emailTaken'), { cause: error })
    }
    throw error
  }
}
```

**A server that rejects one field names the field.** Pass `fields` to the `FormError`, an object
from a field path to a message. The form shows each message on its field, exactly as a failed
`validate` does, and moves the focus to the first of them. A message that you leave empty shows no
notice above the buttons, because the fields carry the message. The next change of a field clears
its message, and the next submit forgets every message from the server:

```js
throw new FormError('', { fields: { email: t('signup.emailTaken') } })
```

**The form knows when the values changed.** The state `imp.form.dirty` is `true` while the values
differ from the clean state of the form. The clean state starts as `initialValues`. After a
successful submit, the submitted values become the clean state. So a form that stays on the page
after a save is clean again. An edit that the person makes while the save runs keeps the form dirty.
Use the state to enable a save button, or to ask before the person leaves the page:

```js
const unsavedGuard = component('myapp-unsaved-guard', {
  setup: (self) => {
    const dirty = useState(self, 'imp.form.dirty')
    beforeLeave(self, () => !dirty.get() || confirm(t('edit.discard')))
    return null
  },
})
```

Put the component inside the form, because the states of a form reach only its own subtree.

**A secret stays out of the form state and out of the log.** Set `secret: true` on a field that
holds a password, an API key or a token. Every control takes it. The form keeps that value in a
private store of its own, not in the `imp.form` state. So no `get()` of a state returns it, and the
debug log of imp never prints it. `onSubmit` gets the values with the secret merged in at its path:

```js
form(
  { initialValues: { name: '' }, onSubmit: (values) => connect(values.name, values.key) },
  textField({ field: 'name', label: 'Name', required: true }),
  textField({ field: 'key', label: 'Key', type: 'password', secret: true, required: true }),
  button({ variant: 'primary', events: { click: submitForm } }, 'Connect'),
)
```

A secret field validates like any other field, and a value in it makes the form dirty. It always
starts empty, so do not put its value in `initialValues`. A successful submit and `resetForm` empty
it. A failed submit keeps it, so the person can try again without typing it again.

**`resetForm` puts the clean state back.** A call to `resetForm` inside `onSubmit` wins over the
save. So a form that adds a record and clears itself for the next one is clean after the save. Pass
values as the second argument, `resetForm(source, values)`, to make them the new clean state. Use it
when the data of the form arrives after the form is on the page.

The controls range from `textField` and `select` to `comboBox`, `treeSelect`, `datePicker`,
`dateRangePicker`, `slider`, `colorPicker`, `emojiPicker`, `fileUpload`, `imageUpload`, `codeEditor`
and `richTextEditor`. The gallery shows each one with its props.

**A picture is cropped and resized before it leaves the browser.** `imageUpload` takes one picture
and opens it in a frame with the ratio that you set, round or rectangular. The person drags the
picture, zooms it, and clicks Done. imp then cuts the frame out of the original and shrinks it to
the size you set. A photo of 12 megapixels becomes a 256 by 256 avatar of about 20 kB, and the
server never receives the original. The value is a data URL, so it sits in the form and travels in
JSON. The output `File` is handed to `onImage` for a `FormData` upload. The control keeps one box
for the placeholder and for the preview, so the page does not move when a picture arrives. The box
fills the field by default, and `compact` makes it a small box beside the prompt.

**The browser decodes the picture, so the browser decides which formats open.** An iPhone saves a
photo as HEIC. `imageUpload` and the image tool of `richTextEditor` offer HEIC and HEIF files in the
file dialog, and they also take a `.heic` file that has no MIME type. Safari opens a HEIC photo on
macOS and on iOS, and imp converts it to a JPEG. Chrome, Edge and Firefox cannot open HEIC. In those
browsers, the control shows a message that names the HEIC photo and asks for a JPEG. imp does not
ship a HEIC decoder of its own. A decoder adds hundreds of kilobytes of WebAssembly to the app, and
it does a job that the platform owns.

**A long document with images stays fast in `richTextEditor`.** The value is markdown, and an
embedded image makes it megabytes long. imp keeps the markdown of each block, so a keystroke writes
only the block that changed. The value is exact after every edit, so a submit right after a
keystroke sends what the person sees.

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

**A choice from a hierarchy is `treeSelect`.** The control looks like a `select`. A press opens a
panel with a search input and a tree of checkboxes. The search keeps every label that contains the
text, together with its parents. A checkbox of a parent has three states, so one press can choose a
whole branch. The first press chooses the parent and everything below it, and the box shows a filled
square. The second press keeps only the parent, and the box shows a check mark. The third press
clears the parent. A dash marks a parent that is not chosen but has a chosen item below it. The
value is an array of the chosen values, in the order of the tree.

```js
treeSelect({
  field: 'pages',
  label: 'Pages',
  placeholder: 'All pages',
  items: [
    {
      value: '/users',
      label: '/users',
      children: [
        { value: '/users/{id}/details', label: '/users/{id}/details' },
        { value: '/users/invites', label: '/users/invites' },
      ],
    },
    { value: '/settings', label: '/settings' },
  ],
})
```

**A range of dates is `dateRangePicker`.** `datePicker` holds one date. `dateRangePicker` holds a
first and a last day, `{ start: '2026-09-08', end: '2026-10-07' }`. The panel shows a month grid,
the two days, and an Apply button. Add `time: true` to put a start time and an end time under the
days. The value then holds moments, such as `'2026-09-08T09:00'`. Without `time`, the panel shows
days only.

```js
dateRangePicker({ field: 'stay', label: 'Hotel stay', min: '2026-10-07' })
```

`min` and `max` limit the days. A person cannot pick a day outside them, and a preset whose range
goes outside them is disabled. A value outside the limits fails validation.

**A report period can be a rule.** Pass `presets`, and the panel gets two tabs, "Relative" and
"Custom". The "Relative" tab lists your presets, such as "Last 5 minutes" or "Last 30 days". Each
preset can show the range that your app computed for it, with times when it is shorter than a day. A
press on a preset writes `{ preset: '30d' }`. So a saved report keeps "Last 30 days" as a rule, and
not as the dates of the day when it was saved. With no presets, the panel has no tabs.

```js
dateRangePicker({
  field: 'period',
  label: 'Period',
  presets: [
    {
      value: '5m',
      label: 'Last 5 minutes',
      range: { start: '2026-10-07T14:55', end: '2026-10-07T15:00' },
    },
    { value: '30d', label: 'Last 30 days', range: { start: '2026-09-08', end: '2026-10-07' } },
  ],
  time: true,
})
```

**An emoji is a form value like any other.** `emojiPicker` holds the emoji itself as a string. Its
panel shows 482 emoji in eight categories, and a search field finds one by name or by a keyword such
as "coffee" or "party". The emoji tool of `richTextEditor` opens the same panel. To offer a specific
set, pass it as `emojis`. An entry can carry a name and keywords in the language of your app:

```js
emojiPicker({
  field: 'health',
  label: 'Project health',
  emojis: [
    { emoji: '\u{1F7E2}', name: 'On track', keywords: ['good'] },
    { emoji: '\u{1F534}', name: 'Blocked', keywords: ['stop'] },
  ],
})
```

## Overlays use the platform, not a z-index war

Anything that imp opens over your page is a real `<dialog>` or a popover in the **top layer** of the
browser. This covers `dialog`, `drawer`, the menu of `menuButton`, `tooltip`, and the panels of
`datePicker`, `dateRangePicker`, `treeSelect`, `emojiPicker` and `reactions`. An ancestor with
`overflow: hidden` cannot clip it. Nothing paints over it. It needs no z-index, no portal and no
placement prop.

```js
import { dialog, drawer } from 'imp/std/layout'

dialog({ title: 'Edit user', open: editing }, form({ initialValues }, textField({ field: 'name' })))
drawer({ title: 'Filters', open: filtering }, form({ initialValues: filters }, ...fields))
```

**`open` is the whole API.** Pass a writable state, and set it to open the window. imp sets it back
to `false` when the person closes the window. The state is always the truth about what is on the
screen. A modal takes the page over: the rest becomes inert, the focus moves in and returns, and
Escape dismisses it. Nearly all of that comes from the browser, not from imp.

**`beforeClose` keeps a window open that holds unsaved work.** imp asks it before every dismissal by
the person: Escape, a click on the backdrop, and the close button. Return `false` to stay open. A
promise works too, so you can wait for your own confirmation dialog. When your code sets `open` to
`false`, imp does not ask, because your code already decided.

```js
dialog(
  { title: 'Edit user', open: editing, beforeClose: () => !dirty.get() || confirm(t('discard')) },
  form({ initialValues }, textField({ field: 'name' })),
)
```

The same prop makes a dialog that only your code closes, with `() => false`. It also holds a dialog
open while a request runs, with `() => !saving.get()`. The router asks the same kind of check before
it leaves a screen, see **[Routing](routing.md)**.

**A form in a dialog starts fresh each time.** Pass the content as `content: () => form(...)`. imp
builds it when the dialog opens and drops it after the dialog closes. So the next open starts from
`initialValues`, with no reset of your own:

```js
dialog({
  title: 'Add people',
  open: adding,
  content: () => form({ initialValues: { members: [] }, onSubmit: add }, ...fields),
})
```

A `drawer` slides in from the end of the line, the right edge in English and the left edge under
`dir="rtl"`. On a desktop it is as tall as the screen. On a phone it is as tall as its content, up
to the height of the screen, so a short list leaves no empty panel. A `menuButton` opens its `items`
as a menu that the browser places under the trigger, and flips when there is no room.

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
  actions: [
    { id: 'remind', label: 'Send a reminder' },
    { id: 'ignore', label: 'Ignore' },
  ],
})
```

`loader`, `notice` and `toast` take a `client` prop, the name of an HTTP client. They then show a
request in flight and the last error on their own. The title of a failure in `toast` is the
`message` of the error. To show the sentence that your API sends, pass a `message` function, such as
`toast({ client: 'myapp.api', message: (error) => error.body?.error })`. See **[HTTP](http.md)**.

## Let people react to content

`reactions` from `imp/std/feedback` puts a reaction bar under any content that you give it. Each
emoji shows as a button with its count. A click adds the reaction of the person, and a second click
takes it back. A button at the end of the bar opens the same emoji panel as `emojiPicker`.

```js
import { card } from 'imp/std/display'
import { reactions } from 'imp/std/feedback'

reactions(
  {
    items: [
      { emoji: '\u{1F44D}', count: 12, reacted: true },
      { emoji: '\u{1F389}', count: 4 },
    ],
    onReact: (emoji, reacted) => api.post('/posts/42/reactions', { body: { emoji, reacted } }),
  },
  card(markdown(post.body)),
)
```

**The count changes at once, and the server hears about it in `onReact`.** imp calls `onReact` with
the emoji and with `true` for an added reaction or `false` for a removed one. Return the promise of
the request. When the request fails, imp takes the change back, so the screen never shows a reaction
that the server does not have. Pass a state as `items` to keep the reactions in your app, and imp
writes each change into it.

**`emojis` limits the reactions to an allowed set.** The panel then offers only those emoji, in one
grid without categories. A reaction that the server sends with an emoji outside the set still shows
its count, but nobody can add to it. A person can still take their own reaction back.

```js
reactions(
  {
    items: post.reactions,
    emojis: ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F440}'],
    onReact: (emoji, reacted) => api.post('/posts/42/reactions', { body: { emoji, reacted } }),
  },
  card(markdown(post.body)),
)
```

## Show what happened, in order

`timeline` from `imp/std/data` shows a list of dated events from top to bottom. Each event has a
marker, a time, a title, and an optional description and actions. Use it for the history of an
order, an activity feed, or an audit log.

```js
import { luTruck } from 'imp/icons'
import { timeline } from 'imp/std/data'

timeline({
  label: 'Order history',
  items: [
    { id: 'placed', time: '2026-09-21T09:12:00Z', title: 'Order placed', color: 'blue' },
    { id: 'shipped', time: '2026-09-23T07:05:00Z', title: 'Shipped', icon: luTruck },
    { id: 'due', time: '2026-09-30', title: 'Invoice due', description: 'Net 7' },
  ],
  events: { select: (event) => openEvent(event.detail.id) },
})
```

**imp draws the events in the order of the array, and it does not sort them.** Put the newest event
first for a feed. Put the oldest event first for a history that a person reads from the top.

- **The time shows in the language of the page**, in a `<time>` element with a machine-readable
  value. A change of language formats every time again. A value such as `'2026-09-30'` shows as a
  date only, on that calendar day in every time zone. A full ISO string also shows the time, in the
  time zone of the reader.
- **The marker is decoration.** An `icon` and a `color` from the palette make an event easy to find,
  but a screen reader does not announce them. Put the meaning in the `title`.
- **The title is the control of an event.** With an `href`, it is a link in the space of your app.
  Without an `href`, it is a button when you pass `events.select`, and plain text when you do not.
- **A long history loads in pages.** Pass `hasMore` and `onLoadMore`, and append the next events to
  the `items` state. An empty timeline shows an empty state.

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

## Share a link as a QR code

`qrCode` from `imp/std/display` draws a QR code of a text or a link. A phone camera reads it, so a
person can open a page of your app on the phone without typing the address. imp encodes the code
itself, with no library and no request, and draws it as one SVG image.

```js
import { link } from 'imp/std'
import { qrCode } from 'imp/std/display'

qrCode({ value: 'https://shop.example.com/order/42', label: 'QR code of the order link' })
link({ href: 'https://shop.example.com/order/42' }, 'shop.example.com/order/42')
```

Show the value as text next to the code. A person cannot read a QR code, and a screen reader reads
only the label of the image. `value` and `label` can be states, and the code follows them.

- **The code is dark on white in every theme.** Many scanners cannot read light modules on a dark
  ground. So the code keeps its own colours. A dark theme and forced-colours mode do not change
  them.
- **`errorCorrection` sets how much damage a scanner can repair**: `'L'`, `'M'`, `'Q'` or `'H'`. The
  default `'M'` suits a screen. Use `'H'` for a print that gets dirty or has a logo on top.
- **A short value gives a code that is easy to read.** imp picks the smallest QR version that fits
  the UTF-8 bytes of the value. A code holds at most 2953 bytes at `'L'`. For a longer value imp
  warns and draws nothing.
- **Any language works.** When the value has a character outside ASCII, the code also tells the
  scanner that the bytes are UTF-8. So a phone shows the text in the script that you wrote, and not
  a row of wrong letters.
- **An empty value draws nothing.** The image leaves the page and the accessibility tree until the
  value has text.
- **`size` is `'sm'`, `'md'` or `'lg'`**, for a side of 6rem, 10rem or 16rem.

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
| pagination         | `hasMore` and `onLoadMore` on `table`, `list` and `timeline`             |
| activity feed      | `timeline`, with an `icon` and a `color` on each event                   |
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
