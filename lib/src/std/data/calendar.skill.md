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

| Event        | `detail`                                                  | Fires when the person activates                 |
| ------------ | --------------------------------------------------------- | ----------------------------------------------- |
| `select`     | `{ id, item }`                                            | an event                                        |
| `slotSelect` | `{ start: '2026-09-21', allDay: true }`                   | a day number (month), a day header (week, day)  |
| `slotSelect` | `{ start: '...T10:00', end: '...T11:00', allDay: false }` | an empty place in the time grid, with a pointer |

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
- **A time slot is for a pointer only.** The keyboard path to a new entry is the day button: the day
  number in the month view, and the day header in the week view and the day view. Both fire
  `slotSelect` with `allDay: true`. Let the dialog of the app ask for the time.
- **The month view shows 3 rows for each day.** With more entries, the last row is a "+N more"
  button. It opens the day view of that day.
- **A narrow container changes the layout, not the viewport.** Below 36rem of its own width, the
  month view shows a dot for each entry, and the week view scrolls sideways. Do not write a
  breakpoint for it.
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
