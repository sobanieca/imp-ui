# link - a real anchor whose in-app clicks are handled by the router

```js
import { link } from 'imp/std'

link({ href: '/settings' }, 'Settings')
```

The call shape is `link(props?, ...children)`. When a props object is present, it must be the
**first** argument. Everything after it is the link text.

| Prop       | Values                               | Default     | Notes                                    |
| ---------- | ------------------------------------ | ----------- | ---------------------------------------- |
| `href`     | string                               | - required  | Where the link goes                      |
| `external` | boolean                              | `false`     | Opens in a new tab with `rel="noopener"` |
| `tone`     | `'default'`, `'secondary'`           | `'default'` | Link color or muted                      |
| `size`     | `'sm'`, `'md'`, `'lg'`               | `'md'`      | Type size                                |
| `weight`   | `'normal'`, `'bold'`                 | `'normal'`  | Type weight                              |
| `events`   | event map, e.g. `{ click: handler }` | -           | Handlers, exactly as on any element      |

Rules an agent gets wrong:

- **Write an in-app `href` like a `navigate()` path**, as in `/settings`. Leave out the base path of
  the app. imp adds it for you.
- **Do not call `navigate()` from a click handler on a link.** imp already routes a plain left-click
  on an in-app href, with no page reload. A handler that navigates again navigates twice.
- **The browser handles an off-site link.** An absolute URL, an `external: true` link, a
  middle-click and a click with a modifier key all behave natively.
- **`href` is necessary.** Without it, the component warns and renders text that a person cannot
  follow.
- **`href` takes `http:`, `https:`, `mailto:`, `tel:`, a path, a query or a `#` fragment.** imp
  drops any other scheme, such as `javascript:` or `data:`, warns, and renders text with no `href`.
  So an address from user data is safe to pass.
- The accessible name is the link text. Write where the link goes. Do not write "click here".
- **A control that performs an action is not a link.** It takes no `href` and it is not an `<a>`.
  Use button (imp skill std/button) with `variant: 'link'` to get the appearance of a link on a real
  button.

```js
link({ href: 'https://example.com', external: true }, 'Read the docs')
link({ href: '/invoices/42', tone: 'secondary', size: 'sm' }, 'Invoice #42')
```

Related: button (imp skill std/button)
