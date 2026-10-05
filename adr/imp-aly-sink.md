# The imp-aly sink - one module, one server per visit, the next server on failure

## Context

imp counts records and gives them to a sink of the app, see `product-analytics.md`. imp-aly is the
analytics server of imp. The owner runs it on a VPS. It takes the records of `imp/analytics` as they
are, checks them against `app-analytics.json` of the build, and answers the queries of the report.
The owner registers an app with the URL of the folder of the build output, or with a local build
folder, and imp-aly reads the file from there.

A sink for imp-aly is the same code in every app that uses it. It must post the batches to the right
URL, keep each visit on one server, add the segments without the loss of the flush on hide, and
report the answers of the server. A hand-written sink gets these details wrong.

A large app runs several imp-aly servers. The servers do not know each other. A query adds up the
counts of all servers. A count of distinct visits adds up only when no visit has records on two
servers.

An app that does not use imp-aly must not pay for its sink.

## Decision

**imp ships `alySink` in its own module, `imp/analytics/aly`.
`alySink({ app, servers, segments,
size, ms })` returns a `batch` sink that posts each batch to
`<server>/collect/<app>`.**

- **A separate specifier.** imp-aly is one store among many. An app that imports `imp/analytics` for
  GA4 never reaches the module of the sink. The module runs nothing at module scope, see
  `tree-shakeable-library.md`, so the bundler also drops it from an app that imports it and does not
  call it.
- **One server per visit, from the visit id.** The sink takes an FNV-1a hash of the visit id modulo
  the number of servers. The visit id is one random id per document load, so the choice is random
  per visit, and it needs no state. Every `alySink` with the same list in the same document picks
  the same server.
- **The next server on failure.** When the request fails on the network, or the server answers with
  a 5xx, the sink sends the same batch to the next server of the list. That server keeps the visit
  for the rest of the document load. Each server gets the batch at most once. When every server
  fails, the sink logs a warning and drops the batch. The batch stays in memory only, so this is no
  retry with storage.
- **The first record goes out at once.** A batch that goes out only when the page unloads cannot
  move to the next server, because the page is gone before the first request fails. So the sink
  sends the first record of a visit, the `page` record, as soon as it arrives. A server that is down
  shows while the page is open, and the batches after it go to the next server.
- **A 4xx does not move the visit.** A 4xx is a fault of the configuration, such as an app that is
  not registered, and the next server has the same configuration. The sink logs an error with a
  hint, and drops the batch. A `429` is the rate limit of the server, so the sink logs a warning. A
  `202` with rejected records logs a warning that names `imp-aly app show`.
- **`fetch` with `keepalive`, a plain text body, no credentials, and a referrer of the origin
  only.** A string body makes a simple request, so the browser sends no preflight. `keepalive` lets
  the flush on hide reach the server. The answer is readable, unlike the answer of
  `navigator.sendBeacon`, so the sink can see a 5xx. The referrer policy `strict-origin` keeps the
  path of the page out of the `Referer` header, and keeps the `Origin` header that the
  `--allow-origin` check of imp-aly reads.
- **Segments are the option of `batch`.** `alySink` passes `segments` to `batch` as it is, see
  `product-analytics.md`.
- **A server URL can have a path or be relative.** A proxy can serve imp-aly under `/aly` of the
  origin of the app. The sink rejects a URL with a query or a fragment, and a list with the same
  server twice.

## Consequences

- An app sends its records to imp-aly with one call. The sink of the docs and the sink of the app
  are the same code.
- A visit that moves to the next server has records on two servers. The report counts it twice. A
  visit whose server fails before the first record, and whose page unloads before the next server
  answers, loses its records.
- A change of the list of servers moves the visits only from the next document load. A visit never
  has records on two servers because of a deploy.
- Each server of the list needs the app and every segment name. A server that does not know a
  segment rejects the record.
- The sink adds about 2.7 kB, before compression, to an app that uses it, and nothing to other apps.
