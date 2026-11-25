# tenantSelect - the tenant switcher of a multi-tenant app: a menu of the tenants, the current one on the trigger

```js
import { tenantSelect } from 'imp/std/shell'

tenantSelect({ tenants: memberships, selected: currentTenant })
tenantSelect({
  tenants: [
    { id: 'acme', name: 'Acme', description: 'Owner', tag: { text: 'Admin', color: 'violet' } },
    { id: 'globex', name: 'Globex' },
  ],
  selected: 'acme',
  events: { select: (event) => navigate(app.organizations.$org.href({ org: event.detail.id })) },
})
tenantSelect({ tenants, selected, onCreateClick: () => navigate(app.newOrg.href()) })
```

The call shape is `tenantSelect(props)`. It takes no content, and it renders one `menuButton`. A
tenant is the unit that a multi-tenant app keeps apart: an organization, a workspace, a team or an
account. The trigger shows the avatar, the name and the tag of the current tenant. The menu lists
every tenant with a check mark on the current one. With `onCreateClick` the menu opens with "Create
workspace" above the tenants, an item that runs only after a held press.

| Prop            | Values                                                                       | Default                      | Notes                                              |
| --------------- | ---------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `tenants`       | array of `{ id, name, description?, picture?, tag? }`, or a state - **live** | `[]`                         | The tenants the person belongs to                  |
| `selected`      | an `id`, or a **writable** state - **live**                                  | the first tenant             | The current tenant                                 |
| `label`         | string, or a state - **live**                                                | "Workspace: {tenant}", `t()` | The accessible name of the trigger                 |
| `variant`       | as on `button`                                                               | `'ghost'`                    | The look of the trigger                            |
| `size`          | `'sm'`, `'md'`, `'lg'`                                                       | `'md'`                       | The size of the trigger                            |
| `compact`       | boolean                                                                      | `false`                      | Avatar only on the trigger; the name stays for AT  |
| `onCreateClick` | `() => void`                                                                 | -                            | Puts a held "Create workspace" first in the menu   |
| `events`        | `{ select }`                                                                 | -                            | `detail: { id, tenant }`, cancelable, before write |

Rules an agent gets wrong:

- **imp holds no tenant.** The component shows `tenants`, marks `selected`, and reports a choice.
  What a choice means is the app's: a navigation to the URL of the tenant, a new token, a reload of
  the data. Do that in `select`, or in a `watch` of the state you passed as `selected`.
- **A multi-tenant app puts the tenant in the URL.** Then `selected` is the param of the route, and
  `select` navigates to `app.organizations.$org.href({ org: event.detail.id })`. See imp skill
  routing for `scope` and the param node.
- **Pass a writable state as `selected` when the app must move it.** imp writes the chosen `id` back
  into it, after a `select` that nothing cancelled. A `computed` is read-only, and imp warns when it
  cannot write. A plain `id` is the start value, and the component then owns the choice.
- **The create action is the first item of the menu, and it is held.** "Create workspace" sits
  above the tenants, where a person finds it. It runs only after the person holds the pointer,
  `Enter` or `Space` on it for 1.5 seconds, the time of `hold: true`, while a fill sweeps across it.
  A plain click does nothing, so a person who switches tenants never creates one by a slip. What it
  does is yours: `onCreateClick` opens a page or a dialog. Without it there is no create item. When
  `tenants` is empty, a triple-dot menu named "Workspace actions" holds the item alone, so a person
  with no tenant can create the first one.
- **The words say "Workspace".** The keys are `imp.tenant.current`, `imp.tenant.create` and
  `imp.tenant.actions`. An app that calls its tenants "organizations" or "teams" overrides them in
  its translations. See i18n (imp skill i18n).
- **`select` is cancelable.** A `preventDefault()` in the handler keeps the current tenant. Use it
  when a switch must be confirmed first.
- **A tenant is data, not DOM.** `picture` is a URL. Without one, imp draws the initials of `name`
  in a square avatar. `description` is a muted line under the name in the menu, such as the plan.
  `tag` is `{ text, color }`, a small `tag` beside the name, on the trigger and in the menu: the
  role of the person in the tenant, such as Admin. Do not draw a role `tag` of your own next to the
  component. The trigger cuts a long name with an ellipsis (up to
  `--imp-tenant-select-name-max-inline-size`, `12rem` by default) and keeps the tag in view.
- **The menu is a `menuButton`**, see imp skill std/menuButton. Every tenant is a `menuitemradio`
  with `aria-checked`. The keys, the placement and the dismissal are the ones of every menu.
- **Inside `shell`, put it in the `tenant` prop**, never in `logo`. The bar shows it beside the
  logo. On a phone the frame moves it into the drawer, on a row of its own under the logo. In the
  icon rail it is hidden with the logo.
- **Do not confuse it with `themeSelect` and `langSelect`.** Those set an app-wide state of imp,
  which `init` can store. `tenantSelect` remembers nothing, because the tenant belongs to the
  session and the URL.
- imp warns about a `tenants` entry without a `name`, about an empty list, and about an unknown
  prop.

```js
import { component } from 'imp'
import { computed, initState } from 'imp/state'
import { navigate, useRoute } from 'imp/router'
import { appLogo, shell, tenantSelect } from 'imp/std/shell'
import { app } from './app-map.js'

export const frame = component('myapp-frame', {
  setup: (self) => {
    const memberships = initState(self, 'myapp.memberships', [])
    const currentTenant = computed([useRoute()], (route) => route.params.org)
    return shell(
      {
        logo: appLogo({ label: 'Acme' }),
        tenant: tenantSelect({
          tenants: memberships,
          selected: currentTenant,
          events: {
            select: (event) => navigate(app.organizations.$org.href({ org: event.detail.id })),
          },
        }),
        map: app,
      },
      router({ map: app, scope: app.organizations.$org, screens }),
    )
  },
})
```

Related: imp skill std/shell - the frame and its `tenant` prop; imp skill routing - the tenant in
the URL; imp skill std/menuButton - the control it renders; imp skill std/userCard - the person
beside it; imp skill i18n - the words of the trigger and the create menu.
