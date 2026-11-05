# notice - an inline message banner: info, success, warning or error (an "alert" elsewhere)

```js
import { notice } from 'imp/std/feedback'

notice({ title: 'A new version is ready' }, 'Reload the page to get it.')
notice(
  { kind: 'warning', title: 'Your trial ends in 3 days' },
  'Add a payment method to keep your projects.',
  button({ variant: 'link' }, 'Add payment'),
)
notice({ kind: 'error', title: 'Could not save', dismissible: true })
notice({ kind: 'error', title: 'Could not save', open })
notice({ client: 'myapp.api' })
```

The call shape is `notice(props, ...children)`. The children are the description and any actions.
They sit under the title.

| Prop          | Values                                        | Default  | Notes                                                            |
| ------------- | --------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `kind`        | `'info'`, `'success'`, `'warning'`, `'error'` | `'info'` | Picks the icon, the colour and the role. `'error'` with `client` |
| `title`       | string or state                               | none     | Live. The bold first line                                        |
| `icon`        | an icon from `imp/icons`, or a DOM node       | by kind  | Replaces the icon of the kind                                    |
| `dismissible` | boolean                                       | `false`  | Adds a close button. `true` with `client`                        |
| `open`        | boolean or state                              | `true`   | Live. A dismiss writes `false` into a writable state             |
| `client`      | the name of an HTTP client, or the client     | none     | Shows the last error of that client                              |
| `events`      | DOM event map                                 | none     | Bound on the host. `dismiss` fires with `detail.open`            |

| Kind      | Colour token    | Role     |
| --------- | --------------- | -------- |
| `info`    | `color-info`    | `status` |
| `success` | `color-success` | `status` |
| `warning` | `color-warning` | `alert`  |
| `error`   | `color-danger`  | `alert`  |

The close button reads its name from the key `imp.notice.dismiss`, which is `Dismiss` in English.

Rules an agent gets wrong:

- **Import the component from `imp/std/feedback`**, not from `imp/std`.
- **The name is `notice`, not `alert`.** An `alert` import shadows the `alert()` of the browser.
- **The description is a child, not a prop.** Write `notice({ title }, 'The words.')`. The
  description is small text, so give an action button `size: 'sm'`.
- **Show a notice later through `open`, not through a `view()`.** A screen reader announces a change
  inside a live region that is already on the page. It does not announce a region that arrives with
  its words. So mount the notice with `open` at `false`, and set the state to `true`.
- **A closed notice takes no space.** imp keeps the live region mounted and hides it from view.
- **A dismiss writes `false` into `open`.** Pass a writable state, same as `dialog`. A plain `true`
  also works, and then the notice only hides itself. Listen for `events.dismiss` to react.
- **`client` makes an error notice with no other prop.** It stays hidden while `lastError` of the
  client is `null`. The title is the message of the error. It clears when a later call succeeds.
- **With `client` and `title`, your title comes first.** The message of the error sits under it.
- **A dismiss of a client notice calls `clearError()` of the client.** So the next failure shows the
  notice again, and every other reader of `lastError` sees `null` too. `open` stays as it is.
- **`client` as a name resolves from the position of the component.** An ancestor must call
  `initHttpClient` for that name. If none did, imp logs an error and the notice stays closed.
- **Use `kind: 'error'` for a failure, and `warning` for a risk.** Both interrupt a screen reader.
  `info` and `success` wait for a pause. Do not use an alert role for routine news.
- **A notice is part of the page.** It does not float and it does not leave by itself.

```js
import { component } from 'imp'
import { initState } from 'imp/state'
import { button } from 'imp/std'
import { notice } from 'imp/std/feedback'
import { stack } from 'imp/std/layout'

export const importer = component('myapp-importer', {
  setup: (self) => {
    const failed = initState(self, 'myapp.import.failed', false)
    const run = () => failed.set(true)
    return stack(
      { gap: 3 },
      notice(
        { kind: 'error', title: 'The import stopped at row 214', open: failed, dismissible: true },
        'Fix the date in that row, then run the import again.',
        button({ variant: 'link', size: 'sm', events: { click: run } }, 'Run again'),
      ),
      button({ variant: 'primary', events: { click: run } }, 'Import'),
    )
  },
})
```

Related: imp skill http - `lastError`, `clearError()` and `tracked()`; imp skill std/progress - the
calls in flight of the same client; imp skill std/dialog - the same `open` contract; imp skill
icons - the values of `icon`.
