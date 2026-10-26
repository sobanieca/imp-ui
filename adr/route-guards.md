# Route guards bind to nodes, and decide synchronously over declared states, with an explicit wait

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
refuses. So the rule has to be bound to a node, and the check has to be one function per node.

A third question is where the rule of a node comes from. One shared check that reads a value per
node puts every rule of the app in one function, as a branch on that value. A guard per node, with
its own states and its own check, keeps each rule beside the node that it protects. A new page must
also be protected without a new line, because a forgotten line opens a private page.

## Decision

**A guard is a plain object `{ states, check }`. `router({ guards })` binds a guard to a node, and
`[app]` binds the guard of the root. The nearest guard on the chain of a node decides that node.
The check is a synchronous function over the values of its states, and `wait` is one of its
answers.** Nothing in the state layer changes. `initState(name)` with no initial value starts at
`undefined`, which is a value like any other. Only the check decides what that value means.

```js
const signedIn = {
  states: ['myapp.session'],
  check: (session, { node, path }) => {
    if (node === app.login) return true
    if (session === undefined) return wait
    return Boolean(session) || `/login?next=${encodeURIComponent(path)}`
  },
}

const role = (name) => ({
  states: ['myapp.session'],
  check: (session, context) => {
    const entry = signedIn.check(session, context)
    if (entry !== true) return entry
    return session.roles.includes(name) || '/forbidden'
  },
})

router({ map: app, guards: { [app]: signedIn, [app.admin]: role('admin') }, screens })
```

- **`states` declares the state names that the check reads.** It takes a name, and not a handle,
  because somebody writes the composition root at module scope, before any component exists. The
  router resolves every name of every guard once, with the ordinary `useState`, at its own position
  in the DOM. The route checkpoints, the routers of the areas and the nav read those handles. So
  the scoping of a provider works as it does everywhere else, and an area root cannot shadow a guard
  state. The values arrive by position, which mirrors `computed([a, b], (a, b) => ...)`, and
  `{ node, params, query, searchParams, path }` arrives last.

- **The vocabulary of a verdict is small.** `true` and `undefined` allow the route. `wait` waits. A
  path string redirects, with `replace: true`. `false` renders `notFound`. Anything else throws, and
  the error names the key of the guard. A verdict with a spelling mistake must not read as truthy
  with no message. `false` exists so that a route can be hidden, in place of refused, and an admin
  section really needs that.

- **The nearest guard wins, and guards do not stack.** A node uses its own guard, else the guard of
  the nearest ancestor. The root is a node like any other, so its guard covers every node with no
  closer guard. A node with no guard on its chain is open. So exactly one function answers "why did
  this redirect?" for a node. The cost is that a guard under the root guard answers the full
  question for its nodes, also "is the session
  loaded" and "is anybody signed in". It calls the check of the outer guard first, and a factory
  such as `role(name)` gives a guard its value.

- **An exception is code in the check, through `context.node`.** `node` is the handle of the node
  that the check decides. A handle is one frozen object per node, so `node === app.login` is exact,
  and it does not depend on the params of the URL. There is no value that opens a node in `guards`,
  so there is one way to make an exception. The exception must come before the `wait` line, or the
  login page waits for the session. A forgotten exception redirects in a cycle, and the cycle error
  names the last hop.

- **The guard of the root covers the whole map, so a new node is protected when it is added.** A guard across
  the whole map also guards the page that it redirects to. The exception in the check is the answer
  to that, and it is the one line that a person must not forget.

- **A guard runs inside the `imp-route` wrapper that already hosts every matched screen**, and it
  runs before the screen factory. That placement is what makes the feature small. The loading
  content, the token of the mount generation that discards a stale navigation, the `error` boundary,
  and the `self` of the wrapper, all already exist there. A guard that can decide immediately
  returns the DOM of the screen in the same tick, with no loading content. A guard that returns
  `wait` makes the `setup` of the wrapper return a promise, and that is the exact path that the
  download of the chunk of an area already takes. **One `loading` covers both waits**, and the app
  writes no branch for loading.

- **Each router checks its target node.** For a screen, the target is the matched node. For an area,
  the target is the area node, so its check runs before the chunk downloads, with `node` set to the
  area node. The wrapper of an area stays mounted while the person moves inside the area, so the
  router inside the area checks its own target, with `node` set to that node. It runs the nearest
  guard of the target, also when that is the same guard object as the one of the area node. So a
  node inside an area is decided by the check of each area node on its chain, and then by its own
  check. Every check must allow. A check cannot open a page inside an area that it refuses at the
  area node. Such a page moves out of the area in the map.

- **An area file binds no guard.** The check of the area node runs before the area file exists, so
  a guard in the file would come too late. `area({ guards })` throws, and the message names
  `router({ guards })`. A split of the code is not access control. The server still authorizes
  every request.

- **The same checks decide visibility in the nav.** The router derives the nav in one `computed`
  over the guard states. For a row, it runs the check of each area node on the chain of the row,
  with `node` set to the area node, and then the check of the row, with `node` set to the row. A
  row shows only when every check allows. `wait` hides it until the state arrives, and a redirect
  or `false` hides it too. So the nav and the route can never disagree about who may see what. The
  `params` of a check in the nav are the params of the current route up to that node, and empty for
  a node off the current chain. A check that throws during that derivation hides the node and logs
  the error. It cannot allow the node.

- **The nav knows the areas that a router binds.** An area inside an area is known after its chunk
  loads. The router adds it when the chunk loads, and the nav uses it on its next derivation, which
  the settle of the screen triggers.

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

- **imp defers a redirect to a microtask, and counts it.** The delay keeps the `navigate` out of the
  state notification that renders the region now. It costs nothing that a person can see, because a
  microtask runs before a paint. Eleven redirects in a row, with no screen rendered between them,
  throw an error that names the last hop. That is the case where two guarded routes redirect at each
  other, or where an exception is missing. imp resets the counter whenever any screen renders. So
  an ordinary redirect never accumulates toward the limit. imp uses a counter of its own, and not
  the generic `MAX_UPDATE_DEPTH` cycle error. That error would point at the state layer instead.
- **A deferred redirect gives way.** A `navigate` that runs before the microtask drops it, because
  the app already decided where the person goes. A guard that allows again before the microtask
  cancels it. So a screen that signs the person in can set the session and navigate, and the guard
  of the public page that it leaves does not send the person somewhere else.

- **Everything fails closed.** A declared state that nothing provides at the position of the router
  throws the existing message of `useState`, and the router does not mount. A check that throws, and
  a check that returns an unknown verdict, both render `error`. A key of `guards` that is not a
  handle, and a guard that is not `{ states, check }`, throw at startup. No path of failure allows a
  screen.

- **A guard that stays on `wait` gives a warning after five seconds.** The warning names the key of
  the guard, the path and the declared states. It is a warning, and not an error, because a slow
  network is a legitimate long wait.

## Consequences

- A check stays a pure function, from values and a context to a decision. So somebody can unit-test
  it with no DOM, no router and no network. It also cannot introduce a request per navigation.
- The state layer does not change. There is no phase flag, no `pending` sub-state, no `ready()`, no
  inactive binding, and no rule of propagation through `computed`. "Not loaded" is a convention that
  an app expresses in the one place that must interpret it, and two states can spell it differently.
- The cost is one explicit line per guard that a person can enter before its data arrives, which is
  `if (session === undefined) return wait`. To forget that line is not silent. The check then runs
  against `undefined`, and it either denies the route or throws. It does not allow the route.
- A guard under the root guard repeats the question of the outer guard. A call to the outer check keeps
  that to one line, and it keeps the rule of the node in one place.
- The question "is this route protected?" is answered by `router({ guards })`, one line per node
  with its own rule. The question "why did this redirect?" is answered by one check per node, and by
  one more for each area on its chain.
- A guard checks again for the life of the route, and once more per checkpoint in the nav
  derivation. So a state that changes often, and that a guard reads, runs that check on every
  change. A guard must be a cheap comparison over values that are already loaded. Anything
  expensive belongs in a `computed` that the guard declares.
