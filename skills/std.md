# std - the built-in component library

Imported from `imp/std` and its groups. Nothing to install, no CSS to include. Each component is a
real imp component rendering as its own element (`<imp-button>`, ...) with its styles sealed inside.

| Import               | Exports                                                                                                                                                     | Per-component skill                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/std`            | `button`, `heading`, `text`, `link`, `icon`                                                                                                                 | `imp skill std/button`, `std/heading`, `std/text`, `std/link`, `std/icon`                                                                                                                                             |
| `imp/std/layout`     | `shell`, `flex`, `stack`, `dialog`                                                                                                                          | `imp skill std/shell`, `std/flex`, `std/stack`, `std/dialog`                                                                                                                                                          |
| `imp/std/inputs`     | `form`, `textField`, `passwordField`, `searchField`, `textArea`, `numberField`, `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton`, `resetButton` | `imp skill std/form`, `std/textField`, `std/passwordField`, `std/searchField`, `std/textArea`, `std/numberField`, `std/select`, `std/checkbox`, `std/toggle`, `std/radioGroup`, `std/submitButton`, `std/resetButton` |
| `imp/std/display`    | `emptyState`, `tag`                                                                                                                                         | `imp skill std/emptyState`, `std/tag`                                                                                                                                                                                 |
| `imp/std/navigation` | `tabs`, `navMenu`                                                                                                                                           | `imp skill std/tabs`, `std/navMenu`                                                                                                                                                                                   |
| `imp/std/shell`      | `appLogo`, `breadcrumbs`, `userCard`, `themeSelect`, `langSelect`                                                                                           | `imp skill std/appLogo`, `std/breadcrumbs`, `std/userCard`, `std/themeSelect`, `std/langSelect`                                                                                                                       |
| `imp/std/feedback`   | `bugReport`                                                                                                                                                 | `imp skill std/bugReport`                                                                                                                                                                                             |

Read the component's own skill before using it - this page is only the shared contract and a summary
of the props.

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

- **Props and children are told apart by type**, exactly as on an element: a plain object is props,
  everything else is content. One props object per call (`imp/single-props-object` lint rule).
- **Only documented props are accepted.** Nothing is forwarded to an inner element. An unknown prop,
  or a value outside the allowed list, is logged with the accepted values and the default is used.
- **Props marked live take a state itself**, not `state.get()`: the component updates that one
  attribute in place, re-rendering nothing.
- **They are themed, not styled by you** - every value comes from `--imp-*` tokens from
  [theming](theming.md), so applying a theme re-skins the library. Written with CSS logical
  properties, so they mirror under `dir="rtl"`.
- **Their own words are translatable and already written** - looked up under an `imp.` key with
  English as the fallback; your translation of that key wins. See [i18n](i18n.md).
- **No outer margins.** Spacing is the job of whatever lays them out.
- **The `imp-` element prefix is reserved.** Name your own components `my-app-*`.
- **Content lives in a shadow root**: `host.textContent` is empty by design. Unit tests walk
  `shadowRoot`; e2e selectors pierce shadow roots on their own. See [testing](testing.md).
- A component that is never called never defines its element or compiles its styles.

## button

```js
button({ variant: 'primary', size: 'lg', events: { click: save } }, 'Save changes')
```

| Prop       | Values                                                    | Default     | Notes                                        |
| ---------- | --------------------------------------------------------- | ----------- | -------------------------------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Visual weight and intent                     |
| `size`     | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                        |
| `disabled` | boolean - **live**                                        | `false`     | Blocks interaction                           |
| `loading`  | boolean - **live**                                        | `false`     | Spinner, implies disabled, sets `aria-busy`  |
| `block`    | boolean                                                   | `false`     | Fills its container's width                  |
| `label`    | string - **live**                                         | -           | `aria-label`, for an icon-only button        |
| `items`    | `{ id?, label, icon?, onClick?, disabled? }[]`            | -           | Triple-dot trigger beside it, opening a menu |
| `events`   | event map                                                 | -           | Handlers, as on any element                  |

**No `type` prop and no submit button** - a button acts on its `click` handler; submit there.
`variant: 'link'` is a button that reads as a link; use `link` when it is a place to go.

`items` adds a second, triple-dot control next to the button. Choosing an item fires a cancellable
`select` event on the host with `detail: { id, item }`, then calls that item's `onClick`. The panel
is a `popover` placed by the browser - it flips above the trigger near the bottom of the screen,
closes on Escape or a click away, and has no `placement` prop.

## heading

```js
heading({ level: 2 }, 'Recent activity')
```

| Prop    | Values                         | Default     | Notes                          |
| ------- | ------------------------------ | ----------- | ------------------------------ |
| `level` | `1`-`6`                        | `1`         | Renders the real `h1`-`h6` tag |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted         |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment                 |

Type size follows the level - never pick font sizes by hand.

## text

```js
text({ tone: 'secondary', size: 'sm' }, 'Prices exclude VAT.')
text('You have ', text({ inline: true, weight: 'bold' }, '3 days'), ' left.')
```

| Prop     | Values                           | Default     | Notes                     |
| -------- | -------------------------------- | ----------- | ------------------------- |
| `tone`   | `'default'`, `'secondary'`       | `'default'` | Full-strength or muted    |
| `size`   | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                 |
| `weight` | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight               |
| `align`  | `'start'`, `'center'`, `'end'`   | `'start'`   | Text alignment            |
| `inline` | boolean                          | `false`     | `<span>` instead of `<p>` |

## link

```js
link({ href: '/settings' }, 'Settings')
link({ href: 'https://example.com', external: true }, 'Read the docs')
```

| Prop       | Values                           | Default     | Notes                                     |
| ---------- | -------------------------------- | ----------- | ----------------------------------------- |
| `href`     | string - **required**            | -           | App-root path, no base path - imp adds it |
| `external` | boolean                          | `false`     | New tab, `rel="noreferrer noopener"`      |
| `tone`     | `'default'`, `'secondary'`       | `'default'` | Link color or muted                       |
| `size`     | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                                 |
| `weight`   | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                               |
| `events`   | event map                        | -           | Handlers, as on any element               |

Renders a real anchor; a plain left-click on an in-app path is handled by the router, while
middle-click, modifier-click, `external`, and off-site URLs are left to the browser.

## icon

```js
icon({ name: 'home' })
icon({ name: 'trash', size: 'sm', label: 'Delete invoice' })
```

| Prop    | Values                            | Default | Notes                                        |
| ------- | --------------------------------- | ------- | -------------------------------------------- |
| `name`  | a glyph name below - **required** | -       | An unknown name is logged and draws nothing  |
| `size`  | `'sm'`, `'md'`, `'lg'`            | `'md'`  | `1rem`, `1.25rem`, `1.5rem` square           |
| `label` | string - **live**                 | -       | Names the glyph; without it it is decorative |

The set: `home`, `search`, `settings`, `grid`, `chart`, `folder`, `file`, `box`, `tag`, `user`,
`users`, `bell`, `mail`, `credit-card`, `plus`, `edit`, `trash`, `check`, `close`, `menu`, `filter`,
`refresh`, `chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`, `more`, `link`,
`external-link`, `download`, `upload`, `log-in`, `log-out`, `lock`, `eye`, `sun`, `moon`, `globe`,
`calendar`, `clock`, `info`, `help`, `warning`, `star`, `heart`.

**A decorative icon takes no `label`** - name the control around it instead. There is no `src` and
no icon font: a glyph imp does not ship is your own inline `<svg>`, and every icon-taking prop in
the library accepts any DOM.

## shell - from `imp/std/layout`

**Build an app's frame with `shell`; do not hand-assemble a header-and-sidebar grid.** One nav tree
as data drives the bar, the column and the phone's bottom bar; `logo`, `aside` and `extras` are DOM;
main content is the children.

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
          groups: [{
            label: 'Money',
            items: [{ id: 'revenue', label: 'Revenue', href: '/revenue' }],
          }],
        },
        { id: 'directory', label: 'Directory', href: '/directory' },
      ],
    },
    sidebar: { label: 'Reports', selected: page },
    extras: themeSelect(),
    account: { name: 'Ada Lovelace', onSignOut },
    signedIn,
  },
  router({ routes }),
)
```

| Prop       | Values                         | Default | Notes                                                 |
| ---------- | ------------------------------ | ------- | ----------------------------------------------------- |
| `logo`     | DOM                            | -       | Heads the bar, the column, or the drawer              |
| `navbar`   | **data** `{ items, ... }`      | -       | The sections; each may declare its own `groups`       |
| `sidebar`  | **data** `{ selected, ... }`   | -       | Names, marks and foots the second level               |
| `aside`    | DOM                            | -       | Right contextual column, into `<aside>`               |
| `account`  | **data** `{ name, ... }`       | -       | The person; becomes a `userCard`                      |
| `extras`   | DOM, or an array of it         | -       | Theme/language pickers, anything; sits by the account |
| `signedIn` | boolean, or a state - **live** | `true`  | `false` withholds the nav; logo and sign-in remain    |
| `navOpen`  | boolean, or a state - **live** | `false` | Drawer state; shell-owned when omitted                |
| `events`   | `{ navToggle, select }`        | -       | `{ open }` on every drawer change; `{ id, item }`     |

`navbar`: `items` (sections, live), `selected` (live), `label`. `sidebar`: `selected` (live),
`label`, `footer` rows - plus `groups` / `items` **only when there is no `navbar`**, which is the
sidebar-only layout; beside one they warn and are dropped.

Section: `{ id, label, icon, href, onClick, tag, disabled, groups?, items? }`. Row:
`{ id, label, icon, href, onClick, tag, disabled, children? }`. Group:
`{ id?, label, tag?, items }`.

`account` keys are `userCard` props: `name`, `description`, `picture`, `href`, `onSignIn`,
`onSignOut`. Any other key warns.

| Layout                 | Props                                | What you get                                    |
| ---------------------- | ------------------------------------ | ----------------------------------------------- |
| Sections with sidebars | `navbar`, sections carrying `groups` | Top bar of sections, column for the current one |
| Sections only          | `navbar`, no section carrying groups | Top bar, no column, content full width          |
| Sidebar only           | `sidebar` with `groups` / `items`    | No bar: logo heads the column, account foots it |

Sizes are custom properties, not props: `--imp-shell-sidebar-inline-size` (`16rem`),
`--imp-shell-aside-inline-size` (`20rem`), `--imp-shell-bottom-bar-items` (`4`, clamped 3-5).

Rules an agent gets wrong:

- **Put the second level inside the section**, as `groups`, and drive `navbar.selected` and
  `sidebar.selected` from the route. Do not keep two arrays in sync by hand.
- **The nav is data, not DOM.** Do not pass a `navMenu` - a node in `navbar` or `sidebar` warns and
  is dropped. The shell draws the rows because it draws each level more than once. `account` is data
  for the same reason. Main content is the children: `shell({ navbar }, page())`. There is no
  `header`, `footer` or `layout` prop - breadcrumbs and page toolbars go atop the main content.
- **A section with no groups renders no sidebar at all** and content goes full width; do not fake a
  column with one row. **A section is always activatable** even with no `href`, because choosing it
  is what changes the sidebar.
- **`children` nest one level, collapsed by default**, behind a caret with `aria-expanded`; they
  never appear in the bottom bar.
- **Below `48rem`** the top bar becomes a hamburger plus a two-line title (section over row); the
  sidebar becomes the bottom bar, capped at `--imp-shell-bottom-bar-items` with a **More** bottom
  sheet and groups flattened; the sections, `extras` and the account move into the drawer; the aside
  goes. With no sidebar for the current section, the bottom bar carries the **sections** and the
  drawer holds only the chrome.
- **The desktop column collapses to an icon rail** from a toggle in its head - shell state, no prop.
- **`signedIn: false` withholds the nav, bottom bar and aside** and leaves one top bar with the logo
  and the sign-in button (`account.onSignIn`). Omit `signedIn` for an app with no auth.
- **`navOpen` must be writable** (never a `computed`) if you pass it: the shell writes back when the
  drawer closes itself.
- **The shell is imp's only breakpoint exception** (`48rem`), and it is a **media query** - a shell
  embedded in a panel narrower than that on a wide screen keeps its desktop layout. Do not copy the
  exception into your own components. It renders `<header>`, `<main>`, `<aside>` and the `<nav>` of
  each level, named from that level's `label`.
- **It is `100dvb` on its own host**; set `block-size` on the element to embed one in a shorter box.

Full manual: `imp skill std/shell`.

## Layout - from `imp/std/layout`

Two flex primitives, and nothing else: `flex` is a row, `stack` is a column. There is no `grid`, no
`box`, no padding/width/background props - a box that needs those is a `div` your own component
styles.

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

| Prop              | Values                                      | Default     | Notes                  |
| ----------------- | ------------------------------------------- | ----------- | ---------------------- |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'stretch'` | `'stretch'` | Across the stack       |
| `gap`             | spacing step `0`-`6`                        | `3`         | Space between children |

- **`gap` is a step number off the theme scale, never a length** - `gap: 4`, not `gap: '1rem'`. The
  scale is fluid, so one step is right at every width. A bad value warns and falls back to `3`.
- **`stack` has no `verticalAlign`** - a stack is as tall as its children.
- **`horizontalAlign` is `'start'`/`'end'`, never `'left'`/`'right'`** - it follows the reading
  direction, so `'start'` is the right edge under `dir="rtl"` and one call is correct in both
  directions. `verticalAlign` keeps `'top'`/`'bottom'`; direction never flips the vertical axis.
- **Spacing between components is a `gap`**, since no standard component carries an outer margin.
- A layout that must change shape below some width is a media query in your own component's
  `styles`; no prop varies by screen size.

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

- **`dialog` is both overlay windows.** `modal: true` (the default) freezes the page behind a
  backdrop, closes on Escape and holds the page scroll; `modal: false` is a movable window that
  blocks nothing, ignores Escape, and may be opened several at a time. `modal` is read once, at
  mount.
- **`open` is the only way to open a dialog** - a writable state, which the dialog writes `false`
  back into when the person closes it. There is no `show()` and no handle.
- **`dialog` shadows the `dialog` element factory** from `imp/html`; a file needing both aliases
  one.

Full manual: `imp skill std/dialog`.

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

Children are the actions, in a centered row under the text. With no `title` it reads its own key:
`imp.state.empty` -> "Nothing here yet", `imp.state.noResults` -> "No results". A `title` you pass
is not translated for you - use `computed([lang], () => t('invoices.empty'))` if it must follow the
language.

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

The label is the children, not a prop; render a live one with `count.text()`. `color` names one of
the theme's 31 palette colors (`'red'`, `'green'`, `'blue'`, ...), never a CSS color; the pill is a
30% tint of it so every one stays readable in a light or a dark theme. A `navMenu` item and group
take the same thing as plain data: `tag: { text, color }`, drawn at the small size to match the row.

## Responsive: fluid values, and your own media query

**No prop takes a per-screen value, and no component hides itself at a width.** Every prop takes one
value and it applies at every width. `shell` is the single exception - the app frame swaps structure
at `48rem` - and it is not a licence to do the same in your own components.

Most pages need nothing more. Spacing and type are **fluid**: `--imp-space-3` and up are `clamp()`
values that grow with the viewport, so a gap or a page gutter is already right at every width.

When a layout must genuinely change axis or disappear, write a media query in your own component's
`styles`, where it is scoped to that component:

```js
component('invoice-filters', {
  styles: () => `
    .filters { display: flex; flex-direction: column; gap: var(--imp-space-4); }

    @media (min-width: 48rem) {
      .filters { flex-direction: row; }
    }
  `,
  build: () => div({ class: 'filters' }, ...filters()),
})
```

`48rem` is the width imp itself splits at, and it is the theme token `--imp-breakpoint-desktop`. Use
the token anywhere a length goes (`calc()`, `min()`, `max-inline-size`) and when reading the number
from JavaScript; **a media query needs the literal**, because CSS cannot read a custom property
inside one.

Rules an agent gets wrong:

- **The arrangement components are `flex` and `stack` only** (`shell` is the page frame, not a box).
  Anything else a box needs - padding, a background, a width, a grid - is plain CSS in your own
  component's `styles`.
- **Spacing is `gap` on the parent, never margins on the children**: no std component has an outer
  margin.

## Forms - from `imp/std/inputs`

**A form's values are ordinary state.** `form({ initialValues })` calls
`initState('imp.form', initialValues ?? null)` on itself; a control names the field it owns with a
**dot path**, resolves the form from its own position, and reads and writes that one path. It works
at any depth, so layout components in between change nothing.

```js
import { form, select, submitButton, textField } from 'imp/std/inputs'

form(
  { initialValues: { user: { firstName: 'Ada' }, plan: 'pro' }, onSubmit: save },
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro'] }),
  submitButton('Save'),
)
```

Every control takes the same binding and labelling props:

| Prop        | Values                         | Notes                                     |
| ----------- | ------------------------------ | ----------------------------------------- |
| `field`     | dot path, e.g. `'user.email'`  | Binds one path of the surrounding form    |
| `value`     | a state, or a plain value      | Standalone use, when there is no form     |
| `label`     | string, or a state holding one | A real `<label>`, rendered by the control |
| `ariaLabel` | string                         | Names it when there is no visible label   |
| `help`      | string, or a state holding one | Hint under the control                    |
| `required`  | boolean                        | Marks it and validates it is filled in    |
| `disabled`  | boolean, or a state - **live** | Blocks interaction                        |

Validation props: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, and `validate`
(returns a message, or `null` when fine). Built-in messages live under `imp.form.*`. `validateAsync`
returns a **promise** of a message or `null` and runs only on blur and submit - submit waits for it,
a sync failure skips it, and a rejected promise blocks with `imp.form.checkFailed`.

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

- **There is no native form submit.** No `type: 'submit'` button, no `events: { submit }` - put the
  handler in the form's `onSubmit` and render `submitButton()`. Enter in a single-line field submits
  too; Enter in a `textArea` does not.
- **A `field` with no `form` around it is an error**, and so is a path that is not dot-separated.
- **`field` and `value` are alternatives.** Both together warns and `field` wins.
- **Labels belong to the control, not around it.** `label[for]` cannot cross a shadow root, so pass
  `label` as a prop; wrapping a control in your own `<label>` names nothing.
- **`select` and `radioGroup` take their choices in `options`, never as children.**
- **`numberField` commits a number**; an empty one commits `undefined`.
- **Errors stay hidden until a field is left or submit is attempted** - do not add your own "show
  errors" flag.
- **Return the promise from an async `onSubmit`** so the submit button's spinner and the
  double-submit guard work.
- **`validate` is synchronous and `validateAsync` is the promise one.** Returning a promise from
  `validate` does not work - it is truthy, so every value looks invalid. Async checks run on blur
  and submit only, never per keystroke; debounce yourself if you need more.
- Read the values anywhere in the subtree with `useState('imp.form')`.

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

```js
import { navMenu } from 'imp/std/navigation'

navMenu({
  label: 'Sections',
  selected: currentSection,
  groups: [{ id: 'work', label: 'Work' }],
  items: [{ id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks', tag: { text: 12 } }],
})
```

| Component | Props                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| `tabs`    | `items`, `selected` (live), `orientation`, `label`, `events`                       |
| `navMenu` | `items` (live), `groups`, `selected` (live), `label`, `direction`, `gap`, `events` |

Rules an agent gets wrong:

- **Panels go in `items`, never as children** - a tab and its panel reference each other by id, and
  ids cannot cross a shadow root, so one component must render both.
- **`selected` is optional.** Without it `tabs` picks the first enabled item and manages selection
  itself; pass a state when the app owns the selection, and listen with `events: { select }`.
- **`select` fires only for a user's choice**, so a state bound both ways cannot loop.
- Arrow keys, `Home`/`End` and RTL mirroring come with it - write no key handling.
- **`navMenu` marks the current page with `selected`**, which writes `aria-current="page"` - never a
  class of your own. Its items are real links; a plain click reports `select` first, so
  `preventDefault()` hands routing back to you. `direction: 'row'` turns the same menu into a bar.
  **Do not pass one to `shell`** - the frame takes the same data and draws the rows itself. Full
  manuals: `imp skill std/tabs` | `imp skill std/navMenu`.

## Shell parts - from `imp/std/shell`

Ready-made contents for `shell`'s regions. Each is optional: `logo`, `aside` and `extras` take DOM,
so a piece that does not fit is replaced by your own.

```js
import { appLogo, breadcrumbs, langSelect, themeSelect, userCard } from 'imp/std/shell'

appLogo({ label: 'Acme', icon: icon({ name: 'box', size: 'lg' }) })
breadcrumbs({ items: [{ id: 'home', label: 'Home', href: '/' }, { id: 'order', label: 'Order' }] })
userCard({ signedIn: session, name: 'Ada Lovelace', description: user.email, onSignOut: signOut })
themeSelect()
langSelect({ languages: ['en', 'pl'] })
```

| Component     | Props                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `appLogo`     | `label`, `tagline`, `href`, `src`, `alt`, `icon`, `compact`, `events`                                                                     |
| `breadcrumbs` | `items` (live), `label` (live), `separator`, `events`                                                                                     |
| `userCard`    | `signedIn`, `name`, `description`, `picture` (all live), `href`, `compact`, `onSignIn`, `onSignOut`, `variant`, `size`, `block`, `events` |
| `themeSelect` | `themes`, `remember`, `label` (live), `events`                                                                                            |
| `langSelect`  | `languages`, `remember`, `label` (live), `events`                                                                                         |

Rules an agent gets wrong:

- **There is no sidebar-item or navbar-item component**: a row is a nav item, whose shape takes an
  `icon` and an `onClick`. Inside `shell` you hand those items to the frame; `navMenu` is for a menu
  outside it.
- **The last crumb is the current page** - `breadcrumbs` renders it as text with
  `aria-current="page"`, never a link, and imp does not derive the trail from the route.
- **`onSignIn` / `onSignOut` are function props, not `events`** - return the promise and the button
  spins until it settles. imp holds no session and talks to no identity provider.
- **`themeSelect` and `langSelect` own their setting**: they apply it, remember it in
  `localStorage`, and re-apply the remembered choice on the next mount. `remember: false` when the
  app owns it. A remembered theme wins over the app's own `applyTheme` at startup - that is the
  point of remembering it.
- **`userCard` is one component with two states**: signed out it is a single sign-in button; signed
  in it is the person, with a sign-out button beside it only when `onSignOut` is passed - leave that
  prop off for a display-only card. `signedIn` defaults to `false`, so a card with only a `name`
  shows the sign-in button. There is no menu inside it.
- **`compact` on `appLogo` and `userCard` hides the words visually, not from assistive tech** - it
  is how a mark-only brand block keeps its name.
- **Inside `shell` you do not call `userCard`**: pass the frame's `account` data and it builds the
  card and places it, in the bar on a wide screen and in the drawer on a phone.

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
  fail. Return a promise: the panel stays open and shows a retryable error when it rejects.
- **imp stores nothing.** There is no endpoint, no `localStorage` fallback and no queue - what
  `onSubmit` does with the report is the app's decision, and so is stripping anything private out of
  it first.
- **The person never sees the element path.** They pick an element by clicking it and it stays
  outlined while they type; the path is in the report for whoever reads it.
- **`as: 'link'` still renders a `<button>`** - it performs an action, so it is never an `<a>`.
- **It is not `imp review`** (`imp skill review`), which is the dev server's own widget writing
  `.imp/reviews/`. They share one capture engine, so a report has the same shape either way.

Full manual: `imp skill std/bugReport`.
