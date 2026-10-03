# analytics - page views, zones, outcomes and errors as counted records, sent to a sink the app registers

```js
import { batch, onAnalytics, track, zone } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
```

imp counts. The app registers a sink that forwards each record to a store. imp bundles no
third-party provider, makes no network call of its own, and records no personal data. `alySink` is
the sink for imp-aly, the analytics server of imp that the owner runs on a VPS.

| Level      | Tool                                   | Records               |
| ---------- | -------------------------------------- | --------------------- |
| a page     | nothing - the router records each view | `page`, `interaction` |
| a zone     | `zone({ name }, ...children)`          | `seen`, `interaction` |
| an outcome | `track(name)`                          | `outcome`             |
| a failure  | nothing - imp reports it               | `error`               |

## Records

Every record has `type`, `visit`, `at` and `page`. `visit` is one random id per document load, in
memory only. `at` is `Date.now()` of the record. `page` is the route pattern of the matched node,
such as `/invoices/:id`. A path off the map, and the time before the router shows a screen, send no
record. No record carries a path, a message or a value from the person.

| `type`        | Other fields     | Sent                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------ |
| `page`        | `readyMs`        | when the screen is ready; a screen left before it is ready sends nothing |
| `seen`        | `zone`           | once per zone name per page view, when some part enters the viewport     |
| `interaction` | `zone` or `null` | pointer press, key, input or wheel; one per zone per 5 s; `null` = page  |
| `outcome`     | `name`           | at the `track()` call                                                    |
| `error`       |                  | uncaught error, rejection, render error, 5xx or network; one per 5 s     |

- `readyMs` counts from the navigation, or from the document load for the entry page, to the moment
  the screen replaces its loading content. A change of the query only, a guard redirect and a
  `redirect()` binding are no page view.
- Zones nest, and an interaction counts for every zone that holds it. A navigation starts the 5 s
  again, for interactions and for errors.
- A 4xx answer gives no `error`. The `ResizeObserver loop ...` messages and a cross-origin
  `Script error.` give no `error`.

```jsonl
{"type":"page","visit":"k3v9a1c2","at":1759300006100,"page":"/invoices/:id","readyMs":420}
{"type":"seen","visit":"k3v9a1c2","at":1759300006150,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"interaction","visit":"k3v9a1c2","at":1759300015000,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"outcome","visit":"k3v9a1c2","at":1759300019400,"page":"/invoices/:id","name":"myapp.invoice-sent"}
{"type":"error","visit":"k3v9a1c2","at":1759300015300,"page":"/invoices/:id"}
```

## Calls

| Call                                  | Does                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `onAnalytics(sink)`                   | registers a sink for the page; returns the function that unregisters it  |
| `onAnalytics(self, sink)`             | the same, and unregisters when the component unmounts                    |
| `batch(send, { size: 20, ms: 5000 })` | returns a sink that calls `send(records)` in batches                     |
| `alySink({ app, servers, segments })` | returns a `batch` sink that posts to `<server>/collect/<app>` of imp-aly |
| `zone({ name }, ...children)`         | wraps any content; records `seen` and `interaction`                      |
| `track(name)`                         | records an outcome; takes the name only                                  |

`batch` sends when the array reaches `size`, when `ms` passes, when the page hides or unloads, and
when the sink is unregistered.

`alySink` options:

| Option     | Value                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `app`      | required; the app name on the servers: lowercase letters, digits, `-`               |
| `servers`  | required; an array of server URLs: `['https://aly-1.myapp.example']`, or `['/aly']` |
| `segments` | optional; `(record) => ({ plan: 'pro' })`, called once per record                   |
| `size`     | as for `batch`, default `20`                                                        |
| `ms`       | as for `batch`, default `5000`                                                      |

- One visit goes to one server, picked from the visit id. Every `alySink` with the same list picks
  the same server.
- The first record of a visit goes out at once. Later records go in batches.
- No answer or a 5xx: the batch goes to the next server, which then keeps the visit. A 4xx or a 429
  drops the batch and logs it. A `202` with rejected records logs a warning.

## Rules an agent gets wrong

- **Register the sink before `mount`.** A sink that registers later gets the `page` record of the
  current screen at once, but no other record from before it.
- **Names carry a namespace: `myapp.due-date`, never `due-date`.** The same rule as a state name,
  plus only ASCII letters, digits, `-` and `_` between the dots, at most 128 characters.
  `zone({ name: 'myapp.due-date' }, child)`, never `zone('myapp.due-date', child)`. imp logs a bad
  name and records nothing for it. `imp lint` checks every literal name, see [lint](lint.md).
- **One name, one place.** Give each zone and each outcome its own literal name, used once in the
  project. `imp lint` reports a name that two calls share.
- **`track(name)` takes one argument.** `track('myapp.invoice-form-invalid')` is correct.
  `track('myapp.invoice-form', 'invalid')` throws. `track('myapp.search', query)` is personal data.
- **A zone around text only is never seen.** It observes its child elements. Wrap the text in an
  element: `zone({ name: 'myapp.intro' }, p(t('...')))`.
- **Put a zone in each tab panel** to measure tabs. A hidden panel has no box, so its zone is not
  seen.
- **Turn off the automatic page views of the provider.** GA4: `send_page_view: false`. PostHog:
  `capture_pageview: false`. imp sends a `page` record on each navigation, so the store counts each
  page twice otherwise.
- **For imp-aly, use `alySink`, never a hand-written `batch` sink.** Put segments in the `segments`
  option, never in a wrapper sink: `onAnalytics((record) => sink({ ...record }))` loses the flush on
  hide. Register the app and every segment name on every server:
  `imp-aly app add myapp <app-map URL> --segments plan`. A server rejects a record with an unknown
  segment.
- **`servers` is an array**, also for one server. Pass the server base URL, never the `/collect`
  URL.
- **A sink that posts to an own endpoint uses `navigator.sendBeacon` or `fetch` with
  `keepalive: true`,** and `batch`. A provider SDK batches itself, so do not wrap it in `batch`.
- **The server of an own endpoint filters by `app-map.txt`.** `imp build` writes the route patterns
  of the map there, one per line, at the root of the output, when `imp.json` names a `map`. The
  server fetches the file from the site and drops a record whose `page` is not a line of it. See
  [build](build.md).
- **Add no personal data in the sink.** No user id, no organization id, no email, no value that the
  person typed. Add segments: `send({ ...record, plan: user.get()?.plan ?? null })`. A segment value
  is a short key of ASCII letters, digits, `.`, `-` and `_`: `pro`, `en-US`, `1.2.3`, never
  `Pro plan`. Add the country on the server from the request, and discard the IP address.
- **imp needs no consent banner.** It stores nothing on the device. A provider SDK that writes
  cookies (GA4, PostHog) needs consent in Europe: register the sink and start the SDK when the
  person has answered. The late sink gets the current `page` record. There is no `when` option.
- **Do not add `onError`, a log sink, an error message or a `data-track` attribute.** They do not
  exist. Forward the records where `type` is `'error'` to count errors. The browser console and the
  server logs hold the message.
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
// main.js - the imp-aly sink, with two servers and a segment
import { flag, mount } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
import { app } from './app.js'
import { currentPlan } from './plan.js'

if (flag('ANALYTICS')) {
  onAnalytics(alySink({
    app: 'myapp',
    servers: ['https://aly-1.myapp.example', 'https://aly-2.myapp.example'],
    segments: () => ({ plan: currentPlan() }),
  }))
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
    { name: 'myapp.send' },
    button({
      variant: 'primary',
      events: { click: () => sendInvoice().then(() => track('myapp.invoice-sent')) },
    }, t('Send')),
  )
```

```js
// a sink for GA4 - one event per record type
gtag('config', GA_ID, { send_page_view: false })
onAnalytics(({ type, ...fields }) => {
  if (type === 'page') {
    gtag('event', 'page_view', { ...fields, page_location: location.origin + fields.page })
  } else {
    gtag('event', type, fields)
  }
})
```

The dev server registers no sink. To read the records in development, register a sink that calls
`console.log`, which `imp start` forwards to the session log: `imp logs | grep analytics`. In a unit
test, register `onAnalytics(self, sink)` and assert on the records. `fakeTimers` moves `readyMs`,
`at` and the 5 s of the interactions and the errors. See [testing](testing.md), [start](start.md),
[lint](lint.md) and [routing](routing.md).
