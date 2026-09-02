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

The call shape is `breadcrumbs(props)`. It takes no content.

| Prop        | Values                             | Default       | Notes                        |
| ----------- | ---------------------------------- | ------------- | ---------------------------- |
| `items`     | array of crumbs, or a state - live | `[]`          | The trail, root first        |
| `label`     | string, or a state - **live**      | `t()` default | Names the `<nav>`            |
| `separator` | string, or DOM                     | `'/'`         | Drawn between crumbs         |
| `events`    | `{ select }`                       | -             | Cancelable, fires on the nav |

Each crumb has these keys:

| Key       | Values                        | Default   | Notes                                        |
| --------- | ----------------------------- | --------- | -------------------------------------------- |
| `label`   | string, or a state - **live** | required  | The word in the trail                        |
| `id`      | string or number              | its index | What `select` reports                        |
| `href`    | string                        | -         | Without one the crumb is inert text          |
| `icon`    | DOM, or a string              | -         | Drawn before the label - usually on the root |
| `onClick` | function                      | -         | Called with `{ id, item }` on activation     |

Rules an agent gets wrong:

- **The last crumb is the current page.** imp renders it as text with `aria-current="page"`, never
  as a link, with or without an `href`. Do not add the current level twice.
- **`items` is data, and a state works there.** `items: trail` renders the trail again in place.
  That is how a screen adds to the trail, as in `computed([trail, extra], (a, b) => [...a, ...b])`.
- **The activation order is `select`, then `onClick`, then the href.** You can cancel `select`. A
  call to `preventDefault()` there gives the routing back to you, and skips the other two steps.
- **The separator is a real element with `aria-hidden`**, not CSS generated content. So a screen
  reader never announces it. To change it, pass your own string or DOM.
- **There is no `max` prop and no overflow picker yet.** A long trail wraps. To collapse it, make
  `items` shorter yourself.
- **imp does not derive the trail from the route.** Build `items` from your own route data.

Related: imp skill std/shell - the frame a trail usually sits in.
