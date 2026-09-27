# todoProgress - a bar that shows how many todos are done

```js
import { todoProgress } from './todos/todo-progress.js'

todoProgress({ todos: useState(self, 'todo.items') })
todoProgress({ todos: [{ id: '1', title: 'Ship it', priority: 'low', done: true }] })
```

The call shape is `todoProgress({ todos })`. It takes no content.

| Prop    | Values                                            | Notes                                      |
| ------- | ------------------------------------------------- | ------------------------------------------ |
| `todos` | a state that holds an array of todos, or an array | A state is live. `undefined` counts as `0` |

Rules an agent gets wrong:

- **Pass the state itself, not `state.get()`.** A plain array renders once and never updates.
- **The label is translated.** It reads `todos.progress` with `{done}` and `{total}`. Every language
  of the app must carry that key.
- **The value is a percentage from `0` to `100`.** An empty list shows `0`, not an error.

Related: imp skill std/progress - the bar that this component draws.
