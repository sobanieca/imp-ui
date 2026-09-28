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

| `type`   | Other fields                                                   | Sent                                            |
| -------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `view`   | `from` (previous page, `null` on entry), `readyMs`, `path`     | when the screen is ready, or when the view ends |
| `time`   | `ms` - engaged time, visible and focused, as a delta           | when the document hides, and when the view ends |
| `zone`   | `name`, `seen`, `activeMs`, as a delta                         | when the document hides, and when the view ends |
| `action` | `name`, `value` (only when given)                              | at the `track()` call                           |
| `error`  | `source` (`script`, `render`, `request`), `message` (one line) | at the failure                                  |

- `path` is on a `view` with `page: null` only. It has no query.
- `readyMs` is `null` when the person left before the screen was ready.
- A change of the query only is no view. A guard redirect or a `redirect()` binding is no view.
- `error` sources: `script` is an uncaught error, an unhandled rejection, or a state subscriber that
  throws. `render` is an error in a component. `request` is an `imp/http` request that fails on the
  network, times out, or answers 5xx: `request failed: 500 POST /path`. No record has a stack.

## Calls

| Call                                  | Does                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `onAnalytics(sink, { when? })`        | registers a sink for the page; returns the function that unregisters it |
| `onAnalytics(self, sink, { when? })`  | the same, and unregisters when the component unmounts                   |
| `batch(send, { size: 20, ms: 5000 })` | returns a sink that calls `send(records)` in batches                    |
| `zone({ name }, ...children)`         | wraps any content; records `seen` and the active time per view          |
| `track(name, value?)`                 | records an outcome; `value` is a string or a number from code           |

`batch` sends when the array reaches `size`, when `ms` passes, when the page hides (after the `time`
and `zone` records of that hide), and when the sink is unregistered. `when` is a state. imp holds
the records for that sink while the state is not `true`: the entry view and the newest 199 after it.

## Rules an agent gets wrong

- **Register the sink before `mount`.** A late sink loses the engaged time before it.
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
