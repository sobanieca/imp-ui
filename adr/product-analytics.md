# Product analytics - imp counts pages, zones, outcomes and errors, and the app forwards the counts

## Context

A team that ships an app must know if the UI is used. The questions are few. Do people reach a page?
Is a part of the screen seen and used? Does the person get the result? Does a page break? A general
analytics SDK answers them only after the app wires a page view per route, an event per control, and
an error handler. That code is the same in every app, and it is easy to get wrong. A page view sent
from a component that renders twice counts twice.

imp already owns the moments that those numbers need. The router mounts a route page per screen. The
component lifecycle catches a render error. The HTTP client knows when a request fails. The state
layer catches a subscriber that throws.

A number that a store must derive from several records is a number that a developer cannot explain
to the team. A time is such a number: a store must sum or rank it, and a time in a zone means a
different thing for a mouse, touch and the keyboard. A share is honest only when its numerator can
never be larger than its denominator. A message of an error, and the path of a page off the map, can
carry a query, an email address or a token. Scrubbing them is code that must be right, and a reader
cannot see that it is.

## Decision

**imp sends counted records, and the app forwards them to its store through a sink.** The home is
`imp/analytics`, see `library-import-namespaces.md`. It exports `onAnalytics`, `batch`, `zone` and
`track`. imp bundles no third-party provider and loads no script. The one sink that imp ships is
`alySink` for its own server, imp-aly, in the separate module `imp/analytics/aly`, see
`imp-aly-sink.md`. No other part of imp makes a network call for analytics. imp ships no report
command. The docs describe each number of the report and the query behind it.

- **Every number of the report is a count of records.** A store counts rows, or distinct visit ids,
  and never sums, joins or takes a percentile. One record stands for one event, for the first event
  of its kind in a page view, or for up to 5 seconds of errors.
- **Five record types, with fixed fields.** `page` with nothing else, `seen` with `zone`, `used`
  with `zone` or `null`, `outcome` with `name`, and `error` with nothing else. Every record carries
  `type`, `visit`, `at` and `page`. A record is plain data that `JSON.stringify` accepts.
- **No record carries personal data, so imp scrubs nothing.** `page` is the route pattern of the
  matched node of the application map, such as `/invoices/:id`, see `application-map.md`. A zone
  name and an outcome name are literals from the code. An error has no message. `visit` is a random
  id in memory, and `at` is a clock time. There is nothing in a record that a pattern must remove.
- **Every record has a page, and `imp build` publishes the pages, zones and outcomes.** The
  collection drops a record while no screen of the map shows: before the router mounts, and on a
  path off the map. So a path never reaches a record, and a store needs no row for an unknown page.
  When `imp.json` names a `map`, `imp build` writes `app-analytics.json` at the root of the output,
  one JSON object with three lists. `pages` holds the route patterns, with no label and no
  description. `zones` and `outcomes` hold, sorted, every zone name and every outcome name that the
  app can send. An app with no zone gets an empty `zones` list. One file means one fetch for a
  store, and one name to upload, to keep off the precache, and to guard against a `public/`
  collision. The PWA worker does not precache it.
- **The name lists come from the code of the app only.** imp reads the literal names of every module
  that enters the bundle, the inline module scripts of the page included. It skips each module in
  `dependencies/`. So an app build reads no third-party code, and a name in minified code never
  stops the build. A JS-entry build writes no name lists, because only an app has a site that a
  store reads.
- **A store drops a record that is not on the lists.** It reads `app-analytics.json` from the site.
  It drops a record whose `page` is not in `pages`, a `seen` or `used` record whose `zone` is not in
  `zones`, and an `outcome` record whose `name` is not in `outcomes`. A `used` record with
  `zone: null` is always valid. A forged record then needs a real page and a real zone or outcome
  name. A record for a name that the app cannot send is spam by definition.
- **The route page is the page view.** The internal route page of the router, see
  `client-side-router.md`, reports its mount and its readiness. The `page` record goes out when the
  screen replaces its loading content. A screen that the person leaves before it is ready sends no
  record. A change of the query only, a guard redirect and a `redirect()` binding are no page view.
- **A visit is one document load, with no stored id.** imp writes no cookie, and nothing to
  `localStorage` or `sessionStorage`. A reload is a new visit. There is no view id. A visit and a
  page group every record that the report needs.
- **A zone sends `seen` once.** `imp-zone` is an element with `display: contents` and no shadow
  root, so it changes no layout and keeps its children in their tree scope. An
  `IntersectionObserver` on the boxes of its content sends one `seen` record the first time some
  part is in the viewport while the document is visible. Zones of one name on one page send one
  record per page view, so a list of rows is one zone.
- **A zone sends `used` once per page view.** One passive capture listener on the document reads
  `click`, `input` and `keydown`, and ignores an event whose `isTrusted` is false. A key that does
  not use the zone is no use: Tab, Shift, Control, Alt, Meta, CapsLock, Escape and F1 to F24. A Tab
  through a zone only moves the focus. The composed path names the zones that hold the event, and
  each zone gets one `used` record per page view. The first such event anywhere on the page also
  sends one `used` record with `zone: null`. `click` covers a mouse, touch and a pen, and the
  browser fires none for a scroll. So a finger that lands on a zone to scroll is no use, and a
  pointer press or a wheel turn is not read.
- **A used zone is a seen zone.** When a zone is used before its `seen` record went out, `seen` goes
  out first. With one record of each per page view, `used` is never more than `seen`, and "used when
  seen" is a share that a store gets from two counts.
- **An error is one record per 5 seconds, with no message.** The sources are an uncaught error, an
  unhandled rejection, a state subscriber that throws, a render error, and an `imp/http` request
  that fails on the network, times out, or answers 5xx. All feed one counter per page. A loop that
  throws on each frame gives 12 records a minute. The `ResizeObserver loop` messages and a
  cross-origin `Script error.` with no file give no record. imp has no `onError` and no log sink.
  The browser console and the server logs hold the message.
- **A name carries a namespace, and is used once.** `myapp.due-date` follows the rule of a state
  name, see `event-propagated-state.md`. It also has only ASCII letters, digits, `-` and `_` between
  the dots, and at most 128 characters, so a name is safe to show in a terminal, a page or a log,
  and an analytics server with an allowlist accepts it. imp logs a name that breaks a rule and
  records nothing for it. `imp lint` checks every name with `imp/analytics-name-namespace`, and
  reports a literal that two calls share with `imp/unique-analytics-name`, across the project, so
  that the report can tell two zones apart.
- **A name is a literal that the build can read.** The name is a string literal, or a template
  literal with no expression. `zone()` gets an object literal, with no spread, and a literal `name`.
  Otherwise `imp build` fails and lists every such call with its file, line and column, and
  `imp/analytics-name-namespace` reports it with the same message. A name that the build cannot read
  is a name that the store would drop. A literal name that breaks the namespace rule stays out of
  the lists, because imp records nothing for it.
- **imp calls a sink at once, and never awaits it.** imp catches a sink that throws or rejects, logs
  it through the built-in logger, see `built-in-logger.md`, and goes on. A failed sink never becomes
  an `error` record, because that record would go to the same sink and fail again.
- **`batch` flushes on hide.** `batch(send, { size, ms, segments })` returns a sink that holds the
  records. It sends at `size`, after `ms`, when the page hides or unloads, and when the sink is
  unregistered. imp does not retry, because a retry needs storage.
- **`batch` adds the segments as each record arrives.** `segments(record)` returns the segments of
  the app, such as `{ plan: 'pro' }`. `batch` adds them under the fields of imp, so a segment cannot
  replace `type`, `visit`, `at` or `page`. In `send`, the segments come up to `ms` too late: a
  record from before a sign-in gets the plan of after it. A wrapper sink around `batch` hides the
  flush on hide from imp, and the last records of the visit are lost.
- **A late sink gets the current page.** A sink that registers after the current screen is ready
  gets its `page` record at once. There is no consent gate in imp. An app that waits for consent
  registers the sink when the person has answered, and the late `page` record keeps the first
  screen.
- **An app with no sink pays nothing.** The router, the route page, the component lifecycle, the
  state layer, the HTTP client and `imp-zone` report to a small shared module. That module drops a
  report while no sink is registered. None of them imports the collection.
- **The dev server registers no sink.** A record goes only where a sink of the app sends it.

## Consequences

- A developer explains every number in one sentence: it is the number of records of one type.
- The seam works with any store. A sink is a plain function, so it can call `gtag`,
  `posthog.capture`, or `sendBeacon`, with one event per record type. The app must turn off the
  automatic page views of its provider.
- A time, such as the time until a screen is ready, the time on a page or the time in a zone, is out
  of scope. So are the flow between pages, a bounce rate, the message of an error, a value on an
  outcome, a heatmap, a user id and a record per component. Each one either needs a derived number
  or carries personal data.
- A page that fails is found in the browser, not in the record. The record says where and how often.
- An app without a map, or a screen off the map, sends nothing. The report has no row for a path
  that is not a feature of the app.
- A zone or outcome name built at runtime, such as `` `myapp.${kind}` ``, is not possible. An app
  writes one literal per case.
- The lists do not hold the names of a vendored imp component. A store drops a zone or outcome
  record that only such a component sends.
- The router gets a small cost per navigation: a random id and a check of the rendered screen.
