# flex - a row of children laid out with CSS flexbox

```js
import { flex } from 'imp/std/layout'

flex({ horizontalAlign: 'end', gap: 4 }, button('Cancel'), button('Save'))
```

The call shape is `flex(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is a child of the row.

| Prop              | Values                                       | Default     | Notes                                    |
| ----------------- | -------------------------------------------- | ----------- | ---------------------------------------- |
| `horizontalAlign` | `'start'`, `'end'`, `'center'`, `'justify'`  | `'start'`   | Along the row; `'justify'` spreads apart |
| `verticalAlign`   | `'top'`, `'bottom'`, `'center'`, `'stretch'` | `'stretch'` | Across the row                           |
| `wrap`            | boolean                                      | `false`     | Lets the row break onto more lines       |
| `gap`             | spacing step `0`-`6`                         | `3`         | Space between children, from the theme   |
| `joined`          | boolean                                      | `false`     | No gap, and the children share a seam    |

Rules an agent gets wrong:

- **`gap` is a step number, not a length.** Write `gap: 4`, never `gap: '1rem'`. imp warns about a
  bad value and falls back to step `3`. The scale is fluid, so one step is correct at every screen
  width.
- **`horizontalAlign` moves the children along the row. `verticalAlign` moves them across it.** In a
  `stack` the two are the other way round, because the axes swap. That is the only difference
  between the two props.
- **`start` and `end` follow the reading direction. They are not `left` and `right`.** Under
  `dir="rtl"` the row lays its children out from the right, and `horizontalAlign: 'start'` is the
  right edge. So a toolbar that you write once is correct in both directions. imp warns about
  `'left'` or `'right'` and falls back. `verticalAlign` keeps `top` and `bottom`, because direction
  never mirrors the vertical axis.
- **`'justify'` only spreads the children apart**, with `space-between`. It does not stretch them.
- **`joined` makes the row read as one control.** Every child squares only the corners that face a
  neighbour, and two borders collapse into one line. Every std button and std input reads the seam,
  so a split button is `flex({ joined: true }, button('Save'), menuButton({ items }))`. A component
  from elsewhere keeps its own corners. A joined row ignores `gap`, and imp warns about one.
- **A joined row is layout, not a control.** It has no name and no value. A choice drawn as a row is
  segmented (imp skill std/segmented). A number with a minus and a plus is
  `textField({ type: 'number', stepper: true })`.
- **Nothing else is a prop.** There is no padding, background, width, direction or grow prop, and
  there is no `grid` component. A box that needs those is a `div` that your own component styles.
- **A child moves into the shadow root of the row, where your `styles` do not reach.** So
  `flex({}, div({ class: 'box' }))` renders the div without your `.box` rule, and imp warns in
  development. Give the box its own component, use a standard component, or set an inline `style`. A
  wrapper in your own tree, `div({ class: 'box' }, flex(...))`, keeps the rule.
- **The spacing lives here, not on the children.** No standard component has an outer margin. So a
  gap is the only way to separate two of them.
- A layout that must change shape below some width needs a media query in the `styles` of your own
  component. No prop varies with the size of the screen.

```js
flex({ horizontalAlign: 'justify', verticalAlign: 'center' }, heading('Invoices'), button('New'))
flex({ wrap: true, gap: 2 }, ...labels.map((label) => text(label)))
flex(stack({ gap: 1 }, heading('Title'), text('Subtitle')), button('Edit'))
flex({ joined: true }, button({ variant: 'primary' }, 'Approve'), button('Comment'))
```

Related: imp skill std/stack - the same primitive stacking its children vertically; imp skill
std/menuButton - the menu at the end of a joined row; imp skill std/segmented - a choice drawn as a
joined row.
