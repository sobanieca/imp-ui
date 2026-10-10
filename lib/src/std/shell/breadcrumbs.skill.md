# breadcrumbs - the trail of levels above the main region, as plain data, with a picker per crumb

```js
import { breadcrumbs } from 'imp/std/shell'

breadcrumbs({
  items: [
    { id: 'home', label: 'Home', href: '/' },
    {
      id: 'repo',
      label: 'imp-ui',
      href: '/repos/imp-ui',
      options: [
        { id: 'imp-ui', label: 'imp-ui', href: '/repos/imp-ui' },
        { id: 'imp-site', label: 'imp-site', href: '/repos/imp-site' },
      ],
    },
    { id: 'file', label: 'README.md' },
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

| Key       | Values                          | Default   | Notes                                                                                |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `label`   | string, or a state - **live**   | required  | The word in the trail                                                                |
| `id`      | string or number                | its index | What `select` reports                                                                |
| `href`    | string                          | -         | Without one, or with an unsafe scheme such as `javascript:`, the crumb is inert text |
| `icon`    | Lucide export, DOM, or a string | -         | Drawn before the label - usually on the root                                         |
| `onClick` | function                        | -         | Called with `{ id, item }` on activation                                             |
| `options` | array of `{ id, label, href }`  | -         | Gives the crumb a picker of its siblings                                             |

Rules an agent gets wrong:

- **Inside `shell` you do not call this.** The frame renders the trail from the application map,
  above the main content, see imp skill std/shell. Call `breadcrumbs` in a frame of your own, or in
  a page that has no map.
- **The last crumb is the current page.** imp renders it as text with `aria-current="page"`, never
  as a link, with or without an `href`. Do not add the current level twice.
- **`options` renders two controls, not one.** The crumb stays a link to its level. A disclosure
  button beside it, named "Change {label}", opens a `popover` panel of links anchored under the
  button. Arrow keys move through the options, Escape and a click outside close the panel. An option
  can sit on any crumb, also in the middle of the trail.
- **An option is `{ id, label, href, onClick }`.** With an `href` it is a real anchor. A choice
  reports `select` with `{ id, item, crumb }`, then calls `onClick`, then follows the href.
- **`items` is data, and a state works there.** `items: trail` renders the trail again in place.
  That is how a screen adds to the trail, as in `computed([trail, extra], (a, b) => [...a, ...b])`.
- **The activation order is `select`, then `onClick`, then the href.** You can cancel `select`. A
  call to `preventDefault()` there gives the routing back to you, and skips the other two steps.
- **The separator is a real element with `aria-hidden`**, not CSS generated content. So a screen
  reader never announces it. To change it, pass your own string or DOM.
- **There is no `max` prop.** A long trail wraps. To collapse it, make `items` shorter yourself.
- **The panel has no filter field.** A picker with hundreds of options wants one; cap the list
  yourself until it lands.

Related: imp skill std/shell - the frame that renders a trail from the map.
