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

Every standard component is a real imp component. So it renders as its own element, with its styles
sealed inside it. Nothing that you write on the page can reach in and break it, and nothing that it
defines reaches out onto your page.

This page is the argument for the library. It gives what holds across all of it, and the few pieces
that are worth knowing before you start. It is not the catalog.

## Browse the components

**The catalog lives in the [component gallery](/components).** Every component renders there as
itself, in light and in dark. The gallery gives its props, its variants, and the code that produced
each specimen. Select a component, look at it, and copy the call.

Nobody writes that page by hand. It is `imp preview`, the same gallery that the CLI serves for your
own components while you build them. See **[CLI](cli.md)**. So imp generates the reference that you
read from the components themselves, and it cannot differ from them. The tool that you use to browse
the library of imp is the tool that you already use to browse your own components.

An AI agent has a second door onto the same information. Every component ships a **skill**, which is
the short mechanical version: the call shape, the prop table, and the mistakes that the component
invites. `imp skill std/button` prints it. Your own components publish a skill in the same way. Put
a `counter.skill.md` file next to the module. See **[Components](components.md)**.

## Where components come from

`imp` and its subpaths are the framework. They hold the element factories, `component`, the state,
the routing and the theming. See **[Imports](imports.md)**. `imp/std` is the component library,
split by group:

| Import               | What it holds                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `imp/std`            | The base set - `button`, `heading`, `text`, `link`, `icon`                                                              |
| `imp/std/layout`     | The app frame, the two arrangement primitives and the two overlay frames - `shell`, `flex`, `stack`, `dialog`, `drawer` |
| `imp/std/inputs`     | `form` and every control that binds to one - `textField`, `select`, `checkbox`, ...                                     |
| `imp/std/display`    | Components that present content - `card`, `emptyState`, `tag`, `tooltip`, ...                                           |
| `imp/std/navigation` | Getting around the app - `tabs`, ...                                                                                    |
| `imp/std/shell`      | Ready-made contents for the frame's regions - `appLogo`, `breadcrumbs`, `userCard`, ...                                 |
| `imp/std/feedback`   | Telling the user what is happening, and hearing back - `bugReport`, ...                                                 |
| `imp/std/<group>`    | The rest, group by group, as they land                                                                                  |

The split by group keeps one namespace from filling up as the catalog grows. It also makes an import
line say which part of the library a file uses. An import of a group that does not exist yet is an
error, and the message lists the groups that exist. So a spelling mistake never becomes a missing
module that is hard to explain.

A component takes the obvious name, and a few names match an element factory. `button` is a plain
`<button>` from `imp/html`, and it is the styled component from `imp/std`. The two never collide,
because they arrive through different imports. In the rare file that wants both, give one an alias:

```js
import { button } from 'imp/html'
import { button as styledButton } from 'imp/std'
```

## The shared rules

A few conventions hold for every component in the library. So after you use one component, you can
predict the rest.

**imp separates props from children by type, exactly as on an element.** A plain object is props. A
string, an element and another component are content. imp matches an argument by what it is, not by
where it sits. So a call to a component reads the same way as a call to `div()`:

```js
button({ variant: 'danger' }, 'Delete') // props, then content
button('Delete') // content only
```

Pass one props object per call. imp merges a second object, and a later key wins. imp reports the
merge in the console, and the `imp/single-props-object` lint rule catches it statically. See
**[Linting](lint.md)**. So compose the props into a single object before the call.

**A component accepts the documented props only.** A standard component accepts a fixed, documented
set of props. It does not forward whatever you hand it to some inner element. imp logs a prop that
it does not recognize, and a prop with a value outside its allowed list. The log names the accepted
values, and the component uses its default. Your app continues to run.

**A prop that changes takes a state.** A prop that the documentation marks as **live** accepts a
value or a state. With a state, the component subscribes to it and updates that one attribute in
place. Nothing renders again, and imp disturbs nothing that you focused or typed into:

```js
const saving = initState(self, 'billing.saving', false)

button({ variant: 'primary', loading: saving }, 'Save')

saving.set(true) // the button is now busy - no re-render
```

**A component is themed. You do not style it.** Every component reads its colours, its spacing, its
radii and its type from the `--imp-*` design tokens. See **[Theming](theming.md)**. So a new theme
re-skins the whole library at once. Every component also uses CSS logical properties. So it mirrors
correctly when the `dir` of the document is right to left.

**The words of a component are translatable, and imp already wrote them.** Some text belongs to a
component, not to you. Examples are the **No results** of an empty table and the **Cancel** of a
dialog. That text works as the tokens work. The component finds the word under an `imp.` key, and it
ships the English wording as its fallback. So a component reads correctly in an app with no
translation file. The moment when you write one of those keys in your own translations, your wording
takes over, and it localizes again in place when the language changes. See
**[Translations](i18n.md)**.

**Accessibility is the job of the component, not yours.** imp renders the native element wherever
one exists. So the roles, the states and the keyboard behaviour come from the browser. Every pointer
interaction has a keyboard equivalent. Every interactive element carries an accessible name. imp
binds the ARIA state to the same state that drives the visuals, so the two cannot differ. imp
handles the focus ring, the contrast and `prefers-reduced-motion`. An app that you assemble from
these components clears the common bar, and you connect none of it by hand.

**A component has no outer margin.** No standard component adds a margin around itself. Spacing
between two things is the job of whatever lays them out. That keeps the rhythm consistent, and it
avoids a fight with collapsing margins.

## Start an app with the frame

**`shell` is the recommended way to start an app.** It is not one option among several. It gives you
a brand block, a top-level navbar, a nav column, a breadcrumb trail, a content area, and a place for
the signed-in person and the pickers. imp lays all of that out, scrolls each region on its own, and
makes it work on a phone.

```js
import { luChartColumn, luUsers } from 'imp/icons'
import { router } from 'imp/router'
import { shell } from 'imp/std/layout'
import { appLogo, themeSelect, userCard } from 'imp/std/shell'
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
    extras: [
      themeSelect(),
      userCard({ signedIn: session, name: user.name, description: user.email, onSignOut }),
    ],
  },
  router({ map: app, access, screens }),
)
```

The reason to use `shell` is not your convenience. It is the person who uses your app. An imp app
must feel like a place where they have been before, with the nav where a nav goes and the brand
where a brand goes. That happens only when the default shape is the shape that most apps ship.

**The application map drives three surfaces and the trail.** You describe the app once, as a map,
see **[Routing](routing.md)**. The top-level nodes are your **sections**, which are the few
destinations that are always there. The children of a node are what the sidebar shows while that
node is current. So the bar lists the sections, the column lists what is inside the current one, the
trail above the content lists the levels down to the current page, and on a phone the bottom bar
lists the same rows. You declare nothing twice, and a change to the map arrives everywhere at once.
The router in the main content derives all of that from the map and the current URL. The frame only
draws it.

**A section with no children gets no sidebar.** It does not get an empty one. It gets none, and the
content takes the full width. Try it. A move between a section that has a sidebar and a section that
does not is meant to change the layout, because that change is how a person feels the context
change. Never imitate a sidebar with a column that holds one link.

**A param node changes the context.** At `/projects/42/builds`, the sidebar shows what is under the
project, the head of the column names the project, and the crumb for the project opens a picker of
the other projects. That picker keeps the page you are on. So a person moves from the builds of one
project to the builds of another in one click.

**Some things do not belong to a section.** A help link, a support card, an upgrade prompt and a
note about what is new belong to the app. A person expects to find them in the same place, whatever
they look at. The sidebar takes two app-wide slots for them. The `footer` rows are the
settings-and-help pair at the foot of most nav columns. `extras` is a block of your own DOM, below
the rows and above the footer. Both stay in place while the sections change. Both also keep the
column on the screen, in a section that has no children of its own. That column is not false. It
shows the app-wide items. On a phone they are not lost either. The footer rows and the `extras` join
the hamburger drawer, and imp merges the `extras` of the sidebar with the `extras` of the shell. So
the drawer becomes the one place that holds everything that is not the current section.

**Or leave the sections out.** Pass `sidebar` with its own `groups`, and no `navbar`. You then get
the one-level layout: no top bar, the logo at the head of the column, and the extras at its foot. It
is the same component, and the props that you pass are the arrangement:

| What you pass                        | What you get                                             |
| ------------------------------------ | -------------------------------------------------------- |
| `navbar.map` with nested nodes       | A top bar of sections and a column for the current one   |
| `navbar.map` with leaf sections      | A top bar, no column, content full width                 |
| `sidebar` with `groups`, no `navbar` | No bar: the logo heads the column and the extras foot it |
| `navbar.map` with one section        | The same column, and the frame drops the bar on its own  |

A map with one section gets the column layout without a second prop. Put every page of a one-section
app under the index node, `app: { path: '/', dashboard: {}, reports: {} }`. The nav then has one
section with rows, and a bar with one item would offer no choice, so the frame leaves it out.

A frame with no router, such as a preview, passes plain rows instead of a map. A **row** is
`{ id, label, href, icon, tag, onClick }`, and it can hold `children`. The map derives rows of that
shape for you. imp renders children indented under a caret, and collapses them by default. The one
that holds the selected row starts expanded. A parent that you fold stays folded, also when the
selection moves within it, until the selection moves to another parent. On a phone the parents are
the bottom bar. A tap on one opens its children in the **More** sheet, one column anchored right
above the row you tapped. So a column of collapsible groups folds into something that a thumb can
use without a move to the top of the screen. The frame draws the rows itself. It must, because it
draws each level more than once, and it cannot make a second presentation out of markup that you
handed it.

**Icons bind by handle.** `icons: { [app.reports]: luChartColumn }` gives the row of a node its
icon. A value is a Lucide export, or any DOM. The map holds no icon, because the map is data that
runs before a screen exists, and an icon is part of how a screen looks.

**`logo` and `extras` are plain DOM.** So a brand block, a command palette or a pair of pickers is
markup that you already know how to write, and the shell places it without a look inside. The
`extras` block of the sidebar, described above, is the same. Know one thing. The frame puts that DOM
inside its own component tree, where your page stylesheet cannot reach it. Only an inherited text
property and a custom property of the theme cross over. That is deliberate. What goes in a region
must be a component, such as `appLogo`, `themeSelect`, `userCard` or one of your own. A component
brings its own styles with it. So it looks the same in the bar, in the column and in the drawer of a
phone. When you start to write a page rule for something in `extras`, put it in a component instead.

**There is no aside region, and that is deliberate.** The frame exists so that one call makes an app
suit a desktop and a phone at the same time. That is why every region that it owns has a phone form.
The bar folds into a drawer, the sidebar becomes the bottom bar, the trail becomes the title, and
the extras move. A contextual side column has no phone form. On a phone there is no room beside the
content. The frame would have to hide what you put there, or stack it under the page without knowing
what it is. So the shell offers no such region, instead of a region that works on a wide screen
only. The content that would go there has two homes, and both are yours:

- **Content that comes and goes is a `drawer`.** Filters, an inspector and a detail view are
  examples. Mount the drawer in the main content, and open it from a control there. It slides in
  over the frame, from the end of the line. It works the same way on a phone and on a desktop, and
  the frame never moves under it.
- **Content that must stand beside the page goes inside the main content, as your own layout.** Use
  a `flex` of the page and its column, and let a media query in your component decide when the
  column wraps below the page. The `<main>` of the shell is a plain scrolling box. So a page with
  two columns inside it is ordinary CSS. You know what the column holds, so you decide what a phone
  does with it.

```js
shell(
  { navbar: { map: app, icons }, extras },
  flex({ gap: 4 }, router({ map: app, screens }), div({ class: 'aside' }, filters())),
)
```

**The shell is the one component that changes its structure by width.** On a phone it becomes the
shape that a phone app has. The top bar becomes a hamburger and a two-line title, which is the last
two crumbs of the trail. On a phone the frame must tell you where you are. The **sidebar becomes the
bottom bar**, where a thumb can reach it. That is four rows, and then a **More** button that opens a
sheet with the rest. The **sections, the footer rows, the pickers, the `extras` of the sidebar and
the extras of the shell move into the hamburger drawer**. That drawer is a real `<dialog>`. So
Escape, the focus trap and the return of the focus are the job of the browser. When the current
section has no sidebar, the bottom bar carries the sections instead. The trail strip hides, because
the title carries it. imp drops nothing. It folds everything up.

On a desktop the column collapses to an icon rail, from a toggle in its head. In the rail every row
shows its label as a tooltip, when a pointer rests on it, when it takes the focus, and when a finger
holds it. The label stays in the row for a screen reader. That head also names the context that you
are in, which is the section, or the project when a param node is on the path. The toggle is there
only when every row in the column has an `icon`. That means the rows of the section and the footer
rows. A rail of blank rows would show nothing. So a column with a row that has no icon stays open.
When the column collapses, the rail keeps the icons and hides the rest: the logo, the name of the
context, the `extras` of the sidebar, and the extras at the foot.

Two custom properties tune the frame; set them anywhere above it:

| Property                          | Default | What it sizes                                  |
| --------------------------------- | ------- | ---------------------------------------------- |
| `--imp-shell-sidebar-inline-size` | `16rem` | The nav column, and the drawer                 |
| `--imp-shell-bottom-bar-items`    | `4`     | Rows in the phone's bottom bar before **More** |

**The frame has a maximum width, and it is centred beyond it.** A line of text that runs across a
very wide screen is hard to read, and a column that sits at the far left of it is far from the
content. So the column and the content together never get wider than `maxWidth`, which is `125rem`
by default. On a wider screen they sit in the middle, and the background of the frame fills the
rest. The top bar keeps its surface from edge to edge, and it centres its controls over the content.
When the frame floats with a `gap`, the bar is a panel, and that panel is capped in the same way. A
`drawer` that you mount in the content opens at the end edge of the content, not at the edge of the
screen. `maxWidth` takes any CSS length. Pass `'none'` for a frame that always fills the screen,
such as a dashboard of many panels.

```js
shell(
  { logo: brand(), navbar: { map: app, icons }, maxWidth: '90rem' },
  router({ map: app, screens }),
)
```

**The frame can float.** By default the bar, the column and the bottom bar of a phone meet the edges
of the screen, and each other, with hairline dividers. Pass `gap`, which is a step on the same
spacing scale that `flex` and `stack` take. The frame then insets itself by that much, and pulls
those regions apart into bordered panels. It rounds each panel with the `radius-container` of the
theme. That is the only way in which the corner radius of a theme reaches the frame. At `gap: 0` a
rounded corner would sit against the edge of the screen, so imp draws none. A theme with
`radius: none` floats square panels. Your content is not a panel. It sits directly on the
background. So a page that wants a card draws one. The drawer of a phone floats with the rest, inset
by the same gap and rounded in the same way. A `drawer` that you mount inside the frame does the
same. The frame gives it the inset and the radius through custom properties. So a contextual panel
lines up with the column that it slides in beside.

```js
shell({ logo: brand(), navbar: { map: app, icons }, extras, gap: 3 }, router({ map: app, screens }))
```

**What the frame sits on is a theme token.** The shell paints `background-app`. Every built-in theme
sets that token to its `color-surface`, and the token accepts anything that a CSS `background`
accepts: a flat colour, a gradient or an image. Every chrome panel paints `color-surface-sunken`
over it. So the background shows through the gaps, and behind the content. For most apps, a gradient
in a theme is the whole story. For a backdrop that CSS cannot draw, pass `background`. Examples are
shapes that drift on a timer, a canvas and a particle field. `background` is one DOM node that the
shell stretches to the frame, and keeps under everything, including the panels and the drawer. It is
decorative, and imp hides it from assistive technology. So put nothing interactive in it.

```js
// theme.js
tokens: { ...light.tokens, 'background-app': 'linear-gradient(135deg, #dbeafe, #ffffff 60%)' }

// or, for a moving backdrop
shell({ navbar: { map: app }, gap: 3, background: driftingShapes() }, router({ map: app, screens }))
```

**Each chrome panel can carry a backdrop of its own.** `navbar.background` sits under the top bar,
and `sidebar.background` sits under the column. Both take the same kind of node as `background`: one
DOM element that imp stretches to the panel, clips to its corners and hides from assistive
technology. Use them for an image, a texture or an animation that a theme token cannot draw. The
panel still paints `color-surface-sunken` under the node, so a translucent node tints the panel, and
an opaque node replaces it. On a phone the column folds into the drawer, and its backdrop moves with
it. A `drawer` in the main content takes a `background` prop of the same kind.

```js
shell(
  { navbar: { map: app, background: barGlow() }, sidebar: { background: columnImage() } },
  router({ map: app, screens }),
)
```

**Who is signed in is not a prop of the frame.** Put `userCard` in `extras`. It shows a sign-in
button while nobody is signed in, and the person with a sign-out action once somebody is. Whether a
signed-out visitor sees a section is the `access` of the map, see **[Routing](routing.md)**. A
visitor with no session sees only the open nodes, and the frame never learns about the session.

**The trail is chrome.** The shell renders `breadcrumbs` above the main content from the map, and
`breadcrumbs: false` turns it off. So a screen never renders a trail of its own. A crumb for a param
node whose `options` the router binds carries a picker of the sibling values. The trail row is as
tall as the head of the column, so the top edge of your content lines up with the divider under the
logo.

Know two things before you structure an app. First, the fold is a **media query**. So a shell inside
a panel narrower than `48rem`, on a wide screen, keeps its desktop layout. Give a frame the room
that a frame needs. Second, a screen deeper in the tree cannot push markup up into the nav. What
travels upward is **data**, through a state that a binding names. The `options` of a param node,
bound at the router, and the `tags` of the navbar read a state. A screen fills that state on mount,
and clears it on unmount. The rule is this: **the binding names the state. A screen writes it.**

```js
export const app = appMap({
  projects: { $projectId: { builds: {} } },
})

router({ map: app, screens, options: { [app.projects.$projectId]: 'acme.projects' } })

const projectList = component('acme-projects', {
  setup: async (self) => {
    const options = useState(self, 'acme.projects')
    const projects = await useHttpClient(self, 'acme.api').get('/projects')
    options.set(projects.map((project) => ({ value: project.id, label: project.name })))
    return list(projects)
  },
})
```

The crumb of the project then names the project, and its picker lists the others. Nothing in the
frame knows where the list came from.

## The frame comes with its furniture

A frame that only draws boxes is half of a quick win. So `imp/std/shell` ships the pieces that
usually fill those boxes. They are deliberately plain. Each one covers what most apps need, and none
of them is necessary. The `logo` and `extras` regions take DOM. So you replace a piece that does not
fit with your own, and you ask the frame for no permission.

```js
import { shell } from 'imp/std/layout'
import { appLogo, langSelect, themeSelect, userCard } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox, luChartColumn } from 'imp/icons'

shell(
  {
    logo: appLogo({ label: 'Acme', icon: icon(luBox, { size: 'lg' }) }),
    navbar: { label: 'Sections', map: app, icons: { [app.reports]: luChartColumn } },
    sidebar: { label: 'Pages' },
    extras: [
      themeSelect(),
      langSelect({ languages: ['en', 'pl'] }),
      userCard({
        signedIn: session,
        name: user.name,
        description: user.email,
        picture: user.avatar,
        onSignIn: signIn,
        onSignOut: signOut,
      }),
    ],
  },
  router({ map: app, access, screens }),
)
```

| Component     | What it is                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| `appLogo`     | The brand block: a mark, the app name, an optional tagline, linked home                 |
| `breadcrumbs` | The trail of levels, with a picker per crumb; the frame renders it from the map         |
| `userCard`    | Who is signed in, with an optional sign-out button - or a sign-in button when nobody is |
| `themeSelect` | A light / dark / system picker that applies the theme and remembers the choice          |
| `langSelect`  | A language picker that calls `setLang` and remembers the choice                         |

`breadcrumbs` is the exception. Inside `shell` you never call it, because the frame renders the
trail from the map. Call `breadcrumbs` directly when you write your own frame, or on a page that has
no map. A crumb can carry `options`, which gives it a picker: a small button beside the crumb opens
a list of the sibling levels, as the repository crumb on a code host does.

A sidebar row and a navbar row are not a separate component either. They are the nodes of the map,
or the items in the tree that you hand to a frame with no router. There is no separate menu
component, because the frame is where the destinations of an app live. A pill on a row is a `tags`
entry of the navbar, keyed by the handle of the node: `{ text: 'new', color: 'green' }`, or a state
that holds one. imp builds the `tag` component from it. So a count or a status pill needs no markup
of your own. An icon comes from `icons` on the navbar, keyed the same way. Every icon prop in the
library accepts any DOM, so your own `<svg>` goes wherever a Lucide export goes.

The furniture of a page is not frame chrome, and it has no region of its own. A page title and a
toolbar of actions are examples. They go at the top of the main content that you pass as children.
That is where they belong. They change with the screen, and the frame does not.

The mark of `appLogo` is an `icon`, or an image by `src`. A brand often has one image for a light
background and another for a dark one. Give `src` both:
`{ light: '/logo-light.svg', dark:
'/logo-dark.svg' }`. imp shows the one that matches the colour
scheme of the active theme, which it reads from the lightness of the `color-surface` token. It swaps
the image the moment the theme changes. The name of the theme plays no part, and the theme knows
nothing about the logo. One entry alone serves both schemes.

Two of these components hold state that lives longer than the page. `themeSelect` and `langSelect`
remember the choice in `localStorage`. Pass `remember: false` when the app owns that decision.

## Icons are built in, and you pay only for the ones you draw

The whole of **Lucide** ships inside imp. That is 1791 icons, and it is the set behind a good share
of the interfaces that you have used. There is nothing to install, no icon font to load, no sprite
sheet to host, and no CSS file to include.

```js
import { icon } from 'imp/std'
import { luHouse, luStar, luTrash } from 'imp/icons'

icon(luHouse)
icon(luStar, { size: 'lg', color: 'warning' })
icon(luTrash, { size: 'sm', label: 'Delete invoice' })
```

An icon is an **imported name**, not a string. That is the whole design. The export is `lu` plus the
Lucide name in PascalCase. So `house` is `luHouse`, `chart-column` is `luChartColumn`, and `trash-2`
is `luTrash2`. Search the set at <https://lucide.dev/icons>. The name that you read off the page is
the name that you import.

The names, one by one, are what keep the bundle small. Your build carries the drawing data for the
icons that you imported, and nothing else. An app that draws one icon ships a few hundred bytes of
artwork, not the 434 kB of the full set. The cost is one rule. Never write
`import * as icons from 'imp/icons'`, because a namespace import asks for all of it. `imp lint`
holds that line for you. A namespace import, an `export *` re-export and a dynamic `import()` of
`imp/icons` are each an `imp/icons-by-name` error. See **[Linting](lint.md)**.

`size` takes the three steps `'sm'`, `'md'` and `'lg'`, or any CSS length. Every Lucide icon is
square, so one length sets both axes. `color` names a **theme token**, not a CSS colour. The names
are `'primary'`, `'danger'`, `'success'` and any palette hue. So an icon re-skins with the theme,
like everything else in the library. The default is `'current'`. It takes the colour of the text
around it, which is what an icon inside a button, or inside a menu row, needs.

Lucide uses the ISC licence, and the icons that it inherited from Feather use MIT. Both licences ask
you to ship the copyright notice with what you distribute. `imp build` does this. The notice goes
into `LICENSES.txt` in the output directory, and every emitted script points at that file. Deploy
the file with the rest of the build.

## Layout is two components, deliberately

Inside the frame, two components lay a page out. Both are CSS flexbox with the sharp edges removed.
**`flex` is a row.** **`stack` is a column.**

```js
stack(
  { gap: 4 },
  flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Team'), button('Invite')),
  stack({ gap: 2 }, ...members.map((member) => memberRow(member))),
  flex({ horizontalAlign: 'end', gap: 2 }, button('Cancel'), button('Save')),
)
```

That is the whole layout library. There is no grid, no box, and no wrapper with padding, background
and width props. Every arrangement is rows inside stacks inside rows. Two primitives cover the
arrangements that a page really makes, and neither name needs a search.

**When a row and a column cannot express what you want, write the CSS.** A dense form, a dashboard
of cards and a masonry wall are examples. Write `display: grid` in the `styles` of your own
component. There it sits next to the thing that it affects, it is isolated from the rest of the
page, and anybody who knows CSS can read it. imp does not build again a layout system that the
platform already has. It gives the system back to you, instead of wrapping it in props:

```js
component('invoice-grid', {
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
  `,
  setup: () => div({ class: 'grid' }, ...cards()),
})
```

Two rules follow from keeping the surface this small, and they hold across the library:

**Spacing is a `gap`, and it is a step, not a length.** No standard component carries an outer
margin. So the space between two of them is always the `gap` of the parent. That is a step on the
spacing scale of the theme, from `0` to `6`. It is never `'1rem'`. The steps from `3` up are fluid
`clamp()` values that grow with the viewport. See **[Theming](theming.md)**. So one number is the
correct amount of space on a phone and on a desktop.

**Alignment is `start` and `end`, never `left` and `right`.** The horizontal alignment props follow
the reading direction, not the screen. `horizontalAlign: 'start'` is the left edge in English, and
the right edge in Arabic. A row lays its children out from the edge where the language starts. So
the toolbar that you write once, with a title, a spacer and a button, is already correct in both
directions. There is nothing to reverse by hand, and there is no `dir` to branch on. imp sets
`<html dir="rtl">` for a right-to-left language on its own. See **[Internationalization](i18n.md)**.
The layout then follows the attribute, as the text does. `verticalAlign` keeps `top` and `bottom`,
because the direction never mirrors the vertical axis.

The components apply the same rule to themselves. imp styles every one of them in CSS logical
properties, such as `padding-inline`, `margin-block`, `inset-inline-start` and `text-align: start`.
So nothing in the library has a left or a right fixed into it. **Write your own components the same
way.** An imp app then mirrors as a whole, and not in parts.

## Forms are state, not a framework

A form in imp is not a special construct with an API of its own to learn. **Its values are ordinary
imp state.** Each control says which field of that state it owns:

```js
import { form, select, submitButton, textField } from 'imp/std/inputs'

form(
  {
    initialValues: { user: { firstName: 'Ada', email: '' }, plan: 'pro' },
    onSubmit: (values) => save(values),
  },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
  submitButton('Save'),
)
```

That is the whole setup. There is no store to create, no field to register, and no `onChange` to
pass through your code. The form creates its state from `initialValues` when it mounts, and releases
the state when it unmounts. Each control finds the form by its position in the tree. So a control
keeps working, however deep you nest it inside a layout component, or inside one of your own.

**`field` is a dot path** into the values. So a nested shape needs nothing more. The values are a
state. So anything inside the form can read them in the ordinary way. That covers a live summary, a
preview, and a field that depends on another field.

**You declare the validation on the field that it belongs to.** `required`, `minLength`, `min`,
`max` and `pattern` are built in. `validate` takes a function that returns a message.
`validateAsync` returns a promise, for a check that must ask the server. It runs on blur and on
submit, not on every keystroke. So a sign-up does not send a request for each letter typed. An error
appears when it is useful. A field says nothing while a person fills it in for the first time. The
built-in messages are translatable, like everything else that the library says.

**A submit is a button, not a `<form>` submit.** A click on `submitButton()` checks every field
again. When one field fails, `onSubmit` does not run, and the bad fields start to show their
messages. Return a promise from `onSubmit`, and imp waits for it. The button spins, and imp ignores
another click until the promise settles. Enter in a single-line field also submits, because people
expect that.

**A label is a prop, not a wrapper.** Every control renders its own label, its hint and its error
message. A `<label>` finds its input by id, and an id cannot cross a component boundary. So you pass
the label instead of putting it around the control. In exchange, imp connects the label, the hint,
the error and the input correctly every time.

**A control does not need a form.** Give it `value`, which is a state or a plain starting value. It
then binds to that value. This is what a search box that filters a list needs. Use `field` inside a
form, and `value` outside one.

## Overlays are the platform's, not a z-index war

Anything that imp opens over your page is a real `<dialog>`, promoted into the **top layer** of the
browser. That covers a dialog, a drawer and the phone drawer of the shell. An ancestor with
`overflow: hidden` cannot clip it. Nothing paints over it. It needs no z-index from you. There is no
portal to render into, and no stacking context to manage.

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open: editing }, form({ initialValues }, textField({ field: 'name' })))
```

**A tooltip is a popover, anchored.** `tooltip({ text: 'Delete' }, deleteButton)` shows a short
label beside its one child. The label appears when a pointer rests on the control, when the focus
lands on it, and when a finger holds it. A tap still activates the control. The label is a popover
in the top layer, placed with CSS anchor positioning, so it never gets clipped and needs no z-index.
There is no side to choose. imp reads where the control sits when the tooltip opens: near the start
or the end edge of the screen the label appears beside the control, in the upper half it appears
below, and in the lower half above. The browser flips it when that side has no room. The tooltip is
visual. It is hidden from assistive technology, because the control carries its own name, such as
the `label` of an icon-only button. The icon rail of the frame shows one for every row without any
code from you.

```js
import { tooltip } from 'imp/std/display'

tooltip({ text: 'Delete' }, button({ label: 'Delete', events: { click: remove } }, icon(luTrash)))
```

**`open` is the whole API.** Pass a writable state, and set it to open the window. imp sets it back
to `false` when the person closes the window. So the state is always the truth about what is on the
screen. There is no `show()` to call, and no handle to keep.

A modal takes the page over. The rest of the document becomes inert, a backdrop dims it, the focus
moves in and returns where it came from, Escape dismisses the modal, and the page behind it stops
scrolling. Nearly all of that is the modal behaviour of the browser, not of imp. Turn `modal` off,
and you get the other window. Nothing behind it is blocked, the page still scrolls, you can open as
many windows as you want, and the person can drag one by its title bar, or move it with the arrow
keys. Both windows animate themselves, and neither animates for a reader who asked their system for
reduced motion.

**A window opens next to the control that opened it when you name that control.** Pass the control
as `anchor`, and the window opens under it, centred on it. When it does not fit below, it opens
above. It shrinks to the room it has, and its content scrolls. It follows the control when the page
scrolls. Without an anchor, a window opens in the centre of the viewport. On a tall screen, or one
that the person zoomed into, that centre is out of view. So give a window an anchor when a control
opens it.

The anchor must be a box in the same component as the dialog. An imp component renders no box of its
own, so wrap it in a `span` and pass the `span`:

```js
const inspect = span(button({ label: 'Inspect', pressed: inspecting }, icon(luSlidersHorizontal)))
dialog({ title: 'Inspector', modal: false, open: inspecting, anchor: inspect }, details())
```

**A drawer is the same window, docked to the side.** Use it for filters, an inspector, a detail
view, and anything else that belongs beside the page instead of in the middle of it. It slides in
from the end of the line, which is the right edge in English and the left edge under `dir="rtl"`.
There is no prop to select a side. The contextual panel has one place, and a menu from the other
side is the drawer of the frame. The width of a drawer is a custom property,
`--imp-drawer-inline-size`. imp caps it, so a phone keeps a narrow part of the page visible. There
is no separate phone mode, because the same panel on a narrow screen already is one. `modal` and
`open` work exactly as on a dialog. A modal drawer adds `pin`. That is a toggle in its bar, and it
keeps the drawer open when the person clicks outside it. Use it for a panel that they still work in.
While the drawer is pinned, only Escape and the close button close it. A drawer also takes a
`background`. That is one decorative node under its bar and its content, stretched to the panel and
hidden from assistive technology, the same as the backdrops of the frame.

```js
import { drawer } from 'imp/std/layout'

drawer({ title: 'Filters', open: filtering }, form({ initialValues: filters }, ...fields))
drawer(
  { title: 'Filters', open: filtering, pin: true },
  form({ initialValues: filters }, ...fields),
)
drawer({ title: 'Details', modal: false, open: inspecting }, details())
```

A panel that hangs from a control works the same way. Give a button a list of `items`. It then grows
a triple-dot control beside it, and that control opens the items as a menu:

```js
button({
  events: { click: save },
  items: [
    { id: 'draft', label: 'Save as draft', onClick: saveDraft },
    { id: 'template', label: 'Save as template', onClick: saveTemplate },
  ],
}, 'Save')
```

`menuTrigger` selects what opens that menu. The default is `'more'`, which is the triple-dot control
above. Pass `'hover'` when you want a dropdown instead. The button then carries no second control.
It opens the menu itself, when the pointer goes over it, and when it takes the focus:

```js
button({
  menuTrigger: 'hover',
  items: themes.map((name) => ({ id: name, label: name, onClick: () => use(name) })),
}, 'Theme')
```

A hover menu keeps the focus on the button when it opens. So the person can read the list, and still
`Tab` past the button. `ArrowDown` and `ArrowUp` walk into the menu from the button.

The menu is in the top layer as well, so nothing clips it. **The browser places it.** It opens under
the trigger, and lines up with the trailing edge of the trigger. It flips above the button when
there is no room below. It opens the other way when the button sits against the left or the right of
the screen. So a menu is never half off the screen, wherever its control sits. A click away, or the
Escape key, closes the menu and puts the focus back on the trigger. The arrow keys walk the items.
None of that is imp code that follows the button. That is why there is no `placement` prop to get
wrong, and nothing to keep in step while the page scrolls.

The browser can connect a trigger and its panel only when one component renders both. So a menu is
always a prop of the control that it belongs to. It is never a wrapper that you put around one.

## A card is the panel that a page is made of

Most of a dashboard is panels. Each one has a surface, a border, a rounded corner and a small
shadow, and each one takes those from the theme. `card` is that panel, so you never write it. It
takes a `header` and a `footer`, and its children are the body:

```js
import { card, tag } from 'imp/std/display'
import { button, heading, text } from 'imp/std'
import { flex } from 'imp/std/layout'

card(
  {
    header: flex(
      { horizontalAlign: 'justify', verticalAlign: 'center', gap: 2 },
      heading({ level: 2 }, 'Invoices'),
      tag({ size: 'sm' }, count.text()),
    ),
    footer: flex({ horizontalAlign: 'end', gap: 2 }, button({ variant: 'primary' }, 'New invoice')),
  },
  text({ tone: 'secondary' }, 'Three invoices are overdue.'),
)
```

**A card can be a link.** Give it an `href`, and the whole panel becomes one anchor. The router
handles a click on an in-app path, and the browser keeps the middle click and the context menu. A
link card holds content only. A button inside a link is invalid HTML. When the body is a picture or
a chart, give the card a `label`, which is the name a screen reader announces.

**The grid is yours.** A card is a block that fills the height of its cell, so a CSS grid of cards
has even rows with no extra work. The grid itself lives in the styles of your own component, as
every two-dimensional layout does. See
**[Layout is two components](#layout-is-two-components-deliberately)**.

**A card follows the theme.** Its surface is `color-surface`, its border is `color-border` at
`border-width`, its corner is `radius-container` and its lift is `shadow-sm`. A theme that sets the
shadow to `none` and the radius to `0` gets a flat, square card, with no CSS in your app. See
**[Theming](theming.md)**.

## Custom elements next to yours

Each standard component defines its own element the first time when you call it. `button` renders as
`<imp-button>`, and `heading` renders as `<imp-heading>`. Two things follow from that:

- **The `imp-` prefix is reserved.** Name your own components with the prefix of your app, such as
  `my-app-profile`, as usual. Then there is nothing to think about.
- **imp registers nothing until you use it.** A component that you never call defines no element and
  compiles no stylesheet. So an import of a whole group costs you nothing at startup.

The content of a component lives inside its own element. So to read the content from outside, you go
through that boundary. `host.textContent` is empty by design. A test walks the `shadowRoot`. An
end-to-end selector uses the deep combinator. See **[Testing](testing.md)**.

The library does not cover every app. When you build a component that the library lacks, follow the
rules that the standard components follow, so that it reads the theme, mirrors in a right-to-left
script, brings its own words and works from a keyboard. See
**[Custom components](custom-components.md)**.
