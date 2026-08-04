# todoItem — one todo in the list, with a switch that saves as soon as it is flipped

```js
import { todoItem } from './components/todo_item.js'

todoItem({ todo })
```

Call shape: `todoItem(props)` — one props object, no children.

| Prop   | Values                                                   | Notes                    |
| ------ | -------------------------------------------------------- | ------------------------ |
| `todo` | `{ id, title, notes, priority, estimate, pinned, done }` | Required — the whole row |

`priority` is one of `'high'`, `'normal'`, `'low'`; `estimate` is hours as a number.

## What it resolves for itself

It reaches **up the DOM** for both of these, so it only works under the app root:

- `useState('todo.items')` — flipping the switch writes the change back into the list.
- `useHttpClient('todo.api')` — it sends the `PATCH` itself.

Rules an agent gets wrong:

- **It takes the todo, not an id** — it never loads anything; the screen above it owns the fetch.
- **Do not pass an `onToggle` callback.** Saving is the component's own job: it patches
  `/todos/:id`, updates `todo.items`, and puts the switch back if the request fails.
- **Render it inside a keyed `each`** —
  `items.each((todo) => todoItem({ todo }), (todo) => todo.id)` — so an unchanged row keeps its DOM
  and its switch.
- **Its content is in a shadow root.** Unit tests walk `shadowRoot`; e2e selectors pierce it on
  their own. The card carries `id="todo-<id>"`, which is what the specs select.
- The switch's accessible name is the todo's title, so a page full of rows still reads correctly.

```js
stack({ gap: 3 }, visible.each((todo) => todoItem({ todo }), (todo) => todo.id))
```
