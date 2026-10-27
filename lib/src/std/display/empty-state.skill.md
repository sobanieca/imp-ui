# emptyState - the placeholder for an empty list or search, and the result page of an action

```js
import { emptyState } from 'imp/std/display'

emptyState()
emptyState({ icon: luInbox, title: 'No messages' })
emptyState({ image: '/art/no-photos.svg', title: 'No photos yet' })
emptyState(
  { icon: luCircleCheck, kind: 'success', title: 'Payment received' },
  button('Back to orders'),
)
```

The call shape is `emptyState(props?, ...children)`. When a props object is present, it must be the
**first** argument. The children are the actions. imp lays them out in a centered row under the
text.

| Prop          | Values                                                     | Default     | Notes                                         |
| ------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------- |
| `variant`     | `'empty'`, `'noResults'`                                   | `'empty'`   | Which of the two situations this is           |
| `title`       | string, or a state holding one - **live**                  | see below   | The line saying there is nothing              |
| `description` | string, or a state holding one - **live**                  | -           | One sentence of explanation; omitted if unset |
| `icon`        | an icon from `imp/icons`                                   | -           | Drawn large and muted above the title         |
| `image`       | a DOM node, or an image URL                                | -           | A drawing above the title; wins over `icon`   |
| `kind`        | `'neutral'`, `'success'`, `'error'`, `'warning'`, `'info'` | `'neutral'` | Tints the icon only                           |

Rules an agent gets wrong:

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **The component already has words.** With no `title`, `variant: 'empty'` reads the message key
  `imp.state.empty` and falls back to "Nothing here yet". `'noResults'` reads `imp.state.noResults`
  and falls back to "No results". Translate those keys. Do not write a fixed title.
- **A `title` that you pass is plain text.** imp does not translate it. To follow the language, pass
  `computed([lang], () => t('invoices.empty'))`.
- **With no `icon` and no `image`, imp draws its own mark.** That is the imp logo, at 6rem, in the
  ink of `color-text`. Pass an `icon` or an `image` to replace it. To replace it in the whole app,
  including the empty views of `list`, `table`, `timeline` and `notifications`, set
  `init({ defaults: { emptyState: { icon: luInbox } } })`, see imp skill std.
- **`icon` is an icon from `imp/icons`, not an `icon()` component and not a name.** Write
  `icon: luInbox`. imp draws it at 3rem, and hides it from a screen reader, because the title says
  the same.
- **`image` is any drawing.** Pass an inline `<svg>` node, any DOM, or the URL of an SVG or a PNG. A
  URL renders as an `<img>` with an empty `alt`. imp draws it 6rem wide and at most 6rem tall, and
  it keeps the ratio of the picture. An inline SVG that uses `currentColor` follows `color-text`.
  With both `icon` and `image`, imp warns and draws the `image`.
- **`kind` only tints the icon.** `'success'` uses `color-success`, `'error'` uses `color-danger`,
  `'warning'` uses `color-warning` and `'info'` uses `color-info`. The title and the wording do not
  change. imp warns about a `kind` with no `icon`.
- **A result page is this component.** imp has no `result` component. Pass an `icon`, a `kind`, a
  `title`, a `description`, and the next actions as children.
- **`kind` is not `variant`.** `variant` selects the default words. `kind` selects the colour of the
  icon. With a `kind`, pass your own `title`.
- imp warns about an unknown prop at mount. It warns about a `kind` outside the list, and uses
  `'neutral'`. It warns about a `variant` outside the list, and falls back to the default.

```js
emptyState({ variant: 'noResults' })
emptyState(
  { title: 'No invoices', description: 'Invoices appear here once you send one.' },
  button({ variant: 'primary', events: { click: newInvoice } }, 'New invoice'),
)
emptyState(
  {
    icon: luCircleX,
    kind: 'error',
    title: 'Payment failed',
    description: 'The bank declined the card.',
  },
  button({ variant: 'primary', events: { click: retry } }, 'Try again'),
)
```

Related: imp skill icons - the icons that `icon` takes; imp skill std/button - the actions.
