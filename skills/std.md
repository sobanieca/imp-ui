# std - the built-in component library

Imported from `imp/std` and its groups. Nothing to install, no CSS to include. Each component is a
real imp component rendering as its own element (`<imp-button>`, …) with its styles sealed inside.

| Import               | Exports                                                                                                                                                     | Per-component skill                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imp/std`            | `button`, `heading`, `text`, `link`                                                                                                                         | `imp skill std/button`, `std/heading`, `std/text`, `std/link`                                                                                                                                                         |
| `imp/std/layout`     | `app`, `navbar`, `sidebar`, `footer`, `flex`, `grid`                                                                                                        | `imp skill std/app`, `std/navbar`, `std/sidebar`, `std/footer`, `std/flex`, `std/grid`                                                                                                                                |
| `imp/std/inputs`     | `form`, `textField`, `passwordField`, `searchField`, `textArea`, `numberField`, `select`, `checkbox`, `toggle`, `radioGroup`, `submitButton`, `resetButton` | `imp skill std/form`, `std/textField`, `std/passwordField`, `std/searchField`, `std/textArea`, `std/numberField`, `std/select`, `std/checkbox`, `std/toggle`, `std/radioGroup`, `std/submitButton`, `std/resetButton` |
| `imp/std/display`    | `emptyState`                                                                                                                                                | `imp skill std/emptyState`                                                                                                                                                                                            |
| `imp/std/navigation` | `tabs`, `navMenu`, `commandPalette`                                                                                                                         | `imp skill std/tabs`, `std/navMenu`, `std/commandPalette`                                                                                                                                                             |

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

| Prop       | Values                                          | Default     | Notes                                       |
| ---------- | ----------------------------------------------- | ----------- | ------------------------------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'default'` | Visual weight and intent                    |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size                       |
| `disabled` | boolean - **live**                              | `false`     | Blocks interaction                          |
| `loading`  | boolean - **live**                              | `false`     | Spinner, implies disabled, sets `aria-busy` |
| `block`    | boolean                                         | `false`     | Fills its container's width                 |
| `events`   | event map                                       | -           | Handlers, as on any element                 |

**No `type` prop and no submit button** - a button acts on its `click` handler; submit there.

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
`imp.state.empty` → "Nothing here yet", `imp.state.noResults` → "No results". A `title` you pass is
not translated for you - use `computed([lang], () => t('invoices.empty'))` if it must follow the
language.

## Layout - from `imp/std/layout`

Everything below takes a **responsive value**: either one value, or a per-breakpoint object
`{ xs, sm, md, lg, xl }` whose values apply from that width upward. Breakpoints are fixed at `xs` 0,
`sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem - a theme cannot change them, because CSS cannot read
a custom property inside a media query. A breakpoint you skip **inherits the nearest one below it**,
so `{ md: 'row' }` is the default under `md` and a row from `md` up.

Spacing props (`gap`, `padding`) take a **step `0`-`6`** from the theme scale - `gap: 4` means
`--imp-space-4`. Pixels warn and fall back.

Every layout component also takes `hideBelow` and `hideAbove` (`'sm'`-`'xl'`), which hide it under
or from that width and remove it from the accessibility tree with it.

```js
import { app, flex, grid, navbar, sidebar } from 'imp/std/layout'

app(
  { maxWidth: 'lg' },
  navbar({ label: 'Top bar' }, brand()),
  sidebar({ side: 'left', label: 'Sections' }, navMenu({ items })),
  flex(
    { direction: 'column', gap: 5 },
    flex({ justify: 'between', align: 'center' }, heading('Invoices'), button('New')),
    grid({ minItemWidth: '18rem', gap: 4 }, ...cards),
    flex(
      { direction: { xs: 'column', sm: 'row' }, gap: 2 },
      flex({ grow: true }, search()),
      button('Go'),
    ),
  ),
)
```

| Component | What it is                             | Key props                                                                                                      |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `flex`    | Flex container, a row by default       | `direction`, `gap`, `justify`, `align`, `wrap`, `grow`, `scroll`                                               |
| `grid`    | CSS grid of equal columns              | `columns` (1-12), `minItemWidth`, `gap`, `align`, `justify`, `grow`                                            |
| `app`     | The page frame; sorts its own children | `maxWidth` (`'sm'`-`'xl'`, `'full'`), `padding`                                                                |
| `navbar`  | The bar across the top of the frame    | `label`, `gap`, `justify`, `align`, `wrap`                                                                     |
| `sidebar` | A collapsible side region of the frame | `side` (`'left'`/`'right'`), `label`, `width`, `resizable`, `minWidth`, `maxWidth`, `collapsible`, `collapsed` |
| `footer`  | The bar across the bottom of the frame | `label`, `gap`, `justify`, `align`, `wrap`                                                                     |

Rules an agent gets wrong:

- **These six are the whole layout group** - do not import anything else from it. A column is
  `flex({ direction: 'column' })`, empty space is a `justify` or a `grow`, a scrolling region is
  `flex({ scroll: true })`, a capped and centred column is `app({ maxWidth })`, and a line of
  controls is a `flex`. Anything past that is a component you write.
- **`grow` belongs to the child, not the parent.** To let one box take the leftover room, give that
  box `grow: true`; wrap anything that is not a `flex` or a `grid` in a `flex` to do it.
- **Reach for `grid({ minItemWidth })` before a `columns` ladder** - it reflows from one column to
  as many as fit with no breakpoints written at all.
- **`columns` is a count, not a track template.** There is no `'1fr 2fr'` and no per-cell span; a
  child always fills exactly one cell.
- **A `flex` does not wrap** unless you pass `wrap: true`.
- **`app` sorts its children into regions by what they are** - a `navbar` goes on top, a `sidebar`
  down the side it names, a `footer` at the bottom, and everything else is the main content. They
  are props of nothing: `app({ sidebar: ... })` warns about an unknown prop.
- **A sidebar carries its own collapse toggle, and becomes a drawer below 48rem** - do not build a
  menu button, do not hide it with `hideBelow`, and do not write the breakpoint yourself.
- **A sidebar drags wider only with `resizable: true`**, between `minWidth` and `maxWidth` - and all
  three take a keyword of the sidebar scale (`'xs'` to `'xl'`), never a length.
- **Only `app`'s main region scrolls.** The frame is `100dvh`, so put `app` at the top of the page
  and nothing around it.
- Spacing is `gap` on the parent, never margins on the children: no std component has an outer
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
import { commandPalette, navMenu } from 'imp/std/navigation'

navMenu({
  label: 'Sections',
  selected: currentSection,
  groups: [{ id: 'work', label: 'Work' }],
  items: [{ id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks', badge: 12 }],
})

commandPalette({
  label: 'Search',
  shortcut: 'ctrl+p',
  items: [{ id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks' }],
})
```

| Component        | Props                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| `tabs`           | `items`, `selected` (live), `orientation`, `label`, `events`                          |
| `navMenu`        | `items` (live), `groups`, `selected` (live), `label`, `direction`, `gap`, `events`    |
| `commandPalette` | `items` (live), `label`, `placeholder`, `shortcut`, `limit`, `emptyMessage`, `events` |

Rules an agent gets wrong:

- **Panels go in `items`, never as children** - a tab and its panel reference each other by id, and
  ids cannot cross a shadow root, so one component must render both. `commandPalette` is one
  component for the same reason: its field and result list are wired by id.
- **`selected` is optional.** Without it `tabs` picks the first enabled item and manages selection
  itself; pass a state when the app owns the selection, and listen with `events: { select }`.
- **`select` fires only for a user's choice**, so a state bound both ways cannot loop.
- Arrow keys, `Home`/`End` and RTL mirroring come with it - write no key handling.
- **`navMenu` marks the current page with `selected`**, which writes `aria-current="page"` - never a
  class of your own. Its items are real links; a plain click reports `select` first, so
  `preventDefault()` hands routing back to you. `direction: 'row'` turns the same menu into a top or
  bottom navbar.
- **`commandPalette` filters its own `items`** - do not filter them yourself on every keystroke. It
  matches `group/label` fuzzily, so a `group` is how a user searches by category. `shortcut` is
  `'ctrl+p'`-style, where `ctrl` matches Ctrl **and** ⌘.

Full manuals: `imp skill std/tabs` · `imp skill std/navMenu` · `imp skill std/commandPalette`.
