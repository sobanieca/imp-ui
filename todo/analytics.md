# Analytics - pages, zones and outcomes that tell if the UI works

Give imp a built-in seam for product analytics, and keep it small. Design it from the outcome: the
report that a developer reads. Every number in that report answers one question and points at one
action. imp collects only the data that those numbers need.

imp **collects** the records and **dispatches** them to the sinks that the app registers. A sink
**forwards** a record to a store: Google Analytics, PostHog, an internal endpoint, a file, or the
`console`. imp bundles no provider and makes no network call.

**imp ships no report.** There is no `imp analytics` command. The report below is the target of the
design: the numbers that the store of an app computes from the records. The docs describe each
number and give the query for it.

**The home for the import is `imp/analytics`**, see `adr/library-import-namespaces.md`. It exports
`onAnalytics`, `batch`, `zone` and `track`.

An app measures three levels, and each level has one tool:

| Level      | Question                               | Tool                                   |
| ---------- | -------------------------------------- | -------------------------------------- |
| a page     | is it used, is it fast, does it break? | nothing - the router records each view |
| a zone     | is this part of the screen seen, used? | `zone({ name }, ...children)`          |
| an outcome | did the person get the result?         | `track(name, value?)`                  |

## The outcome - one report

```
$ analytics report --days 7

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

$ analytics report /invoices/:id

zones (per view)       seen    used   active (median, when used)
  invoice-summary       94%     12%     3s
  due-date              71%     31%     6s
  send                  71%     44%     1s
  invoice-history       23%      9%     8s
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

The report has two halves, because a person reads them in two ways:

- **"Working" has flags.** A broken view, a slow screen and a missing page are bad in every app. So
  a fixed threshold can mark them. It answers the question "do my pages work?".
- **"Usage" has no flags.** A short time can mean a quick task or a confused person. Only a person
  who knows the page can judge it. It answers the question "is my UI good?". The zones and the
  outcomes of a page belong to this half.

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

A flag needs 50 views or more in the period, so a rare page does not raise noise. The flag
thresholds are 1% for broken and 1000 ms for slow.

## The data - five record types

Every record carries `type`, `visit`, `view` and `page`. The store adds the time when it receives
the record.

```jsonl
{"type":"view","visit":"k3v9","view":"A","page":"/invoices/:id","from":"/invoices","readyMs":420}
{"type":"time","visit":"k3v9","view":"A","page":"/invoices/:id","ms":25000}
{"type":"zone","visit":"k3v9","view":"A","page":"/invoices/:id","name":"due-date","seen":true,"activeMs":6000}
{"type":"action","visit":"k3v9","view":"A","page":"/invoices/:id","name":"invoice-form","value":"invalid"}
{"type":"error","visit":"k3v9","view":"A","page":"/invoices/:id","source":"render","message":"TypeError: total is undefined"}
```

- **`visit` is one random id per document load.** imp holds it in memory only. It writes no cookie,
  and nothing to `localStorage` or `sessionStorage`. So the collection stores no identifier on the
  device. A reload starts a new visit. A person, and a session across tabs, are not in scope.
- **`view` is one random id per view.** Every record between two views carries the same `view`.
- **`page` is the route pattern of the matched node of the application map**, such as
  `/invoices/:id`. The report groups by it. It has the shape of a path, so a store that keys a page
  by its URL, such as Google Analytics, uses it as it is. It holds no param value. Each node has
  exactly one pattern, so the pattern is the one key of a page, and a record needs no second id.
- **A path off the map has `page: null`.** Its `view` record is the only record that carries a
  `path`, with no query. There, the path is the only fact that helps.

### `view` - one mounted screen

- **The route page of the matched node is the view.** Each matched screen already mounts inside an
  internal route page, see `adr/client-side-router.md`. That route page runs the guard, loads the
  area chunk, shows the loading content, and unmounts when the person leaves. So it already knows
  every moment that a view needs. It reports them to the shared module of analytics: it mounts, it
  is ready, it unmounts. The router gets no second analytics path.
- **The router keys a screen by the node and the params.** So a change of the query only is no view,
  because the screen stays mounted. A navigation inside an area is a view, because the route page of
  the new node mounts. For an area, the view is the route page of the matched node, not the route
  page of the area around it.
- **A route page that redirects is no view.** A guard redirect, and a `redirect()` binding, give one
  view, for the node where the navigation ends.
- **`from` is the `page` of the previous view.** It is `null` on the entry view of a visit.
- **`readyMs` is the time from the mount of the route page to the moment the screen replaces its
  loading content.** So it includes the guard `wait`, the area chunk, and the data that the screen
  awaits in its `setup`. For the entry view it starts at the start of the document load. imp sends
  the record when the screen is ready. When the person leaves before that, imp sends it with
  `readyMs: null`.

### `time` - engaged time on the page, as a delta

- Engaged time counts only while the document is visible and has focus. It counts reading too, with
  no interaction. That is the difference from the active time of a zone.
- imp sends a `time` record when the document becomes hidden, and when the view ends. When the
  person comes back, the same view counts again from zero. The engaged time of a view is the sum of
  `ms` per `view`.
- This is the only shape that survives a mobile browser that closes a hidden tab with no further
  event.

### `zone` - a part of the screen

```js
import { zone } from 'imp/analytics'

zone({ name: 'invoice-summary' }, summaryCard(invoice))
zone({ name: 'due-date' }, datePicker({ field: 'dueDate', label: t('Due date') }))
zone({ name: 'send' }, button({ variant: 'primary' }, t('Send')))
```

A zone wraps any content: a section of a screen, one standard component, a raw element, or a
component from a third party. It records three facts per view:

- **`seen`**: some part of the zone was in the viewport while the document was visible. This is the
  scroll depth in a form that means something. "Payment options, seen in 22% of views" says that
  people do not scroll to it.
- **used**: the person interacted inside the zone. An interaction is a `pointerdown`, a `keydown`,
  an `input` or a `wheel` event. A `keydown` of `Tab`, or of a modifier key alone, is not an
  interaction. So focus that only passes through a zone is no use. A record with `activeMs` above
  zero is a use.
- **`activeMs`**: the time that the person worked in the zone. Each interaction opens a window of 5
  seconds. The active time is the union of those windows while the document is visible. Focus alone
  does not count, because a cursor that blinks in a field for 10 minutes is no work.

The rules of a zone:

- **A zone sends a delta, like `time`.** imp sends one `zone` record per zone name when the document
  becomes hidden and when the view ends. It sends a record only for a zone that was seen or used
  since the last record. A zone with no record in a view was not seen.
- **One name in one view is one zone.** Five rows that each sit in `zone({ name: 'invoice-row' })`
  give one record. It is seen when any row was seen, and its active time is the union of the windows
  of all rows.
- **Zones nest.** An interaction counts for every zone that holds it. So `due-date` inside
  `invoice-form` counts for both.
- **A name is kebab case, and it is local to the page.** The record carries `page` already. imp logs
  a name that is not kebab case, and the zone records nothing.
- **A zone is `imp-zone`, with `display: contents` and no shadow root.** So a zone does not change
  the layout of a flex or a grid. Its children stay in the tree scope of their parent, so an id
  reference across the zone still resolves, see `adr/shadow-dom-isolation.md`.
- **A zone listens on itself.** The four events are composed, so they reach the zone from inside the
  shadow root of any component. An overlay, such as the panel of a `datePicker` or a `dialog`, stays
  inside its zone, because imp promotes an overlay in place to the top layer and does not move it,
  see `adr/overlay-top-layer.md`.
- **A zone observes its child elements** with an `IntersectionObserver`, because an element with
  `display: contents` has no box. A zone that holds only text is never seen. Wrap the text in an
  element.
- **A zone costs almost nothing without a sink.** It adds itself to a set in the shared module when
  it connects, and removes itself when it disconnects. It adds its listeners and its observer only
  while collection runs.

**Tabs need no special logic.** Wrap the content of each panel in a zone. A panel that does not show
has no box in the viewport, so its zone is not seen:

```js
tabs({
  label: t('Invoice'),
  items: [
    { id: 'details', label: t('Details'), content: zone({ name: 'invoice-details' }, details()) },
    { id: 'history', label: t('History'), content: zone({ name: 'invoice-history' }, history()) },
  ],
})
```

**No standard component records anything of its own.** A zone measures it from the outside. So the
standard library carries no analytics code, and a new component needs no analytics work.

### `action` - an outcome that the app states

```js
track('invoice-sent')
track('invoice-form', 'invalid')
```

- **A zone knows that the person worked in the send area. It does not know that the invoice was
  sent.** The app states an outcome with `track()`, where the outcome happens: after a request
  succeeds, or when a form fails validation.
- **An action is a name, and an optional value.** A name is kebab case. imp logs a name that is not
  kebab case, and drops the record. `value` is a string or a number that names one of several fixed
  choices, such as `'valid'` and `'invalid'`. It must come from the code of the app, never from what
  the person typed or chose. An action has no props. Props carry business data and personal data,
  and the report does not use them.
- `track` is synchronous. It returns nothing, and it never throws for a sink that fails.
- The context is the view at the moment of the call. A `track()` in the callback of a request that
  ends after a navigation gets the new page.

### `error` - imp reports what broke

imp sends an `error` record for three sources:

| `source`  | Cause                                                                        | `message`                        |
| --------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `script`  | an uncaught `error`, an `unhandledrejection`, a state subscriber that throws | the first line of the message    |
| `render`  | an error that an error boundary catches                                      | the first line of the message    |
| `request` | an `imp/http` request that fails on the network or with a 5xx                | `request failed: 500 POST /path` |

- The message is one line, 200 characters or fewer. A request message has no query.
- **The `error` record is the only error seam of imp.** There is no `onError`, and no log sink, see
  `todo/prod-ready.md`. A sink that wants only the errors forwards the records where `type` is
  `'error'`.
- **The record has no stack.** `imp build` writes no source map, so a stack from production points
  into minified code, see `adr/production-bundling.md`. The `page`, the `view`, the `source` and the
  message identify the failure.
- **A state subscriber that throws is a `script` error.** `createNotifier`, in `lib/src/state.js`,
  catches the error so that the other subscribers still run. Today it only logs to the console. So a
  UI that updated in part leaves no trace in production.

## Sinks

```js
import { onAnalytics } from 'imp/analytics'
import { flag } from 'imp'

if (flag('ANALYTICS')) {
  onAnalytics((record) => navigator.sendBeacon('/collect', JSON.stringify(record)))
}
```

- `onAnalytics(sink)` registers a sink for the life of the page and returns the function that
  unregisters it. `onAnalytics(self, sink)` ends the registration when the component of `self`
  unmounts. That keeps the tests of `imp test` isolated.
- **Register a sink before `mount`.** Collection starts at the first registration and stops when the
  last sink goes. When it starts late, imp sends the `view` of the current route page at once, and
  it starts the zones that are connected already. The engaged time before the start is lost.
- **An app with no sink pays nothing.** The router, the route page and `zone` do not import the
  collection. They report to a small shared module, which drops a report while no sink is
  registered.
- imp allows several sinks.
- **imp calls a sink at once, and does not wait for it.** The call happens in the same task as the
  event, so a sink runs before a hidden page can freeze. A sink can be `async`, and its network call
  is async. imp does not await the promise that it returns, so a slow sink never delays the next
  record or the UI.
- **A failed sink never becomes an `error` record.** imp catches a sink that throws, and a promise
  from a sink that rejects. It logs both through the built-in logger, and goes on with the next
  sink. Without this rule, a rejected promise is an `unhandledrejection`. imp sends that as an
  `error` record, to the same sink, which fails again: a loop. Analytics must never break the app.
- **A sink that sends to its own endpoint must use `sendBeacon` or
  `fetch(url, { keepalive: true })`.** The `time` and `zone` records fire as the page hides, and the
  browser can cancel a plain `fetch` there. The SDK of a provider handles this itself.
- The feature flag keeps the sink, and the SDK of a provider, out of a build where the flag is off,
  see `adr/feature-flags.md`.

### Batches - `batch(send, { size, ms })`

A sink that sends to its own endpoint can send the records in batches:

```js
import { batch, onAnalytics } from 'imp/analytics'

onAnalytics(batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)), {
  size: 20,
  ms: 5000,
}))
```

- `batch` returns a sink. It holds the records, and it calls `send` with an array of them.
- **It sends when one of four things happens:** the array reaches `size`, `ms` passes since the
  first held record, the page becomes hidden, or the sink is unregistered.
- **The flush on hide is the reason that imp owns this helper.** imp flushes a batch after it
  dispatches the `time` and `zone` records of that hide, in the same task. So a batch is empty at
  each moment where the browser can freeze or discard the page. A batch that an app writes by hand
  gets this order wrong.
- The defaults are `size: 20` and `ms: 5000`. `send` must use `sendBeacon`, or `fetch` with
  `keepalive`, for every batch. The browser limits the data in flight to about 64 KiB, and 20
  records are about 4 KB.
- A `send` that throws or rejects follows the rule for a failed sink. imp does not retry a batch,
  because a retry needs storage, and imp stores nothing on the device.
- `batch` works with `when`. The hold comes first, and the batch gets the records when the hold
  releases them.
- The SDK of a provider batches its own events. A sink for Google Analytics or PostHog does not use
  `batch`.

## Consent is a state

`onAnalytics(sink, { when: consent })` holds the records for that sink while the state `consent` is
not `true`. When it becomes `true`, imp delivers the held records in order, and the next records at
once. When it becomes `false` again, imp holds again.

- imp does not decide what consent means. The app owns the banner and the state. imp only holds the
  records, so the entry view is not lost while the banner is open.
- The hold keeps the entry view, and the newest 199 records after it.
- The same option covers an SDK that loads late: `when: providerReady`.
- **The hold is per sink.** An app that reports its errors with no consent registers a second sink
  with no `when`, which forwards only the `error` records. The app decides if its error reports need
  consent.

## Any analytics store

The seam must work with any store. These properties of the design make that true, and the
implementation must keep all of them:

- **A record is plain data that `JSON.stringify` accepts.** The five types and their fields are
  fixed, so a sink can map each type to the event of its store once.
- **A sink is a plain function.** imp calls it synchronously, once per record, in the order of the
  records. So a sink can call any SDK: `gtag`, `posthog.capture`, `plausible`, or `sendBeacon`.
- **`page` has the shape of a path.** A store that keys a page by its URL gets a page URL with no
  param value in it.
- **imp loads no script and sends nothing to a store.** The app loads the script of its provider,
  behind the feature flag. The app must turn off the automatic page views of the provider, because
  imp sends a view on each navigation. If it does not, the store counts each page twice.
- **The consent hold works with the consent mode of a provider.** An app can use `when`, the consent
  mode of the provider, or both.

Each store maps the five types to its own events:

| Record   | Google Analytics 4                                 | PostHog                                 |
| -------- | -------------------------------------------------- | --------------------------------------- |
| `view`   | `page_view`, with `page_location` from `page`      | `$pageview`, with `$current_url`        |
| `time`   | skip - GA4 measures the engaged time itself        | a custom event, or skip                 |
| `zone`   | a `zone` event, with the name, `seen` and the time | `capture('zone', { name, seen, ... })`  |
| `action` | an event named in snake case, `value` as a param   | `capture(name, { value })`              |
| `error`  | `exception`, with `description` and `fatal: false` | `capture('error', { source, message })` |

A sink for Google Analytics 4:

```js
gtag('config', GA_ID, { send_page_view: false })

onAnalytics((record) => {
  if (record.type === 'view') {
    gtag('set', { page_location: location.origin + (record.page ?? record.path) })
    gtag('event', 'page_view')
  }
  if (record.type === 'zone') {
    gtag('event', 'zone', { zone: record.name, seen: record.seen, active_ms: record.activeMs })
  }
  if (record.type === 'action') {
    gtag('event', record.name.replaceAll('-', '_'), { value: record.value })
  }
  if (record.type === 'error') {
    gtag('event', 'exception', { description: record.message, fatal: false })
  }
}, { when: consent })
```

## Development and tests

- **`imp start` writes every record to the session log** as a `[browser:analytics]` line, with or
  without a sink. An agent checks its zones and its outcomes with `imp logs | grep analytics`.
- **A test registers a sink with `onAnalytics(self, sink)`** and asserts on the records. `readyMs`,
  the engaged time and the active time read `performance.now()`, so the fake clock of `imp/test`
  moves them, see `adr/fake-timers.md`.

## Acceptance

- The library tests run the GA4 sink and the PostHog sink of the docs against a stub of `gtag` and
  of `posthog`. They assert the calls for one visit with a view, a navigation, a zone, an outcome,
  an error and a hidden tab. Check the names of the GA4 and PostHog events against the documentation
  of each provider when you write the docs page.
- Tests cover `batch`: a flush at `size`, at `ms`, on hide after the `time` and `zone` records, and
  on unregister.
- A test covers a sink that rejects: imp logs it once, and sends no `error` record.
- A test covers a state subscriber that throws: imp sends one `script` record, and the other
  subscribers still run.
- The e2e tests cover a zone around a `datePicker`: an interaction in its open panel counts, a `Tab`
  through it does not, and a zone below the fold is not seen until the page scrolls. They cover a
  zone in an inactive tab panel, which is not seen, in LTR and in RTL.
- An app must be able to load the script of a provider from its origin. So the CSP item of
  `todo/prod-ready.md` must let an app add a script origin.

## Not in scope

Each of these failed the test "one number, one action":

- **An instrumentation per component**, such as a `data-track` attribute, or a record that each
  standard component sends for its own use. A zone measures any component from the outside, with one
  mechanism.
- **A heatmap and a rage click.** They are noisy. `broken`, the zones and the outcomes answer the
  same questions more directly.
- **A view per query key.** A change of the query keeps the screen mounted, so it is no view. A zone
  in each tab panel measures the tabs.
- **Props on an action, the full path, the query, and the component chain.** The report groups by
  page, zone name, action name and action value only.
- **A report command.** imp ships no `imp analytics` command. The store of the app computes the
  report, and the docs give the queries.
- **A user id and a session across tabs.** One visit per document load gives reach, bounce and "left
  here".
- **Web Vitals.** `readyMs` measures what the app controls, from the navigation to a ready screen.
- **A client of a provider**, a transport, a retry and a sample. They are the job of the sink.
- **A stack trace.** imp writes no source map, so a stack from production has no reader.
- **A call to report a caught error.** The app catches an error to handle it. To count it too, the
  app rethrows it after the UI shows the failure, and imp sends a `script` record.
- **A stream of logs.** The `error` records answer "what breaks, where, and how often?". A team that
  needs a stream of logs uses the SDK of its provider directly.

## Dependencies

- The route page reports its mount, its readiness and its unmount to a small shared module. The
  router, the route page and `imp-zone` import that module, and not the collection. So no module
  pulls in `imp/analytics`.
- The `render` source reads the error boundary of the component lifecycle, see
  `adr/error-boundaries.md`. The `request` source reads the HTTP client, see `adr/http-client.md`.
  The `script` source also reads the catch of a state subscriber in `lib/src/state.js`. All three
  report through the same shared module.
- A failed sink goes through the built-in logger, see `adr/built-in-logger.md`.

## ADR, user-facing docs, skills and the home page

The feature is not done until every audience knows about it. Update all of these in the change that
implements it:

- **ADR.** Write `adr/product-analytics.md`: imp collects and the app forwards, the three levels of
  page, zone and outcome, the five record types, `page` as the one key, the route page as the view,
  a visit per document load with no stored id, zones with no instrumentation per component, a sink
  that imp calls at once and never awaits, `batch` with its flush on hide, and consent as a state.
  It also records that the `error` record is the only error seam, with no stack and no log sink. Add
  it to the table in `adr/README.md`.
- **User-facing docs.** Write `docs/analytics.md` for the reader. It explains the report and what
  each number means, the queries behind it, the setup with a flag, `zone` with the tabs example,
  `track` for outcomes, a sink for Google Analytics 4, one for PostHog and one for an endpoint,
  `batch`, the consent hold, and a sink for the errors only. In `docs/cli.md`, link the note about
  source maps to that sink. Add `imp/analytics` to the import tables of `docs/imports.md`. In
  `docs/routing.md`, say that each view is recorded when a sink exists, and link to the analytics
  page. Replace the `setupAnalytics()` line in the `onRemove` example of `docs/routing.md` with a
  cleanup that is not analytics. Add the `[browser:analytics]` lines to the description of the
  session log in `docs/cli.md`.
- **Skills.** Write `skills/analytics.md`, and register it in `cli/src/skill.js` with its summary,
  group and aliases. It lists the five records, `zone`, `track(name, value)`, `onAnalytics`, `batch`
  and `when`. It lists the rules an agent gets wrong: register before `mount`, `zone({ name })` and
  not `zone(name)`, a zone around text only is never seen, turn off the page views of the provider,
  deliver with `sendBeacon`, use `batch` for an own endpoint and not for a provider, kebab case
  names, a value from code only, and no props. Add `imp/analytics` to `skills/imports.md`, and link
  the page from `skills/routing.md` and `skills/start.md`.
- **The home page.** Add a separate slide for analytics and zones to the carousel of the overview
  page, in `site/content/slides.js`. Give it an eyebrow of "Analytics" and a title such as "See
  which parts of the UI work". The points are: every view of a page is recorded with no code, a zone
  measures any part of a screen with no code in the component, the records go to any store, and imp
  stores no id on the device. Show the code of a zone and a sink. Run `deno task site`, and check
  the slide in both colour schemes and at the width of a phone.
