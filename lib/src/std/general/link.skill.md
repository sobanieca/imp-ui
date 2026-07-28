# link — a real anchor whose in-app clicks are handled by the router

```js
import { link } from 'imp/std'

link({ href: '/settings' }, 'Settings')
```

Call shape: `link(props?, ...children)` — the props object, when present, must be the **first**
argument; everything after it is the link text.

| Prop       | Values                               | Default     | Notes                                               |
| ---------- | ------------------------------------ | ----------- | --------------------------------------------------- |
| `href`     | string                               | — required  | Where the link goes                                 |
| `external` | boolean                              | `false`     | Opens in a new tab with `rel="noreferrer noopener"` |
| `tone`     | `'default'`, `'secondary'`           | `'default'` | Link color or muted                                 |
| `size`     | `'sm'`, `'md'`, `'lg'`               | `'md'`      | Type size                                           |
| `weight`   | `'normal'`, `'medium'`, `'bold'`     | `'normal'`  | Type weight                                         |
| `events`   | event map, e.g. `{ click: handler }` | —           | Handlers, exactly as on any element                 |

Rules an agent gets wrong:

- **An in-app `href` is written like a `navigate()` path** — `/settings`, without the app's base
  path, which imp adds for you.
- **Do not call `navigate()` from a click handler on a link.** A plain left-click on an in-app href
  is already routed without a page reload; a handler that navigates again double-navigates.
- **Off-site links are left to the browser** — an absolute URL, an `external: true` link, a
  middle-click or a modifier-click all behave natively.
- **`href` is required**: without it the component warns and renders text that cannot be followed.
- The accessible name is the link text; write where it goes, not "click here".

```js
link({ href: 'https://example.com', external: true }, 'Read the docs')
link({ href: '/invoices/42', tone: 'secondary', size: 'sm' }, 'Invoice #42')
```
