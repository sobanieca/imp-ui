# analytics - page views, zones, outcomes and errors as counted records, sent to a sink the app registers

```js
import { batch, onAnalytics, track, zone } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
```

imp counts. The app registers a sink that forwards each record to a store. imp bundles no
third-party provider, makes no network call of its own, and records no personal data. `alySink` is
the sink for imp-aly, the analytics server of imp that the owner runs on a VPS.

| Level      | Tool                                   | Records        |
| ---------- | -------------------------------------- | -------------- |
| a page     | nothing - the router records each view | `page`, `used` |
| a zone     | `zone({ name }, ...children)`          | `seen`, `used` |
| an outcome | `track(name)`                          | `outcome`      |
| a failure  | nothing - imp reports it               | `error`        |

## Records

Every record has `type`, `visit`, `at` and `page`. `visit` is one random id per document load, in
memory only. `at` is `Date.now()` of the record. `page` is the route pattern of the matched node,
such as `/invoices/:id`. A path off the map, and the time before the router shows a screen, send no
record. No record carries a path, a message or a value from the person.

| `type`    | Other fields     | Sent                                                                     |
| --------- | ---------------- | ------------------------------------------------------------------------ |
| `page`    |                  | when the screen is ready; a screen left before it is ready sends nothing |
| `seen`    | `zone`           | once per zone name per page view, when some part enters the viewport     |
| `used`    | `zone` or `null` | once per zone name per page view, at a click, input or key in it         |
| `outcome` | `name`           | at the `track()` call                                                    |
| `error`   |                  | uncaught error, rejection, render error, 5xx or network; one per 5 s     |

- The screen is ready when it replaces its loading content. A change of the query only, a guard
  redirect and a `redirect()` binding are no page view.
- `used` comes from `click`, `input` and `keydown` on the document, in the capture phase. These keys
  are no use: Tab, Shift, Control, Alt, Meta, CapsLock, Escape, F1 to F24. So moving the focus with
  Tab, or pressing only a modifier key, is no use. A letter, Enter or an arrow key is a use. A
  pointer press, a wheel turn and a scroll are no use. An event that code dispatches (`isTrusted`
  false, for example `element.click()`) is no use.
- `used` with `zone: null` is one per page view, at the first such event anywhere on the page.
- Zones nest, and an event counts for every zone that holds it. A used zone whose `seen` did not go
  out yet sends `seen` first, so `used` is never more than `seen`.
- There is no time on a page, time in a zone or time to ready a screen. Do not add one.
- A navigation starts the 5 s of the errors again.
- A 4xx answer gives no `error`. The `ResizeObserver loop ...` messages and a cross-origin
  `Script error.` give no `error`.

```jsonl
{"type":"page","visit":"k3v9a1c2","at":1759300006100,"page":"/invoices/:id"}
{"type":"seen","visit":"k3v9a1c2","at":1759300006150,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"used","visit":"k3v9a1c2","at":1759300015000,"page":"/invoices/:id","zone":null}
{"type":"used","visit":"k3v9a1c2","at":1759300015000,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"outcome","visit":"k3v9a1c2","at":1759300019400,"page":"/invoices/:id","name":"myapp.invoice-sent"}
{"type":"error","visit":"k3v9a1c2","at":1759300015300,"page":"/invoices/:id"}
```

## Calls

| Call                                  | Does                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `onAnalytics(sink)`                   | registers a sink for the page; returns the function that unregisters it  |
| `onAnalytics(self, sink)`             | the same, and unregisters when the component unmounts                    |
| `batch(send, { size, ms, segments })` | returns a sink that calls `send(records)` in batches                     |
| `alySink({ app, servers, segments })` | returns a `batch` sink that posts to `<server>/collect/<app>` of imp-aly |
| `zone({ name }, ...children)`         | wraps any content; records `seen` and `used`                             |
| `track(name)`                         | records an outcome; takes the name only                                  |

`batch` sends when the array reaches `size` (default `20`), when `ms` (default `5000`) passes, when
the page hides or unloads, and when the sink is unregistered. `segments` is optional:
`(record) => ({ plan: 'pro' })`, called for each record when it arrives. Its fields go under the
fields of imp, so a segment never replaces `type`, `visit`, `at` or `page`.

`alySink` options:

| Option     | Value                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `app`      | required; the app name on the servers: lowercase letters, digits, `-`               |
| `servers`  | required; an array of server URLs: `['https://aly-1.myapp.example']`, or `['/aly']` |
| `segments` | as for `batch`                                                                      |
| `size`     | as for `batch`, default `20`                                                        |
| `ms`       | as for `batch`, default `5000`                                                      |

- One visit goes to one server, picked from the visit id. Every `alySink` with the same list picks
  the same server.
- The first record of a visit goes out at once. Later records go in batches.
- No answer or a 5xx: the batch goes to the next server, which then keeps the visit. A 4xx or a 429
  drops the batch and logs it. A `202` with rejected records logs a warning.

## Rules an agent gets wrong

- **Register the sink before `mount`, or in the `setup` of the root component.** A sink that
  registers later gets the `page` record of the current screen at once, but no other record from
  before it. Never register the sink only after the sign-in. That loses the sign-in page and every
  signed-out visit.
- **Names carry a namespace: `myapp.due-date`, never `due-date`.** The same rule as a state name,
  plus only ASCII letters, digits, `-` and `_` between the dots, at most 128 characters.
  `zone({ name: 'myapp.due-date' }, child)`, never `zone('myapp.due-date', child)`. imp logs a bad
  name and records nothing for it. `imp lint` checks every name, see [lint](lint.md).
- **Write each name as a literal.** A string, or a template literal with no `${...}`. `zone()` gets
  an object literal with a literal `name`, no spread. `imp build` lists every name for the store, so
  ``zone({ name: `myapp.${part}` })``, `zone(options)` and `track(outcomeName)` stop the build. Pick
  one literal per case: `ok ? track('myapp.sent') : track('myapp.failed')`.
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
  `imp-aly app add myapp https://myapp.example/ --segments plan,role`. Pass the folder URL of the
  build output, or a local build folder such as `dist`, never the URL of one file. A server rejects
  a record with an unknown segment.
- **Segments come from state, so the sink registers where the state is.** `main.js` cannot read a
  state. Call
  `onAnalytics(self, alySink({ ..., segments: () => ({ plan: session.get()?.plan ?? null }) }))` in
  the `setup` of the component that calls `initState(self, 'myapp.session')`, usually the root. Use
  a component with one instance that stays mounted. Never one per screen or per list row.
- **`segments` reads the state on each call.** Never read the state once into a constant. A record
  before the session loads, or after a sign-out, has `null` segments. imp-aly stores it without the
  segment.
- **A segment name is 1 to 32 letters and digits, and starts with a letter:** `appVersion`, never
  `app-version`. It is never a record field (`type`, `visit`, `at`, `page`, `zone`, `name`,
  `country`), nor `day`, `week`, `month`, `records`, `visits`, nor a built-in property name of a
  JavaScript object (`constructor`, `toString`, `valueOf`). At most 16 segments. A value is `null`,
  a number, a boolean, or 1 to 64 of `A-Za-z0-9._-`.
- **A segment holds one key of a small set.** Reduce a list of roles to `admin` or `member`. Put a
  count, such as seats, in classes: `1`, `2-10`, `11-50`, `51+`.
- **For an own endpoint, pass `segments` to `batch`:**
  `batch(send, { segments: () => sessionSegments(session.get()) })`. Never add segments in `send`,
  which runs up to `ms` later and tags a pre-sign-in record with the post-sign-in plan. Never wrap
  the `batch` sink, which loses the flush on hide.
- **`servers` is an array**, also for one server. Pass the server base URL, never the `/collect`
  URL.
- **A sink that posts to an own endpoint uses `navigator.sendBeacon` or `fetch` with
  `keepalive: true`,** and `batch`. A provider SDK batches itself, so do not wrap it in `batch`.
- **The server of an own endpoint filters by the lists of the build.** When `imp.json` names a
  `map`, `imp build` writes `app-analytics.json` at the root of the output:
  `{ "pages": [...], "zones": [...], "outcomes": [...] }`, with route patterns, zone names and
  outcome names. The name lists hold only the names in the code of the app, never the names of a
  component in `dependencies/`. The server fetches the file from the site. It drops a record whose
  `page` is not in `pages`, a `seen` or `used` whose `zone` is not in `zones`, and an `outcome`
  whose `name` is not in `outcomes`. A `used` with `zone: null` is always valid. See
  [build](build.md).
- **Add no personal data in the sink.** No user id, no organization id, no email, no value that the
  person typed. Add segments, such as `plan`, `role` and `lang`. A segment value is a short key of
  ASCII letters, digits, `.`, `-` and `_`: `pro`, `en-US`, `1.2.3`, never `Pro plan`. Add the
  country on the server from the request, and discard the IP address.
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
// app.js - the imp-aly sink in the root component, with segments from the session state
import { component, flag } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
import { lang } from 'imp/i18n'
import { initState } from 'imp/state'

const sessionSegments = (session) => ({
  plan: session?.plan ?? null,
  role: session ? (session.roles.includes('admin') ? 'admin' : 'member') : null,
  lang: lang.get(),
})

export const root = component('myapp-root', {
  setup: (self) => {
    const session = initState(self, 'myapp.session')
    loadSession().then(session.set, () => session.set(null))
    if (flag('ANALYTICS')) {
      onAnalytics(
        self,
        alySink({
          app: 'myapp',
          servers: ['https://aly-1.myapp.example', 'https://aly-2.myapp.example'],
          segments: () => sessionSegments(session.get()),
        }),
      )
    }
    return shell({ navbar: { map: app } }, appRouter())
  },
})
// on each server: imp-aly app add myapp https://myapp.example/ --segments plan,role,lang
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
test, register `onAnalytics(self, sink)` and assert on the records. `fakeTimers` moves `at` and the
5 s of the errors. An event that a unit test dispatches sends no `used`; test `used` in an e2e spec.
See [testing](testing.md), [start](start.md), [lint](lint.md) and [routing](routing.md).
