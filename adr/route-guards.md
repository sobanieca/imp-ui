# Route guards are synchronous checks over declared states, with an explicit wait

## Context

A routed app must keep a screen behind a condition. A visitor who is signed out must not open
`/todos`. A person who is not an administrator must not open `/admin`. The condition nearly always
derives from state that the app loads after the mount. The session comes from the network. So at the
moment when imp matches the first route, the answer is not knowable yet. imp considered two shapes,
and rejected both before this one.

**An async guard**, such as `async ({ params }) => (await api.get('/session')).role === 'admin'`,
removes the problem of timing, because it fetches again on each navigation. It brings the problem
back one layer up. Somebody must cache the result, to avoid a request per navigation. A shared cache
with no model of a phase is exactly the problem that this decision solves. It also makes every guard
a place where somebody must handle a failure of the network.

**A pending phase on the state itself** puts the concept where every reader can see it.
`initState(name)` would mark a state as not loaded. It would expose a `pending` sub-state, a
`ready()` promise, and a binding that stays inactive until the first `set`. But it makes the state
layer decide what "not loaded" means, for every value. `undefined` and "legitimately absent" become
the same bit. A `computed` whose `compute` ends in a `find` that matches nothing would be
indistinguishable from a `computed` whose source has not arrived. So a guard that waits on it would
hang, in place of denying the route. It is also a large addition, through a phase flag in
`createState`, in `computed`, in the rebinding of a consumer, and in the attach of `createReadable`.
It would serve one caller.

The state layer already holds everything that a guard needs. What was missing was a way for a guard
to say "not yet". A second question arrived with the application map, see `application-map.md`. The
nav must know the same rule as the route, so that a section never shows a row that its guard
refuses. So the rule has to be data on the node, and the check has to be one function.

## Decision

**A guard is a synchronous function over the values of the states that it declares, and `wait` is
one of its answers. A node of the map carries an `access` value, and the one `access` guard of the
router receives that value as `need`.** Nothing in the state layer changes. `initState(name)` with
no initial value starts at `undefined`, which is a value like any other. Only the guard decides what
that value means.

```js
const access = guard(['myapp.session'], (session, { need }) =>
  session === undefined ? wait : session ? session.roles.includes(need) || '/forbidden' : '/login',
)

router({ map: app, access, screens })
```

- **`guard(states, check)` declares the state names that the check reads.** It takes a name, and not
  a handle, because somebody writes the composition root at module scope, before any component
  exists. The router resolves each name with the ordinary `useState`, at its own position in the
  DOM. So the scoping of a provider, and the rebinding on a move, work as they do everywhere else.
  The values arrive by position, which mirrors `computed([a, b], (a, b) => ...)`, and
  `{ need, params, query, searchParams, path }` arrives last.

- **The vocabulary of a verdict is small.** `true` and `undefined` allow the route. `wait` waits. A
  path string redirects, with `replace: true`. `false` renders `notFound`. Anything else throws, and
  the error names the states of the guard. A verdict with a spelling mistake must not read as truthy
  with no message. `false` exists so that a route can be hidden, in place of refused, and an admin
  section really needs that.

- **`access` is data on the node, and the guard interprets it.** Any value is allowed, so an app
  writes `access: 'admin'`, `access: ['billing', 'owner']` or `access: { role: 'admin' }`, and its
  one check decides what each means. Every `access` on the chain from the root to the matched node
  runs, root first, and the first verdict that is not an allow wins. A node with no `access` is
  open. So `/login` never loops, and there is no default across the map to exclude a page from.
  There is no second guard form, and no guard on an area file. A rule that `access` cannot express
  is a richer `access` value.

- **A guard runs inside the `imp-route` wrapper that already hosts every matched screen**, and it
  runs before the screen factory. That placement is what makes the feature small. The loading
  content, the token of the mount generation that discards a stale navigation, the `error` boundary,
  and the `self` of the wrapper, all already exist there. The wrapper hands its `self` to the guard
  and to the loader of an area, so both resolve a state and register a cleanup through it. A guard
  that can decide immediately returns the DOM of the screen in the same tick, with no loading
  content. A guard that returns `wait` makes the `setup` of the wrapper return a promise, and that
  is the exact path that the download of the chunk of an area already takes. **One `loading` covers
  both waits**, and the app writes no branch for loading.

- **The same check decides visibility in the nav.** The router derives the nav in one `computed`
  over the guard states. A row shows only on an allow verdict. `wait` hides it until the state
  arrives, and a redirect or `false` hides it too. So the rows that share one guard share one
  computed, and the nav and the route can never disagree about who may see what. A check that throws
  during that derivation hides the node and logs the error. It cannot allow the node.

- **The same computed decides whether `shell` shows its chrome.** The router reports the verdict of
  the current node with the nav. While it is `wait`, `shell` shows the loading content without the
  bar, the column or the extras, because the app does not know yet who may see the page. While it is
  a redirect, `shell` keeps its layout, because the next screen decides it. So a signed-out visitor
  goes from the loading content to the sign-in page, and the chrome never paints.

- **imp watches the declared states for the life of the route, and not only while it decides.** The
  first verdict that is not `wait` resolves the entry. After that, the same subscriptions run the
  check again, on every change. So a sign-out on a guarded screen redirects, and the app writes
  nothing. imp suppresses the first notification that `watch` fires on attach. So a subscription
  cannot issue the entry verdict again.

- **`wait` decides the entry only.** imp ignores a guard that returns `wait` again after its screen
  shows. To enter the loading content again would mean to remount the screen, and to discard its
  component state, its scroll position and the text that somebody typed, on every transient reload.
  imp reports a `false` after the mount as an error, for the same reason. Only a redirect can leave
  a mounted screen. The practical consequence is that a sign-out sets `null`, which is a fact that a
  guard can act on. It does not reset the state to `undefined`, which is an absence that a guard can
  only wait on.

- **An `access` on the node an area binds covers the whole section, and it runs before the chunk
  downloads.** The `imp-route` of the binding wraps the area. So the `root` of the area does not
  render until the guard allows it. The guard keeps watching while the visitor is inside the
  section. So a lost session redirects out of the section. A node _inside_ the area can carry its
  own `access`, for a narrower rule, and the router inside the area checks it. A split of the code
  is not access control, in either case. The server still authorizes every request.

- **imp defers a redirect to a microtask, and counts it.** The delay keeps the `navigate` out of the
  state notification that renders the region now. It costs nothing that a person can see, because a
  microtask runs before a paint. Eleven redirects in a row, with no screen rendered between them,
  throw an error that names the last hop. That is the case where two guarded routes redirect at each
  other. imp resets the counter whenever any screen renders. So an ordinary redirect never
  accumulates toward the limit. imp uses a counter of its own, and not the generic
  `MAX_UPDATE_DEPTH` cycle error. That error would point at the state layer instead.

- **Everything fails closed.** A declared state that nothing provides at the position of the router
  throws the existing message of `useState`, and the router does not mount. A check that throws, and
  a check that returns an unknown verdict, both render `error`. No path of failure allows a screen.

- **A guard that stays on `wait` gives a warning after five seconds.** The warning names the path,
  and the declared states. It is a warning, and not an error, because a slow network is a legitimate
  long wait.

## Consequences

- A guard stays a pure function, from a value and a need to a decision. So somebody can unit-test it
  with no DOM, no router and no network. It also cannot introduce a request per navigation.
- The state layer does not change. There is no phase flag, no `pending` sub-state, no `ready()`, no
  inactive binding, and no rule of propagation through `computed`. "Not loaded" is a convention that
  an app expresses in the one place that must interpret it, and two states can spell it differently.
- The cost is one explicit line per guard that a person can enter before its data arrives, which is
  `if (session === undefined) return wait`. To forget that line is not silent. The check then runs
  against `undefined`, and it either denies the route or throws. It does not allow the route.
- A guard across a whole map would have had a trap. It also guards the page that it redirects to.
  That cannot occur here, because a node with no `access` is open, and the login page has none.
- The question "is this route protected?" is answered by the line of the node in the map. The
  question "why did this redirect?" is answered by one function, with the `need` it received.
- A guard checks again for the life of the route, and once more per node in the nav derivation. So a
  state that changes often, and that a guard reads, runs that check on every change. A guard is
  expected to be a cheap comparison over values that are already loaded. Anything expensive belongs
  in a `computed` that the guard declares.
