# imp-ui - Analytics

imp tells you which parts of your UI people see and use. It counts each page view, each zone that
comes into view, each zone that the person uses, each outcome that you name, and each failure. It
gives each count to a function that you register, a **sink**. The sink forwards the record to your
store: your own [imp-aly](#imp-aly) servers, Google Analytics, PostHog, your own endpoint, or the
console.

imp bundles no third-party provider. It makes no network call until you register a sink that sends
one. It stores no id on the device. It writes no cookie, and nothing to `localStorage` or
`sessionStorage`. A record carries no personal data: only a route pattern from your application map,
a name from your code, a time, and a random id of the visit. imp encourages you to keep it that way.
Do not add personal data in your sink.

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

pages            views   visits    used   errors
/invoices        9,800    8,400   7,900       12
/invoices/:id    7,100    6,200   6,600      310
/settings          400      390     210        0

/invoices/:id
  zones                    seen    used
  myapp.invoice-summary   6,900     900
  myapp.due-date          5,300   3,100
  myapp.send              5,300   2,900
  myapp.payment-options   1,500     200
  outcomes
  myapp.invoice-sent      2,900
```

Every number is a count of records. **views** is the number of `page` records. **visits** is the
number of different visit ids. **seen** is the number of `seen` records of the zone, and it is at
most one per page view. **used** is the number of `used` records, and it is also at most one per
page view. For a page, it counts the page views where the person used the page at all. **errors** is
the number of `error` records, and one record stands for up to 5 seconds of failures. **outcomes**
is the number of `outcome` records.

Read the report by comparison. A zone with many `seen` and few `used` is a part of the screen that
people look at and do not use. A page with many views and few outcomes is a flow that people start
and do not end. A page with errors is a page to open in the browser, with the console open.

## Setup

Register the sink in your entry module, **before `mount`**. Put it behind a build flag. Then a build
with the flag off contains no sink and no SDK. See **[Build flags](build-flags.md)**. A sink that
adds the plan or the role of the person reads your app state, so it registers in your root component
instead. See **[Segments](#segments)**.

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

| `type`    | Other fields     | One record per                                                     |
| --------- | ---------------- | ------------------------------------------------------------------ |
| `page`    |                  | screen that the router shows, when it is ready                     |
| `seen`    | `zone`           | zone that enters the viewport, once per page view                  |
| `used`    | `zone` or `null` | zone that the person uses, once per page view; `null` for the page |
| `outcome` | `name`           | `track(name)` call                                                 |
| `error`   |                  | 5 seconds of failures on the page                                  |

```jsonl
{"type":"page","visit":"k3v9a1c2","at":1759300006100,"page":"/invoices/:id"}
{"type":"seen","visit":"k3v9a1c2","at":1759300006150,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"used","visit":"k3v9a1c2","at":1759300009800,"page":"/invoices/:id","zone":null}
{"type":"used","visit":"k3v9a1c2","at":1759300009800,"page":"/invoices/:id","zone":"myapp.send"}
{"type":"error","visit":"k3v9a1c2","at":1759300015300,"page":"/invoices/:id"}
{"type":"outcome","visit":"k3v9a1c2","at":1759300019400,"page":"/invoices/:id","name":"myapp.invoice-sent"}
```

### `page`

The router records each screen that it shows, when the screen is ready. You write no code for it.
See **[Routing](routing.md)**.

- A screen is ready when it replaces its loading content. This is after a guard `wait`, the download
  of an area, and the data that the screen awaits in its `setup`.
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

### `used`

A zone is used when the person clicks, taps or types inside it. imp listens for three events on the
document: `click`, `input` and `keydown`. imp sends one `used` record for a zone the first time in a
page view. Zones nest, and an event counts for every zone that holds it.

A key that does not use the zone is no use. These keys are Tab, Shift, Control, Alt, Meta, CapsLock,
Escape and the function keys F1 to F24. So a person who moves the focus through a zone with Tab, or
presses only a modifier key, does not use it. Each other key is a use, such as a letter, Enter or an
arrow key.

imp also sends one `used` record with `zone: null` per page view. It goes out for the first event
anywhere on the page, inside a zone or not. So `zone: null` says that the person used the page at
all.

A used zone is also a seen zone. When the person uses a zone before its `seen` record went out, imp
sends the `seen` record first. imp counts only the events of the person. An event that your code
dispatches, such as `element.click()`, is no use.

These rules keep the number honest:

- **`click` covers a mouse, touch and a pen.** The browser fires no `click` when a finger scrolls
  the page. So a finger that lands on a zone to scroll does not use it. For the same reason, a
  pointer press and a wheel turn are no use.
- **One record per zone per page view.** So `used` is never more than `seen` for a zone. The share
  "used when seen" is `used` divided by `seen`: the part of the page views that showed the zone and
  had a use of it.
- **No time in a zone.** A dwell time needs a pointer that stays over the zone. Touch and the
  keyboard have no such pointer, so the time means a different thing for each person.

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
state name, with one more limit. A name has only ASCII letters, digits, `-` and `_` between the
dots, and at most 128 characters. imp logs a name that breaks a rule, and that zone or outcome
records nothing.

The limit keeps a name safe in every place that shows it: a terminal, a report page or a log. A name
cannot hold HTML, a quote, a space or a Unicode character that changes the look of the text. An
analytics server can reject such a name, so imp stops it in the browser first.

Give each zone and each outcome its own name, in one place of your code. The report groups the
records by name, so two zones of one name on different pages are still two rows, but two zones of
one name on one page are one row. `imp lint` checks both rules on every name. See
**[Lint](lint.md)**.

**Write each name as a literal.** `imp build` reads every name from your code and lists them for
your store, see [Check each record on the server](#check-each-record-on-the-server). So the name
must be a string, or a template literal with no `${...}` in it. `zone()` must get an object literal
with a literal `name`, and no spread. A name that the build cannot read stops the build:

```js
zone({ name: 'myapp.invoice-summary' }, summary()) // correct
track('myapp.invoice-sent') // correct
zone({ name: `myapp.${part}` }, summary()) // stops the build
zone(options, summary()) // stops the build
```

```
imp build cannot read every analytics name:
  src/invoice.js:8:14 - zone name is not a literal - imp build lists every zone name for the analytics store, so write the name as a string, like zone({ name: 'myapp.invoice-summary' })
```

## No personal data

imp records only a route pattern, a name from your code, a time and a random visit id. None of these
is personal data, so imp itself does not make your app need a consent banner. Keep the records that
way in your sink:

- **Do not add a user id or an organization id.** A user id is personal data, also when you hash it.
  An organization id can point at one person in a small organization.
- **Add segments, not ids.** A segment describes a group, such as `plan: 'pro'`. Other good segments
  are the role, the language and the version of the app. Use short values of ASCII letters, digits,
  `.`, `-` and `_`, such as `pro`, `en-US` or `1.2.3`. A strict analytics server rejects a value
  with other characters, such as a space, a quote or an accented letter. Hide a small group in the
  report, because "Enterprise plan in Iceland" can be one customer. See **[Segments](#segments)**.
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

### imp-aly

[imp-aly](https://github.com/sobanieca/imp-aly) is an analytics server for imp apps. You run it on
your own VPS. It checks each record against the lists that `imp build` writes, stores it on the disk
of the server, and answers the queries of the report. imp ships the sink for it in a separate
module:

```js
import { flag, mount } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
import { app } from './app.js'

if (flag('ANALYTICS')) {
  onAnalytics(alySink({
    app: 'myapp',
    servers: ['https://aly-1.myapp.example', 'https://aly-2.myapp.example'],
  }))
}

mount('#app', app())
```

An app that does not import `imp/analytics/aly` does not contain the sink. The bundler removes it.

| Option     | Value                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `app`      | The name of the app on the servers: lowercase letters, digits and `-`. Required.                  |
| `servers`  | The list of the URLs of your imp-aly servers. Required. A URL can have a path, such as `/aly`.    |
| `segments` | A function that returns the segments of a record. See [Segments](#segments). Optional.            |
| `size`     | The number of records in one batch, as for `batch`. The default is `20`.                          |
| `ms`       | The time in milliseconds that a batch waits for more records, as for `batch`. The default `5000`. |

`alySink` returns a `batch` sink. It posts each batch to `<server>/collect/<app>` with `fetch` and
`keepalive`, so a batch also goes out when the page hides. The request sends no cookie. Its
`Referer` header holds only the origin of the page, never the path. The first record of a visit goes
out at once, so the sink finds a server that is down while the page is still open.

**One visit goes to one server.** The sink picks the server from the visit id, so every record of a
visit goes to the same server. Two `alySink` calls with the same list pick the same server. The
visits of two servers do not overlap, so `imp-aly query` adds up their counts exactly. Add a server
to the list when one server is not sufficient for the traffic.

When the server of a visit does not answer, or answers with a 5xx, the sink sends the batch to the
next server of the list. It then keeps that server for the rest of the visit. Such a visit has
records on two servers, and the report counts it twice. When no server takes a batch, the sink logs
a warning and drops the batch.

The sink logs each problem that the server reports:

| Answer           | What the sink does                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| `202`            | It logs a warning when the server rejected some records. `imp-aly app show` gives why. |
| `404`            | It logs an error. Register the app on that server.                                     |
| `429`            | It logs a warning. The rate limit of the server dropped the batch.                     |
| other `4xx`      | It logs an error and drops the batch. The visit stays on the same server.              |
| `5xx`, no answer | It sends the batch to the next server.                                                 |

Register the app on every server of the list, with the segments that `segments` returns. Give the
URL of the folder of your build output. imp-aly reads `app-analytics.json` from there. A local build
folder, such as `dist`, also works.

```sh
imp-aly app add myapp https://myapp.example/ --segments plan,role,lang -s aly-1,aly-2
```

**A segment that a server does not know makes it reject the record.** Declare each segment name on
every server before you deploy the sink. When a server runs with `--allow-origin`, add the origin of
your app to that list. Otherwise the browser blocks the request, and the sink tries the next server.

imp-aly accepts these segments:

- A name has 1 to 32 letters and digits, and starts with a letter. So `plan` and `appVersion` are
  correct, and `app-version` is not.
- A name is not `type`, `visit`, `at`, `page`, `zone`, `name`, `country`, `day`, `week`, `month`,
  `records` or `visits`, in any case.
- A name is not a built-in property name of a JavaScript object, such as `constructor`, `toString`
  or `valueOf`.
- An app has at most 16 segments.
- A value is `null`, a number, a boolean, or a text of 1 to 64 ASCII letters, digits, `.`, `-` and
  `_`. imp-aly stores a record with a `null` value without that segment.

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

Register `visit`, `page`, `zone` and `name` as custom dimensions with the event scope. GA4 shows
only the parameters that you register.

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

`batch(send, { size, ms, segments })` returns a sink. It holds the records, and calls `send` with an
array of them. It sends in these cases:

- the array reaches `size`,
- `ms` passes after the first held record,
- the page becomes hidden, or the browser unloads it,
- the sink is unregistered.

The defaults are `size: 20` and `ms: 5000`. The optional `segments` function adds the segments to
each record when it arrives. See [Segments](#segments). The browser limits the data in flight to
about 64 KiB, and 20 records are about 2 KB. imp does not retry a failed batch, because a retry
needs storage. The SDK of a provider batches its own events, so do not wrap it in `batch`.

#### Check each record on the server

**Anyone can post to a public endpoint, so your store must know which records are real.** When
`imp.json` names a `map`, `imp build` writes `app-analytics.json` at the root of the output, next to
the bundle. See **[Deploying an app](deploy.md)**. The file holds three lists:

```json
{
  "pages": ["/", "/invoices", "/invoices/:id"],
  "zones": ["myapp.invoice-summary"],
  "outcomes": ["myapp.invoice-sent"]
}
```

| Key        | Entries                                                |
| ---------- | ------------------------------------------------------ |
| `pages`    | the route pattern of each page of your application map |
| `zones`    | the name of each zone that the app can send, sorted    |
| `outcomes` | the name of each outcome that the app can send, sorted |

The two name lists hold every name from `zone({ name })` and `track(name)` in each module of your
app. They do not hold the names of an imp component in `dependencies/`, so your store drops the
records of such a component. See **[Dependencies](dependencies.md)**. An app with no zone gets an
empty `zones` list.

Your server reads the file from your site, and drops a record that is not on its lists:

- a record whose `page` is not in `pages`,
- a `seen` or `used` record whose `zone` is not in `zones`,
- an `outcome` record whose `name` is not in `outcomes`.

A `used` record with `zone: null` is always correct. It is the use of the page.

```js
const response = await fetch('https://myapp.example/app-analytics.json')
const lists = await response.json()
const [pages, zones, outcomes] = [lists.pages, lists.zones, lists.outcomes].map((list) =>
  new Set(list)
)
const isKnown = (record) => {
  if (!pages.has(record.page)) return false
  if (record.type === 'seen') return zones.has(record.zone)
  if (record.type === 'used') return record.zone === null || zones.has(record.zone)
  if (record.type === 'outcome') return outcomes.has(record.name)
  return true
}
const accepted = records.filter(isKnown)
```

Read the file again after each deploy, or on a timer. A record always carries a `page`, so a record
without one is spam too. So a false record must name a real page and a real zone or outcome.

### Errors only

An app that wants only its errors forwards the records where `type` is `'error'`:

```js
onAnalytics((record) => {
  if (record.type === 'error') navigator.sendBeacon('/errors', JSON.stringify(record))
})
```

imp has no other error hook and no log sink. A team that needs the message of each error, or a
stream of logs, uses the SDK of its provider directly.

## Segments

A segment splits the report by a group of people, such as the plan, the role or the language. imp
does not know these groups. Your app knows them, because it holds the session of the signed-in
person in its state. The sink reads that state and adds the segments to each record:

```jsonl
{"type":"outcome","visit":"k3v9a1c2","at":1759300019400,"page":"/invoices/:id","name":"myapp.invoice-sent","plan":"pro","role":"admin","lang":"en"}
```

Then the report can answer questions such as "do people on the free plan reach the send button?" or
"do admins use the settings page?".

### Read the segments from the state

A state belongs to a component, so your entry module cannot read it. Register the sink in the
`setup` of the component that holds the session state. In most apps, that is the root component.
This example sends to imp-aly:

```js
// app.js
import { component, flag } from 'imp'
import { onAnalytics } from 'imp/analytics'
import { alySink } from 'imp/analytics/aly'
import { lang } from 'imp/i18n'
import { initState } from 'imp/state'

const roleOf = (session) => {
  if (!session) return null
  return session.roles.includes('admin') ? 'admin' : 'member'
}

const sessionSegments = (session) => ({
  plan: session?.plan ?? null,
  role: roleOf(session),
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
```

Register the three segments on each server: `--segments plan,role,lang`. See
**[imp-aly](#imp-aly)**.

**Register the sink once, when the app starts. Do not wait for the sign-in.** The sink calls
`segments` for each record when the record arrives. So each record carries the state at that moment.
After a sign-in, the next record carries the plan. After a sign-out, the next record has no plan.
The root component sets up before the router shows the first screen, so the sink gets every record
of the visit.

**A record without a session has `null` segments.** This applies to a signed-out person, and to the
time while the session loads. A screen behind a guard that waits for the session is ready only after
the session loads, so its `page` record carries the plan. A public screen, such as `/login`, sends
its records with `plan: null`. imp-aly stores such a record without the segment. A query that groups
by `plan` gives these records as one group with a `null` plan.

**A visit can be in two groups.** A person can upgrade from `free` to `pro` during a visit. The
records before the change carry `free`, and the records after it carry `pro`. A count of visits per
plan counts that visit once in each plan.

**Keep the sink in a component that stays mounted and has one instance.** `onAnalytics(self, sink)`
ends the registration when the component unmounts. A sink in a screen stops when the person leaves
the screen. A sink in a component with several instances sends each record once per instance.

**Register the sink late only to wait for consent.** A sink in the signed-in part of the app gets no
record from before the sign-in, other than the `page` record of the current screen. It loses the
sign-in page, and every visitor who does not sign in. See **[No personal data](#no-personal-data)**.

### Choose the segments

- **A segment is a group, never an id.** Good segments are the plan, the role, the language, the
  version of the app, and the size class of the organization. A user id or an organization id is
  personal data. See **[No personal data](#no-personal-data)**.
- **A value is a key from your code, never a text that the person sees.** Send `pro`, not
  `Pro plan`. Send `en-US`, not `English (US)`. Use the key that your API returns, not its label.
- **A segment has one value.** Reduce a list to one key, such as the roles of a person to `admin` or
  `member`.
- **Keep the number of values small.** A segment with many different values, such as the number of
  seats, splits the report into many small groups. Put the values in classes, such as `1`, `2-10`,
  `11-50` and `51+`. A small group can also point at one customer.

### Segments in other sinks

The `segments` option belongs to `alySink`. For another sink, add the segments in the sink, and
register it in the same component. For a provider SDK, spread them into the properties of each
event. This is the PostHog sink with segments:

```js
onAnalytics(self, ({ type, ...fields }) => {
  const properties = { ...fields, ...sessionSegments(session.get()) }
  if (type === 'page') {
    posthog.capture('$pageview', { ...properties, $current_url: location.origin + fields.page })
  } else {
    posthog.capture(type, properties)
  }
})
```

For your own endpoint, give `batch` the same `segments` function as `alySink`:

```js
onAnalytics(
  self,
  batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)), {
    segments: () => sessionSegments(session.get()),
  }),
)
```

**Do not add the segments in `send`, and do not wrap a `batch` sink in another sink.** `send` runs
when the batch goes out, up to `ms` after a record. So a record on `/login` from before the sign-in
gets the plan of after the sign-in. imp sends the held records of a `batch` sink when the page
hides. It cannot do that through a wrapper, so the last records of the visit are lost.

## The queries

imp-aly answers the queries of the report itself, with `imp-aly query`. For another store, load the
records into one table, one row per record. These queries use SQL for PostgreSQL, over a table
`records`. Adapt them to the query language of your store.

```sql
-- visits
select count(distinct visit) from records;

-- pages: views, visits, used and errors
select page,
       count(*) filter (where type = 'page') as views,
       count(distinct visit) filter (where type = 'page') as visits,
       count(*) filter (where type = 'used' and zone is null) as used,
       count(*) filter (where type = 'error') as errors
from records
group by page;

-- zones of a page: seen and used
select zone,
       count(*) filter (where type = 'seen') as seen,
       count(*) filter (where type = 'used') as used
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
`fakeTimers`, the virtual clock moves `at` and the 5 seconds of the errors. An event that a unit
test dispatches is not an event of the person, so it sends no `used` record. Check `used` in an e2e
test, where the browser gets real input. See **[Testing](testing.md)**.

## What imp does not record

Each of these failed the test "one number, one action", or carries personal data:

- **The message of an error.** A message can carry a URL with a query, an email address or a token.
  The record says that the page failed, and the browser console says why.
- **A page off the map.** A path can carry personal data, so a screen off the map sends no record at
  all. Put each screen on the map, so that its records carry the route pattern.
- **A time.** imp does not record the time until a screen is ready, the time on a page, the time in
  a zone or a Web Vital. A time is not a count of records.
- **A record per component**, such as a `data-track` attribute. A zone measures any component from
  the outside.
- **A heatmap and a rage click.** They are noisy. The zones and the outcomes answer the same
  questions more directly.
- **A value on an outcome.** A value from your code is one more name. A value from the person is
  personal data.
- **A user id and a session across tabs.** One visit per document load gives reach. Your sink can
  add segments such as the plan.
- **A transport, a retry and sampling.** They are the job of the sink.
