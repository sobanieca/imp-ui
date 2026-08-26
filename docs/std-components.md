# imp-ui - Standard components

imp ships a component library in the box, imported from **`imp/std`** - there is no UI package to
add, no CSS file to include, and no build step to configure:

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

Every standard component is a real imp component, so it renders as its own element with its styles
sealed inside it. Nothing you write on the page can leak in and break it, and nothing it defines
leaks out onto your page.

## Where components come from

`imp` and its subpaths are the framework - element factories, `component`, state, routing, theming
(see **[Imports](imports.md)**). `imp/std` is the component library, split by group:

| Import               | What it holds                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/std`            | The base set - `button`, `heading`, `text`, `link`                                                                                                                                            |
| `imp/std/layout`     | The frame - `app`, `navbar`, `sidebar`, `footer` - and the boxes it holds: `page`, `stack`, `grid`, `section`                                                                                 |
| `imp/std/inputs`     | `form` and the controls that bind to it - `textField`, `passwordField`, `searchField`, `textArea`, `numberField`, `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton`, `resetButton` |
| `imp/std/display`    | `emptyState`                                                                                                                                                                                  |
| `imp/std/navigation` | `tabs`, `navMenu`, `commandPalette`                                                                                                                                                           |
| `imp/std/feedback`   | `bugReport`                                                                                                                                                                                   |
| `imp/std/<group>`    | The rest, group by group, as they land                                                                                                                                                        |

Components take the obvious names, and a few of them match an element factory - `button` is both a
plain `<button>` from `imp/html` and the styled component from `imp/std`. They never collide,
because they arrive through different imports. In the rare file that wants both, alias one:

```js
import { button } from 'imp/html'
import { button as styledButton } from 'imp/std'
```

Importing a group that does not exist yet is an error that tells you what does exist, so a typo
never turns into a mysterious missing module.

Every component here also ships a **skill** - the short, mechanical version of this page for one
component: call shape, prop table, and the mistakes it invites. `imp skill std/button` prints it, so
an AI agent writing against the library can check a component before it uses it. Your own components
publish theirs the same way, by putting a `counter.skill.md` file next to the module (see
**[Components](components.md)**).

## The shared rules

A handful of conventions hold for every component in the library, so once you have used one you can
predict the rest.

**Props and children are told apart by type, exactly as on an element.** A plain object is props;
strings, elements and other components are content. Arguments are matched by what they are, not
where they sit, so a component call reads the same way `div()` does:

```js
button({ variant: 'danger' }, 'Delete') // props, then content
button('Delete') // content only
```

One props object per call. A second one is merged with later keys winning, reported in the console,
and caught statically by the `imp/single-props-object` lint rule (see **[Linting](lint.md)**) - so
compose props into a single object before the call.

**Only the documented props.** Standard components accept a fixed, documented set of props rather
than forwarding anything you hand them to some inner element. An unrecognized prop, or a prop set to
a value outside its allowed list, is logged with the accepted values and the component falls back to
its default - your app keeps running.

**Props that change take state.** Props documented as **live** accept a value or a piece of state.
Given state, the component subscribes to it and updates that one attribute in place - nothing is
re-rendered, and nothing you focused or typed into is disturbed:

```js
const saving = initState('billing.saving', false)

button({ variant: 'primary', loading: saving }, 'Save')

saving.set(true) // the button is now busy - no re-render
```

**They are themed, not styled by you.** Every component reads its colors, spacing, radii and type
from the `--imp-*` design tokens (see **[Theming](theming.md)**), so applying a theme re-skins the
whole library at once. They also use CSS logical properties throughout, so they mirror correctly
when the document's `dir` is right-to-left.

**Their words are translatable, and already written.** Text that belongs to a component rather than
to you - an empty table's **No results**, a dialog's **Cancel** - works the way the tokens do: the
component looks the word up under an `imp.` key and ships the English wording as its fallback. So a
component reads properly in an app with no translation files at all, and the moment you write one of
those keys in your own translations your wording takes over, re-localizing in place when the
language changes. See **[Translations](i18n.md)**.

**No outer margins.** No standard component adds margin around itself. Spacing between things is the
job of whatever lays them out, which keeps rhythm consistent instead of fighting collapsing margins.

## `button`

The button. It renders a real `<button>`, so keyboard activation, focus rings and disabled semantics
are the browser's own.

```js
button({ variant: 'primary', size: 'lg', events: { click: save } }, 'Save changes')
```

| Prop       | Values                                                    | Default     |                                                        |
| ---------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | The visual weight and intent                           |
| `size`     | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                                  |
| `disabled` | boolean - **live**                                        | `false`     | Blocks interaction                                     |
| `loading`  | boolean - **live**                                        | `false`     | Shows a spinner, disables the button, sets `aria-busy` |
| `block`    | boolean                                                   | `false`     | Fills the width of its container                       |
| `label`    | a string, or a state holding one                          | -           | The accessible name, when the content is not enough    |
| `events`   | event map                                                 | -           | Handlers, exactly as on any element                    |

`variant: 'link'` is a button that reads as a link. Reach for it when the control performs an
action - opening a panel, starting a flow - and the surrounding text calls for link weight rather
than a filled or outlined button. It stays a real `<button>`, so it is not something a person can
open in a new tab; use `link` for anywhere they can actually go.

**There is no `type` prop, and no submit button.** A button always acts on its `click` handler.
Because the button element lives inside the component, the browser would never associate it with a
form on your page anyway - so imp does not pretend otherwise, and submitting is something you do in
the handler, where an SPA does the work regardless.

`loading` implies disabled, so a request in flight cannot be fired twice:

```js
const sending = initState('contact.sending', false)

const send = async () => {
  sending.set(true)
  try {
    await post('/api/contact', draft)
  } finally {
    sending.set(false)
  }
}

button({ variant: 'primary', loading: sending, events: { click: send } }, 'Send')
```

## `heading`

A section heading, rendered as the real `h1`-`h6` element for the level you ask for - screen readers
and document outlines see the right structure.

```js
heading({ level: 2 }, 'Recent activity')
```

| Prop    | Values                         | Default     |                            |
| ------- | ------------------------------ | ----------- | -------------------------- |
| `level` | `1`-`6`                        | `1`         | The heading level, and tag |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted     |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment             |

Type size follows the level (`level: 1` is the largest), so headings stay in proportion across an
app without anyone picking font sizes by hand.

## `text`

Body text. Renders a paragraph by default, or an inline span when you need styled text inside a
sentence.

```js
text('Everything below is included in your plan.')
text({ tone: 'secondary', size: 'sm' }, 'Prices exclude VAT.')
text({ inline: true, weight: 'bold' }, 'unlimited')
```

| Prop     | Values                           | Default     |                                      |
| -------- | -------------------------------- | ----------- | ------------------------------------ |
| `tone`   | `'default'`, `'secondary'`       | `'default'` | Full-strength or muted text          |
| `size`   | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                            |
| `weight` | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                          |
| `align`  | `'start'`, `'center'`, `'end'`   | `'start'`   | Text alignment                       |
| `inline` | boolean                          | `false`     | Render a `<span>` instead of a `<p>` |

Because content comes after the props, mixing plain and emphasized text reads naturally:

```js
text(
  'You have ',
  text({ inline: true, weight: 'bold' }, '3 days'),
  ' left in your trial.',
)
```

## `link`

A link. It renders a real anchor - the URL shows in the status bar, middle-click and
copy-link-address work - but a plain left-click inside your own app is handled by the router, so
there is no page reload.

```js
link({ href: '/settings' }, 'Settings')
link({ href: 'https://example.com', external: true }, 'Read the docs')
```

| Prop       | Values                           | Default     |                                                     |
| ---------- | -------------------------------- | ----------- | --------------------------------------------------- |
| `href`     | string                           | - required  | Where the link goes                                 |
| `external` | boolean                          | `false`     | Opens in a new tab with `rel="noreferrer noopener"` |
| `tone`     | `'default'`, `'secondary'`       | `'default'` | Link color or muted                                 |
| `size`     | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                                           |
| `weight`   | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                                         |
| `events`   | event map                        | -           | Handlers, exactly as on any element                 |

In-app navigation is handed to the router (see **[Routing](routing.md)**), so `href` is written the
same way you would write it for `navigate()` - a path like `/settings`, without your app's base
path. imp adds that for you. Clicks are left to the browser whenever the user means it: a
middle-click, a modifier-click, an `external` link, or an absolute URL pointing off-site.

A link is a place to go. When the control performs an action instead - opening a panel, starting a
flow - it belongs in a `button`, and `variant: 'link'` gives it link appearance without giving up
what a button is.

## `emptyState` - from `imp/std/display`

The placeholder for a list, table or search result with nothing in it: a line saying so, optional
explanation, and whatever action gets the user out of it.

```js
import { emptyState } from 'imp/std/display'
import { button } from 'imp/std'

emptyState()
emptyState({ variant: 'noResults' })
emptyState(
  { title: 'No invoices', description: 'Invoices appear here once you send one.' },
  button({ variant: 'primary', events: { click: newInvoice } }, 'New invoice'),
)
```

| Prop          | Values                   | Default   |                                               |
| ------------- | ------------------------ | --------- | --------------------------------------------- |
| `variant`     | `'empty'`, `'noResults'` | `'empty'` | Which of the two situations this is           |
| `title`       | string - **live**        | see below | The line saying there is nothing              |
| `description` | string - **live**        | -         | One sentence of explanation; omitted if unset |

Children are the actions, laid out in a centered row under the text.

**It has words already.** Left without a `title`, the component reads its own message key - so it
says something sensible before you have written any translations:

| `variant`     | Key                   | Falls back to    |
| ------------- | --------------------- | ---------------- |
| `'empty'`     | `imp.state.empty`     | Nothing here yet |
| `'noResults'` | `imp.state.noResults` | No results       |

Translate those keys in your own files to put it in your own words and every language you support
(see **[Translations](i18n.md)**), or pass `title` when this one empty state needs to say something
specific. A `title` you pass is text like any other - imp does not translate it for you, so reach
for `computed([lang], () => t('invoices.empty'))` if it needs to follow the language.

## Laying a page out - from `imp/std/layout`

Layout is where a page stops being a list of components and starts being a design, so imp gives it
its own group - and keeps it small. You get five boxes and the four pieces of the page frame. None
of them ask you to write CSS, and most of them need no props at all.

```js
import { button, heading } from 'imp/std'
import { grid, page, stack } from 'imp/std/layout'

page(
  stack(
    stack({ direction: 'row', justify: 'between' }, heading('Invoices'), button('New invoice')),
    grid(...invoiceCards),
  ),
)
```

That example passes two props, and it is already responsive: the page gutter grows with the
viewport, the row wraps when it runs out of room, and the grid fits as many cards as the screen
allows. The next two sections explain why.

### Responsive by default, not by configuration

Most responsive design in imp is not something you write. It is already in the values:

- **Spacing is fluid.** The theme's spacing scale is built from `clamp()`, so a gap or a page gutter
  grows smoothly with the viewport instead of jumping at a fixed width. `padding: 4` is tighter on a
  phone and roomier on a monitor without you saying so.
- **`grid` fits as many columns as the width allows.** With no props at all it reflows from one
  column on a phone to four on a monitor.
- **A `stack` wraps.** A line of controls that runs out of room continues on the next line rather
  than overflowing.

Between them these cover most of what breakpoints used to be for, which is why imp only has two.

### The two stops, for when layout must actually change

Sometimes a layout has to genuinely change shape rather than scale - an axis flips, a region
disappears. For that there are exactly two screen sizes: **`mobile`**, under 48rem, and
**`desktop`**, 48rem and up. Every layout prop takes either one value or one per stop:

```js
stack({ direction: { mobile: 'column', desktop: 'row' } }, filters(), results())
stack({ gap: { mobile: 2, desktop: 5 } }, ...sections)
navbar({ justify: { mobile: 'center', desktop: 'between' } }, brand(), userMenu())
```

A stop you leave out keeps the component's own default, so you only name the case that differs.

That one width is fixed. It is the one measurement in imp a theme cannot change, and the reason is
worth knowing: CSS media queries cannot read a theme variable, so honouring a custom scale would
mean measuring the window in JavaScript and re-laying-out on every resize. imp would rather your
layout be correct in the very first frame the browser paints - and with fluid spacing doing the
continuous work, one stop is enough.

To show something on one stop only, every layout component takes `hideOnMobile` and `hideOnDesktop`:

```js
stack({ hideOnMobile: true }, wideScreenExtras())
button({ hideOnDesktop: true }, 'Menu')
```

Hidden means genuinely gone: it is not read out by a screen reader and not reachable by keyboard
while it is hidden.

### Space comes from the scale

Anywhere a layout component asks for space - `gap`, `padding` - you give it a **step from 0 to 6**,
not a pixel value:

```js
stack({ gap: 4 }, ...rows)
```

Those steps are your theme's spacing scale (see **[Theming](theming.md)**), so spacing stays
consistent across the whole app, scales with the viewport, and changes with the theme instead of
drifting one hand-typed pixel value at a time. Most of the time you can leave `gap` and `padding`
out entirely and take the theme's answer.

### The components

| Component | What it does                                | The props you will reach for                         |
| --------- | ------------------------------------------- | ---------------------------------------------------- |
| `page`    | A padded, centred column at a good measure  | `size`                                               |
| `stack`   | A column, a row, or one that changes shape  | `direction`, `gap`, `align`, `justify`, `wrap`       |
| `grid`    | As many equal columns as fit                | `minItemWidth`, `columns`, `gap`                     |
| `section` | A band of page content with vertical rhythm | `size`, `label`                                      |
| `app`     | The whole page frame - see below            | `maxWidth`, `padding`                                |
| `navbar`  | The bar across the top of the frame         | `label`, `gap`, `justify`, `align`, `wrap`           |
| `sidebar` | A collapsible column beside the page        | `side`, `label`, `width`, `resizable`, `collapsible` |
| `footer`  | The strip along the bottom of the frame     | `label`, `gap`, `justify`, `align`, `wrap`           |

`stack` does all the everyday work. A column, a row, and a column that becomes a row on a wider
screen are the same component with a different `direction`, so there is one thing to learn instead
of three; empty space between children is a `justify` or a `grow` rather than an element you insert;
and a region that scrolls on its own is `stack({ scroll: true })`. Anything more specific than these

- a labelled rule, a media object - is a component of yours, built once and named after what it is.

A card is not a component either, because it does not need to be: it is a `stack` with a background
and a border, which the shared box surface below already gives you.

### One box surface, five components

`page`, `stack`, `grid` and `section` are the same box with different jobs, so they share one set of
props on top of their own. Learn it once and it works everywhere:

| Prop                                                                | Takes                                              |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| `padding`, `paddingX`, `paddingY`                                   | a spacing step `0`-`6`                             |
| `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | a CSS length, e.g. `'20rem'`                       |
| `radius`                                                            | `'none'`, `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` |
| `shadow`                                                            | `'none'`, `'sm'`, `'md'`, `'lg'`                   |
| `background`                                                        | `'none'`, `'surface'`, `'sunken'`                  |
| `border`                                                            | `true` / `false`                                   |
| `ratio`                                                             | an aspect ratio, e.g. `'16/9'`                     |
| `grow`, `scroll`, `hideOnMobile`, `hideOnDesktop`                   | as described above                                 |

```js
stack({ padding: 4, background: 'surface', border: true, radius: 'lg', shadow: 'sm' }, ...summary)
```

That is a panel: theme background, theme border, theme corner rounding, theme shadow - four steps,
no colours and no pixel values. `radius` and `shadow` read the scales your theme sets (see
**[Theming](theming.md)**), so a rounder or flatter theme changes every box at once.

Two things the surface deliberately leaves out. There are **no margin props**: the space between
siblings belongs to their parent's `gap`, so a component never pushes on the space around it and two
layouts can never fight over the same margin. And there are **no positioning props** - a layout
component places its children in flow, and anything that has to escape the flow is a component of
yours with its own styles.

`page` and `section` are the two named shapes that come up on every page. A page caps its content at
a themed width (`sm` 40rem through `xl` 80rem, or `full` for none) and centres what is left over, so
a paragraph never runs the full width of a monitor, and it pads itself from the theme so text never
sits flush against a phone's screen edge. A section is a band of page with block padding from the
spacing scale, and it renders a real `<section>` element - give it a `label` matching its heading
and a screen reader can jump straight to it:

```js
page({ size: 'md' }, section({ label: 'Pricing' }, heading('Pricing'), plans()))
```

`grid` deserves a note: it fits as many columns as the width allows by default. `minItemWidth` sets
the narrowest a card should ever get, and `columns` is a **count** of equal columns for the rarer
case where the number has to be exact:

```js
grid({ minItemWidth: '18rem' }, ...cards)
```

### Letting one child take the leftover room

`gap` handles the space between children, and `justify`/`align` handle the group as a whole. When
**one** child should absorb what is left over, give that child `grow`:

```js
stack({ direction: 'row' }, stack({ grow: true }, searchField()), button('Search'))
```

`grow` is a prop of the box that grows, not of the parent, and that is a consequence of how imp
components work rather than a preference: a component seals its own styling, so a parent genuinely
cannot reach inside `searchField` to stretch it. Every layout box carries `grow` itself; wrap
anything else in a `stack` when it needs to grow. Everything else lays out correctly with no wrapper
at all.

### The page frame: `app`

Almost every application has the same outline - a bar across the top, navigation down one side, the
page in the middle, something along the bottom. `app` is that outline. You do not describe it with
props: you pass the regions as children and `app` sorts them by what they are.

```js
import { app, flex, footer, navbar, sidebar } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'

app(
  { maxWidth: 'lg' },
  navbar({ label: 'Workspace', justify: 'between' }, brand(), accountMenu()),
  sidebar({ side: 'left', label: 'Sections' }, navMenu({ label: 'Sections', items: sections })),
  sidebar({ side: 'right', label: 'Activity', width: 'sm' }, activityFeed()),
  footer({ label: 'Session' }, text({ size: 'sm', tone: 'secondary' }, 'Signed in as ada')),
  invoicesPage(),
)
```

Every `navbar` goes on top, every `sidebar` down the edge it names, every `footer` at the bottom,
and **everything left over is the main content**. Order between them does not matter, so you can
write the frame in whatever order reads best. Only sidebars on the same side care: they stack in the
order you write them, outward from the page.

| Prop       | Values                                   | Default  |                                     |
| ---------- | ---------------------------------------- | -------- | ----------------------------------- |
| `maxWidth` | `'sm'`, `'md'`, `'lg'`, `'xl'`, `'full'` | `'full'` | Caps the main region and centres it |
| `padding`  | spacing step `0`-`6`                     | `4`      | The inset around the main region    |

It is a **viewport frame**: it fills the window, the navbar and footer hold their place, and only
the main region scrolls. That is what makes a long page feel like an application rather than a
document - your navigation does not scroll away. Put it at the top of the page and give it nothing
to sit inside.

`maxWidth` caps the **content**, not the chrome. The navbar, the sidebars and the footer stay
full-bleed against the window edges while the page itself settles into a centred column of readable
width - which is what you want on a wide monitor, and it costs one prop.

### Sidebars, and what happens on a phone

A sidebar is a region and a control in one. It renders as a `complementary` landmark, and unless you
turn it off with `collapsible: false` it draws its own toggle: pressing it collapses the sidebar to
a narrow rail with the toggle still on it, and pressing it again slides the panel back open. The
width animates, and it does not animate at all for someone who has asked their system for reduced
motion.

| Prop          | Values              | Default  |                                                     |
| ------------- | ------------------- | -------- | --------------------------------------------------- |
| `side`        | `'left'`, `'right'` | `'left'` | Follows the reading direction, so it mirrors in RTL |
| `label`       | string - **live**   | -        | Names the landmark and its toggle - always pass it  |
| `width`       | scale keyword       | `'md'`   | From your theme's `--imp-sidebar-*` tokens          |
| `resizable`   | boolean             | `false`  | Lets the reader drag the sidebar wider or narrower  |
| `minWidth`    | scale keyword       | `'xs'`   | How narrow a drag may take it                       |
| `maxWidth`    | scale keyword       | `'xl'`   | How wide a drag may take it                         |
| `collapsible` | boolean             | `true`   | `false` drops the rail, but never the drawer tab    |
| `collapsed`   | boolean - **live**  | `false`  | The starting state on a wide screen                 |

A scale keyword is one of `'xs'`, `'sm'`, `'md'`, `'lg'` and `'xl'` - the five steps of your theme's
sidebar scale, 10rem to 24rem until you retune them.

The part worth not writing yourself is the phone. Below 48rem every sidebar leaves the flow: it
collapses to a small tab pinned to its own edge of the screen, and tapping that tab slides the panel
over the page behind a backdrop, moves focus into it, and takes the rest of the page out of the
accessibility tree so a screen reader cannot wander behind the overlay. `Escape`, the backdrop, and
choosing anything inside it all close it again and hand focus back to the tab.

`collapsible: false` says the sidebar is not a column you can roll up - it takes the toggle off the
wide-screen layout - and that is all it says. On a narrow screen the sidebar is still a drawer and
still keeps its tab, because a region with no way to open it is a region nobody can read.

This is also the answer to the question a second sidebar raises. Two sidebars will not fit beside a
phone screen, so on a narrow screen they do not try: each keeps its own tab, the tabs stack down
their edge in the order you wrote them, and opening one closes any other that is open. One panel is
over the page at a time, whichever side it came from, and the page behind it is never half-covered
by two. None of this is a prop you set - it is what a sidebar is - so do not add a menu button, a
`hideOnMobile`, or a breakpoint of your own on top of it.

### Letting the reader choose the width

`resizable: true` puts a drag handle down the edge of the sidebar that faces the page, and the
reader takes it from there - with the mouse, with a finger on a touch screen, or with a pen. It is
the same handle in each case, so there is nothing to enable for touch.

```js
sidebar(
  { side: 'left', label: 'Sections', resizable: true, minWidth: 'xs', maxWidth: 'lg' },
  navMenu({ label: 'Sections', items: sections }),
)
```

The drag never leaves the range you gave it, and the range is the same keyword scale as `width`, so
a resizable sidebar cannot be dragged into a shape your theme did not plan for. Whoever cannot use a
pointer gets the same control: the handle is in the tab order, the arrow keys move it a step at a
time, `Home` and `End` take it to the ends of the range, and a screen reader announces it as a
splitter along with the width it is at. A double click puts the sidebar back to the `width` you
declared.

The width a reader drags to sticks for as long as the page is open, including across collapsing and
reopening the sidebar. The handle itself is only there while there is something to drag: it goes
away while the sidebar is collapsed to its rail, and on a narrow screen, where the sidebar is a
drawer rather than a column.

Each region renders as its landmark - `<header>`, `<aside>`, `<main>`, `<footer>` - so a screen
reader user can jump straight to the page content, and you should not wrap what you pass in another
one.

`footer` here is the app region; `imp/html` exports a `footer` element factory too. They never
collide because they arrive through different imports, but a file that wants both should alias one.

## Forms - from `imp/std/inputs`

A form in imp is not a special construct with its own API to learn. **Its values are ordinary imp
state**, and each control says which field of that state it owns:

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

That is the whole setup. There is no store to create, no field to register, no `onChange` to thread
through. The form creates its state from `initialValues` when it mounts and disposes it when it
unmounts, and each control finds the form by its position in the tree - so it keeps working however
deeply you nest it inside layout components or your own.

### Fields are addressed by path

`field: 'user.firstName'` is a **dot path** into the form's values. A control reads its value by
following the path and writes by rebuilding the object along it, leaving every other branch alone.
Nested shapes need nothing extra:

```js
form(
  { initialValues: { address: { city: 'Kraków', postcode: '30-001' } } },
  textField({ field: 'address.city', label: 'City' }),
  textField({ field: 'address.postcode', label: 'Postcode' }),
)
```

Because the values are just state, anything inside the form can read them the ordinary way - a live
summary, a preview, or a field that depends on another:

```js
const values = useState('imp.form')

text(values.text((current) => `Billing ${current.plan} to ${current.user.email}`))
```

### Validation

Validation is declared on the field it belongs to. `required`, `minLength`, `maxLength`, `min`,
`max` and `pattern` are built in, and `validate` takes a function returning a message - or `null`
when the value is fine:

```js
textField({ field: 'user.email', label: 'Email', required: true, pattern: /.+@.+\..+/ })
numberField({ field: 'quantity', label: 'Quantity', min: 1, max: 99 })
textField({
  field: 'username',
  label: 'Username',
  validate: (value) => value?.includes(' ') ? 'No spaces, please' : null,
})
```

**A check that has to ask the server** goes in `validateAsync`, which returns a promise:

```js
textField({
  field: 'username',
  label: 'Username',
  validateAsync: async (value) => await isTaken(value) ? 'That name is taken' : null,
})
```

It runs on **blur and on submit**, never on every keystroke, so signing up does not fire a request
per letter typed. While it is in flight the field is marked busy; if a submit is waiting on it, the
submit button spins until every check has come back. A check that fails outright - the server is
down - blocks the submit with a "could not check this" message rather than letting the value
through. A synchronous rule that already failed skips the round trip entirely.

The built-in messages are translatable like everything else the library says - they live under
`imp.form.*` keys (see **[Translations](i18n.md)**), so you translate the key rather than passing
wording to every field.

**Errors appear when they are useful, not before.** A field says nothing while it is being filled in
for the first time; its message appears once the field has been left, or once submit has been
attempted. You do not have to manage that - there is no "show errors" flag to keep.

### Submitting

`submitButton()` is the submit action. It can sit anywhere inside the form:

```js
stack({ direction: 'row', gap: 2 }, submitButton('Save changes'), resetButton('Start over'))
```

Clicking it re-checks every field. If anything fails, `onSubmit` never runs and the bad fields start
showing their messages. If everything passes, `onSubmit` gets the values object.

**Pressing Enter in a single-line field submits too** - imp implements that itself, so a one-field
form behaves the way people expect. Enter in a `textArea` inserts a newline, as it should.

If `onSubmit` returns a promise, imp waits for it: the submit button shows a spinner and further
clicks are ignored until it settles.

```js
form({ initialValues: { email: '' }, onSubmit: async (values) => await post('/signup', values) }, …)
```

`resetButton()` puts `initialValues` back and clears the errors with them.

### The controls

| Control         | Holds                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| `textField`     | A line of text - `type` picks the keyboard: `'text'`, `'email'`, `'tel'`, `'url'` |
| `passwordField` | A masked line of text                                                             |
| `searchField`   | A search term                                                                     |
| `textArea`      | Several lines of text                                                             |
| `numberField`   | A **number** - never a string                                                     |
| `select`        | One value out of `options`                                                        |
| `radioGroup`    | One value out of `options`, all visible at once                                   |
| `checkbox`      | A boolean                                                                         |
| `toggle`        | A boolean, drawn as a switch                                                      |

`select` and `radioGroup` take their choices as an `options` array - plain strings, or
`{ value, label }` objects when the two differ.

### Labels come from the control

Every control renders its own label, hint and error message:

```js
textField({ field: 'email', label: 'Email', help: 'We never share it', required: true })
```

This is worth knowing rather than fighting: a `<label>` finds its input by id, and an id cannot
reach across a component boundary. So the label is a **prop**, not something you wrap around the
control - and in exchange the label, the hint, the error and the input are wired to each other
correctly every time, with `aria-describedby` and `aria-invalid` kept in step with what is on
screen. Where a control has no visible label, name it with `ariaLabel`.

### Controls outside a form

A control does not need a form. Give it `value` - a state, or a plain starting value - and it binds
to that instead, which is what you want for a search box filtering a list:

```js
const query = initState('invoices.query', '')

searchField({ value: query, ariaLabel: 'Search invoices', placeholder: 'Search…' })
```

Use `field` inside a form and `value` outside one; passing both is a mistake imp reports.

## `tabs` - from `imp/std/navigation`

One strip of tabs over a set of panels. You describe the tabs as data and imp renders both halves -
the strip and the panels - wired to each other:

```js
import { tabs } from 'imp/std/navigation'

tabs({
  label: 'Account sections',
  items: [
    { id: 'overview', label: 'Overview', content: overviewPanel() },
    { id: 'usage', label: 'Usage', content: usagePanel() },
    { id: 'billing', label: 'Billing', content: billingPanel() },
  ],
})
```

| Prop          | Values                                      | Default            |                                           |
| ------------- | ------------------------------------------- | ------------------ | ----------------------------------------- |
| `items`       | array of `{ id, label, content, disabled }` | `[]`               | The tabs and their panels                 |
| `selected`    | an item's `id` - **live**                   | first enabled item | Which panel is showing                    |
| `orientation` | `'horizontal'`, `'vertical'`                | `'horizontal'`     | Vertical puts the strip beside the panels |
| `label`       | string - **live**                           | -                  | Names the strip for a screen reader       |
| `events`      | `{ select }`                                | -                  | Fires with `detail: { id, index }`        |

**Why the panels are data rather than children.** A tab and its panel point at each other by id -
`aria-controls` one way, `aria-labelledby` the other - and an id reference cannot cross a shadow
boundary. If you passed the panels as children of one component and the tabs as children of another,
those references would silently resolve to nothing and a screen reader would announce a tab that
controls nothing. Keeping both halves inside one component is what makes the wiring real, so the API
takes one `items` array.

The keyboard behaviour comes with it: arrow keys move along the strip (mirrored automatically under
`dir="rtl"`), `Home` and `End` jump to the ends, disabled items are skipped, and selection follows
focus. Exactly one tab is in the tab order at a time, so `Tab` takes you past the strip into the
panel rather than through every tab.

Left alone, `tabs` remembers its own selection. Pass `selected` to open on a particular panel, and
pass a **state** when the selection is something your app owns - a route, say:

```js
const openTab = initState('settings.tab', 'profile')

tabs({
  label: 'Settings',
  selected: openTab,
  items: [
    { id: 'profile', label: 'Profile', content: profileForm() },
    { id: 'security', label: 'Security', content: securityForm() },
  ],
  events: { select: (event) => openTab.set(event.detail.id) },
})
```

That pair cannot loop: `select` fires only for a choice the user made, never for a change your state
drove. Every panel is built at mount and hidden when it is not showing, so whatever is inside one -
a half-filled form, a scroll position - is still there when you come back to it.

## `navMenu` - from `imp/std/navigation`

A list of places in your app, with the one you are on marked. Like `tabs`, it is data rather than
children:

```js
import { navMenu } from 'imp/std/navigation'

navMenu({
  label: 'Sections',
  selected: currentSection,
  groups: [{ id: 'work', label: 'Work' }, { id: 'admin', label: 'Admin' }],
  items: [
    { id: 'reports', group: 'work', label: 'Reports', href: '/reports', badge: 4 },
    { id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks' },
    { id: 'billing', group: 'admin', label: 'Billing', href: '/billing' },
  ],
})
```

| Prop        | Values                                   | Default    |                                            |
| ----------- | ---------------------------------------- | ---------- | ------------------------------------------ |
| `items`     | array of `{ id, label, href, … }` - live | `[]`       | The destinations                           |
| `groups`    | array of `{ id, label, badge }`          | derived    | Orders and names the sections              |
| `selected`  | an item's `id` - **live**                | none       | The page you are on                        |
| `label`     | string - **live**                        | -          | Names the navigation for a screen reader   |
| `direction` | `'column'`, `'row'` - **responsive**     | `'column'` | `column` for a sidebar, `row` for a navbar |
| `gap`       | spacing step `0`-`6` - **responsive**    | `1`        | Between items and groups                   |

The current item is marked with `aria-current="page"` - the thing a screen reader actually announces
as "current page" - and the styling follows from it, so the highlight and the announcement can never
disagree. Bind `selected` to the state your router already drives and the menu keeps itself right.

Items are real links. Middle-click and ⌘-click open them in a new tab, and a plain click is reported
as a `select` event before the link is followed, so an app doing its own routing can call
`event.preventDefault()` and take over. There is no keyboard behaviour to learn because there is
none to add: `Tab` and `Enter` are what links already do, and a roving-focus menu would take those
links out of the tab order in exchange for nothing.

The same component is your navigation bar with `direction: 'row'`. Put the column one in a `sidebar`
and a row one straight in the `navbar`, and one list of destinations serves both.

## `commandPalette` - from `imp/std/navigation`

A search field that filters a list as you type and opens what you pick. It is what you reach for
when your app has more places than fit in a menu:

```js
import { commandPalette } from 'imp/std/navigation'

commandPalette({
  label: 'Search',
  placeholder: 'Search components by name or category…',
  shortcut: 'ctrl+p',
  items: components.map((entry) => ({
    id: entry.id,
    group: entry.category,
    label: entry.name,
    href: entry.href,
  })),
})
```

| Prop           | Values                                    | Default        |                                    |
| -------------- | ----------------------------------------- | -------------- | ---------------------------------- |
| `items`        | array of `{ id, label, group, … }` - live | `[]`           | Everything that can be found       |
| `label`        | string - **live**                         | `'Search'`     | Names the field and the results    |
| `placeholder`  | string - **live**                         | `'Search'`     | The ghost text in the empty field  |
| `shortcut`     | `'ctrl+p'`, `'ctrl+k'`, …                 | -              | Focuses the field from anywhere    |
| `limit`        | whole number                              | `50`           | How many matches are shown at once |
| `emptyMessage` | string                                    | `'No matches'` | When nothing matches               |

**An item's `group` is part of what you search.** A match runs against `group/label`, so typing
`inp` finds everything in the `inputs` group and `tf` finds `text_field` - the matching is fuzzy,
the characters it matched are highlighted in the result, and a match on the name outranks one on the
group. That is the whole reason to give your items a group: it turns a category into something a
person can type.

`shortcut` is one key with optional modifiers, written lowercase and joined with `+`. Write `ctrl`
and it matches **Ctrl and ⌘**, so the same spelling is right on every platform; the hint rendered at
the end of the field follows suit, showing `Ctrl P` or `⌘P`. The binding is taken on the page, ahead
of the browser's own, so `Ctrl P` opens your palette rather than the print dialog.

Everything else is the combobox pattern, done properly and not by you: the field is a `combobox`
over a `listbox`, the highlighted result is announced through `aria-activedescendant`, the number of
matches goes out through a live region on every keystroke, Up and Down move through the matches and
wrap, `Enter` opens the highlighted one, and `Escape` clears the query before it closes the list.
Those wires are ids pointing at each other, which cannot cross a component boundary - the reason
this is one component rather than a field you compose with a list of your own.

An item with an `href` is followed when it is picked. Anything else - running a command, opening a
dialog - is a `select` handler:

```js
commandPalette({
  label: 'Run a command',
  shortcut: 'ctrl+k',
  items: commands.map(({ id, name, section }) => ({ id, label: name, group: section })),
  events: { select: (event) => run(event.detail.id) },
})
```

## `bugReport` - from `imp/std/feedback`

Ships a "something is wrong here" trigger inside your app. The person using it presses the trigger,
clicks the element the problem is about, and types a comment - and you get one plain object
describing what they were looking at.

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

| Prop       | Values                           | Default     | What it does                                           |
| ---------- | -------------------------------- | ----------- | ------------------------------------------------------ |
| `onSubmit` | a function taking the report     | -           | Where the report goes. May be async and may reject     |
| `as`       | `'button'`, `'link'`             | `'button'`  | How the trigger looks - both are a real button         |
| `variant`  | any `button` variant             | `'default'` | The trigger's look, passed to `button`                 |
| `size`     | `'sm'`, `'md'`, `'lg'`           | `'md'`      | The trigger's size                                     |
| `label`    | a string, or a state holding one | -           | The trigger's text; with children, its accessible name |
| `events`   | any DOM events                   | -           | Bound on the component                                 |

**imp does not store the report.** There is no endpoint to configure, no queue and no local
fallback: `onSubmit` is the whole storage story, so a report can go to your API, an issue tracker,
`localStorage`, or nowhere at all. It may return a promise - the panel disables its buttons while it
is pending, closes when it resolves, and shows a retryable message when it rejects, keeping what was
typed.

The report is plain JSON-safe data, captured the moment the element was picked rather than when the
comment was finished - so it describes the screen being complained about even if the app has moved
on since:

```js
{
  comment: 'The save button does nothing.',
  time: '2026-08-25T12:10:36.682Z',
  page: 'https://acme.test/settings',
  title: 'Settings - Acme',
  viewport: '1440x900',
  scroll: '0,1240',
  scheme: 'dark',
  motion: '',
  lang: 'en',
  dir: 'ltr',
  element: {
    path: 'body > div#app > acme-settings >> form.panel > button.save',
    rect: '96x36 at 512,604',
    text: 'Save changes',
    html: '<button class="save" type="submit" disabled="">Save changes</button>',
  },
  state: [{ name: 'settings.profile', value: { name: 'Ada' } }],
  controls: [{ name: 'input[name=name]', value: 'Ada', disabled: false, readOnly: false }],
}
```

Three of those fields are what make a vague report actionable. `element.path` names the node,
crossing into a component with `>>` so the component before the last one owns it. `state` is every
named state in scope at that element, as plain data - close enough to a snapshot that you can put
the values back and be looking at the same screen. `controls` is what was actually typed into the
form the element sits in, which the markup does not carry; a password field records only its length,
never its value.

The rest is the context that usually goes unreported: the viewport and device pixel ratio, the
scroll position, the colour scheme, whether reduced motion was on, and the page language and
direction. "Only when narrow" and "only in dark mode" stop being something anybody has to remember
to mention.

**Whoever reports the problem never sees the element path.** Picking is visual on both ends: the
element under the pointer is outlined, a click takes it (`Enter` takes the outlined one, `Escape`
cancels), and it stays outlined while the comment is typed. Nothing about the DOM is put in front of
a person who should not have to look at one.

The wording is translatable like every other standard component, under `imp.bugReport.*` keys (see
**[Translations](i18n.md)**), so a `label` prop is for changing the words in one place rather than
for translating them.

**One privacy note.** `state` and `controls` carry whatever your app put there, and imp sends none
of it anywhere by itself. Strip what should not leave the browser inside `onSubmit`, before you send
it.

## Custom elements next to yours

Each standard component defines its own element the first time you call it - `button` renders as
`<imp-button>`, `heading` as `<imp-heading>`, and so on. Two things follow from that:

- **The `imp-` prefix is reserved.** Name your own components with your app's prefix
  (`my-app-profile`) as usual and there is nothing to think about.
- **Nothing is registered until it is used.** A component you never call never defines an element
  and never compiles its stylesheet, so importing a whole group costs you nothing at startup.

Because a component's content lives inside its own element, reading it from the outside means
piercing that boundary - `host.textContent` is empty by design. Tests walk `shadowRoot`, and
end-to-end selectors use the deep combinator (see **[Testing](testing.md)**).
