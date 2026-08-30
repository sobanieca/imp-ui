# Route guards are synchronous checks over declared states, with an explicit wait

## Context

A routed app has to keep screens behind a condition: a signed-out visitor may not open `/todos`, a
non-admin may not open `/admin`. The condition is almost always derived from state the app loads
after mount - the session comes from the network, so at the moment the first route is matched the
answer is not yet knowable. Two shapes were considered and rejected before this one.

**An async guard** (`async ({ params }) => (await api.get('/session')).role === 'admin'`) removes
the timing problem by re-fetching per navigation. It reintroduces it one layer up: the result has to
be cached to avoid a request per navigation, and a shared cache with no phase model is exactly the
problem being solved. It also makes every guard a place where a network failure has to be handled.

**A pending phase on state itself** - `initState(name)` marking a state "not loaded" and exposing a
`pending` sub-state, a `ready()` promise, and bindings that stay dormant until the first `set` -
puts the concept where every reader can see it, but it makes the state layer decide what "not
loaded" means for every value. `undefined` and "legitimately absent" become the same bit: a
`computed` whose `compute` ends in a `find` that misses would be indistinguishable from one whose
source has not arrived, so a guard waiting on it would hang instead of denying. It is also a large
addition - a phase flag through `createState`, `computed`, consumer rebinding, and
`createReadable`'s attach - to serve one caller.

The state layer already holds everything a guard needs; what was missing was a way for a guard to
say "not yet".

## Decision

**A guard is a synchronous function over the values of the states it declares, and `wait` is one of
its answers.** Nothing in the state layer changes: `initState(name)` with no initial value simply
starts at `undefined`, which is a value like any other, and only the guard decides what it means.

```js
const signedIn = guard(
  ['myapp.session'],
  (session) => session === undefined ? wait : Boolean(session) || '/login',
)
```

- **`guard(states, check)` declares the state names the check reads.** The names, not handles,
  because a routes table is written at module scope before any component exists; the router resolves
  each one with the ordinary `useState` at its own position in the DOM, so provider scoping and
  rebinding on moves are the same as everywhere else. Values arrive positionally, mirroring
  `computed([a, b], (a, b) => ...)`, with `{ params, query, path }` last.

- **The verdict vocabulary is `true`/`undefined` (allow), `wait`, a path string (redirect with
  `replace: true`), and `false` (render `notFound`).** Anything else throws, naming the guard's
  states - a typo'd verdict must not silently read as truthy. `false` exists so a route can be
  hidden rather than refused, which is a real requirement for an admin section.

- **Guards run inside the `imp-route` wrapper that already hosts every matched screen**, before the
  screen factory is called. That placement is what makes the feature small: the loading placeholder,
  the mount-generation token that discards a stale navigation, the `fallback` boundary, and a mount
  scope with a host all already exist there. A guard that can decide immediately returns the
  screen's DOM in the same tick, with no placeholder; a guard that returns `wait` makes the
  wrapper's `build` return a promise, which is the exact path an area's chunk download already
  takes. **One `placeholder` covers both waits**, and the app writes no loading branch of its own.

- **The declared states are watched for the life of the route, not just while deciding.** The first
  non-`wait` verdict resolves entry; afterwards the same subscriptions re-run the check on every
  change, so a sign-out on a guarded screen redirects with nothing written in the app. The initial
  notification `watch` fires on attach is suppressed, so subscribing cannot re-issue the entry
  verdict.

- **`wait` decides entry only.** A guard that returns `wait` again after its screen is showing is
  ignored, because re-entering the placeholder would mean remounting the screen and discarding its
  component state, scroll and typing on every transient reload. `false` after mount is reported as
  an error for the same reason - only a redirect can leave a mounted screen. The practical
  consequence is that a sign-out sets `null` (a fact a guard can act on) rather than resetting to
  `undefined` (an absence it can only wait on).

- **A route has exactly one guard, and it attaches to the route.** `route({ guard, screen })` is a
  third accepted value in a routes table, next to a factory and an `area()`, and it is the only
  place a guard goes: `router({ guard })` and `area({ guard })` both throw, pointing at it. There is
  no table-wide default, no inheritance into nested areas, and no array of guards - a rejected
  design in which guards accumulated through the same per-instance options object that carries
  `placeholder`, `fallback` and `notFound`. **Composition belongs to the app, and needs no API**: a
  check is a plain function, so a guard meaning "signed in and an admin" is written by calling the
  shared check and passing its verdict through. The cost is repeating
  `route({ guard: signedIn, ... })` on every protected entry of a mostly-protected app; the gain is
  that a route's own line names every condition that can redirect it, so "why did this redirect?" is
  answered by one function rather than by reconstructing what each enclosing router and area
  contributed. `notFound` is never guarded.

- **A guard on an area's entry covers the whole section and runs before the chunk downloads.**
  Because the entry's `imp-route` wraps the area, its `root` does not render until the guard allows,
  and the guard keeps watching while the visitor is inside the section, so a lost session redirects
  out of it. A route _inside_ the area may declare its own guard for a narrower rule; that is still
  one guard per route, not a stack, because it guards a different entry in a different table. Code
  splitting is not access control either way; the server still authorizes every request.

- **A redirect is deferred to a microtask and counted.** Deferring keeps the `navigate` out of the
  state notification that is currently rendering the region, and costs nothing visible because a
  microtask runs before paint. Eleven consecutive redirects with no screen rendered in between
  throws an error naming the last hop - two guarded routes redirecting at each other - and the
  counter resets whenever any screen renders, so ordinary redirects never accumulate toward it. It
  is a dedicated counter rather than the generic `MAX_UPDATE_DEPTH` cycle error, which would have
  pointed at the state layer instead.

- **Everything fails closed.** A declared state that is not provided at the router's position throws
  `useState`'s existing message; a throwing check, and a check returning an unknown verdict, both
  render `fallback`. No failure path allows a screen.

- **A guard stuck on `wait` warns after five seconds**, naming the path and the declared states. It
  is a warning rather than an error because a slow network is a legitimate long wait.

## Consequences

- Guards stay pure functions from values to a decision, so they are unit-testable without a DOM, a
  router, or a network, and they cannot introduce a request per navigation.
- The state layer is untouched: no phase flag, no `pending` sub-state, no `ready()`, no dormant
  bindings, no propagation rule through `computed`. "Not loaded" is a convention an app expresses in
  the one place that needs to interpret it, and two states can spell it differently.
- The cost is one explicit line per guard that can be entered before its data lands
  (`if (session === undefined) return wait`). Forgetting it is not silent: the check runs against
  `undefined` and either denies or throws, rather than allowing.
- The trap a table-wide guard would have had - it also guards the page it redirects to, so a
  `signedIn` sending visitors to `/login` would guard `/login` and loop - cannot occur, because a
  guard only ever covers the entry that names it.
- An app where nearly every route is protected repeats the guard on nearly every entry. Accepted:
  the repetition is local and greppable, where a default plus an exclusion list, or inheritance,
  would put the answer to "is this route protected?" somewhere other than the route.
- Waiting is indistinguishable from an area downloading, by design - one `placeholder`, one
  mechanism. An app that wants to tell a visitor _why_ it is waiting overrides `placeholder` per
  area rather than per reason.
- Because guards re-check for the life of the route, a state that changes often and is read by a
  guard runs that check on every change. Guards are expected to be cheap comparisons over already
  loaded values; anything expensive belongs in a `computed` the guard declares instead.
