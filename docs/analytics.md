# imp-ui - Analytics

imp tells you which parts of your UI people see and use. It counts each page view, each zone that
comes into view, each interaction, each outcome that you name, and each failure. It gives each count
to a function that you register, a **sink**. The sink forwards the record to your store: Google
Analytics, PostHog, your own endpoint, or the console.

imp bundles no provider and makes no network call. It stores no id on the device. It writes no
cookie, and nothing to `localStorage` or `sessionStorage`. A record carries no personal data: only a
route pattern from your application map, a name from your code, a time, and a random id of the
visit. imp encourages you to keep it that way. Do not add personal data in your sink.

```js
import { batch, onAnalytics, track, zone } from 'imp/analytics'
```

You measure three levels, and each level has one tool:

| Level      | Question                                     | Tool                                   |
| ---------- | -------------------------------------------- | -------------------------------------- |
| a page     | is it reached, is it used, does it break?    | nothing - the router records each view |
| a zone     | is this part of the screen seen, is it used? | `zone({ name }, ...children)`          |
| an outcome | did the person get the result?               | `track(name)`                          |

## The report

The records exist to fill one report. imp does not draw the report. Your store counts the records,
with the queries in [The queries](#the-queries) below. This is the report for one period:

```
visits 12,000

pages            views   visits   interactions   errors
/invoices        9,800    8,400         31,000       12
/invoices/:id    7,100    6,200         52,000      310
/settings          400      390            900        0

/invoices/:id
  zones                    seen   interactions
  myapp.invoice-summary   6,900          1,200
  myapp.due-date          5,300          4,100
  myapp.send              5,300          6,800
  myapp.payment-options   1,500            200
  outcomes
  myapp.invoice-sent      2,900
```

Every number is a count of records. **views** is the number of `page` records. **visits** is the
number of different visit ids. **seen** is the number of `seen` records of the zone, and it is at
most one per page view. **interactions** is the number of `interaction` records, and one record
stands for up to 5 seconds of activity. **errors** is the number of `error` records, and one record
stands for up to 5 seconds of failures. **outcomes** is the number of `outcome` records.

Read the report by comparison. A zone with many `seen` and few `interactions` is a part of the
screen that people look at and do not use. A page with many views and few outcomes is a flow that
people start and do not end. A page with errors is a page to open in the browser, with the console
open.

## Setup

Register the sink in your entry module, **before `mount`**. Put it behind a build flag. Then a build
with the flag off contains no sink and no SDK. See **[Build flags](build-flags.md)**.

```js
import { flag, mount } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { app } from './app.js'

if (flag('ANALYTICS')) {
  onAnalytics((record) => console.log(record))
}

mount('#app', app())
```

Collection starts when you register the first sink, and it stops when the last sink goes. A sink
that registers after the current page is ready gets the `page` record of that page at once. It does
not get the records that went out before it. An app with no sink pays nothing: the collection code
is not in its bundle.

`onAnalytics(sink)` returns a function that unregisters the sink. `onAnalytics(self, sink)` ends the
registration when the component of `self` unmounts. You can register several sinks.

## The records

Every record carries `type`, `visit`, `at` and `page`:

- **`visit`** is one random id per document load. A reload starts a new visit.
- **`at`** is the time of the record, in milliseconds since the epoch, from the clock of the
  browser.
- **`page`** is the route pattern of the screen, from your application map, such as `/invoices/:id`.
  It holds no param value. A path that is not on the map sends no record, so no record carries a
  path. A record before the router shows a screen is dropped too.

| `type`        | Other fields     | One record per                                         |
| ------------- | ---------------- | ------------------------------------------------------ |
| `page`        | `readyMs`        | screen that the router shows                           |
| `seen`        | `zone`           | zone that enters the viewport, once per page view      |
| `interaction` | `zone` or `null` | 5 seconds of activity in a zone, or outside every zone |
| `outcome`     | `name`           | `track(name)` call                                     |
| `error`       |                  | 5 seconds of failures on the page                      |

```jsonl
{"type":"page","visit":"k3v9a1c2","at":1759300006100,"page":"/invoices/:id","readyMs":420}
{"type":"seen","visit":"k3v9a1c2","at":1759300006150,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"interaction","visit":"k3v9a1c2","at":1759300009800,"page":"/invoices/:id","zone":null}
{"type":"interaction","visit":"k3v9a1c2","at":1759300015000,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"error","visit":"k3v9a1c2","at":1759300015300,"page":"/invoices/:id"}
{"type":"outcome","visit":"k3v9a1c2","at":1759300019400,"page":"/invoices/:id","name":"myapp.invoice-sent"}
```

### `page`

The router records each screen that it shows, when the screen is ready. You write no code for it.
See **[Routing](routing.md)**.

- **`readyMs`** is the time from the start of the navigation to the moment the screen replaces its
  loading content. It includes a guard `wait`, the download of an area, and the data that the screen
  awaits in its `setup`. For the entry page, it starts at the start of the document load.
- A screen that the person leaves before it is ready sends no record.
- A change of the query only is no page view, because the screen stays mounted.
- A navigation inside an area is a page view.
- A guard redirect and a `redirect()` binding are no page view. You get one record, for the screen
  where the navigation ends.

### `seen`

A zone wraps any content: a section of a screen, one standard component, an element, or a component
from a third party.

```js
import { zone } from 'imp/analytics'

zone({ name: 'myapp.invoice-summary' }, summaryCard(invoice))
zone({ name: 'myapp.due-date' }, datePicker({ field: 'dueDate', label: t('Due date') }))
zone({ name: 'myapp.send' }, button({ variant: 'primary' }, t('Send')))
```

A zone sends one `seen` record the first time that some part of it is in the viewport while the
document is visible. Zones of one name on one page send one record per page view: five rows in
`zone({ name: 'myapp.invoice-row' })` give one record. A zone that never enters the viewport sends
nothing.

A zone does not change your layout. It is an `imp-zone` element with `display: contents` and no
shadow root. The panel of a `datePicker` or a `dialog` stays inside its zone. A zone that holds only
text is never seen, because it observes its child elements. Wrap the text in an element.

**Tabs need no special code.** Put a zone in each panel. A panel that does not show has no box in
the viewport, so its zone is not seen:

```js
tabs({
  label: t('Invoice'),
  items: [
    {
      id: 'details',
      label: t('Details'),
      content: zone({ name: 'myapp.invoice-details' }, details()),
    },
    {
      id: 'history',
      label: t('History'),
      content: zone({ name: 'myapp.invoice-history' }, history()),
    },
  ],
})
```

No standard component records anything of its own. A zone measures it from the outside.

### `interaction`

An interaction is a pointer press, a key, an input or a wheel turn. imp sends one `interaction`
record for the zone that holds it, and then no other for that zone for 5 seconds. So one record
stands for up to 5 seconds of activity, and a store that counts the records gets a measure of the
time that people spend in a zone. An interaction outside every zone is an interaction of the page,
with `zone: null`. Zones nest, and an interaction counts for every zone that holds it. A navigation
starts the 5 seconds again.

### `outcome`

A zone knows that the person worked in the send area. It does not know that the invoice was sent.
You state an outcome with `track()`, where the outcome happens:

```js
import { track } from 'imp/analytics'

api.post(`/invoices/${id}/send`).then(() => track('myapp.invoice-sent'))

if (!valid) track('myapp.invoice-form-invalid')
```

`track` takes a name and nothing else. Put each different outcome under its own name. A name never
carries what the person typed or chose. `track` returns nothing. The outcome belongs to the page
that shows when you call it.

### `error`

imp sends an `error` record for an uncaught error, an unhandled rejection, a state subscriber that
throws, an error that a component or an error boundary catches, and an `imp/http` request that fails
on the network, times out, or answers a 5xx. A request that answers a 4xx gives no record, because a
4xx is often an expected answer.

The record has no message and no stack. It says that the page failed, and when. To find the failure,
open the page in the browser with the console open, or read the logs of your server. An `error`
record is one per 5 seconds per page, so a loop that throws on each frame gives 12 records a minute.

Two messages that browsers report are not failures of your app, and they give no record:
`ResizeObserver loop ...`, which only says that the browser moved a resize notification to the next
frame, and `Script error.` with no file, which the browser writes for an error in a script from
another origin.

To count an error that you catch, rethrow it after your UI shows the failure.

## Names

A zone name and an outcome name carry a namespace: two or more dot-separated segments, such as
`myapp.invoice-summary`. The first segment is the name of your app. The rule is the same as for a
state name. imp logs a name without a namespace, and that zone or outcome records nothing.

Give each zone and each outcome its own name, in one place of your code. The report groups the
records by name, so two zones of one name on different pages are still two rows, but two zones of
one name on one page are one row. `imp lint` checks both rules on every literal name. See
**[Lint](lint.md)**.

## No personal data

imp records only a route pattern, a name from your code, a time and a random visit id. None of these
is personal data, so imp itself does not make your app need a consent banner. Keep the records that
way in your sink:

- **Do not add a user id or an organization id.** A user id is personal data, also when you hash it.
  An organization id can point at one person in a small organization.
- **Add segments, not ids.** A segment describes a group, such as `plan: 'pro'`. Other good segments
  are the role, the language and the version of the app. Hide a small group in the report, because
  "Enterprise plan in Iceland" can be one customer.
- **Add the country on the server**, from a header of your CDN such as `CF-IPCountry`, and discard
  the IP address. Do not keep the full IP address of a request.
- **Delete the records after a fixed period.**

A provider SDK can store data on the device. GA4 writes the `_ga` cookies. PostHog writes a cookie
and a `localStorage` entry by default. In the European Union and the United Kingdom, such an SDK
needs consent before it starts. imp does not decide what consent means. Register the sink, and start
the SDK, when the person has answered. A sink that registers late gets the `page` record of the
current screen, so the first screen is not lost. This is not legal advice. Check the rules of the
regions of your users.

## Sinks for a store

imp calls each sink at once, synchronously, once per record, in the order of the records. It does
not wait for a sink. A sink can be `async`, and a slow sink never delays the next record or the UI.
imp catches a sink that throws or rejects, logs it, and goes on. A failed sink never becomes an
`error` record.

Turn off the automatic page views of your provider. imp sends a `page` record on each navigation, so
the store otherwise counts each page twice.

### Google Analytics 4

```js
gtag('config', GA_ID, { send_page_view: false })

onAnalytics(({ type, ...fields }) => {
  if (type === 'page') {
    gtag('event', 'page_view', { ...fields, page_location: location.origin + fields.page })
  } else {
    gtag('event', type, fields)
  }
})
```

Register `visit`, `page`, `zone` and `name` as custom dimensions with the event scope, and `readyMs`
as a custom metric. GA4 shows only the parameters that you register.

### PostHog

```js
posthog.init(POSTHOG_KEY, { capture_pageview: false, capture_exceptions: false })

onAnalytics(({ type, ...fields }) => {
  if (type === 'page') {
    posthog.capture('$pageview', { ...fields, $current_url: location.origin + fields.page })
  } else {
    posthog.capture(type, fields)
  }
})
```

Turn off the automatic exceptions of PostHog, so a failure arrives once.

### Your own endpoint

```js
import { batch, onAnalytics } from 'imp/analytics'

onAnalytics(batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)), {
  size: 20,
  ms: 5000,
}))
```

**Send with `navigator.sendBeacon`, or with `fetch(url, { keepalive: true })`.** A batch goes out as
the page hides, and the browser can cancel a plain `fetch` there.

`batch(send, { size, ms })` returns a sink. It holds the records, and calls `send` with an array of
them. It sends in these cases:

- the array reaches `size`,
- `ms` passes after the first held record,
- the page becomes hidden, or the browser unloads it,
- the sink is unregistered.

The defaults are `size: 20` and `ms: 5000`. The browser limits the data in flight to about 64 KiB,
and 20 records are about 2 KB. imp does not retry a failed batch, because a retry needs storage. The
SDK of a provider batches its own events, so do not wrap it in `batch`.

**Check each record against `app-map.txt` on the server.** Anyone can post to a public endpoint, so
your store must know which pages exist. `imp build` writes the route patterns of your application
map to `app-map.txt` at the root of the output, one pattern per line, next to the bundle. See
**[Deploying an app](deploy.md)**. Your server reads that file from your site, and drops a record
whose `page` is not one of its lines:

```
/
/invoices
/invoices/:id
/settings
```

```js
const response = await fetch('https://myapp.example/app-map.txt')
const pages = new Set((await response.text()).split('\n').filter(Boolean))
const accepted = records.filter((record) => pages.has(record.page))
```

Read the file again after each deploy, or on a timer. A record always carries a `page`, so a record
without one is spam too.

### Segments

To compare usage across plans or regions, add the segments in the sink:

```js
const user = useState(self, 'myapp.user')

onAnalytics(self, (record) => send({ ...record, plan: user.get()?.plan ?? null }))
```

### Errors only

An app that wants only its errors forwards the records where `type` is `'error'`:

```js
onAnalytics((record) => {
  if (record.type === 'error') navigator.sendBeacon('/errors', JSON.stringify(record))
})
```

imp has no other error hook and no log sink. A team that needs the message of each error, or a
stream of logs, uses the SDK of its provider directly.

## The queries

Load the records into one table, one row per record. These queries use SQL for PostgreSQL, over a
table `records`. Adapt them to the query language of your store.

```sql
-- visits
select count(distinct visit) from records;

-- pages: views, visits, interactions and errors
select p.page,
       count(*) filter (where p.type = 'page') as views,
       count(distinct p.visit) filter (where p.type = 'page') as visits,
       count(*) filter (where p.type = 'interaction') as interactions,
       count(*) filter (where p.type = 'error') as errors
from records p
group by 1;

-- ready time of a page, 75th percentile
select page, percentile_cont(0.75) within group (order by "readyMs")
from records where type = 'page' group by page;

-- zones of a page: seen and interactions
select zone,
       count(*) filter (where type = 'seen') as seen,
       count(*) filter (where type = 'interaction') as interactions
from records where page = '/invoices/:id' and zone is not null
group by zone;

-- outcomes of a page
select name, count(*) from records
where type = 'outcome' and page = '/invoices/:id' group by name;
```

## In development and in tests

The dev server registers no sink of its own, so a record goes only where your sinks send it. To
check your zones and outcomes while you click through the app, register a sink that prints each
record. `imp start` forwards the browser console to the terminal and to the session log:

```js
import { onAnalytics } from 'imp/analytics'

onAnalytics((record) => console.log('analytics', record))
```

```sh
imp logs | grep analytics
```

In a unit test, register a sink with `onAnalytics(self, sink)` and assert on the records. With
`fakeTimers`, the virtual clock moves `readyMs`, `at` and the 5 seconds of the interactions and the
errors. See **[Testing](testing.md)**.

## What imp does not record

Each of these failed the test "one number, one action", or carries personal data:

- **The message of an error.** A message can carry a URL with a query, an email address or a token.
  The record says that the page failed, and the browser console says why.
- **A page off the map.** A path can carry personal data, so a screen off the map sends no record at
  all. Put each screen on the map, so that its records carry the route pattern.
- **The time on a page and the time in a zone.** The count of `interaction` records, one per 5
  seconds of activity, answers the same question.
- **A record per component**, such as a `data-track` attribute. A zone measures any component from
  the outside.
- **A heatmap and a rage click.** They are noisy. The zones and the outcomes answer the same
  questions more directly.
- **A value on an outcome.** A value from your code is one more name. A value from the person is
  personal data.
- **A user id and a session across tabs.** One visit per document load gives reach. Your sink can
  add segments such as the plan.
- **Web Vitals.** `readyMs` measures what your app controls, from the navigation to a ready screen.
- **A transport, a retry and sampling.** They are the job of the sink.
