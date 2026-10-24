# Web-component lifecycle

## Context

An element factory is eager, and it runs from the leaves up. So a child is built before its parent
element exists, and nothing touches the live tree until the mount. The logic of a component
therefore ran detached. It could not reach an ancestor. It could not measure the layout. It could
not own a subscription with a defined lifetime. An app also had no story for a loading state around
async data. To run the code of a component **after imp mounts it** needs content that the factory
returns at the moment of the call, and a signal about the connection. imp considered three
alternatives. An anchor element that replaces itself has no hook for disposal, and no persistent
root for the component. A MutationObserver over the page is asynchronous, and it costs something all
the time. To process a deferred body inside the insertion points of imp only breaks in silence when
somebody inserts DOM with a raw API.

A component also needs a way to find a resource that an ancestor provides, such as a state or an
http client, from inside `setup`. A lookup through an ambient stack of mount scopes cannot survive
an `await`. It would force a rule about the position of every resolution, lint rules to enforce that
rule, a runtime throw after an `await`, and a second rule for the removal hook, where the host has
already left the tree. A third of the rules that an agent must learn would come from that one
choice.

## Decision

**An imp component is a real web component.** `component(name, definition)` defines a custom element
with the name `name`, and returns a factory. A call to the factory creates the host element. No
logic runs until the browser connects that element to the document. Each host attaches an open
shadow root at construction, and all output of the component renders into that root, see
`shadow-dom-isolation.md`. The lifecycle callbacks of the platform drive everything. The definition
has six keys:

| Key                           | Returns | Runs                                                                |
| ----------------------------- | ------- | ------------------------------------------------------------------- |
| `loading(...args)`            | DOM     | while an async `setup` runs, and on remount. Gets no `self`.        |
| `setup(self, ...args)`        | DOM     | on connect, before imp places the DOM. Can be async.                |
| `error(self, error, ...args)` | DOM     | when `setup` or a descendant fails. Makes the component a boundary. |
| `onMount(self, ...args)`      | nothing | after imp places the DOM and the browser lays it out.               |
| `onRemove(self, ...args)`     | nothing | on removal, before imp empties the shadow root. Can be async.       |
| `styles`                      | -       | the CSS of the component.                                           |

**A key that returns DOM is a noun. A key named `on*` is an effect, and imp discards its return
value.** That is the rule that `onRequest` and `onResponse` on the http client already follow, see
`http-client.md`. The producer is `setup`, the name that Vue gives to the function that runs once
per mount, resolves state and returns what to show. `render` would tell a React reader that the
function runs again on every state change. It runs once per mount. The router follows the same
vocabulary for the options that it shares with a component, see `client-side-router.md`.

- **`setup(self, ...args)` is required, and it is the whole logic of the component.** It runs in
  `connectedCallback`, with a parent before its children, and synchronously on the insertion. It
  receives `self`, and then the arguments of the factory call, without a change. It returns the DOM
  of the component, which fills the shadow root of the host. imp then activates the state bindings
  that the output contains, and the component owns them, see `event-propagated-state.md`. An async
  `setup` keeps the loading content visible until it resolves. A counter of the mount generation
  discards output that resolves after an unmount, or after a remount. A mount error goes to the
  nearest error boundary, see `error-boundaries.md`. That covers a synchronous throw, a rejection
  that is still current, and a failure while imp activates a binding. With no boundary, imp logs the
  error, and leaves the loading content in place.
- **`self` is what a component knows about itself during one mount.** imp creates a new one per
  mount and passes it first to `setup`, `error`, `onMount` and `onRemove`. Its position is fixed, so
  it works with an arrow function of any arity, where a bound `this` would not. It shadows
  `window.self`, which is harmless. The parameter name is the choice of the user, so the docs and
  the skills call it `self` everywhere. It carries `host`, which is the custom element, and
  `abortSignal`. Its open shadow root is `self.host.shadowRoot`. There is no `self.root`. It was
  `self.host.shadowRoot` under a second name, and a node that `onMount` needs travels as a field.
  `self` is writable, so it is the approved channel to hand a node or a resource from `setup` to
  `onMount`, `error` and `onRemove`. It exists per mount. So a list of components never shares a
  handle, and never overwrites one, in the way that a property on the definition, or a variable at
  module scope, would. `self` survives a move. The path of a move does not touch it. So anything
  that you stored on it travels with the element, see `component-moves-rebind.md`.
- **`self` is the key that resolves a resource.** `initState(self, name, value)`,
  `useState(self, name)`, `initHttpClient(self, name, options)` and `useHttpClient(self, name)` take
  `self` first. imp keeps the mount scope of each `self` in a `WeakMap` inside the component module.
  A helper looks the scope up, dispatches the lookup from `self.host`, and registers its cleanup and
  its rebind on that scope. So every resolution works at any point in `setup`, before or after any
  number of awaits. There is no ambient stack, and there is no rule about the first `await`. A
  helper that does not import the component module cannot resolve anything. That is why the helpers
  stay free functions in `imp/state` and `imp/http`, and are not methods on `self`. A method on
  `self` would pin the state layer and the http client into every bundle that has a component, see
  `tree-shakeable-library.md`. A free function is bundled only by an app that imports it.
- **`self` remembers what the mount resolved.** `useState(self, name)` in `setup` resolves through
  the host and caches the handle on the mount by kind and name. The same call in `onRemove` returns
  the cached handle. A state from `initState` is available by the same route. The host is
  disconnected in `onRemove`. A lookup has nothing to bubble through, and imp cannot keep the host
  in the tree. Nothing in the platform runs before a removal, and imp does not do the removal itself
  in most cases. A two-phase removal at the seams of imp would give a raw `remove()` a second code
  path. A re-insertion of the host would paint a stale frame and confuse a keyed `each`. So the
  cache is the answer. A name that `setup` never resolved throws in `onRemove`, with a message that
  says to resolve it in `setup`. This is also the correct meaning. A component that withdraws on
  unmount writes to the provider it contributed to at mount, not to whatever sits above its old
  position. When a subtree unmounts, the parent runs `onRemove` before the child, and the bindings
  of the parent are released. A `set` from the child then notifies nobody, which is harmless. When
  the component unmounts while `setup` awaits, a later `useState` throws, because the scope has
  ended. A resolution with anything but a `self` as its first argument throws too.
- **`self.abortSignal` is an `AbortSignal` scoped to the one mounted lifetime.** imp creates its
  controller at the mount. A move is a removal and an insertion in the same task. It is not an
  unmount. Nothing runs, and the signal, the requests in flight and `self` survive. An unmount
  aborts the signal after `onRemove` has finished. A remount is an insertion in a later task, after
  an unmount. It starts a new mount with a new `self` and a new signal, and it aborts the old signal
  if an async `onRemove` still holds it. So a request aborts only when its mount is over. `setup`
  hands the signal to `fetch` and to `addEventListener`. `onRemove` reads its `aborted` flag, to
  detect a remount that replaces it. The two points of abort never overlap. In a permanent unmount,
  `onRemove` sees the signal not aborted, because the abort follows. In an unmount that a remount
  replaces, `onRemove` sees the signal aborted, because the remount aborted it first.
- **`onMount(self, ...args)` is optional.** imp runs it after it attaches the returned DOM, and
  after the browser lays that DOM out, on the next animation frame after the placement. So a
  measurement, `scrollIntoView`, a focus, and the setup of an animation, are all safe. A query on
  `self.host.shadowRoot` there is valid. A node that `setup` made after a fetch travels as a field,
  `self.field = field`. imp guards the cancellation twice. The async path of the placement already
  discards a mount that resolved after its generation moved. The frame callback checks the
  generation of the mount again, and checks that the element is connected, because a component can
  unmount between the placement and the next frame. `onMount` is the end of the mount. So a throw
  from it is a **mount failure**. It goes to the nearest error boundary, through the same
  `ComponentError` channel as a synchronous throw, or an async rejection, see `error-boundaries.md`.
  `onMount` does not run after `error`. The `imp/no-root-query-in-setup` lint rule keeps its scope,
  which is `setup`, and reports a query on `self.host.shadowRoot` there.
- **`loading(...args)` is optional.** It renders the initial content of the shadow root, at the
  moment of the factory call. It renders again at the **front of the `connectedCallback` of a
  remount**, which is a connection whose element has already been through a mount cycle. A
  synchronous mount replaces it before the paint. So a person sees it during an async mount only,
  and that is the built-in story of a skeleton and of loading. It runs outside a live mount. So it
  takes no `self`. For the same reason it holds no live content. imp never activates a binding in
  the output of `loading`. So imp warns once, and names the component, in place of leaving the
  binding empty with no message. **To render the loading content on a remount is what returns the
  host to a clean state at rest**, before the new `setup` runs. Without that, a host that somebody
  inserts again would keep the DOM of the dead mount on the screen, until the new async `setup`
  resolved. A first mount skips it, because the factory already filled the shadow root at the moment
  of the call. **An unmount does not render the loading content.** It empties the shadow root, and
  drops the outgoing subtree for collection. For a component with no `loading`, a remount starts
  from that emptied shadow root. So this is one rule, and not a special case.
- **`onRemove(self, ...args)` is optional.** It runs on a removal, for a resource that imp cannot
  track, such as a timer, a socket and a third-party widget. It receives the same `self` as its
  mount. It can be async, and imp awaits it. A guard on the mount generation, after the await, stops
  an outgoing `onRemove` from overwriting a component that somebody inserted again in the middle of
  it. That guard protects the step of imp after the await only. It does not protect the body of your
  `onRemove`, which has already run. So an async `onRemove` that touches a **shared** resource, or a
  resource at module scope, must check `self.abortSignal.aborted` after its `await`, and stop. A
  resource per mount needs no guard.
- **An async `setup` that awaits an http call of the component needs no check.** A call through
  `useHttpClient(self)` belongs to the mount, see `http-client.md`. An unmount aborts it, so the
  rest of `setup` never runs, and imp logs the aborted rejection at debug level only. The
  `imp/abort-check-after-await` lint rule counts such an `await` as a guard.
- **`interval(self, ms, run)` repeats work for the length of a mount.** imp stops it when the mount
  ends, with the bindings. It skips a tick while an async `run` has not settled, so a slow poll does
  not overlap itself, and it logs a failure instead of throwing it into a timer.
- **`delay(self, ms, run)` runs work once after a wait, inside a mount.** An unmount before the wait
  cancels it, with the bindings. A failure goes to the log, the same as for `interval`.
- **`error(self, error, ...args)` is optional.** It makes the component an error boundary, for a
  mount failure of the component itself, and of its subtree, see `error-boundaries.md`. The boundary
  is a mounted component when its error view renders. So it gets the same `self`. The error view can
  reset a state, bind a state, keep `self.abortSignal` for a retry, and set a field that `onRemove`
  reads.
- **imp detects a removal with a guard on a microtask.** `disconnectedCallback` delays, and checks
  `isConnected` again. So a move inside the same task keeps the component mounted. Its DOM stays as
  it is, and imp binds its subscriptions to the new position, see `component-moves-rebind.md`. A
  real removal runs the cleanup. imp releases the tracked bindings, then awaits `onRemove`, then
  aborts the signal, and then empties the shadow root.
- **`styles` is optional.** It is the CSS of the component, and the shadow root of every instance
  adopts it, see `shadow-dom-isolation.md`.
- **A host is invisible to the layout.** Every shadow root adopts a shared default sheet, with
  `:host { display: contents }`. So the output takes part in the layout of the parent. The `styles`
  of a component can override the display of the host.
- **A name is lowercase, and it holds at least one dash**, such as `my-app-profile`. Those are the
  rules for a custom element, and they also enforce a namespace, like a state name. imp rejects a
  name that HTML reserves. The `imp/component-name` lint rule reports a bad literal statically. A
  second definition of a name gives a warning, and imp keeps the first definition.

There is no hook before a removal with the DOM attached. An exit animation is
`document.startViewTransition`. There is no hook for changed arguments. A changing input is a state
passed as an argument.

An element factory stays eager. A plain lowercase helper function stays the way to compose DOM with
no life of its own. A component is the path of promotion, when a piece of UI needs time. That is the
mount, the loading, the state and the cleanup.

## Consequences

- The code of a component runs while the component is connected. It can subscribe to a scoped state.
  It can dispatch a bubbling event. Through `onMount`, it can measure and focus its DOM after the
  browser lays it out. Nobody schedules a `requestAnimationFrame` by hand, and nobody checks again
  for an unmount in the middle of a frame. The order of a mount is top down. So the `initState` of
  an ancestor always runs before the `useState` of a descendant.
- The depth of a tree of components is not limited by the stack of the browser. An insertion runs
  the `connectedCallback` of a child inside the DOM call of its parent, so a chain of nested mounts
  is a chain of re-entries into the browser, and Chrome ran out of stack at about 40 levels. imp
  therefore mounts a tree from one loop. The first host that connects mounts, and every host that
  connects while it mounts joins a list. The loop then mounts those hosts in document order, and
  their children after them, depth first, so the order stays parent before child, and sibling
  subtree before the next sibling. A mount of thousands of levels costs no more stack than one.
- A loading state costs nothing extra. It is `loading` with an async `setup`.
- A resolution has no position rule. `useState(self, name)` works before and after an `await`, and
  in `onRemove`. There is no rule about the first `await`, no lint rule for it, and no handle to
  carry by hand into the removal hook. The one cost of the design is one argument. Nothing ambient
  can own a `watch`, so a component passes `self` to it, and imp stops it with the mount. The DOM
  bindings never needed an owner from the stack. Containment decides their owner.
- **A component that mounts again resets to its content at rest.** A comparable library for web
  components leaves that content alone. Lit keeps the shadow root of a disconnected element as it
  is. So a reconnection shows the previous render immediately. That is safe there, because a
  reactive render again corrects stale output. imp has no render again. `setup` builds DOM once,
  directly. So nothing would ever overwrite a stale subtree, except the next mount, and that is
  exactly what the user waits for. imp resets by rendering the loading content at the front of the
  remount, and not on the way out. So the cost lands on the rare path that needs it.
- The cleanup is deterministic. A binding exists inside a mount only, and it ends at the unmount.
  `onRemove` covers a timer and a socket.
- The tag of the host stays in the tree, and its output sits behind a shadow boundary. So a
  component boundary is visible in the inspector. No selector crosses it, see
  `shadow-dom-isolation.md`. A strict content model, such as `<table>` and `<select>`, is best
  rendered as a whole, by one component.
- The lifecycle belongs to the platform. There is no scheduler, and there is no reconciliation,
  which is consistent with `real-dom-no-virtual-dom.md`. The whole surface is one function, and six
  entries in a definition.
