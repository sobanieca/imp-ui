# Response cache for the HTTP client

The client ships without one (`adr/http-client.md`): every call is sent, and identical concurrent
`GET`s are two requests. Caching was designed and then cut before v1 rather than shipped
half-decided — a wrong cache serves stale data silently, while its absence costs a request the
author can see in the network panel.

What a later version would add, none of which changes an existing call site:

- **`cache` on the client and per call** — `ttl`, `staleWhileRevalidate`, `vary` (request headers
  that join the key), and per-call modes `no-store` / `reload` / `force-cache`. `GET` and `HEAD`
  only, keyed by method + resolved URL + the varied header values.
- **Request coalescing** — concurrent identical `GET`s share one call. A call carrying its own
  interceptors stays out of the sharing, so its hooks always run. Worth deciding separately from the
  cache: it needs no store and has no staleness, so it could land first.
- **Invalidation** — `invalidates: '/users*'` on a mutating verb (optionally method-prefixed,
  `'GET /users*'`) plus `client.invalidate(patterns)` and `client.invalidate()` on demand. Patterns
  match the path as written at the call site, so they read like the calls.
- **A store seam** — `cache.store` taking `get`, `set`, `delete`, `keys`, `clear` (each possibly
  async), defaulting to memory, cleared when the owning component unmounts. `keys` is what makes
  pattern invalidation possible. A `localStorage`/IndexedDB store could then ship on top without an
  API change.

Open questions to settle before building it:

- Does background revalidation stay invisible to `pending` / `lastError`? (It should — nobody is
  waiting on it — but that makes "is anything happening?" unanswerable from request state alone.)
- Are cached bodies handed out by reference (fast, and read-only by convention like state values) or
  copied per caller (safe, and a structured clone per read)?
- Does a cache belong to the client at all, or to a data layer above it that owns keys, freshness
  and invalidation and uses the client to fetch? The second reading is what most apps grow, and it
  would keep the client literal.
