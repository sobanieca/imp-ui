# toast and notifications - a popup that a person can revisit later

A toast is the usual popup in the corner. imp goes one step further. Every toast is also a
notification. A `notifications` bell in the `shell` opens a drawer, and that drawer lists the recent
notifications of the app. So a person who missed a popup can still read it, follow its link, and
answer its actions. Three exports, and one store, make that work:

| Export            | From               | What it is                                                  |
| ----------------- | ------------------ | ----------------------------------------------------------- |
| `notify(data)`    | `imp/std/feedback` | A function. Raises a notification from anywhere in the app  |
| `toast(props?)`   | `imp/std/feedback` | The region. Renders the popups in the corner. Mount it once |
| `notifications()` | `imp/std/shell`    | The bell. Shows the unread count, and opens the drawer      |

```js
import { notify, toast } from 'imp/std/feedback'
import { notifications, userCard } from 'imp/std/shell'

shell({ extras: [notifications(), userCard(session)] }, toast({ client: 'acme.api' }), router(...))

notify({ kind: 'success', title: 'Report sent' })

const choice = await notify({
  kind: 'warning',
  title: 'Invoice 1042 is overdue',
  description: 'The payment was due three days ago.',
  link: { href: '/invoices/1042', label: 'Open the invoice' },
  actions: [{ id: 'remind', label: 'Send a reminder' }, { id: 'ignore', label: 'Ignore' }],
  duration: 0,
})
```

## The store

One store holds every notification of the app. It is a `createState` value, built on first use, in a
module beside the region. Its value is plain data, one array, newest first, see
`adr/state-plain-data-values.md`. `notify` writes to it. `toast` and `notifications` watch it. So
the popup, the count on the bell, and the list in the drawer can never disagree.

The store is app-wide on purpose, and not a named state that a call site resolves from its position.
Two reasons decide that:

- **A notification outlives an area.** The bell sits in the frame, and the region sits beside the
  router. A call site in an area cannot be an ancestor of either. The same reasoning already puts
  the messages of a toast queue at the level of the app, see `skills/i18n.md`.
- **The HTTP client raises one from outside any component.** `lastError` of a client has no `self`.
  A function that needs no `self` is the only shape that fits, see `adr/http-client.md`.

The store keeps at most `limit` entries, and it drops the oldest beyond that. A `ttl` timer removes
an entry when its time is over. The store lives in memory, for the session. A reload empties it. The
reason is the actions. A pending action is a promise at a call site, and a promise does not survive
a reload. The open question below records the alternative.

## A notification

`notify(data)` takes one plain object. `title` is the only required key:

| Key           | Values                                        | Default              | Notes                                                      |
| ------------- | --------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `id`          | string                                        | generated            | A call with the `id` of a listed entry updates it in place |
| `kind`        | `'info'`, `'success'`, `'warning'`, `'error'` | `'info'`             | Picks the icon, the colour, and the live region            |
| `title`       | string                                        | - required           | One line. The accessible name of the entry                 |
| `description` | string                                        | -                    | Plain text under the title                                 |
| `icon`        | a Lucide export                               | the icon of `kind`   | Replaces the icon of the kind                              |
| `image`       | URL string                                    | -                    | An avatar, a thumbnail. Replaces the icon                  |
| `link`        | `{ href, label, external? }`                  | -                    | One link under the description. Renders the std `link`     |
| `actions`     | `[{ id, label, variant? }]`                   | -                    | Up to three small buttons. `variant` is a `button` variant |
| `duration`    | milliseconds                                  | `duration` of region | How long the popup stays. `0` keeps it until a dismissal   |
| `ttl`         | milliseconds                                  | `ttl` of region      | How long the entry stays in the list. `0` lists it never   |

Every key is plain data, and that is the reason for two limits. `icon` takes a Lucide export, which
is plain data, and not any DOM. `description` is text, and not markup. A link is its own key, so
that the text stays a string. To put a link inside the description would need markup in a string,
and nothing in imp reads markup from a string.

The store adds three keys to every entry. `time` is the ISO time of the call. `read` is a boolean.
`choice` is the `id` of the action that the person took, or `null` while none is taken.

`notify` returns a promise. It resolves with the `id` of the action that the person chose. It
resolves with `null` when the person dismisses the entry, or when the entry expires from the list.
An entry with no action resolves on its dismissal or its expiry too. A call site that wants no
answer ignores the promise. `dismiss(id)` removes an entry from the popup and from the list, and it
resolves the promise with `null`. `imp/std/feedback` exports it beside `notify`.

An `id` that is already listed updates the entry in place. That is how a call site reports the
progress of one job, and how a repeated failure stays one entry. An update shows the popup again
when the entry has left the corner.

## `toast` - the region

`toast(props?)` renders the popups. An app mounts it once, usually as the first child of the main
content of `shell`. It promotes itself with `popover="manual"`, on the non-modal half of the seam,
see `adr/overlay-top-layer.md`. So no ancestor clips it, it needs no z-index, and the page behind it
stays live. It takes no children. imp warns when a second region mounts, and the second one renders
nothing.

| Prop       | Values                              | Default    | Notes                                                |
| ---------- | ----------------------------------- | ---------- | ---------------------------------------------------- |
| `duration` | milliseconds                        | `5000`     | The default time on screen of a popup                |
| `ttl`      | milliseconds                        | `86400000` | The default time in the list. One day                |
| `visible`  | number                              | `3`        | Popups on screen at once. The rest wait in order     |
| `limit`    | number                              | `100`      | Entries the store keeps                              |
| `client`   | name of an HTTP client, or an array | -          | Raises an `error` notification from each `lastError` |

The region sits at the `block-start` and `inline-end` corner. That is the top right corner under
`dir="ltr"`, and the top left corner under `dir="rtl"`. There is no placement prop. The newest popup
is nearest to the corner. On a phone, a popup takes the full inline size, still at the top.

A popup shows the icon or the image, the title, the description, the link, the actions, and a
dismiss button. The timer of `duration` pauses while the pointer is over the popup, and while an
element inside it has the focus. A click on the link, or on an action, closes the popup. The entry
stays in the list, marked as read, and with its `choice` recorded. A popup never steals the focus.
Escape closes the popup that holds the focus. The popups slide in from the inline end, and they obey
`prefers-reduced-motion`, through the shared `overlayMotion`.

The `client` prop is the wiring that the feedback group owes the HTTP client, see
`todo/stdlib-components.md`. The region resolves each name with `useHttpClient`, from its own
position. Each new value of `lastError` becomes an `error` notification. Its title comes from the
error, through the same rules that the client uses for a log line.

## `notifications` - the bell and the drawer

`notifications(props?)` is a `shell` region component. It goes in `extras`, beside `userCard`. It
composes `button` with `luBell`, and a `tag` with the unread count. The tag is absent at zero. The
accessible name is "Notifications", or "Notifications, 3 unread", through `t()`.

| Prop      | Values                 | Default     | Notes                              |
| --------- | ---------------------- | ----------- | ---------------------------------- |
| `label`   | string, or a state     | translated  | The accessible name of the bell    |
| `variant` | any `button` variant   | `'default'` | Passed to `button`                 |
| `size`    | `'sm'`, `'md'`, `'lg'` | `'md'`      | Passed to `button`                 |
| `events`  | event map              | -           | Bound on the root of the component |

A press opens a modal `drawer`, titled "Notifications". The bell renders that drawer itself, so the
drawer needs no mount point in the app. The drawer lists the entries of the store, newest first. A
row shows the same content as a popup, plus a relative time, such as "3 minutes ago", from
`Intl.RelativeTimeFormat` in the active `lang`. The actions of a row work the same as in a popup. A
row whose `choice` is set shows the label of the chosen action in place of the buttons. Each row has
its own dismiss button. The foot of the drawer holds "Mark all as read" and "Clear all". An empty
list renders `emptyState`.

To open the drawer marks every listed entry as read. So the count on the bell is the number of
entries that arrived since the person last looked. There is no per-entry unread toggle.

An entry with `ttl: 0` never reaches the list. It is a plain toast. So an app that mounts no bell
loses nothing, and an app that mounts one gets the history at no extra call.

## Accessibility

- **Two live regions, not one.** The region renders a `role="status"` element for `info` and
  `success`, and a `role="alert"` element for `warning` and `error`. So a failure interrupts, and a
  confirmation waits for a pause. The text of a popup lands in the live region at the moment
  `notify` runs, see `todo/accessibility.md`.
- **The keyboard path to a popup is the Tab order.** The buttons of a popup sit in the Tab order at
  the position of the region in the DOM. That is early, when the region is the first child of the
  content. The drawer of the bell is the reliable path, and every popup is also a row there.
- **Every action is a real `button`**, and the link is a real `a[href]`. The dismiss button is
  icon-only, and it takes its name from `t()`.
- **The bell has an accessible name that carries the count.** A change of the count updates the
  name, and it does not announce, because the bell is not a live region.
- **The test of the region asserts the roles, the names, the Tab order, Escape, and the pause of the
  timer on focus.** The test of the bell asserts the count, the name, and the drawer. Both run under
  `dir="rtl"` as well, for the corner and for the slide.

## Wording

Every string routes through `t()`, with `defaultMessages` beside the `component()` call, see
`adr/translatable-by-default.md`:

| Key                             | English                       |
| ------------------------------- | ----------------------------- |
| `imp.notifications.label`       | Notifications                 |
| `imp.notifications.labelUnread` | Notifications, {count} unread |
| `imp.notifications.empty`       | No notifications              |
| `imp.notifications.markAllRead` | Mark all as read              |
| `imp.notifications.clearAll`    | Clear all                     |
| `imp.toast.dismiss`             | Dismiss                       |

## Dependencies

`drawer`, `button`, `link`, `tag`, `icon` and `emptyState` have all landed. The non-modal half of
the overlay seam has landed, see `adr/overlay-top-layer.md`. `badge` from _Display_ is not a
blocker. The count rides on `tag`. So nothing blocks this item.

## Skills and docs

Ship `toast.skill.md` beside the region, and `notifications.skill.md` beside the bell. Put `notify`
and `dismiss` in `toast.skill.md`, because the region is what makes them show anything. Add a
section to `docs/std-components.md`, and to `skills/preview.md` where the preview of the region
needs a note. Add a `toast.preview.js` that raises each kind, a long one, one with an image, and one
with actions. Add a `notifications.preview.js` inside a `shell` frame.

## ADR impact

Record the store as an ADR, `adr/app-wide-notification-store.md`. The decision is that a
notification is app-wide plain data in one store, raised by a function with no `self`, and rendered
by two independent watchers. The consequence to record is the limit on the data: a Lucide icon or an
image URL, text with no markup, and actions as ids. Update `adr/shell-region-components.md` with the
bell. Update `todo/stdlib-components.md` and `todo/overlay-seam.md` when the item lands, and delete
this file.

## Open questions

- **Persistence.** A `ttl` of one day suggests that the list survives a reload. The store could
  write its plain data to `localStorage`, and drop the pending promises. An action of an entry that
  was loaded from storage would then need a handler on the region, such as
  `toast({ onAction: (entry, id) => ... })`. That is a second way to answer an action. Decide it
  when an app asks for the history across sessions. Until then, the app that needs a durable list
  feeds `notify` from its server on start.
- **The default `ttl`.** One day keeps a dashboard that stays open all day honest. It also means
  that every toast of an app with no bell sits in memory for a day, up to `limit`. Confirm the value
  with the first real app.
- **A sound, or a browser `Notification`.** Out of scope. An app that wants the system tray calls
  the platform itself.
