# card - a themed panel that lifts a block of content off the page

```js
import { card } from 'imp/std/display'
import { heading, text } from 'imp/std'

card(text('Plain content on a surface.'))
card({ header: heading({ level: 2 }, 'Billing') }, invoiceList)
card({ href: '/projects/42', label: 'Project 42' }, preview)
```

The call shape is `card(props?, ...children)`. When a props object is present, it must be the
**first** argument. **Everything after it is the body.**

| Prop      | Values                   | Default     | Notes                                                                        |
| --------- | ------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `header`  | string or DOM - **live** | -           | Sits above the body, separated by a rule                                     |
| `footer`  | string or DOM - **live** | -           | Sits below the body, separated by a rule                                     |
| `href`    | string                   | -           | Makes the whole card one link. An in-app path goes through the router        |
| `label`   | string                   | -           | The accessible name. With `href` it names the link. Alone, it names a region |
| `padding` | `'sm'`, `'md'`, `'lg'`   | `'md'`      | The inner padding, from `space-3`, `space-4` and `space-6`                   |
| `tone`    | `'surface'`, `'primary'` | `'surface'` | `'primary'` fills the card with the primary colour                           |
| `events`  | `{ click: fn, ... }`     | -           | Listeners on the outer element                                               |

The card renders a `div`. With `label` and no `href` it renders a `section`, which is a named
region. With `href` it renders a real `a`, so the browser gives it the link role, the keyboard and
the middle click. A plain click on an in-app path goes to `navigate`. An absolute URL leaves the
app. An `href` with a scheme other than `http:`, `https:`, `mailto:` or `tel:`, such as
`javascript:`, is dropped with a warning, and the card renders as with no `href`.

Rules an agent gets wrong:

- **`tone: 'primary'` turns the theme around inside the card.** The text, the headings and every
  standard component in it take `color-on-primary` as ink. A primary `button` there is drawn in
  `color-on-primary` with the primary colour as its text. Do not override `--imp-color-*` tokens
  yourself to make a loud card.

- **Import the component from `imp/std/display`**, not from `imp/std`.
- **A card is a box, not an inline thing.** The host is `display: block`, and the panel fills the
  height that the parent gives it. So a CSS grid of cards has equal rows, with no extra CSS. The
  grid itself is yours, in the `styles` of your component, see `imp skill std/flex`.
- **The card has no outer margin.** Space between two cards comes from the `gap` of a `stack`, a
  `flex` or your grid.
- **The body, the `header` and the `footer` move into the shadow root of the card, where your
  `styles` do not reach.** So `card(div({ class: 'note' }))` renders the div without your `.note`
  rule, and imp warns in development. Give the box its own component, use `text` or `stack`, or set
  an inline `style`.
- **Every value comes from the theme.** The surface is `color-surface`, the rule is `border-width`
  with `color-border`, the corner is `radius-container` and the lift is `shadow-sm`. A theme with
  `shadow-sm: 'none'` and `radius-container: '0'` gives a flat, square card. Do not restyle the card
  to force a look. Retheme.
- **A link card must not hold a control.** A `button`, a `link` or an input inside an `a` is invalid
  HTML, and the browser handles the nested click badly. A card with actions is a plain card with the
  buttons in its `footer`. A card that opens something is a link card with content only.
- **Give a link card a `label` when its body is not text.** The accessible name of an `a` is its
  text. A card whose body is an image, a chart or a specimen announces nothing. `label` is the name
  a screen reader gets, and it wins over the text when both exist.
- **`header` and `footer` take DOM, so compose them.** The usual header is a `flex` row with
  `horizontalAlign: 'justify'`, a `heading` at the start and a `tag` at the end. A string works as
  well. A state works as well, and the text updates in place.
- **`padding: 'sm'` is for a dense grid**, such as a gallery of thumbnails. `'lg'` is for one card
  that carries a whole section. The default suits a dashboard.
- **A card is not an overlay.** It has no open state, no close button and no shadow above
  `shadow-sm`. A panel that floats is a `dialog` or a `drawer`, see `imp skill std/dialog`.

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

Related: imp skill std/flex - lay cards out in a row; imp skill std/stack - lay cards out in a
column; imp skill theming - the tokens a card reads; imp skill std/dialog - a panel that floats.
