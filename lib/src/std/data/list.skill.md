# list - a vertical list of records, each with a visual, a title, a tag and actions

```js
import { list } from 'imp/std/data'

list({
  label: 'Team members',
  items: [
    { id: 'ada', title: 'Ada Lovelace', description: 'Engineering', name: 'Ada Lovelace' },
    {
      id: 'alan',
      title: 'Alan Turing',
      picture: '/alan.png',
      tag: { text: 'Admin', color: 'blue' },
    },
  ],
})
```

The call shape is `list(props)`. It takes **no children**. imp warns about a child and drops it.

| Prop         | Values                                            | Default | Notes                                         |
| ------------ | ------------------------------------------------- | ------- | --------------------------------------------- |
| `label`      | string, or a state - **live**                     | -       | Necessary. The accessible name of the list    |
| `items`      | array of items, or a state holding one - **live** | `[]`    | Plain data - see below                        |
| `leading`    | `(item) => content`                               | -       | The leading control of each row - see below   |
| `actions`    | `(item) => content`                               | -       | The trailing controls of each row             |
| `hasMore`    | boolean, or a state - **live**                    | -       | More items exist. Necessary with `onLoadMore` |
| `onLoadMore` | `async () => void`                                | -       | Loads the next items. Append them to `items`  |
| `empty`      | props of `emptyState`, or a DOM node              | -       | What the list shows with no items             |
| `events`     | `{ select }`                                      | -       | Fires on the host - see below                 |

Each item has these keys:

| Key           | Values                   | Notes                                                                                              |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `id`          | string or number         | Necessary and unique. imp skips an item with no `id` or a repeated `id`                            |
| `title`       | string                   | The main line                                                                                      |
| `description` | string                   | The second line, in the secondary colour                                                           |
| `picture`     | URL string               | Draws a round avatar                                                                               |
| `name`        | string                   | Draws an avatar with the initials, when there is no `picture`                                      |
| `icon`        | an icon from `imp/icons` | The leading visual, when there is no `picture` or `name`                                           |
| `tag`         | `{ text, color }`        | A small tag before the actions. `color` is a palette name                                          |
| `href`        | string                   | Makes the title a link, in the space of the app. An unsafe scheme such as `javascript:` is dropped |

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **An item is plain data.** Do not put a node or a function in an item. A state cannot hold one.
  Build the controls of a row in the `actions` function of the list.
- **The title is the only control of a row.** With `href` it is a real link. Without `href` it is a
  real `<button>` when you pass `events.select`, and plain text when you do not. The row itself is
  never a click target, so `leading` and `actions` stay separate controls.
- **`leading` replaces the visual.** With `leading`, a row shows its result in place of the avatar
  and the icon, and ignores `picture`, `name` and `icon`. Use it for a control at the start of a
  row, such as a toggle button or a `checkbox`. Give it a name, as you give one to an action.
- **`select` fires on the host with `detail: { id, item }`**, before imp follows an `href`. It is
  cancelable. Call `event.preventDefault()` to stop the navigation.
- **The decorative visual has no name.** The avatar and the icon are hidden from a screen reader.
  Put the meaning in `title`.
- **A long list costs what is on screen.** Each row has `content-visibility: auto`, so the browser
  skips the layout and the paint of the rows outside the viewport. There is no virtualizer.
- **There is no pagination.** Paging is infinite scroll. Pass `hasMore` and `onLoadMore`, and append
  to the `items` state: `items.set((loaded) => [...loaded, ...page])`. imp redraws only the rows
  whose object changed.
- **`onLoadMore` needs `hasMore`.** Without it imp warns and loads nothing. A rejected `onLoadMore`
  shows a retry button, and imp logs the error.
- **Give every control in `actions` a name.** An icon-only `button` needs its `label`. Include the
  title of the item, such as `Edit Ada Lovelace`.
- **An empty list shows `emptyState`.** Pass `empty: { icon: luUsers, title: 'No people yet' }` to
  change it. imp sets the `variant`. To add an action, pass a node:
  `empty: emptyState({ title: 'No people yet' }, inviteButton)`.
- A narrow container moves the actions under the text. The host
  fills the width of its container, also in a flex row.
- imp warns about a missing `label`, an item with no `id`, a `tag` with no `text`, and an `actions`
  that is not a function.

```js
import { luPencil } from 'imp/icons'
import { initState } from 'imp/state'
import { button, icon, menuButton } from 'imp/std'
import { list } from 'imp/std/data'
import { flex } from 'imp/std/layout'

const people = initState(self, 'team.people', [])
const hasMore = initState(self, 'team.hasMore', true)

list({
  label: 'Team members',
  items: people,
  hasMore,
  onLoadMore: async () => {
    const page = await loadPeople({ after: people.get().length })
    people.set((loaded) => [...loaded, ...page.items])
    hasMore.set(page.hasMore)
  },
  actions: (person) =>
    flex(
      { joined: true },
      button({ size: 'sm', square: true, label: `Edit ${person.title}` }, icon(luPencil)),
      menuButton({
        size: 'sm',
        label: `Actions for ${person.title}`,
        items: [{ id: 'remove', label: 'Remove' }],
      }),
    ),
  events: { select: (event) => openPerson(event.detail.id) },
})
```

Related: imp skill std/table - columns, sorting and selection over the same data; imp skill
std/emptyState - what the list shows with no items; imp skill std/tag - the colours of `tag`.
