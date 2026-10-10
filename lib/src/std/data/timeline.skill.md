# timeline - a vertical list of dated events, each with a marker, a time, a title and actions

```js
import { luTruck } from 'imp/icons'
import { timeline } from 'imp/std/data'

timeline({
  label: 'Order history',
  items: [
    { id: 'placed', time: '2026-09-21T09:12:00Z', title: 'Order placed', color: 'blue' },
    { id: 'shipped', time: '2026-09-23T07:05:00Z', title: 'Shipped', icon: luTruck },
    { id: 'due', time: '2026-09-30', title: 'Invoice due', description: 'Net 7' },
  ],
})
```

The call shape is `timeline(props)`. It takes **no children**. imp warns about a child and drops it.

| Prop         | Values                                            | Default | Notes                                          |
| ------------ | ------------------------------------------------- | ------- | ---------------------------------------------- |
| `label`      | string, or a state - **live**                     | -       | Necessary. The accessible name of the timeline |
| `items`      | array of items, or a state holding one - **live** | `[]`    | Plain data, drawn in the order given           |
| `actions`    | `(item) => content`                               | -       | The trailing controls of each event            |
| `hasMore`    | boolean, or a state - **live**                    | -       | More events exist. Necessary with `onLoadMore` |
| `onLoadMore` | `async () => void`                                | -       | Loads the next events. Append them to `items`  |
| `events`     | `{ select }`                                      | -       | Fires on the host with `detail: { id, item }`  |

Each item has these keys:

| Key           | Values                                   | Notes                                                                                              |
| ------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`          | string or number                         | Necessary and unique. imp skips an item with no `id` or a repeated `id`                            |
| `time`        | ISO string, `Date` or epoch milliseconds | Shown in the language of the page, in a `<time>` element                                           |
| `title`       | string                                   | The main line                                                                                      |
| `description` | string                                   | The second line, in the secondary colour                                                           |
| `icon`        | an icon from `imp/icons`                 | Drawn in the marker. Without it, the marker is a dot                                               |
| `color`       | `'neutral'`, or a palette name           | Tints the marker. The same names as `tag`                                                          |
| `href`        | string                                   | Makes the title a link, in the space of the app. An unsafe scheme such as `javascript:` is dropped |

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **imp does not sort.** It draws the items in the order of the array. Put the newest first for a
  feed, and the oldest first for a history that a person reads down.
- **A date with no time is `'YYYY-MM-DD'`.** imp shows it as a date only, on that calendar day in
  every time zone. A full ISO string shows the date and the time in the time zone of the reader.
- **The marker is decoration.** The icon and the colour are hidden from a screen reader. Put the
  meaning in `title`.
- **An item is plain data.** Build the controls of an event in `actions`, and give each one a name
  that includes the title, such as `Open Order placed`.
- **The title is the only control of an event.** With `href` it is a real link. Without `href` it is
  a `<button>` when you pass `events.select`, and plain text when you do not. `select` is
  cancelable, so `event.preventDefault()` stops the navigation.
- **There is no pagination.** Pass `hasMore` and `onLoadMore`, and append to the `items` state.
- An empty timeline shows `emptyState`. The time follows a change of language at once.
- imp warns about a missing `label`, an item with no `id`, a `time` that is not a date, and an
  unknown `color`.

Related: imp skill std/list - the same records with no time; imp skill std/steps - the stages of a
process that is not over; imp skill std/tag - the palette names of `color`.
