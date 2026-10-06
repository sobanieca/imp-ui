# gantt - a read-only Gantt chart of tasks over a timeline of days, weeks or months

```js
import { gantt } from 'imp/std/data'

gantt({
  label: 'Release plan',
  tasks: [
    { id: 'design', label: 'Design', start: '2026-09-01', end: '2026-09-12', progress: 100 },
    { id: 'build', label: 'Build', start: '2026-09-10', end: '2026-10-02', progress: 40 },
    { id: 'launch', label: 'Launch', start: '2026-10-05', end: '2026-10-05' },
  ],
})
gantt({
  label: 'Roadmap',
  scale: 'month',
  tasks,
  events: { select: (event) => open(event.detail.id) },
})
```

The call shape is `gantt(props)`. The component takes no children.

| Prop     | Values                                            | Default        | Notes                                                      |
| -------- | ------------------------------------------------- | -------------- | ---------------------------------------------------------- |
| `label`  | string, or a state holding one - **live**         | -              | The accessible name of the scroll region                   |
| `tasks`  | array of tasks, or a state holding one - **live** | `[]`           | See the table below                                        |
| `scale`  | `'day'`, `'week'`, `'month'`                      | from the tasks | The width of one column                                    |
| `events` | event map, e.g. `{ select: handler }`             | -              | `select` has `detail: { id }`. It makes each task a button |

One entry of `tasks`:

| Key        | Values               | Notes                                                              |
| ---------- | -------------------- | ------------------------------------------------------------------ |
| `id`       | string               | Default is the index. It is the `detail.id` of `select`            |
| `label`    | string               | Required. The text in the label column                             |
| `start`    | `'YYYY-MM-DD'`       | Required. The first day                                            |
| `end`      | `'YYYY-MM-DD'`       | Required. The last day, inclusive. Equal to `start` is a milestone |
| `progress` | number, 0 to 100     | The darker inner fill of the bar. Without it, there is no fill     |
| `color`    | a theme palette name | Default is the primary colour of the theme                         |
| `group`    | string               | Tasks with the same `group` sit under one heading row              |

The custom property `--imp-gantt-max-block-size` on the host limits the height. The rows then scroll
under the sticky header.

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **A date is an ISO date string, never a `Date`.** Write `'2026-09-21'`. `end` is inclusive. imp
  warns about a task with a bad date, or with an `end` before its `start`, and skips that task.
- **The host fills the width of its container**, also in a flex row. The label column is at most 40%
  of that width, and the timeline scrolls sideways inside the gantt.
- **A milestone is a task with `start` equal to `end`.** It draws a diamond. There is no `milestone`
  key.
- **The gantt is a read-only view.** There are no dependency arrows, no drag and no resize. Do not
  try to add them. To change a task, open your own form from `select`, and write the new `tasks`.
- **`select` makes the tasks interactive.** With it, each label is a real `<button>`, and a click on
  a bar fires the same event. Without it, the labels are plain text.
- **Pass the state itself for live tasks.** Write `tasks: plan`, never `tasks: plan.get()`.
- **Groups are data, not children.** Set `group` on each task. The groups appear in the order of
  their first task. A task without `group` has no heading.
- **The timeline spans the first `start` to the last `end`**, padded to whole columns. A week starts
  on the first day of the week of the active language. Without `scale`, a span up to 35 days uses
  `'day'`, up to 182 days uses `'week'`, and a longer span uses `'month'`.
- **The today line shows only when today is in that span.** The timeline starts at its first day. It
  does not scroll to today.
- **`color` is a palette name, not a CSS colour.** imp warns about another value and uses the
  primary colour.
- **Always pass `label`.** The timeline is a focusable scroll region with that name, so a keyboard
  scrolls it. Each task exposes its dates and its progress as text for a screen reader.
- Month names, weekday names and dates follow the active language. Write no date formatting.

```js
import { component } from 'imp'
import { initState } from 'imp/state'
import { gantt } from 'imp/std/data'

export const releasePlan = component('my-app-release-plan', {
  setup: (self) => {
    const opened = initState(self, 'plan.opened', null)
    return gantt({
      label: 'Release plan',
      scale: 'week',
      tasks: [
        {
          id: 'design',
          label: 'Design',
          start: '2026-09-01',
          end: '2026-09-25',
          progress: 70,
          color: 'violet',
          group: 'Design',
        },
        {
          id: 'api',
          label: 'Public API',
          start: '2026-09-07',
          end: '2026-10-16',
          progress: 45,
          group: 'Engineering',
        },
        {
          id: 'freeze',
          label: 'Code freeze',
          start: '2026-11-09',
          end: '2026-11-09',
          group: 'Engineering',
        },
      ],
      events: { select: (event) => opened.set(event.detail.id) },
    })
  },
})
```

Related: imp skill std/chart - numbers over categories; imp skill i18n - the language that the dates
follow; imp skill state - the state that a live prop takes.
