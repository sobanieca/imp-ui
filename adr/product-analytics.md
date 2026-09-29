# Product analytics - imp collects pages, zones and outcomes, and the app forwards them

## Context

A team that ships an app must know if the UI works. The questions are few. Does a page break, is it
slow, and do people reach it? Is a part of the screen seen and used? Does the person get the result?
A general analytics SDK answers them only after the app wires a page view per route, an event per
control, and an error handler. That code is the same in every app, and it is easy to get wrong. A
page view sent from a component that renders twice counts twice. An event sent from a hidden tab is
lost. An error handler that a sink failure calls again makes a loop.

imp already owns the moments that those numbers need. The router mounts a route page per screen. The
component lifecycle catches a render error. The HTTP client knows when a request fails. The state
layer catches a subscriber that throws. `imp build` writes no source map, see
`production-bundling.md`, so a stack from production has no reader. A failure must be identified by
its message and its context instead.

The design starts from the report that a developer reads. Every number in it answers one question
and points at one action. imp collects only the data that those numbers need.

## Decision

**imp collects records, and the app forwards them to its store through a sink.** The home is
`imp/analytics`, see `library-import-namespaces.md`. It exports `onAnalytics`, `batch`, `zone` and
`track`. imp bundles no provider, loads no script and makes no network call. imp ships no report
command. The docs describe each number of the report and the query behind it.

- **Three levels, one tool each.** A page needs no code, because the router records each view. A
  zone is `zone({ name }, ...children)` around any part of a screen. An outcome is
  `track(name, value?)` at the place where the outcome happens.
- **Five record types, with fixed fields.** `view`, `time`, `zone`, `action` and `error`. Every
  record carries `type`, `visit`, `view` and `page`. A record is plain data that `JSON.stringify`
  accepts, so a sink maps each type to the event of its store once.
- **`page` is the one key.** It is the route pattern of the matched node of the application map,
  such as `/invoices/:id`, see `application-map.md`. It holds no param value, and it has the shape
  of a path, so a store that keys a page by its URL uses it as it is. A path off the map has
  `page: null`, and its `view` record carries the `path`, with no query.
- **imp scrubs each recorded URL.** The `path` of a `view` and the text of an `error` message lose
  their emails, which become `:email`, and their tokens, which become `:token`. A token is a JSON
  Web Token, or a word with 16 or more letters and digits in a row that holds a digit and a letter.
  A number, a UUID and a slug stay, because the report treats an id as no personal data. The rule is
  a pattern, so the route pattern of the map stays the key that carries no value at all.
- **The route page is the view.** The internal route page of the router, see
  `client-side-router.md`, reports its mount, its readiness and its unmount. `readyMs` is the time
  from the mount to the moment the screen replaces its loading content. It includes a guard wait,
  the area chunk, and the data that the screen awaits in its `setup`. For the entry view, it starts
  at the start of the document load. A change of the query only is no view. A guard redirect and a
  `redirect()` binding are no view. For an area, the view is the route page of the matched node.
- **A view that is not ready goes out when the page hides.** A browser can discard a hidden page
  with no further event. So when the document becomes hidden, or the page unloads, before the screen
  is ready, imp sends the `view` with `readyMs: null` and `waitedMs`, the time until the person
  left. A view goes out once, so a screen that is ready after the person comes back keeps
  `readyMs: null`. The loads that people give up are the slowest loads. Without them, the cold start
  percentile and the bounce rate look better than they are.
- **A visit is one document load, with no stored id.** `visit` and `view` are random ids in memory.
  imp writes no cookie, and nothing to `localStorage` or `sessionStorage`. A reload is a new visit.
- **Engaged time and zones are deltas.** imp sends a `time` record, and one `zone` record per zone
  name, when the document becomes hidden and when the view ends. That is the only shape that
  survives a mobile browser that discards a hidden tab with no further event. Engaged time counts
  while the document is visible and has focus.
- **A zone needs no instrumentation per component.** `imp-zone` is an element with
  `display: contents` and no shadow root, so it changes no layout and keeps its children in their
  tree scope. It records `seen`, through an `IntersectionObserver` on the boxes of its content, and
  the active time, through composed `pointerdown`, `keydown`, `input` and `wheel` events on itself.
  Each interaction opens a window of 5 seconds, and the active time is the union of the windows. A
  `keydown` of `Tab` or of a modifier alone is no interaction. No standard component records
  anything of its own.
- **The `error` record is the only error seam of imp.** It has three sources: `script` for an
  uncaught error, an unhandled rejection and a state subscriber that throws, `render` for an error
  in a component, and `request` for an `imp/http` request that fails on the network, times out, or
  answers 5xx. The message is one line of 200 characters or fewer, and it has no stack. A message
  carries the path of a URL only, never its origin or its query, and an `imp/http` error always gets
  the request message. One failed request gives one record: an error that gave a `request` record
  gives no second `script` or `render` record when nothing catches it. imp has no `onError` and no
  log sink. An app that wants only its errors forwards the records where `type` is `'error'`. A team
  that needs a stream of logs uses the SDK of its provider directly.
- **Errors are limited per view.** The first error of a kind, the same `source` and `message`, goes
  out at once with `count: 1`. The repeats of that kind go out as one record with their `count`,
  when the document hides and when the view ends. A view sends 10 kinds or fewer. A loop that throws
  on each frame then gives a few records, not thousands. The `ResizeObserver loop` messages and a
  cross-origin `Script error.` with no file give no record. They are not errors of the app, and a
  developer cannot act on them.
- **imp calls a sink at once, and never awaits it.** The call happens in the same task as the event,
  so a sink runs before a hidden page can freeze. imp catches a sink that throws or rejects, logs it
  through the built-in logger, see `built-in-logger.md`, and goes on. A failed sink never becomes an
  `error` record, because that record would go to the same sink and fail again.
- **`batch` flushes on hide.** `batch(send, { size, ms })` returns a sink that holds the records. It
  sends at `size`, after `ms`, when the page hides or unloads, when its `when` state stops being
  `true`, and when the sink is unregistered. imp flushes a batch after it dispatches the records of
  that hide, in the same task. A batch that an app writes by hand gets that order wrong. imp does
  not retry, because a retry needs storage.
- **Consent is a state with three values.** `onAnalytics(sink, { when })` sends the records of that
  sink while the state is `true`, and drops them while it is `false`. A refusal must not become a
  delayed send. Any other value, such as `null`, means that the person has not answered. imp holds
  the records then: the first held view and the newest 199 records, so an early `track()` call does
  not push the entry view out. A refusal drops the held records. imp does not decide what consent
  means. The hold is per sink.
- **A late sink gets the current view.** A sink that registers after the current view started gets
  the `view` record of that view at once, and so does a sink whose `when` state leaves `false`.
  Without it, the next records of the view reach a store that has no view to join them to. In
  development, the session log registers its sink first, so each sink of the app is a late sink.
- **An app with no sink pays nothing.** The router, the route page, the component lifecycle, the
  state layer, the HTTP client and `imp-zone` report to a small shared module. That module drops a
  report while no sink is registered. None of them imports the collection. A zone adds its listeners
  and its observer only while collection runs.
- **`imp start` writes every record to the session log**, as a `[BROWSER:analytics]` line, with or
  without a sink of the app.

## Consequences

- A developer reads "is anything broken?" and "do people use it?" from one set of records. The
  working half, with broken views, slow screens and missing pages, has fixed thresholds. The usage
  half has none, because only a person who knows the page can judge a time.
- The seam works with any store. A sink is a plain function, so it can call `gtag`,
  `posthog.capture`, or `sendBeacon`. The app must turn off the automatic page views of its
  provider.
- A stack trace, a heatmap, a user id, a session across tabs and a record per component are out of
  scope. Each one failed the test of one number and one action.
- A record from production carries the page, the view, the source and a message. That is enough to
  find a failure without a source map.
- The router gets a small cost per navigation: a random id and a check of the rendered screen.
