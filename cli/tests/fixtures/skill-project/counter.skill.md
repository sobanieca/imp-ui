# counter - a self-contained increment/decrement widget

```js
import { counter } from './counter.js'

counter({ start: 0, step: 1 })
```

| Prop    | Values | Default | Notes                                  |
| ------- | ------ | ------- | -------------------------------------- |
| `start` | number | `0`     | The value it counts from               |
| `step`  | number | `1`     | How much each press adds or subtracts  |

Emits a `change` event with the new value in `event.detail`.
