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

This page is the argument for the library - what holds across all of it, and the few pieces worth
knowing before you start. It is not the catalog.

## Browse the components

**The catalog lives in the [component gallery](/components).** Every component is there rendered as
itself, in light and dark, with its props, its variants and the code that produced each specimen -
pick one, look at it, copy the call.

That page is not written by hand: it is `imp preview`, the same gallery the CLI serves for your own
components while you build them (see **[CLI](cli.md)**). So the reference you read is generated from
the components themselves and cannot drift from them, and the tool you use to browse imp's library
is the tool you already use to browse your own.

An AI agent has a second door onto the same information: every component ships a **skill**, the
short mechanical version - call shape, prop table, and the mistakes the component invites.
`imp skill std/button` prints it. Your own components publish theirs the same way, by putting a
`counter.skill.md` file next to the module (see **[Components](components.md)**).

## Where components come from

`imp` and its subpaths are the framework - element factories, `component`, state, routing, theming
(see **[Imports](imports.md)**). `imp/std` is the component library, split by group:

| Import               | What it holds                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `imp/std`            | The base set - `button`, `heading`, `text`, `link`, `icon`                                 |
| `imp/std/layout`     | The app frame and the two arrangement primitives - `shell`, `flex`, `stack`, plus `dialog` |
| `imp/std/inputs`     | `form` and every control that binds to one - `textField`, `select`, `checkbox`, ...        |
| `imp/std/display`    | Components that present content - `emptyState`, `tag`, ...                                 |
| `imp/std/navigation` | Getting around the app - `tabs`, `navMenu`, ...                                            |
| `imp/std/shell`      | Ready-made contents for the frame's regions - `appLogo`, `breadcrumbs`, `userCard`, ...    |
| `imp/std/feedback`   | Telling the user what is happening, and hearing back - `bugReport`, ...                    |
| `imp/std/<group>`    | The rest, group by group, as they land                                                     |

Splitting by group keeps one namespace from flooding as the catalog grows, and makes an import line
say which part of the library a file leans on. Importing a group that does not exist yet is an error
that tells you what does exist, so a typo never turns into a mysterious missing module.

Components take the obvious names, and a few of them match an element factory - `button` is both a
plain `<button>` from `imp/html` and the styled component from `imp/std`. They never collide,
because they arrive through different imports. In the rare file that wants both, alias one:

```js
import { button } from 'imp/html'
import { button as styledButton } from 'imp/std'
```

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

**Accessibility is the component's job, not yours.** The native element is rendered wherever one
exists, so roles, states and keyboard behaviour come from the browser. Every pointer interaction has
a keyboard equivalent, every interactive element carries an accessible name, ARIA state is bound to
the same state that drives the visuals so the two cannot drift, and the focus ring, the contrast and
`prefers-reduced-motion` are handled. An app assembled from these components clears the common bar
without wiring any of it by hand.

**No outer margins.** No standard component adds margin around itself. Spacing between things is the
job of whatever lays them out, which keeps rhythm consistent instead of fighting collapsing margins.

## Start an app with the frame

**`shell` is the recommended way to start an app**, not one option among several: a header, a nav
column, a content area and whatever else the page needs, already laid out, already scrolling each
region on its own, and already working on a phone.

```js
import { shell } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'

shell(
  {
    header: flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, logo(), userMenu()),
    sidebar: navMenu({ label: 'Sections', items: sections, selected: current }),
  },
  router({ routes }),
)
```

The reason to use it is not your convenience, it is the person using your app: an imp app should
feel like somewhere they have been before, with the nav where the nav goes and the header where the
header goes. That only happens if the default shape is the one most apps actually ship.

Three things about it are worth knowing before you design around it:

**There is no `layout` prop with five named variants to learn.** The regions you pass, plus where
the header starts, are the layout. A rail with an aside and a bottom bar is a valid combination
nobody had to think of in advance, which is the point of not shipping the list as a prop.

**Every region takes DOM, not data**, so the shell never has to grow a prop for what you want to put
in one. A command palette in the header, a tenant switcher above the nav, a pair of preference
checkboxes below it - all of them are DOM you already know how to write.

**It is the one component that changes its structure by width.** Below `48rem` the rail and the
aside collapse and the sidebar becomes a modal drawer, opened from a button the shell adds to the
header - a real `<dialog>`, so Escape, the focus trap and returning focus are the browser's job.
Pass a `bottomNav` instead and there is no drawer at all; a bottom bar is the whole phone
navigation.

One consequence to know before you structure an app: the shell never looks inside a region, so a
screen deeper in the tree cannot push DOM up into the sidebar. What travels upward is **data** -
keep a nav-items state next to the shell, have each screen contribute its rows on mount and withdraw
them on unmount, and bind that state into the menu. The rule of thumb: **you at the call site, DOM;
a screen at runtime, data.**

## The frame comes with its furniture

A frame that only draws boxes is half a quick win, so `imp/std/shell` ships the pieces those boxes
are usually filled with. They are deliberately plain: each one covers what most apps need, and none
of them is required - a region takes DOM, so a piece that does not fit is replaced by your own
without asking the frame's permission.

```js
import { shell } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'
import { appLogo, authButton, breadcrumbs, langSelect, themeSelect, userCard } from 'imp/std/shell'
import { icon } from 'imp/std'
import { flex, stack } from 'imp/std/layout'

shell(
  {
    header: flex(
      { horizontalAlign: 'justify', verticalAlign: 'center' },
      breadcrumbs({ items: trail }),
      flex(
        { verticalAlign: 'center' },
        themeSelect(),
        langSelect({ languages: ['en', 'pl'] }),
        userCard({ name: user.name, description: user.email, picture: user.avatar }),
        authButton({ signedIn: session, onSignOut: signOut }),
      ),
    ),
    sidebar: stack(
      { gap: 4 },
      appLogo({ label: 'Acme', icon: icon({ name: 'box', size: 'lg' }) }),
      navMenu({
        label: 'Sections',
        selected: current,
        items: [
          { id: 'overview', label: 'Overview', href: '/', icon: icon({ name: 'home' }) },
          {
            id: 'orders',
            label: 'Orders',
            href: '/orders',
            icon: icon({ name: 'box' }),
            tag: { text: 4 },
          },
        ],
      }),
    ),
  },
  router({ routes }),
)
```

| Component     | What it is                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| `appLogo`     | The brand block: a mark, the app name, an optional tagline, linked home        |
| `breadcrumbs` | The trail above the main region, as plain data; the last crumb is the page     |
| `userCard`    | Who is signed in: picture or initials, display name, and one line under it     |
| `authButton`  | One button that signs in or out, following a `signedIn` state                  |
| `themeSelect` | A light / dark / system picker that applies the theme and remembers the choice |
| `langSelect`  | A language picker that calls `setLang` and remembers the choice                |

Sidebar and navbar rows are not a separate component: they are **`navMenu`**, whose items now take
an `icon`, an `onClick` and a `tag`, so the same data renders a sidebar (`direction: 'column'`), a
top or bottom bar (`direction: 'row'`) and an icon rail. A row's `tag` is plain data -
`tag: { text: 'new', color: 'green' }` - and the menu builds the `tag` component from it, so a count
or a status pill needs no markup of your own; a group takes the same key. Icons come from `icon` in
the base group, a small fixed set of line glyphs drawn in the current text color - and every
icon-taking prop in the library accepts any DOM, so your own `<svg>` goes wherever `icon()` does.

Two of these components hold state that outlives the page: `themeSelect` and `langSelect` remember
what was chosen in `localStorage`. Pass `remember: false` when the app owns that decision instead.

## Layout is two components, deliberately

Inside the frame, two components lay a page out, and they are both CSS flexbox with the sharp edges
filed off: **`flex` is a row**, **`stack` is a column**.

```js
stack(
  { gap: 4 },
  flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Team'), button('Invite')),
  stack({ gap: 2 }, ...members.map((member) => memberRow(member))),
  flex({ horizontalAlign: 'right', gap: 2 }, button('Cancel'), button('Save')),
)
```

That is the whole layout library. There is no grid, no box, and no wrapper with padding, background
and width props. Every arrangement is rows in stacks in rows, and two primitives cover the ones a
page actually makes - each one a name you do not have to look up.

**When you want something a row and a column cannot express, write the CSS.** A dense form, a
dashboard of cards, a masonry wall - that is `display: grid` in your own component's `styles`, where
it sits next to the thing it affects, is isolated from the rest of the page, and is readable by
anyone who knows CSS. imp declines to reinvent a layout system the platform already has, and hands
it back to you rather than wrapping it in props:

```js
component('invoice-grid', {
  styles: () => `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
  `,
  onMount: () => div({ class: 'grid' }, ...cards()),
})
```

Two rules follow from keeping the surface this small, and they hold across the library:

**Spacing is a `gap`, and a step, not a length.** No standard component carries an outer margin, so
the space between two of them is always the parent's `gap` - a step on the theme's spacing scale,
`0` through `6`, never `'1rem'`. The steps from `3` up are fluid `clamp()` values that grow with the
viewport (see **[Theming](theming.md)**), so one number is the right amount of space on a phone and
on a desktop alike.

**`left` means left, in every language.** The alignment props are physical and stay physical when
the document reads right to left. imp sets `<html dir="rtl">` on its own and that mirrors the text
inside your components, but it does not flip what `horizontalAlign: 'left'` means. These components
place _components_ - buttons, fields, cards - not glyphs, so a prop called `left` that sometimes
meant right would be worse than useless. Order the children the other way round yourself when an
arrangement genuinely should mirror.

## Forms are state, not a framework

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

**`field` is a dot path** into the values, so a nested shape needs nothing extra. And because the
values are just state, anything inside the form can read them the ordinary way - a live summary, a
preview, or a field that depends on another.

**Validation is declared on the field it belongs to.** `required`, `minLength`, `min`, `max` and
`pattern` are built in; `validate` takes a function returning a message; `validateAsync` returns a
promise for the check that has to ask the server, and it runs on blur and on submit rather than on
every keystroke, so signing up does not fire a request per letter typed. Errors appear when they are
useful - a field says nothing while it is being filled in for the first time - and the built-in
messages are translatable like everything else the library says.

**Submitting is a button, not a `<form>` submit.** Clicking `submitButton()` re-checks every field;
if anything fails, `onSubmit` never runs and the bad fields start showing their messages. Return a
promise from `onSubmit` and imp waits for it, with the button spinning and further clicks ignored
until it settles. Enter in a single-line field submits too, because people expect it to.

**Labels are props, not wrappers.** Every control renders its own label, hint and error message. A
`<label>` finds its input by id, and an id cannot reach across a component boundary - so in exchange
for passing the label rather than wrapping it, the label, the hint, the error and the input are
wired to each other correctly every time.

**A control does not need a form.** Give it `value` - a state, or a plain starting value - and it
binds to that instead, which is what you want for a search box filtering a list. Use `field` inside
a form and `value` outside one.

## Overlays are the platform's, not a z-index war

Anything imp opens over your page - a dialog, the shell's phone drawer - is a real `<dialog>`
promoted into the browser's **top layer**. It cannot be clipped by an ancestor with
`overflow: hidden`, it cannot be painted under something else, and it needs no z-index from you.
There is no portal to render into and no stacking context to manage.

```js
import { dialog } from 'imp/std/layout'

dialog({ title: 'Edit user', open: editing }, form({ initialValues }, textField({ field: 'name' })))
```

**`open` is the whole API.** Pass a writable state, set it to open the window, and imp sets it back
to `false` when the person closes it - so the state is always the truth about what is on screen.
There is no `show()` to call and no handle to keep.

A modal takes the page over: the rest of the document goes inert, a backdrop dims it, focus moves in
and returns where it came from, Escape dismisses it, and the page behind stops scrolling - almost
all of that the browser's own modal behaviour rather than imp's. Turn `modal` off and you get the
other window entirely: nothing behind it is blocked, the page still scrolls, you can open as many as
you like, and the person can drag it by its title bar or move it with the arrow keys. Both animate
themselves, and neither animates for a reader who has asked their system for reduced motion.

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
