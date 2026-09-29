# calendar - an event calendar with a month view, a week view and a day view

```js
import { calendar } from 'imp/std/data'

calendar({
  label: 'Team calendar',
  items: [
    { id: 1, title: 'Standup', start: '2026-09-21T09:00', end: '2026-09-21T09:15', color: 'blue' },
    { id: 2, title: 'Offsite', start: '2026-09-23', end: '2026-09-25' },
  ],
  view: 'month',
  date: '2026-09-21',
  events: { select, slotSelect },
})
```

The call shape is `calendar(props?)`. It takes no children. The toolbar is part of the component:
"Today", previous, next, the title of the shown range, and the view switch.

| Prop     | Values                                              | Default   | Notes                                   |
| -------- | --------------------------------------------------- | --------- | --------------------------------------- |
| `label`  | string, or a state holding one - **live**           | -         | Names the calendar for a screen reader  |
| `items`  | array, or a state holding one - **live**            | `[]`      | The entries to show                     |
| `view`   | `'month'`, `'week'`, `'day'`, or a state - **live** | `'month'` | The toolbar writes a writable state     |
| `date`   | `'YYYY-MM-DD'`, or a state holding one - **live**   | today     | The day in focus; the toolbar writes it |
| `events` | event map                                           | -         | `select` and `slotSelect`, on the host  |

One item:

| Key     | Values                                  | Notes                                                    |
| ------- | --------------------------------------- | -------------------------------------------------------- |
| `id`    | string or number                        | Comes back in `select`. Must be unique                   |
| `title` | string                                  | Required                                                 |
| `start` | `'YYYY-MM-DD'` or `'YYYY-MM-DDTHH:mm'`  | Required. A date with no time makes an all-day item      |
| `end`   | same shapes as `start`                  | An all-day `end` is inclusive. Default: 1 hour, or 1 day |
| `color` | a theme palette name, such as `'green'` | Default: the primary colour                              |

| Event        | `detail`                                                  | Fires when the person activates                |
| ------------ | --------------------------------------------------------- | ---------------------------------------------- |
| `select`     | `{ id, item }`                                            | an event                                       |
| `slotSelect` | `{ start: '2026-09-21', allDay: true }`                   | a day number (month), a day header (week, day) |
| `slotSelect` | `{ start: '...T10:00', end: '...T11:00', allDay: false }` | a half-hour slot of the time grid              |

Rules an agent gets wrong:

- **The entries go in `items`, not in `events`.** `events` is always the DOM event map.
- **The calendar is read-only.** It has no drag, no resize and no editor. To add or change an entry,
  handle `slotSelect` or `select`, open a `dialog` with a `form`, and update the `items` state.
- **Dates are ISO strings in local time, never `Date` objects.** A state holds plain data.
- **An all-day `end` is the last day, inclusive.** `start: '2026-09-23', end: '2026-09-25'` covers
  three days. A timed `end` is the moment that the entry stops.
- **Pass a writable state to `view` and `date` to follow the toolbar.** With a plain value, the
  calendar keeps its own view and date from that start value. Watch the two states to load the
  entries of the shown range.
- **Every half hour of the week view and the day view is a slot button.** The time grid is one tab
  stop. The arrow keys move the focus by half an hour and by a day, Home and End go to the first and
  the last slot of the day, and a move past the edge of the week shows the next week. Enter, or a
  click, fires `slotSelect` with a start and an end one hour later. The day number in the month view
  and the day header fire `slotSelect` with `allDay: true`.
- **The slots follow the wall clock of the day.** On a day when the clock skips an hour, the time
  grid has no slot in that hour, and the arrow keys go over the gap. On a day that repeats an hour,
  each half hour has one slot. The `end` of a slot is one hour later on the wall clock, and it is
  never equal to the `start`.
- **An entry over several days is one bar per week in the month view.** The bar keeps one lane on
  every day that it covers. A bar that goes on into the next week has square ends on that side.
- **The month view shows 3 lanes for each day.** On a day with more entries, the last lane is a "+N
  more" button. It opens the day view of that day. A bar in the last lane that covers a full day is
  counted in the "+N more" of every day that it covers.
- **A narrow container changes the layout, not the viewport.** Below 36rem of its own width, the
  month view shows a dot for each entry and a thin line for a bar, and the week view scrolls
  sideways. Do not write a breakpoint for it.
- **`color` is a palette name, not a CSS colour.** imp warns about another value and uses the
  primary colour.
- **The language decides the formats and the first day of the week.** The words are the
  `imp.calendar.*` keys: `today`, `month`, `week`, `day`, `previous`, `next`, `more` with `{count}`,
  `allDay`, `view`.
- **The time grid has a fixed height and scrolls inside.** It opens near 07:00, or at the first
  entry when that is earlier.

```js
const planner = component('app-planner', {
  setup: (self) => {
    const items = initState(self, 'planner.items', [])
    const slot = initState(self, 'planner.slot', null)
    const open = initState(self, 'planner.open', false)
    return stack(
      calendar({
        label: 'Planner',
        items,
        events: {
          slotSelect: ({ detail }) => {
            slot.set(detail)
            open.set(true)
          },
        },
      }),
      dialog(
        { title: 'New event', open },
        form(
          {
            initialValues: { title: '' },
            onSubmit: ({ title }) => {
              const { start, end } = slot.get()
              items.set((all) => [...all, { id: crypto.randomUUID(), title, start, end }])
              open.set(false)
            },
          },
          textField({ field: 'title', label: 'Title', required: true }),
          button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
        ),
      ),
    )
  },
})
```

Related: imp skill std/datePicker - the form control for a date; imp skill std/dialog - the window
for the editor of an entry; imp skill std/form - the form inside it; imp skill theming - the palette
that `color` names.
