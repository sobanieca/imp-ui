# notifications - the bell with the unread count, and the drawer of recent notifications

```js
import { notifications, userCard } from 'imp/std/shell'
import { notify, toast } from 'imp/std/feedback'

shell({ extras: [notifications(), userCard(session)] }, toast(), router(...))

notify({ kind: 'success', title: 'Report sent' })
```

The call shape is `notifications(props?)`. It takes no content and no data. It lists what `notify`
raised, see toast (imp skill std/toast).

| Prop      | Values                                                    | Default     | Notes                              |
| --------- | --------------------------------------------------------- | ----------- | ---------------------------------- |
| `label`   | string, or a state - **live**                             | translated  | The accessible name of the bell    |
| `variant` | `'default'`, `'primary'`, `'ghost'`, `'danger'`, `'link'` | `'default'` | Passed to `button`                 |
| `size`    | `'sm'`, `'md'`, `'lg'`                                    | `'md'`      | Passed to `button`                 |
| `events`  | event map                                                 | -           | Bound on the root of the component |

Rules an agent gets wrong:

- **There is no `items` prop and no `count` prop.** The bell reads the app-wide store that `notify`
  writes. To add a row, call `notify`. To remove one, call `dismiss(id)`.
- **The bell renders its own drawer.** Do not mount a `drawer` for it, and do not pass an `open`
  state. A press opens a modal drawer titled "Notifications", and Escape closes it.
- **To open the drawer takes the listed popups out of the corner.** While the drawer is open, a new
  listed entry goes to the list only, with no popup.
- **To open the drawer marks every entry as read, and so does an arrival while it is open.** So the
  count is the number of entries that arrived since the person last looked. There is no unread
  toggle per entry, and no "mark all as read" control.
- **The name carries the count.** It is "Notifications", or "Notifications, 3 unread". imp updates
  it in place, and the bell is not a live region. A `label` of your own replaces the whole name. Put
  the count in it yourself, from a state.
- **The count tag is absent at zero**, and it shows `99+` above 99.
- **An entry with `ttl: 0` never reaches the list.** It is a plain toast, and it does not count.
- **A row works as the popup does.** An action resolves the promise of `notify`, and the row then
  shows the label of the chosen action in place of the buttons. The link closes the drawer. The
  dismiss button of a row removes the entry and resolves the promise with `null`.
- **"Clear all" removes every listed entry**, and it resolves each pending promise with `null`.
- **The bell needs no `toast()` region.** Without a region there are no popups, and the list still
  fills.
- The relative time of a row comes from `Intl.RelativeTimeFormat` in the active language. imp
  refreshes it while the drawer is open.
- The wording is under `imp.notifications.label`, `imp.notifications.labelUnread` with `{count}`,
  `imp.notifications.empty`, `imp.notifications.clearAll` and `imp.toast.dismiss`.

```js
shell(
  {
    logo: appLogo({ label: 'Acme' }),
    extras: [notifications({ variant: 'ghost' }), userCard({ name })],
  },
  toast({ client: 'acme.api' }),
  router(routes),
)
```

Related: toast (imp skill std/toast), imp skill std/shell, imp skill i18n
