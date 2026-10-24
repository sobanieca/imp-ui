# toast - the corner popups, with `notify` and `dismiss` that feed them

```js
import { dismiss, notify, toast } from 'imp/std/feedback'

shell({ extras: [notifications()] }, toast({ client: 'acme.api' }), router(...))

notify({ kind: 'success', title: 'Report sent' })

const choice = await notify({
  id: 'invoice-1042',
  kind: 'warning',
  title: 'Invoice 1042 is overdue',
  description: 'The payment was due three days ago.',
  link: { href: '/invoices/1042', label: 'Open the invoice' },
  actions: [{ id: 'remind', label: 'Send a reminder' }, { id: 'ignore', label: 'Ignore' }],
  duration: 0,
})

dismiss('invoice-1042')
```

There are three exports. `toast(props?)` is the region, and it takes no content. `notify(data)` is a
plain function that raises a notification from anywhere. `dismiss(id)` removes one. All three share
one app-wide store. The bell reads the same store, see notifications (imp skill std/notifications).

## `notify(data)`

| Key           | Values                                        | Default              | Notes                                               |
| ------------- | --------------------------------------------- | -------------------- | --------------------------------------------------- |
| `title`       | string                                        | - required           | One line. The accessible name of the entry          |
| `id`          | string                                        | generated            | A call with a listed `id` replaces that entry       |
| `kind`        | `'info'`, `'success'`, `'warning'`, `'error'` | `'info'`             | Picks the icon, the colour and the live region      |
| `description` | string                                        | -                    | Plain text under the title                          |
| `icon`        | an icon from `imp/icons`                      | the icon of `kind`   | Replaces the icon of the kind                       |
| `image`       | URL string                                    | -                    | An avatar or a thumbnail. Replaces the icon         |
| `link`        | `{ href, label, external? }`                  | -                    | One link under the description                      |
| `actions`     | `[{ id, label, variant? }]`                   | -                    | Up to three small buttons. `variant` is of `button` |
| `duration`    | milliseconds                                  | `duration` of region | Time in the corner. `0` keeps it until a dismissal  |
| `ttl`         | milliseconds                                  | `ttl` of region      | Time in the list of the bell. `0` lists it never    |

`notify` returns a promise. It resolves with the `id` of the action that the person chose. It
resolves with `null` when the entry is dismissed, when it expires, or when the store drops it.

## `toast(props?)`

| Prop       | Values                              | Default    | Notes                                                |
| ---------- | ----------------------------------- | ---------- | ---------------------------------------------------- |
| `duration` | milliseconds                        | `5000`     | The default time in the corner                       |
| `ttl`      | milliseconds                        | `86400000` | The default time in the list. One day                |
| `visible`  | number                              | `3`        | Popups in the corner at once. The rest wait in order |
| `limit`    | number                              | `100`      | Entries the store keeps. It drops the oldest         |
| `client`   | name of an HTTP client, or an array | -          | Raises an `error` notification from each `lastError` |
| `message`  | `(error) => string`                 | -          | The title of a client failure. Gets `lastError`      |

Rules an agent gets wrong:

- **Mount `toast()` once**, as the first child of the content of `shell`. A second region warns and
  renders nothing. `notify` needs no region to store an entry, but only a region shows a popup.
- **`notify` and `dismiss` take no `self`.** Call them from a handler, a module or a hook of an HTTP
  client. They are functions, not components. Do not put `notify(...)` in a tree.
- **Every key is plain data.** `description` is text, and markup in it shows as text. `icon` is an
  export of `imp/icons`, never `icon(...)` and never DOM. A link is the `link` key, never markup.
- **Pass an `id` to change an entry later.** A generated id is not returned. A call with a listed
  `id` replaces the whole entry, so pass the `title` again. That is how to report progress, and it
  keeps a repeated failure as one entry.
- **An update keeps its place while the popup is in the corner.** When the popup has left, the
  update shows it again as the newest entry, unread, and with no `choice`.
- **Await the promise only when the entry has `actions`.** An entry with `duration: 0` and no
  dismissal keeps the promise pending until the `ttl` ends.
- **The dismiss button and Escape close the popup only.** The entry stays in the list, marked as
  read, and the promise stays pending. `dismiss(id)` and the dismiss button of a row in the bell
  remove the entry and resolve `null`. An entry with `ttl: 0` has no list, so to close its popup
  removes it.
- **A click on an action resolves the promise, closes the popup and marks the entry as read.** A
  click on the link closes the popup and marks the entry as read. Do not also navigate in a handler.
- **There is no placement prop.** The region sits at the block-start, inline-end corner. That is the
  top right under `dir="ltr"` and the top left under `dir="rtl"`. Below `48rem` it takes the full
  inline size.
- **The timer of a popup waits** while the pointer is over the popup, and while the focus is inside
  it. A popup never takes the focus.
- **A call with `silent: true` raises no notification.** Use it for a failure that the page shows
  itself. An aborted call raises none either. Do not create a second client to keep the toast quiet.
- **`client` names a client that an ancestor initialized.** The region calls `useHttpClient` from
  its own position, and imp throws when no ancestor provides the name. The title of the notification
  is the text that `message` returns, else the `message` of `lastError`. The `id` comes from the client name, the method and the URL, so
  the same request that fails again stays one entry.
- **A screen reader hears the title and the description once.** `info` and `success` go to a
  `role="status"` element. `warning` and `error` go to a `role="alert"` element. Do not add a live
  region of your own.
- The words "Dismiss" and "Notifications" are `imp.toast.dismiss` and `imp.notifications.label`.
  Override them in your translations, see imp skill i18n.

```js
const save = async () => {
  notify({ id: 'export', title: 'Exporting the report', description: '0%', duration: 0 })
  for await (const percent of exportReport()) {
    notify({ id: 'export', title: 'Exporting the report', description: `${percent}%`, duration: 0 })
  }
  notify({
    id: 'export',
    kind: 'success',
    title: 'The report is ready',
    link: { href: '/reports/latest', label: 'Open the report' },
  })
}
```

Related: notifications (imp skill std/notifications), imp skill http, imp skill i18n
