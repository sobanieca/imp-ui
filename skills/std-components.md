# std — the built-in component library

Imported from `imp/std` and its groups. Nothing to install, no CSS to include. Each component is a
real imp component rendering as its own element (`<imp-button>`, …) with its styles sealed inside.

| Import            | Exports                             | Per-component skill                                           |
| ----------------- | ----------------------------------- | ------------------------------------------------------------- |
| `imp/std`         | `button`, `heading`, `text`, `link` | `imp skill std/button`, `std/heading`, `std/text`, `std/link` |
| `imp/std/display` | `emptyState`                        | `imp skill std/emptyState`                                    |

Read the component's own skill before using it — this page is only the shared contract and a summary
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
- **They are themed, not styled by you** — every value comes from `--imp-*` tokens from
  [theming](theming.md), so applying a theme re-skins the library. Written with CSS logical
  properties, so they mirror under `dir="rtl"`.
- **Their own words are translatable and already written** — looked up under an `imp.` key with
  English as the fallback; your translation of that key wins. See [i18n](i18n.md).
- **No outer margins.** Spacing is the job of whatever lays them out.
- **The `imp-` element prefix is reserved.** Name your own components `my-app-*`.
- **Content lives in a shadow root**: `host.textContent` is empty by design. Unit tests walk
  `shadowRoot`; e2e selectors use Puppeteer's `>>>` combinator. See [testing](testing.md).
- A component that is never called never defines its element or compiles its styles.

## button

```js
button({ variant: 'primary', size: 'lg', events: { click: save } }, 'Save changes')
```

| Prop       | Values                                          | Default     | Notes                                       |
| ---------- | ----------------------------------------------- | ----------- | ------------------------------------------- |
| `variant`  | `'default'`, `'primary'`, `'ghost'`, `'danger'` | `'default'` | Visual weight and intent                    |
| `size`     | `'sm'`, `'md'`, `'lg'`                          | `'md'`      | Padding and type size                       |
| `disabled` | boolean — **live**                              | `false`     | Blocks interaction                          |
| `loading`  | boolean — **live**                              | `false`     | Spinner, implies disabled, sets `aria-busy` |
| `block`    | boolean                                         | `false`     | Fills its container's width                 |
| `events`   | event map                                       | —           | Handlers, as on any element                 |

**No `type` prop and no submit button** — a button acts on its `click` handler; submit there.

## heading

```js
heading({ level: 2 }, 'Recent activity')
```

| Prop    | Values                         | Default     | Notes                          |
| ------- | ------------------------------ | ----------- | ------------------------------ |
| `level` | `1`–`6`                        | `1`         | Renders the real `h1`–`h6` tag |
| `tone`  | `'default'`, `'secondary'`     | `'default'` | Full-strength or muted         |
| `align` | `'start'`, `'center'`, `'end'` | `'start'`   | Text alignment                 |

Type size follows the level — never pick font sizes by hand.

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
| `href`     | string — **required**            | —           | App-root path, no base path — imp adds it |
| `external` | boolean                          | `false`     | New tab, `rel="noreferrer noopener"`      |
| `tone`     | `'default'`, `'secondary'`       | `'default'` | Link color or muted                       |
| `size`     | `'sm'`, `'md'`, `'lg'`           | `'md'`      | Type size                                 |
| `weight`   | `'normal'`, `'medium'`, `'bold'` | `'normal'`  | Type weight                               |
| `events`   | event map                        | —           | Handlers, as on any element               |

Renders a real anchor; a plain left-click on an in-app path is handled by the router, while
middle-click, modifier-click, `external`, and off-site URLs are left to the browser.

## emptyState — from `imp/std/display`

```js
import { emptyState } from 'imp/std/display'

emptyState({ variant: 'noResults' })
emptyState({ title: 'No invoices', description: 'They appear here once you send one.' }, action)
```

| Prop          | Values                   | Default   | Notes                            |
| ------------- | ------------------------ | --------- | -------------------------------- |
| `variant`     | `'empty'`, `'noResults'` | `'empty'` | Which situation this is          |
| `title`       | string — **live**        | see below | The line saying there is nothing |
| `description` | string — **live**        | —         | One sentence; omitted if unset   |

Children are the actions, in a centered row under the text. With no `title` it reads its own key:
`imp.state.empty` → "Nothing here yet", `imp.state.noResults` → "No results". A `title` you pass is
not translated for you — use `computed([lang], () => t('invoices.empty'))` if it must follow the
language.
