# imp-ui — Standard components

imp ships a component library in the box, imported from **`imp/std`** — there is no UI package to
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

`imp` and its subpaths are the framework — element factories, `component`, state, routing, theming
(see **[Imports](imports.md)**). `imp/std` is the component library, split by group:

| Import            | What it holds                                      |
| ----------------- | -------------------------------------------------- |
| `imp/std`         | The base set — `button`, `heading`, `text`, `link` |
| `imp/std/display` | `emptyState`                                       |
| `imp/std/<group>` | The rest, group by group, as they land             |

Components take the obvious names, and a few of them match an element factory — `button` is both a
plain `<button>` from `imp/html` and the styled component from `imp/std`. They never collide,
because they arrive through different imports. In the rare file that wants both, alias one:

```js
import { button } from 'imp/html'
import { button as styledButton } from 'imp/std'
```

Importing a group that does not exist yet is an error that tells you what does exist, so a typo
never turns into a mysterious missing module.

Every component here also ships a **skill** — the short, mechanical version of this page for one
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
and caught statically by the `imp/single-props-object` lint rule (see **[Linting](lint.md)**) — so
compose props into a single object before the call.

**Only the documented props.** Standard components accept a fixed, documented set of props rather
than forwarding anything you hand them to some inner element. An unrecognized prop, or a prop set to
a value outside its allowed list, is logged with the accepted values and the component falls back to
its default — your app keeps running.

**Props that change take state.** Props documented as **live** accept a value or a piece of state.
Given state, the component subscribes to it and updates that one attribute in place — nothing is
re-rendered, and nothing you focused or typed into is disturbed:

```js
const saving = initState('billing.saving', false)

button({ variant: 'primary', loading: saving }, 'Save')

saving.set(true) // the button is now busy — no re-render
```

**They are themed, not styled by you.** Every component reads its colors, spacing, radii and type
from the `--imp-*` design tokens (see **[Theming](theming.md)**), so applying a theme re-skins the
whole library at once. They also use CSS logical properties throughout, so they mirror correctly
when the document's `dir` is right-to-left.

**Their words are translatable, and already written.** Text that belongs to a component rather than
to you — an empty table's **No results**, a dialog's **Cancel** — works the way the tokens do: the
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

| Prop       | Values                                          | Default     |                                                        |
| ---------- | ----------------------------------------------- | ----------- | ------------------------------------------------------ |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'default'` | The visual weight and intent                           |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size                                  |
| `disabled` | boolean — **live**                              | `false`     | Blocks interaction                                     |
| `loading`  | boolean — **live**                              | `false`     | Shows a spinner, disables the button, sets `aria-busy` |
| `block`    | boolean                                         | `false`     | Fills the width of its container                       |
| `events`   | event map                                       | —           | Handlers, exactly as on any element                    |

**There is no `type` prop, and no submit button.** A button always acts on its `click` handler.
Because the button element lives inside the component, the browser would never associate it with a
form on your page anyway — so imp does not pretend otherwise, and submitting is something you do in
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

A section heading, rendered as the real `h1`–`h6` element for the level you ask for — screen readers
and document outlines see the right structure.

```js
heading({ level: 2 }, 'Recent activity')
```

| Prop    | Values                         | Default     |                            |
| ------- | ------------------------------ | ----------- | -------------------------- |
| `level` | `1`–`6`                        | `1`         | The heading level, and tag |
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

A link. It renders a real anchor — the URL shows in the status bar, middle-click and
copy-link-address work — but a plain left-click inside your own app is handled by the router, so
there is no page reload.

```js
link({ href: '/settings' }, 'Settings')
link({ href: 'https://example.com', external: true }, 'Read the docs')
```

| Prop       | Values                           | Default     |                                                     |
| ---------- | -------------------------------- | ----------- | --------------------------------------------------- |
| `href`     | string                           | — required  | Where the link goes                                 |
| `external` | boolean                          | `false`     | Opens in a new tab with `rel="noreferrer noopener"` |
| `tone`     | `'default'`, `'secondary'`       | `'default'` | Link color or muted                                 |
| `size`     | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                                           |
| `weight`   | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                                         |
| `events`   | event map                        | —           | Handlers, exactly as on any element                 |

In-app navigation is handed to the router (see **[Routing](routing.md)**), so `href` is written the
same way you would write it for `navigate()` — a path like `/settings`, without your app's base
path. imp adds that for you. Clicks are left to the browser whenever the user means it: a
middle-click, a modifier-click, an `external` link, or an absolute URL pointing off-site.

## `emptyState` — from `imp/std/display`

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
| `title`       | string — **live**        | see below | The line saying there is nothing              |
| `description` | string — **live**        | —         | One sentence of explanation; omitted if unset |

Children are the actions, laid out in a centered row under the text.

**It has words already.** Left without a `title`, the component reads its own message key — so it
says something sensible before you have written any translations:

| `variant`     | Key                   | Falls back to    |
| ------------- | --------------------- | ---------------- |
| `'empty'`     | `imp.state.empty`     | Nothing here yet |
| `'noResults'` | `imp.state.noResults` | No results       |

Translate those keys in your own files to put it in your own words and every language you support
(see **[Translations](i18n.md)**), or pass `title` when this one empty state needs to say something
specific. A `title` you pass is text like any other — imp does not translate it for you, so reach
for `computed([lang], () => t('invoices.empty'))` if it needs to follow the language.

## Custom elements next to yours

Each standard component defines its own element the first time you call it — `button` renders as
`<imp-button>`, `heading` as `<imp-heading>`, and so on. Two things follow from that:

- **The `imp-` prefix is reserved.** Name your own components with your app's prefix
  (`my-app-profile`) as usual and there is nothing to think about.
- **Nothing is registered until it is used.** A component you never call never defines an element
  and never compiles its stylesheet, so importing a whole group costs you nothing at startup.

Because a component's content lives inside its own element, reading it from the outside means
piercing that boundary — `host.textContent` is empty by design. Tests walk `shadowRoot`, and
end-to-end selectors use the deep combinator (see **[Testing](testing.md)**).
