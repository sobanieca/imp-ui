# button - the standard button, rendered as a real `<button>`

```js
import { button } from 'imp/std'

button({ variant: 'primary', events: { click: save } }, 'Save changes')
```

The call shape is `button(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is content.

| Prop          | Values                                                    | Default     | Notes                                                     |
| ------------- | --------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| `variant`     | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Visual weight and intent                                  |
| `size`        | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Padding and type size                                     |
| `disabled`    | boolean, or a state holding one - **live**                | `false`     | Blocks interaction                                        |
| `loading`     | boolean, or a state holding one - **live**                | `false`     | Shows a spinner, disables the button, sets `aria-busy`    |
| `block`       | boolean                                                   | `false`     | Fills the width of its container                          |
| `label`       | string, or a state holding one - **live**                 | -           | `aria-label` on the button - names an icon-only one       |
| `pressed`     | boolean, or a state holding one - **live**                | -           | Makes it a toggle button - `aria-pressed`, flips on click |
| `items`       | array of menu items                                       | -           | Adds a menu to the button                                 |
| `menuTrigger` | `'more'`, `'hover'`                                       | `'more'`    | What opens the `items` menu                               |
| `events`      | event map, e.g. `{ click: handler }`                      | -           | Handlers, exactly as on any element                       |

An `items` entry is `{ id?, label, icon?, onClick?, disabled? }`. `id` defaults to the index.
`label` is necessary. `icon` is a node.

Rules an agent gets wrong:

- **There is no `type` prop and no submit button.** A button acts on its `click` handler. Submit
  from there. A `type` prop gives a warning about an unknown prop.
- **`loading` also disables the button.** So a request in flight cannot start twice. Do not also
  pass `disabled`.
- **A live prop takes the state itself, not its value.** Write `disabled: saving`, never
  `disabled: saving.get()`. The second form freezes at the value read during mount.
- **The button has no outer margin.** Spacing between buttons belongs to whatever lays them out.
- The accessible name is the content of the button. An icon-only button needs `label`. There is no
  `aria-label` prop, and imp warns that it is unknown.
- **`pressed` makes a toggle button, and the same `<button>` stays.** With `pressed`, a click flips
  the value and paints `aria-pressed`. Pass a **state** to read the value and to drive it from
  outside, as with the `open` state of a dialog. imp writes the flip back to the state. The host
  also fires a `toggle` event with `detail: { pressed }`. A `click` handler in `events` still runs.
  A disabled button does not flip. Give an icon-only toggle a `label`.
- **`variant: 'link'` is a button that looks like a link.** Use it for an action inside running
  text. For a place that a person can go to, use link (imp skill std/link), which needs an `href`.
- **The host forwards the focus.** So a component that composes `button` keeps the returned element
  and calls `.focus()` on it. Never reach into its `shadowRoot`.
- imp warns about an unknown prop at mount. It warns about a `variant` or a `size` outside the list,
  and falls back to the default.

Rules for `items`:

- **The menu is never the click action of the button.** The button keeps its own `click` handler. A
  button with a menu only still needs content for its own label.
- **`menuTrigger` selects what opens the menu.** `'more'` adds a second, triple-dot control beside
  the button, and a click on it opens the menu. `'hover'` adds no second control. The button itself
  opens the menu, when the pointer goes over it, and when it takes the focus. Use `'hover'` for a
  control that reads as a dropdown.
- **A choice of item fires a `select` event on the host** that you can cancel, with
  `detail: { id, item }`. imp then calls the `onClick({ id, item })` of that item. A call to
  `preventDefault()` on `select` stops the `onClick`.
- **The browser places the panel, not imp.** The panel opens under the trigger. It flips above the
  trigger near the bottom of the screen, and it flips to the other side near a left or right edge.
  So it is never off the screen. There is no `placement` prop.
- **The platform owns the dismissal and the layering.** A click away from the menu, or the Escape
  key, closes the menu and returns the focus to the trigger. Do not add your own outside-click
  handler.
- The arrow keys, `Home` and `End` walk the enabled items. imp skips a `disabled` item.
- **A hover menu keeps the focus on the button when it opens.** The person walks into the menu with
  `ArrowDown` or `ArrowUp`. So `Tab` still leaves the button.
- `disabled` and `loading` on the button also disable the triple-dot trigger. A disabled button
  opens no hover menu.

```js
const sending = initState(self, 'contact.sending', false)

button({ variant: 'primary', loading: sending, events: { click: send } }, 'Send')
button({ variant: 'danger', size: 'sm', events: { click: remove } }, 'Delete')
button({ block: true, events: { click: next } }, 'Continue')
button({ variant: 'link', events: { click: showDetails } }, 'What is this?')

const showingCode = initState(self, 'panel.code', false)
button({ variant: 'ghost', label: 'Show code', pressed: showingCode }, icon(luCode))

button({
  variant: 'primary',
  events: { click: save },
  items: [
    { id: 'draft', label: 'Save as draft', onClick: saveDraft },
    { id: 'template', label: 'Save as template', onClick: saveTemplate },
    { id: 'discard', label: 'Discard', disabled: true },
  ],
}, 'Save')

button({
  menuTrigger: 'hover',
  items: THEMES.map((name) => ({ id: name, label: name, onClick: () => applyTheme(name) })),
}, 'Theme')
```

Related: link (imp skill std/link)
