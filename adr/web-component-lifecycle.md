# Web-component lifecycle

## Context

An element factory is eager, and it runs from the leaves up. So a child is built before its parent
element exists, and nothing touches the live tree until the mount. The logic of a component
therefore ran detached. It could not reach an ancestor. It could not measure the layout. It could
not own a subscription with a defined lifetime. The disposal of a state had to rely on a lazy check
of whether a node was connected, see `event-propagated-state.md`. An app also had no story for a
loading state around async data. To run the code of a component **after imp mounts it** needs a
placeholder that the factory returns at the moment of the call, and a signal about the connection.
imp considered three alternatives. An anchor element that replaces itself has no hook for disposal,
and no persistent root for the component. A MutationObserver over the page is asynchronous, and it
costs something all the time. To process a deferred body inside the insertion points of imp only
breaks in silence when somebody inserts DOM with a raw API.

## Decision

**An imp component is a real web component.** `component(name, definition)` defines a custom element
with the name `name`, and returns a factory. A call to the factory creates the host element. No
logic runs until the browser connects that element to the document. Each host attaches an open
shadow root at construction, and all output of the component renders into that root, see
`shadow-dom-isolation.md`. The lifecycle callbacks of the platform drive everything:

- **`build(instance, ...args)` is required, and it is the whole logic of the component.** It runs in
  `connectedCallback`, with a parent before its children, and synchronously on the insertion. It
  receives the instance of the mount, and then the arguments of the factory call, without a change.
  It returns the DOM of the component, which fills the shadow root of the host. imp then activates
  the state bindings that the output contains, and the component owns them, see
  `event-propagated-state.md`. An async `build` keeps the placeholder visible until it resolves. A
  counter of the mount generation discards output that resolves after an unmount, or after a
  remount. A mount error goes to the nearest error boundary, see `error-boundaries.md`. That covers
  a synchronous throw, a rejection that is still current, and a failure while imp activates a
  binding. With no boundary, imp logs the error, and leaves the placeholder in place.
- **The instance is a handle per mount.** It is an ordinary object, and imp creates a new one each
  time when the component mounts. imp passes it as the first argument to `build` and to `teardown`.
  It carries `host`, which is the custom element, and `root`, which is its shadow root. Those give
  direct access to the DOM, which is consistent with `real-dom-no-virtual-dom.md`. The instance is
  writable, so it is the approved channel to hand a resource from `build` to `teardown`. It exists
  per instance. So a list of components never shares a handle, and never overwrites one, in the way
  that a property on the definition, or a variable at module scope, would. imp passes the instance
  first, and not last. So its position is fixed, whatever arity a component has, and it works with
  an arrow function as a hook, where a bound `this` would not. The instance survives a move. The
  path of a move does not touch it. So anything that you stored on it travels with the element, see
  `component-moves-rebind.md`. It also carries **`instance.abortSignal`**, which is an `AbortSignal`
  scoped to the one mounted lifetime. imp creates its controller at the mount. It aborts the
  controller when a remount replaces the instance, and at the end of a permanent teardown, after
  `teardown` has run. The one signal serves both hooks. `build` hands it to `fetch` and to
  `addEventListener`, to cancel work when the component goes away. `teardown` reads its `aborted`
  flag, to detect a remount that replaces it, described below. The two points of abort never
  overlap. In a permanent teardown, `teardown` sees the signal not aborted, because the abort
  follows. In a teardown that a remount replaces, `teardown` sees the signal aborted, because the
  remount aborted it first.
- **`instance.afterMount(callback)` registers one callback.** imp runs it after it attaches the
  returned DOM, and after the browser lays that DOM out. imp flushes the callback on the next
  animation frame after the placement. So a measurement, `scrollIntoView`, a focus, and the setup of
  an animation, are all safe. It is a method on the instance, and not an imported helper, and that
  is deliberate. The synchronous stack of the mount scope, which scopes `initState`, `useState` and
  `watch`, cannot survive an `await`. The instance is an object that a closure carries. So you can
  call `afterMount` anywhere in `build`. That includes _after_ the fetch that builds the very nodes
  that the callback touches, and you declare no `let` early. There is no ref system. The node that
  you build directly in `build` is a live element, and the closure carries it into the callback.
  `afterMount` accepts **one** callback per mount, and it throws on a second call. Work after the
  mount is one step, in concept. So a caller composes several actions inside that one function. imp
  then does not have to order a list, or reason about it. imp guards the cancellation twice. The
  async path of the placement already discards a mount that resolved after its generation moved. The
  frame callback checks the generation of the mount again, and checks that the element is connected,
  because a component can unmount between the placement and the next frame. `afterMount` is the end
  of the mount. So a throw from the callback is a **mount failure**. It goes to the nearest error
  boundary, through the same `ComponentError` channel as a synchronous throw, or an async rejection,
  see `error-boundaries.md`. imp does not log it in isolation, in the way that it logs a later error
  from an event handler, or from a subscriber.
- **`placeholder(...args)` is optional.** It renders the initial content of the shadow root, at the
  moment of the factory call. It renders again at the **front of the `connectedCallback` of a
  remount**, which is a connection whose element has already been through a mount cycle. A
  synchronous mount replaces it before the paint. So a person sees it during an async mount only,
  and that is the built-in story of a skeleton and of loading. It runs outside a live mount. So it
  takes no instance. For the same reason it holds no live content. imp never activates a binding in
  the output of a placeholder. So imp warns once, and names the component, in place of leaving the
  binding empty with no message. **To render the placeholder on a remount is what returns the host
  to a clean state at rest**, before the new `build` runs. Without that, a host that somebody
  inserts again would keep the DOM of the dead mount on the screen, until the new async `build`
  resolved. A first mount skips the placeholder, because the factory already filled the shadow root
  at the moment of the call. So imp builds the placeholder exactly once per mount that can show it,
  and never for a mount that imp discards. **A teardown does not render the placeholder.** It
  empties the shadow root, and drops the outgoing subtree for collection. It does not build a
  skeleton that a host that is removed for good would never paint. For a component with no
  `placeholder`, a remount starts from that emptied shadow root. So this is one rule, and not a
  special case.
- **`teardown(instance, ...args)` is optional.** It runs on a removal, for a resource that imp
  cannot track. It receives the same instance as its mount. It can be async, and imp awaits it. A
  guard on the mount generation, after the await, stops an outgoing teardown from overwriting a
  component that somebody inserted again in the middle of that teardown. That guard protects the
  step of imp after the await only. It does not protect the body of your `teardown`, which has
  already run. So the teardown also exposes the **`instance.abortSignal`** of the mount. A fresh
  `connectedCallback` aborts the controller of the outgoing mount, before it starts the new mount.
  So an async `teardown` that touches a **shared** resource, or a resource at module scope, must
  check `instance.abortSignal.aborted` after its `await`, and stop. That covers a shared socket, a
  listener at document level, and a global timer. So a slow teardown cannot close a handle that the
  next mount just opened. A resource per instance needs no guard. imp creates a fresh instance on
  each mount. So a teardown that touches `instance.*` only can never reach the state of the new
  mount.
- **`fallback(error, ...args)` is optional.** It makes the component an error boundary, for a mount
  failure of the component itself, and of its subtree, see `error-boundaries.md`.
- **imp detects a removal with a guard on a microtask.** `disconnectedCallback` delays, and checks
  `isConnected` again. So a move inside the same task keeps the component mounted. Its DOM stays as
  it is, and imp binds its subscriptions to the new position, see `component-moves-rebind.md`. A
  real removal runs the cleanup. imp unsubscribes the tracked states, then awaits `teardown`, and
  then empties the shadow root.
- **A stack of mount scopes tracks the host that mounts now.** The state helpers register their
  unsubscribe functions with that stack, see `event-propagated-state.md`. The stack is also what
  gives `initState` a host to scope a state to.
- **`styles` is optional.** It is the CSS of the component, and the shadow root of every instance
  adopts it, see `shadow-dom-isolation.md`.
- **A definition key that returns DOM is never named `on*`.** imp calls `build`, `placeholder` and
  `fallback` for their return value, and it renders that value. An `on*` name promises the opposite,
  which is a handler that imp calls for its side effect, and whose result imp discards. `teardown`
  is the only hook in the set that imp really calls for an effect. It is named for the job, and not
  for the event. So the whole definition reads as one vocabulary. The router follows the same rule,
  for the options that it shares with a component, see `client-side-router.md`. Across imp, `on*`
  stays reserved for a callback whose return value imp ignores, such as `onClick`, `onSubmit`,
  `onRequest` and `onResponse`.
- **A host is invisible to the layout.** Every shadow root adopts a shared default sheet, with
  `:host { display: contents }`. So the output takes part in the layout of the parent. The `styles`
  of a component can override the display of the host.
- **A name is lowercase, and it holds at least one dash**, such as `my-app-profile`. Those are the
  rules for a custom element, and they also enforce a namespace, like a state name. imp rejects a
  name that HTML reserves. The `imp/component-name` lint rule reports a bad literal statically. A
  second definition of a name gives a warning, and imp keeps the first definition.

An element factory stays eager. A plain lowercase helper function stays the way to compose DOM with
no life of its own. A component is the path of promotion, when a piece of UI needs time. That is the
mount, the loading, the state and the cleanup.

## Consequences

- The code of a component runs while the component is connected. It can subscribe to a scoped state.
  It can dispatch a bubbling event. Through `instance.afterMount`, it can measure and focus its DOM
  after the browser lays it out. Nobody schedules a `requestAnimationFrame` by hand, and nobody
  checks again for an unmount in the middle of a frame. The order of a mount is top down. So the
  `initState` of an ancestor always runs before the `useState` of a descendant.
- A loading state costs nothing extra. It is a `placeholder` with an async `build`.
- **A component that mounts again resets to its content at rest.** A comparable library for web
  components leaves that content alone. Lit keeps the shadow root of a disconnected element as it
  is. So a reconnection shows the previous render immediately. That is safe there, because a
  reactive render again corrects stale output. imp has no render again. `build` builds DOM once,
  directly. So nothing would ever overwrite a stale subtree, except the next mount, and that is
  exactly what the user waits for. imp resets by rendering the placeholder at the front of the
  remount, and not on the way out. So the cost lands on the rare path that needs it. A host that
  somebody discards for good pays for an emptied shadow root only, and never for a skeleton that it
  would never paint.
- The cleanup is deterministic. A state subscription exists inside a mount only, and it ends at the
  unmount. Outside a mount it throws, see `event-propagated-state.md`. `teardown` covers a timer and
  a socket.
- `useState` inside `teardown` throws, and the error names the form that works. Resolve in `build`,
  keep the handle on the instance, and write through it in `teardown`. The host runs `teardown`
  while it is disconnected. So a lookup for a provider has nothing to bubble through. imp does not
  make the host remember the consumers that `build` resolved, in order to answer a `useState` by
  name. That would give one helper two meanings, which are to resolve and to remember, and it would
  save the one line that the instance already carries. The component tracks which host is in a
  teardown, only so that the message can point at the fix.
- The tag of the host stays in the tree, and its output sits behind a shadow boundary. So a
  component boundary is visible in the inspector. No selector crosses it, see
  `shadow-dom-isolation.md`. A strict content model, such as `<table>` and `<select>`, is best
  rendered as a whole, by one component.
- The lifecycle belongs to the platform. There is no scheduler, and there is no reconciliation,
  which is consistent with `real-dom-no-virtual-dom.md`. The whole surface is one function, and four
  entries in a definition.
