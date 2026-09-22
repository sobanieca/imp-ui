# steps - the numbered progress of a flow with several steps, such as a checkout

```js
import { steps } from 'imp/std/navigation'

steps({
  label: 'Checkout',
  current: 'address',
  items: [
    { id: 'cart', label: 'Cart' },
    { id: 'address', label: 'Address', description: 'Where we ship to' },
    { id: 'payment', label: 'Payment' },
  ],
})
```

The call shape is `steps(props)`. You pass everything as props. The component takes **no children**.
imp warns about a child and drops it.

| Prop          | Values                                            | Default        | Notes                                      |
| ------------- | ------------------------------------------------- | -------------- | ------------------------------------------ |
| `items`       | array of `{ id, label, description, status }`     | `[]`           | Required in practice - see the table below |
| `current`     | an item's `id`, or a state holding one - **live** | the first item | Items before it are done                   |
| `orientation` | `'horizontal'`, `'vertical'`                      | `'horizontal'` | A row, or a column                         |
| `label`       | string, or a state holding one - **live**         | required       | Accessible name of the list                |
| `events`      | `{ select }`                                      | -              | Makes the done steps buttons - see below   |

Each entry in `items` has these keys:

| Key           | Values                           | Default   | Notes                                          |
| ------------- | -------------------------------- | --------- | ---------------------------------------------- |
| `id`          | string or number                 | its index | What `current` and `event.detail.id` refer to  |
| `label`       | string, or a state - live        | required  | The name of the step                           |
| `description` | string, or a state - live        | -         | One short line under the label                 |
| `status`      | `'error'`, or a state - **live** | -         | Marks a failed step: danger colour and a cross |

Rules an agent gets wrong:

- **Import the component from `imp/std/navigation`**, not from `imp/std`.
- **`current` is the only position that you set.** Items before it are done and show a check. Items
  after it are upcoming. Do not pass a `done` flag per item.
- **`steps` never changes `current` itself.** Pass a **state** and set it from your flow. imp reads
  a plain string once.
- **`events: { select }` makes each done step a real button.** `select` is a `CustomEvent` on the
  host, with `detail: { id, index }`. It fires when the person activates a done step. Set `current`
  in the handler. The current step and the upcoming steps are never buttons, so a person cannot skip
  ahead. Without `select`, no step is interactive.
- **`steps` shows no panel.** Render the form of the current step yourself, below the component.
- **`label` names the list, and imp warns without it.** The list is an `<ol>`. The current item has
  `aria-current="step"`. A screen reader also gets "Completed", "Current", "Upcoming" or "Error"
  after each label. The message keys are `imp.steps.done`, `imp.steps.current`, `imp.steps.upcoming`
  and `imp.steps.error`.
- **When the flow is finished, no step is left to be current.** Add a last item such as `Done` and
  make it current.
- **The row adapts to its own width, not to the screen.** Below 40rem a horizontal row hides the
  descriptions. Below 28rem it becomes a column and shows them again. Do not write a media query.
- **The connector lines and the order mirror under `dir="rtl"`.**
- imp warns about an unknown prop, about an `orientation` outside the list, about an item with no
  `label`, about two items with one `id`, about a `current` that matches no item, and about a
  `status` other than `'error'`.

```js
import { initState } from 'imp/state'
import { steps } from 'imp/std/navigation'

const current = initState(self, 'checkout.step', 'cart')
const paymentStatus = initState(self, 'checkout.paymentStatus', null)

steps({
  label: 'Checkout',
  current,
  items: [
    { id: 'cart', label: 'Cart' },
    { id: 'address', label: 'Address', description: 'Where we ship to' },
    { id: 'payment', label: 'Payment', status: paymentStatus },
    { id: 'done', label: 'Done' },
  ],
  events: { select: (event) => current.set(event.detail.id) },
})

paymentStatus.set('error')
```

Related: imp skill std/tabs - views that a person switches between in any order; imp skill state -
the state that holds `current`.
