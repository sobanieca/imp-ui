# analytics - page views, zones and outcomes as plain records, sent to a sink the app registers

```js
import { batch, onAnalytics, track, zone } from 'imp/analytics'
```

imp collects the records. The app registers a sink that forwards each record to a store. imp bundles
no provider and makes no network call.

| Level      | Tool                                   | Record         |
| ---------- | -------------------------------------- | -------------- |
| a page     | nothing - the router records each view | `view`, `time` |
| a zone     | `zone({ name }, ...children)`          | `zone`         |
| an outcome | `track(name, value?)`                  | `action`       |
| a failure  | nothing - imp reports it               | `error`        |

## Records

Every record has `type`, `visit`, `view` and `page`. `visit` is one random id per document load, in
memory only. `view` is one random id per view. `page` is the route pattern of the matched node, such
as `/invoices/:id`, or `null` for a path off the map.

| `type`   | Other fields                                                            | Sent                                                             |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `view`   | `from` (previous page, `null` on entry), `readyMs`, `waitedMs`, `path`  | when the screen is ready, or the view ends, or the page hides    |
| `time`   | `ms` - engaged time, visible and focused, as a delta                    | when the document hides, and when the view ends                  |
| `zone`   | `name`, `seen`, `activeMs`, as a delta                                  | when the document hides, and when the view ends                  |
| `action` | `name`, `value` (only when given)                                       | at the `track()` call                                            |
| `error`  | `source` (`script`, `render`, `request`), `message` (one line), `count` | at the failure; repeats when the document hides or the view ends |

- `path` is on a `view` with `page: null` only. It has no query.
- `readyMs` is `null` when the person left before the screen was ready. Then `waitedMs` is the time
  from the navigation to the leave. A page that hides or unloads before the screen is ready sends
  its view at once, and only once.
- imp scrubs `path` and the text of `message`: an email (also `%40`) becomes `:email`, a JSON Web
  Token or a word with 16+ letters and digits in a row, with a digit and a letter, becomes `:token`.
  Numbers, UUIDs and slugs stay. Put each screen on the map, so that it records the route pattern.
- `error` is one record per kind (`source` + `message`) per view, with `count: 1`. Repeats of that
  kind go out as one record with their `count`. A view sends 10 kinds or fewer. The
  `ResizeObserver loop ...` messages and a cross-origin `Script error.` give no record.
- A change of the query only is no view. A guard redirect or a `redirect()` binding is no view.
- `error` sources: `script` is an uncaught error, an unhandled rejection, or a state subscriber that
  throws. `render` is an error in a component. `request` is an `imp/http` request that fails on the
  network, times out, or answers 5xx: `request failed: 500 POST /path`. No record has a stack.
- A message never has the origin or the query of a URL: imp writes the path only. One failed request
  gives one record: an uncaught 5xx or network error that already gave a `request` record gives no
  `script` or `render` record. An uncaught 4xx gives a `script` or `render` record with the request
  message.

## Calls

| Call                                  | Does                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `onAnalytics(sink, { when? })`        | registers a sink for the page; returns the function that unregisters it |
| `onAnalytics(self, sink, { when? })`  | the same, and unregisters when the component unmounts                   |
| `batch(send, { size: 20, ms: 5000 })` | returns a sink that calls `send(records)` in batches                    |
| `zone({ name }, ...children)`         | wraps any content; records `seen` and the active time per view          |
| `track(name, value?)`                 | records an outcome; `value` is a string or a number from code           |

`batch` sends when the array reaches `size`, when `ms` passes, when the page hides or unloads (after
the records of that hide), when its `when` state stops being `true`, and when the sink is
unregistered.

`when` is a state. `true` sends the records to the sink. `false` drops them, and drops the held
records. Any other value (`null`) holds them: the first held view and the newest 199 records. After
`false`, the sink starts again with the `view` record of the current screen.

## Rules an agent gets wrong

- **Register the sink before `mount`.** A sink that registers later gets the `view` record of the
  current screen at once, but no other record from before it. `imp start` registers a log sink
  first, so each app sink joins a running collection in development.
- **`zone({ name: 'due-date' }, child)`, never `zone('due-date', child)`.** The name is kebab case.
  `track` names are kebab case too. imp logs a bad name, and records nothing for it.
- **A zone around text only is never seen.** It observes its child elements. Wrap the text in an
  element: `zone({ name: 'intro' }, p(t('...')))`.
- **Put a zone in each tab panel** to measure tabs. A hidden panel has no box, so its zone is not
  seen.
- **`value` comes from code, never from the input of the person.**
  `track('invoice-form', 'invalid')` is correct. `track('search', query)` is wrong. `track` takes no
  props object.
- **Turn off the automatic page views of the provider.** GA4: `send_page_view: false`. PostHog:
  `capture_pageview: false`. imp sends a view on each navigation, so the store counts each page
  twice otherwise.
- **A sink that posts to an own endpoint uses `navigator.sendBeacon` or `fetch` with
  `keepalive: true`,** and `batch`. A provider SDK batches itself, so do not wrap it in `batch`.
- **Add `when: consent` only when the store needs consent.** imp stores nothing on the device. A
  provider SDK that writes cookies (GA4, PostHog), an id kept across reloads, or personal data needs
  it. A sink to an own endpoint with none of these does not. Do not add a banner by default.
- **Start a `when` state as `null`, never `false`.** `null` holds the records until the person
  answers. `false` means refused, and drops the entry view. An opt-out switch starts as `true`.
- **Put `view_id: record.view` on every event of a provider SDK.** Map `time` to an event with
  `engaged_ms: record.ms`, and put `ready_ms: record.readyMs ?? record.waitedMs` on the page view.
  The store needs them for the per-view numbers.
- **`when` does not stop a provider SDK.** Start GA4 after
  `gtag('consent', 'default', { analytics_storage: 'denied' })`. Start PostHog with
  `persistence: 'memory'`. Update the SDK in `consent.watch(self, ...)`, and call it before
  `onAnalytics`, so the SDK gets the consent before the held records. Test `granted === true`.
- **Add segments, not ids.** In the sink:
  `onAnalytics(self, (record) => send({ ...record, plan: user.get()?.plan ?? null }), { when: contextReady })`,
  where `contextReady` is `null` while the user state loads and `true` after, never `false`. Add the
  country on the server from the request, and discard the IP address. Do not add a user id or an
  organization id. They usually need consent in Europe.
- **Gate the sink and the SDK on a flag**, so a build with the flag off has none of it. See
  [feature-flags](feature-flags.md).
- **Do not add `onError`, a log sink, or a `data-track` attribute.** They do not exist. Forward the
  records where `type` is `'error'` to report errors.
- A sink that throws or rejects is logged, and never becomes an `error` record.
- No standard component records anything. Wrap it in a zone.

## Example

```js
// main.js - the sink first, then mount
import { flag, mount } from 'imp'
import { batch, onAnalytics } from 'imp/analytics'
import { app } from './app.js'

if (flag('ANALYTICS')) {
  onAnalytics(batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records))))
}
mount('#app', app())
```

```js
// invoice.js - a zone and an outcome
import { track, zone } from 'imp/analytics'
import { t } from 'imp/i18n'
import { button } from 'imp/std'

export const sendArea = (sendInvoice) =>
  zone(
    { name: 'send' },
    button({
      variant: 'primary',
      events: { click: () => sendInvoice().then(() => track('invoice-sent')) },
    }, t('Send')),
  )
```

`imp start` writes every record to the session log as a `[BROWSER:analytics]` line, with or without
a sink: `imp logs | grep analytics`. In a unit test, register `onAnalytics(self, sink)` and assert
on the records. `fakeTimers` moves `readyMs`, the engaged time and the active time. See
[testing](testing.md), [start](start.md) and [routing](routing.md).
