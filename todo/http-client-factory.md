# HTTP client factory

Ship a built-in HTTP client factory so an app can configure its network layer once instead of
hand-rolling `fetch` wrappers. `httpClientFactory` produces a configured client with cross-cutting
concerns baked in — the app calls the client, imp handles the plumbing.

## What it configures

- **Retries** — retry policy (attempts, backoff, which statuses/errors are retryable) declared once
  at construction.
- **Timeouts** — per-request and/or per-client timeouts that abort in-flight requests.
- Room to grow: base URL, default headers, request/response interceptors — keep the surface small to
  start and extend as needs appear.

## Standard-library integration (later)

Once the standard component library exists (`todo/stdlib-components.md`), let a client connect to
stdlib feedback components so request state renders without wiring:

- **Failure banner** — a request that fails surfaces a standard banner/`alert` automatically.
- **Pending loader** — a `spinner`/`progressBar` shows while a request is in flight and clears when
  it settles.

This means the client exposes observable request state (pending/failed/settled) the components can
bind to reactively (`todo/reactivity-signals.md`), rather than each call site plumbing loading and
error state by hand.

## Dependencies

- Standalone for the core factory (retries + timeouts) — can land on its own.
- The stdlib integration depends on `todo/stdlib-components.md` and the signal graph
  (`todo/reactivity-signals.md`).

## ADR impact

Record an ADR once the approach is settled: that imp ships a configured HTTP client factory as part
of the all-in-one toolkit, its retry/timeout model, and how request state binds to stdlib feedback
components. Document the client in `docs/`.
