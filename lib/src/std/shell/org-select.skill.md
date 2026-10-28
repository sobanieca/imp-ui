# orgSelect - the organization switcher of a multi-tenant app: a menu of the tenants, the current one on the trigger

```js
import { orgSelect } from 'imp/std/shell'

orgSelect({ orgs: memberships, selected: currentOrg })
orgSelect({
  orgs: [
    { id: 'acme', name: 'Acme', description: 'Owner' },
    { id: 'globex', name: 'Globex' },
  ],
  selected: 'acme',
  events: { select: (event) => navigate(app.organizations.$org.href({ org: event.detail.id })) },
})
```

The call shape is `orgSelect(props)`. It takes no content, and it renders one `menuButton`. The
trigger shows the avatar and the name of the current organization. The menu lists every organization
with a check mark on the current one.

| Prop       | Values                                                                 | Default                          | Notes                                               |
| ---------- | ---------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| `orgs`     | array of `{ id, name, description?, picture? }`, or a state - **live** | `[]`                             | The organizations the person belongs to             |
| `selected` | an `id`, or a **writable** state - **live**                            | the first org                    | The current organization                            |
| `label`    | string, or a state - **live**                                          | "Organization: {org}", via `t()` | The accessible name of the trigger                  |
| `variant`  | as on `button`                                                         | `'ghost'`                        | The look of the trigger                             |
| `size`     | `'sm'`, `'md'`, `'lg'`                                                 | `'md'`                           | The size of the trigger                             |
| `compact`  | boolean                                                                | `false`                          | Avatar only on the trigger; the name stays for AT   |
| `events`   | `{ select }`                                                           | -                                | `detail: { id, org }`, cancelable, before the write |

Rules an agent gets wrong:

- **imp holds no tenant.** The component shows `orgs`, marks `selected`, and reports a choice. What
  a choice means is the app's: a navigation to the URL of the tenant, a new token, a reload of the
  data. Do that in `select`, or in a `watch` of the state you passed as `selected`.
- **A multi-tenant app puts the tenant in the URL.** Then `selected` is the `org` param of the
  route, and `select` navigates to `app.organizations.$org.href({ org: event.detail.id })`. See imp
  skill routing for `scope` and the param node.
- **Pass a writable state as `selected` when the app must move it.** imp writes the chosen `id` back
  into it, after a `select` that nothing cancelled. A `computed` is read-only, and imp warns when it
  cannot write. A plain `id` is the start value, and the component then owns the choice.
- **`select` is cancelable.** A `preventDefault()` in the handler keeps the current organization.
  Use it when a switch must be confirmed first.
- **An organization is data, not DOM.** `picture` is a URL. Without one, imp draws the initials of
  `name` in a square avatar. `description` is a muted line under the name in the menu, such as the
  role of the person or the plan.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Every organization is a
  `menuitemradio` with `aria-checked`. The keys, the placement and the dismissal are the ones of
  every menu.
- **Inside `shell`, put it in the `logo` slot beside `appLogo`, or in `extras`.** Write
  `logo: flex({ gap: 2, verticalAlign: 'center' }, appLogo({ label: 'Acme' }), orgSelect(...))`. The
  frame moves the whole block into the drawer on a phone. In the icon rail the block is hidden with
  the logo.
- **Do not confuse it with `themeSelect` and `langSelect`.** Those set an app-wide state of imp,
  which `init` can store. `orgSelect` remembers nothing, because the tenant belongs to the session
  and the URL.
- imp warns about an `orgs` entry without a `name`, about an empty list, and about an unknown prop.

```js
import { component } from 'imp'
import { computed, initState } from 'imp/state'
import { navigate, useRoute } from 'imp/router'
import { flex } from 'imp/std/layout'
import { appLogo, orgSelect, shell } from 'imp/std/shell'
import { app } from './app-map.js'

export const frame = component('myapp-frame', {
  setup: (self) => {
    const memberships = initState(self, 'myapp.memberships', [])
    const currentOrg = computed([useRoute()], (route) => route.params.org)
    return shell(
      {
        logo: flex(
          { gap: 2, verticalAlign: 'center' },
          appLogo({ label: 'Acme' }),
          orgSelect({
            orgs: memberships,
            selected: currentOrg,
            events: {
              select: (event) => navigate(app.organizations.$org.href({ org: event.detail.id })),
            },
          }),
        ),
        map: app,
      },
      router({ map: app, scope: app.organizations.$org, screens }),
    )
  },
})
```

Related: imp skill std/shell - the frame and its `logo` slot; imp skill routing - the tenant in the
URL; imp skill std/menuButton - the control it renders; imp skill std/userCard - the person beside
it.
