# imp-ui - Analytics

imp tells you if your UI works. It records each page view, the parts of a screen that people see and
use, the outcomes that you name, and every failure. It gives each record to a function that you
register, a **sink**. The sink forwards the record to your store: Google Analytics, PostHog, your
own endpoint, or the console.

imp bundles no provider and makes no network call. It stores no id on the device. It writes no
cookie, and nothing to `localStorage` or `sessionStorage`.

```js
import { batch, onAnalytics, track, zone } from 'imp/analytics'
```

You measure three levels, and each level has one tool:

| Level      | Question                               | Tool                                   |
| ---------- | -------------------------------------- | -------------------------------------- |
| a page     | is it used, is it fast, does it break? | nothing - the router records each view |
| a zone     | is this part of the screen seen, used? | `zone({ name }, ...children)`          |
| an outcome | did the person get the result?         | `track(name, value?)`                  |

## The report

The records exist to fill one report. imp does not draw the report. Your store computes it from the
records, with the queries in [The queries](#the-queries) below. This is the report for one week:

```
visits 1,240   bounce 23%   cold start p75 1.9s

WORKING - is anything broken?
page               views   broken   slow p75
/invoices/:id      3,204    2.4% !    420ms
/reports             310    0.3%     2.8s !
/customers           902    0.0%     310ms
not found             45    /invoice/881 (31), /help/faq (14)

USAGE - do people use it, and do they stay?
page               reach   engaged   left here
/invoices            92%       41s        12%
/invoices/:id        71%       38s        18%
/customers           20%       12s        61%
/settings             3%        8s        40%
```

And this is the report for one page:

```
zones (per view)       seen    used   active (median, when used)
  invoice-summary       94%     12%     3s
  due-date              71%     31%     6s
  send                  71%     44%     1s
  payment-options       22%      4%    40s
outcomes (per view)
  invoice-sent          41%
  invoice-form          valid 28%   invalid 12%
errors
  TypeError: total is undefined           61 views
  request failed: 500 POST /api/send      16 views
came from   /invoices 88%, /customers 9%
went to     /invoices 70%, (left) 18%
```

The report has two halves, because you read them in two ways:

- **"Working" has flags.** A broken view, a slow screen and a missing page are bad in every app. So
  a fixed threshold marks them. A flag needs 50 views or more in the period, so a rare page does not
  raise noise. The thresholds are 1% for broken and 1000 ms for slow.
- **"Usage" has no flags.** A short time can mean a quick task or a confused person. Only you know
  the purpose of the page. The zones and the outcomes of a page belong to this half.

Each number answers one question and points at one action:

| Number                  | Meaning                                                     | Action                                     |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| **broken**              | share of views with one or more `error` records             | open the page, and fix the top error       |
| **slow p75**            | the 75th percentile of `readyMs`, entry views excluded      | reduce the area chunk, the wait, the fetch |
| **not found**           | paths off the map, with a count each                        | fix the link, or add a redirect            |
| **cold start p75**      | the 75th percentile of `readyMs` of the entry views         | reduce the bundle and the first fetch      |
| **bounce**              | visits with one view and less than 10 s of engaged time     | fix the entry pages                        |
| **reach**               | share of visits that opened the page                        | find a feature that is hidden or unwanted  |
| **engaged**             | median of the engaged time per view                         | compare it with the purpose of the page    |
| **left here**           | share of views that are the last view of their visit        | find a dead end in the middle of a flow    |
| **came from / went to** | the most frequent neighbours of the page                    | find a navigation path that nobody uses    |
| **zone seen**           | share of views where the zone was in the viewport           | move a zone that people do not scroll to   |
| **zone used**           | share of views where the person worked in the zone          | remove or move a zone that people ignore   |
| **zone active**         | median active time in the zone, over the views that used it | simplify a zone that takes too long        |
| **outcomes**            | share of views with the outcome, per value                  | fix a flow that people start and not end   |

## Setup

Register the sink in your entry module, **before `mount`**. Put it behind a feature flag. Then a
build with the flag off contains no sink and no SDK. See **[Feature flags](feature-flags.md)**.

```js
import { flag, mount } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { app } from './app.js'

if (flag('ANALYTICS')) {
  onAnalytics((record) => console.log(record))
}

mount('#app', app())
```

Collection starts when you register the first sink, and it stops when the last sink goes. When a
sink arrives after `mount`, imp sends the view of the current screen at once. The engaged time
before that moment is lost. An app with no sink pays nothing: the collection code is not in its
bundle.

`onAnalytics(sink)` returns a function that unregisters the sink. `onAnalytics(self, sink)` ends the
registration when the component of `self` unmounts. You can register several sinks.

## The records

Every record carries `type`, `visit`, `view` and `page`. Your store adds the time when it receives
the record.

```jsonl
{"type":"view","visit":"k3v9","view":"A","page":"/invoices/:id","from":"/invoices","readyMs":420}
{"type":"time","visit":"k3v9","view":"A","page":"/invoices/:id","ms":25000}
{"type":"zone","visit":"k3v9","view":"A","page":"/invoices/:id","name":"due-date","seen":true,"activeMs":6000}
{"type":"action","visit":"k3v9","view":"A","page":"/invoices/:id","name":"invoice-form","value":"invalid"}
{"type":"error","visit":"k3v9","view":"A","page":"/invoices/:id","source":"render","message":"TypeError: total is undefined"}
```

- **`visit`** is one random id per document load. A reload starts a new visit.
- **`view`** is one random id per view. Every record between two views carries the same `view`.
- **`page`** is the route pattern of the screen, from your application map, such as `/invoices/:id`.
  It holds no param value. A path that is not on the map has `page: null`. Its `view` record also
  carries the `path`, with no query. There, the path is the only fact that helps.

### `view`

The router records each screen that it shows. You write no code for it. See
**[Routing](routing.md)**.

- A change of the query only is no view, because the screen stays mounted.
- A navigation inside an area is a view.
- A guard redirect and a `redirect()` binding are no view. You get one view, for the screen where
  the navigation ends.
- **`from`** is the `page` of the previous view. It is `null` on the entry view of a visit.
- **`readyMs`** is the time from the start of the navigation to the moment the screen replaces its
  loading content. It includes a guard `wait`, the download of an area, and the data that the screen
  awaits in its `setup`. For the entry view, it starts at the start of the document load. imp sends
  the record when the screen is ready. When the person leaves before that, `readyMs` is `null`.

### `time`

`ms` is the engaged time: the time while the document is visible and has focus. It counts reading
too, with no interaction. imp sends a `time` record when the document becomes hidden, and when the
view ends. When the person comes back, the same view counts again from zero. So the engaged time of
a view is the sum of `ms` per `view`. This is the only shape that survives a mobile browser that
closes a hidden tab with no further event.

### `zone`

A zone wraps any content: a section of a screen, one standard component, an element, or a component
from a third party.

```js
import { zone } from 'imp/analytics'

zone({ name: 'invoice-summary' }, summaryCard(invoice))
zone({ name: 'due-date' }, datePicker({ field: 'dueDate', label: t('Due date') }))
zone({ name: 'send' }, button({ variant: 'primary' }, t('Send')))
```

A zone records three facts per view:

- **`seen`**: some part of the zone was in the viewport while the document was visible. This is the
  scroll depth in a form that means something.
- **used**: the person worked inside the zone, with a pointer press, a key, an input or a wheel.
  `Tab` and a modifier key alone do not count, so focus that only passes through is no use. A record
  with `activeMs` above zero is a use.
- **`activeMs`**: the time that the person worked in the zone. Each interaction opens a window of 5
  seconds, and the active time is the union of those windows. Focus alone does not count. A cursor
  that blinks in a field for 10 minutes is no work.

Like `time`, a zone sends a delta when the document hides and when the view ends, and only when it
was seen or used. A zone with no record in a view was not seen. Zones of one name in one view are
one zone: five rows in `zone({ name: 'invoice-row' })` give one record. Zones nest, and an
interaction counts for every zone that holds it.

A zone does not change your layout. It is an `imp-zone` element with `display: contents` and no
shadow root. The panel of a `datePicker` or a `dialog` stays inside its zone. A zone that holds only
text is never seen, because it observes its child elements. Wrap the text in an element.

A zone name is kebab case, and it is local to the page. imp logs a name that is not kebab case, and
that zone records nothing.

**Tabs need no special code.** Put a zone in each panel. A panel that does not show has no box in
the viewport, so its zone is not seen:

```js
tabs({
  label: t('Invoice'),
  items: [
    { id: 'details', label: t('Details'), content: zone({ name: 'invoice-details' }, details()) },
    { id: 'history', label: t('History'), content: zone({ name: 'invoice-history' }, history()) },
  ],
})
```

No standard component records anything of its own. A zone measures it from the outside.

### `action`

A zone knows that the person worked in the send area. It does not know that the invoice was sent.
You state an outcome with `track()`, where the outcome happens:

```js
import { track } from 'imp/analytics'

api.post(`/invoices/${id}/send`).then(() => track('invoice-sent'))

if (!valid) track('invoice-form', 'invalid')
```

- An action is a kebab-case name and an optional value. imp logs a name that is not kebab case, and
  drops the record.
- The value is a string or a number that names one of a few fixed choices, such as `'valid'` and
  `'invalid'`. It must come from your code, never from what the person typed or chose.
- An action has no props. Props carry business data and personal data, and the report does not use
  them.
- `track` returns nothing. The action belongs to the view that shows when you call it.

### `error`

imp sends an `error` record for three sources:

| `source`  | Cause                                                                        | `message`                        |
| --------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `script`  | an uncaught error, an unhandled rejection, a state subscriber that throws    | the first line of the message    |
| `render`  | an error in a component, caught by an error boundary or by no boundary       | the first line of the message    |
| `request` | an `imp/http` request that fails on the network, times out, or answers a 5xx | `request failed: 500 POST /path` |

The message is one line of 200 characters or fewer. It never carries the origin or the query of a
URL, because a query often holds personal data. imp writes each URL in a message as its path only.
An error of `imp/http` always gets the request message, also as a `script` or `render` record, such
as `request failed: 404 GET /missing`.

One failed request gives one record. A request that fails on the network, times out, or answers a
5xx gives a `request` record. When your code does not catch that error, imp sends no second `script`
or `render` record for it. A request that answers a 4xx gives no `request` record, because a 4xx is
often an expected answer. If your code does not catch it, it gives a `script` or `render` record.

The record has no stack. `imp build` writes no source map, so a stack from production points into
minified code. The page, the view, the source and the message identify the failure.

To count an error that you catch, rethrow it after your UI shows the failure. imp then sends a
`script` record.

## Sinks for a store

imp calls each sink at once, synchronously, once per record, in the order of the records. It does
not wait for a sink. A sink can be `async`, and a slow sink never delays the next record or the UI.
imp catches a sink that throws or rejects, logs it, and goes on. A failed sink never becomes an
`error` record.

Turn off the automatic page views of your provider. imp sends a view on each navigation, so the
store otherwise counts each page twice.

### Google Analytics 4

```js
gtag('config', GA_ID, { send_page_view: false })

onAnalytics((record) => {
  if (record.type === 'view') {
    gtag('event', 'page_view', { page_location: location.origin + (record.page ?? record.path) })
  }
  if (record.type === 'zone') {
    gtag('event', 'zone', { zone: record.name, seen: record.seen, active_ms: record.activeMs })
  }
  if (record.type === 'action') {
    gtag('event', record.name.replaceAll('-', '_'), { outcome: record.value })
  }
  if (record.type === 'error') {
    gtag('event', 'exception', { description: record.message, fatal: false })
  }
})
```

- A GA4 event name uses letters, numbers and underscores only. So the sink replaces each hyphen.
- GA4 reads a `value` parameter as a monetary amount. So the sink sends the value as `outcome`.
- The sink skips `time`. GA4 measures the engaged time itself.
- GA4 writes cookies, so in Europe it needs consent. See [Consent](#consent).

### PostHog

```js
posthog.init(POSTHOG_KEY, { capture_pageview: false, capture_exceptions: false })

onAnalytics((record) => {
  if (record.type === 'view') {
    posthog.capture('$pageview', { $current_url: location.origin + (record.page ?? record.path) })
  }
  if (record.type === 'zone') {
    posthog.capture('zone', { zone: record.name, seen: record.seen, active_ms: record.activeMs })
  }
  if (record.type === 'action') posthog.capture(record.name, { value: record.value })
  if (record.type === 'error') {
    posthog.captureException(new Error(record.message), { source: record.source })
  }
})
```

Turn off the automatic exceptions of PostHog, so each failure arrives once. PostHog writes a cookie
by default, so in Europe it needs consent. See [Consent](#consent).

### Your own endpoint

```js
import { batch, onAnalytics } from 'imp/analytics'

onAnalytics(batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)), {
  size: 20,
  ms: 5000,
}))
```

**Send with `navigator.sendBeacon`, or with `fetch(url, { keepalive: true })`.** The `time` and
`zone` records fire as the page hides, and the browser can cancel a plain `fetch` there.

`batch(send, { size, ms })` returns a sink. It holds the records, and calls `send` with an array of
them. It sends in four cases:

- the array reaches `size`,
- `ms` passes after the first held record,
- the page becomes hidden,
- the `when` state of the sink stops being `true`,
- the sink is unregistered.

imp flushes a batch after it dispatches the `time` and `zone` records of that hide, in the same
task. So a batch is empty at each moment when the browser can freeze or discard the page. The
defaults are `size: 20` and `ms: 5000`. The browser limits the data in flight to about 64 KiB, and
20 records are about 4 KB. imp does not retry a failed batch, because a retry needs storage. The SDK
of a provider batches its own events, so do not wrap it in `batch`.

### Errors only

An app that wants only its errors forwards the records where `type` is `'error'`:

```js
onAnalytics((record) => {
  if (record.type === 'error') navigator.sendBeacon('/errors', JSON.stringify(record))
})
```

imp has no other error hook and no log sink. The `error` records answer "what breaks, where, and how
often?". A team that needs a stream of logs uses the SDK of its provider directly.

## Your own context

imp does not know your plans, your regions or your people. To compare usage across them, add
**segments** to the records: values that describe a group, such as `plan: 'pro'` or `country: 'PL'`.
A segment is not an id, so it does not make a record personal data, and it needs no consent.

Add the segments of the app in the sink. Hold the records until the app knows them:

```js
const user = useState(self, 'myapp.user')
const contextReady = computed([user], (value) => value !== undefined)
const send = batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)))

onAnalytics(self, (record) => send({ ...record, plan: user.get()?.plan ?? null }), {
  when: contextReady,
})
```

- `myapp.user` is `undefined` while it loads, and `null` when nobody is signed in. So a signed-out
  page is ready at once, with `plan: null`.
- The hold keeps the entry view. So the first screen gets the plan too.
- Other good segments are the role, the language, the version of the app, and a size bucket such as
  `'10-50 seats'`.

Add the country on the server, not in the browser. The endpoint that receives the records reads it
from the request, for example from a header of your CDN such as `CF-IPCountry`, or from a lookup of
the IP address. Then it writes the country into the records and discards the IP address. The time
zone and the language of the browser do not tell you the country.

Keep the segments coarse:

- **Do not add a user id or an organization id.** A user id is personal data, also when you hash it.
  An organization id can point at one person in a small organization. Both usually need consent in
  Europe, see [Consent](#consent). The plan and the country give the trends without them.
- **Hide a small group in the report.** "Enterprise plan in Iceland" can be one customer. Show a
  number only when its group has 10 visits or more.

## Consent

imp collects the records in memory. It stores nothing on the device, and it sends nothing. So imp
itself does not make your app need a consent banner. The sink and the store decide that. This
section tells you when a banner is necessary, and how imp helps you to wait for the answer. It is
not legal advice. The rules are different in each region, so check them for the regions of your
users.

### When to show a consent banner

In the European Union and the United Kingdom, show a banner before the sink sends records, when one
of these is true:

- **The SDK of a provider stores data on the device.** GA4 writes the `_ga` cookies. PostHog writes
  a cookie and a `localStorage` entry by default. Most analytics SDKs do the same.
- **The sink adds an id that stays after a reload.** Examples are a visitor id in `localStorage` and
  the id of the signed-in user.
- **The sink sends personal data.** Examples are an email address, a name, or a value that the
  person typed.
- **The store shares the records with a third party** that uses them for its own purposes, such as
  advertising.

A banner is often not necessary when you send the records to your own endpoint, with no stored id
and no personal data. Such first-party statistics can usually use legitimate interest as their legal
basis, not consent. Your app must then do these things:

- Describe the analytics in your privacy policy.
- Give the person a way to object. A `when` state that starts as `true` is an opt-out switch.
- Do not keep the full IP address of a request. Remove it or shorten it when the request arrives.
- Delete the records after a fixed period.

Outside Europe, most regions do not ask for consent for first-party analytics. In California, the
CCPA applies when you sell or share the records.

### Hold the records until consent

`onAnalytics(sink, { when: consent })` holds the records for that sink while the state `consent` is
not `true`. When it becomes `true`, imp delivers the held records in order, and the next records at
once. When it becomes `false` again, imp holds again.

```js
const consent = initState(self, 'myapp.consent', false)
onAnalytics(self, sendToStore, { when: consent })
```

- imp does not decide what consent means. Your app owns the banner and the state. imp only holds the
  records, so the entry view is not lost while the banner is open.
- The hold keeps the first view that it holds, and the newest 199 records. So a `track()` call or an
  error before the first screen does not push the entry view out.
- To remember the choice of the person, save it, for example in `localStorage`. This entry is part
  of the consent, so it needs no consent of its own.
- The same option covers an SDK that loads late: `{ when: providerReady }`.
- The hold is per sink. To report errors with no consent, register a second sink with no `when`,
  which forwards only the `error` records. You decide if your error reports need consent.
- `batch` works with `when`. The hold comes first, and the batch gets the records when the hold
  releases them.

### Stop the SDK until consent

**`when` holds only the records of imp. It does not stop the SDK of a provider.** GA4 and PostHog
write their cookies when they start, before the first record. So also start the SDK with no storage,
and give it the consent from the same state.

For GA4, use the consent mode of Google. In the `denied` state, GA4 writes no cookie:

```js
gtag('consent', 'default', { analytics_storage: 'denied' })
gtag('config', GA_ID, { send_page_view: false })

const consent = initState(self, 'myapp.consent', false)
consent.watch(self, (granted) => {
  gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
})
onAnalytics(self, sendToGa, { when: consent })
```

For PostHog, keep its data in memory until consent:

```js
posthog.init(POSTHOG_KEY, {
  capture_pageview: false,
  capture_exceptions: false,
  persistence: 'memory',
})

const consent = initState(self, 'myapp.consent', false)
consent.watch(self, (granted) => {
  posthog.set_config({ persistence: granted ? 'localStorage+cookie' : 'memory' })
})
onAnalytics(self, sendToPosthog, { when: consent })
```

**Call `consent.watch` before `onAnalytics`.** imp notifies the subscribers of a state in the order
in which they subscribed. So the SDK gets the consent first, and the held records arrive after it.

## The queries

Load the records into one table, one row per record. These queries use SQL for PostgreSQL, over a
table `records` with a `received_at` column that your store adds. Adapt them to the query language
of your store.

```sql
-- views per page, broken and slow p75 (entry views excluded from slow)
select coalesce(v.page, 'not found') as page,
       count(*) as views,
       avg(case when exists (select 1 from records e
                             where e.type = 'error' and e.view = v.view) then 1 else 0 end) as broken,
       percentile_cont(0.75) within group (order by v."readyMs")
         filter (where v."from" is not null) as slow_p75
from records v
where v.type = 'view'
group by 1;

-- not found: the paths off the map
select path, count(*) from records where type = 'view' and page is null group by path;

-- cold start p75
select percentile_cont(0.75) within group (order by "readyMs")
from records where type = 'view' and "from" is null;

-- reach: share of visits that opened the page
select page, count(distinct visit)::float / (select count(distinct visit) from records) as reach
from records where type = 'view' group by page;

-- engaged: median engaged time per view
select page, percentile_cont(0.5) within group (order by engaged) as engaged
from (select page, view, sum(ms) as engaged from records where type = 'time' group by page, view) t
group by page;

-- bounce: visits with one view and less than 10 s of engaged time
select avg(case when views = 1 and coalesce(engaged, 0) < 10000 then 1 else 0 end) as bounce
from (select visit,
             count(*) filter (where type = 'view') as views,
             sum(ms) filter (where type = 'time') as engaged
      from records group by visit) v;

-- left here: share of views that are the last view of their visit
select page, avg(case when last then 1 else 0 end) as left_here
from (select page, received_at = max(received_at) over (partition by visit) as last
      from records where type = 'view') v
group by page;

-- came from: the neighbours of a page
select "from", count(*) from records
where type = 'view' and page = '/invoices/:id' group by "from" order by 2 desc;

-- zones of a page: seen, used and active per view
select name,
       count(*) filter (where seen)::float / views.n as seen,
       count(*) filter (where active > 0)::float / views.n as used,
       percentile_cont(0.5) within group (order by active) filter (where active > 0) as active
from (select name, view, bool_or(seen) as seen, sum("activeMs") as active
      from records where type = 'zone' and page = '/invoices/:id' group by name, view) z,
     (select count(*) as n from records where type = 'view' and page = '/invoices/:id') views
group by name, views.n;

-- outcomes of a page, per value
select name, value, count(distinct view) from records
where type = 'action' and page = '/invoices/:id' group by name, value;

-- errors of a page, by message
select message, count(distinct view) from records
where type = 'error' and page = '/invoices/:id' group by message order by 2 desc;
```

## In development and in tests

`imp start` writes every record to the session log as a `[BROWSER:analytics]` line, with or without
a sink of your app. Check your zones and outcomes while you click through the app:

```sh
imp logs | grep analytics
```

In a unit test, register a sink with `onAnalytics(self, sink)` and assert on the records. With
`fakeTimers`, the virtual clock moves `readyMs`, the engaged time and the active time. See
**[Testing](testing.md)**.

## What imp does not record

Each of these failed the test "one number, one action":

- **A record per component**, such as a `data-track` attribute. A zone measures any component from
  the outside.
- **A heatmap and a rage click.** They are noisy. The broken views, the zones and the outcomes
  answer the same questions more directly.
- **A view per query key.** A zone in each tab panel measures the tabs.
- **Props on an action, the full path, the query, and the component chain.** The report groups by
  page, zone name, action name and action value only.
- **A user id and a session across tabs.** One visit per document load gives reach, bounce and "left
  here". Your sink can add segments such as the plan, see [Your own context](#your-own-context).
- **Web Vitals.** `readyMs` measures what your app controls, from the navigation to a ready screen.
- **A stack trace.** imp writes no source map, so a stack from production has no reader.
- **A transport, a retry and sampling.** They are the job of the sink.
