# breadcrumbs - the trail of levels above the main region, as plain data

```js
import { breadcrumbs } from 'imp/std/shell'

breadcrumbs({
  items: [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'orders', label: 'Orders', href: '/orders' },
    { id: 'order', label: 'Order 8f3a' },
  ],
})
```

Call shape: `breadcrumbs(props)` - it takes no content.

| Prop        | Values                             | Default       | Notes                        |
| ----------- | ---------------------------------- | ------------- | ---------------------------- |
| `items`     | array of crumbs, or a state - live | `[]`          | The trail, root first        |
| `label`     | string, or a state - **live**      | `t()` default | Names the `<nav>`            |
| `separator` | string, or DOM                     | `'/'`         | Drawn between crumbs         |
| `events`    | `{ select }`                       | -             | Cancelable, fires on the nav |

Each crumb:

| Key       | Values                        | Default   | Notes                                        |
| --------- | ----------------------------- | --------- | -------------------------------------------- |
| `label`   | string, or a state - **live** | required  | The word in the trail                        |
| `id`      | string or number              | its index | What `select` reports                        |
| `href`    | string                        | -         | Without one the crumb is inert text          |
| `icon`    | DOM, or a string              | -         | Drawn before the label - usually on the root |
| `onClick` | function                      | -         | Called with `{ id, item }` on activation     |

Rules an agent gets wrong:

- **The last crumb is the current page**: it renders as text with `aria-current="page"`, never a
  link, whether or not it carries an `href`. Do not add the current level twice.
- **`items` is data, and a state works** - `items: trail` re-renders the trail in place, which is
  how a screen amends it: `computed([trail, extra], (a, b) => [...a, ...b])`.
- **Activation order is `select` -> `onClick` -> the href.** `select` is cancelable, so
  `preventDefault()` in it hands routing back to you and skips both.
- **The separator is a real element**, `aria-hidden`, not CSS generated content - so it is never
  announced. Pass your own string or DOM to change it.
- **There is no `max` and no overflow picker yet.** A long trail wraps; collapse it yourself by
  shortening `items`.
- **imp does not derive the trail from the route.** Build `items` from your own route data.

Related: imp skill std/shell - the frame a trail usually sits in.
