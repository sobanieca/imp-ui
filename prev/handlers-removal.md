# Auto-removal of `events` handlers — how to avoid leaks

## First, a correction worth internalizing

The current code doesn't yet implement the `events: {...}` design from notes §1
at all. `rendering.js:55` still uses the legacy `on*` prefix and attaches with
**no cleanup signal**:

```js
if (k.startsWith("on") && typeof v === "function") {
  node.addEventListener(k.slice(2).toLowerCase(), v); // leaks-by-design? Actually no — see below
  continue;
}
```

Here's the nuance that matters for "ensure no memory leaks": **a listener
attached directly to a DOM node does _not_ keep that node alive.** When
`when`/`each`/a route swap drops the node and nothing else references it, the GC
reclaims the node, its listeners, and their closures together. There is no leak
in that case.

The listeners that _genuinely_ leak are the ones attached to a **target that
outlives the node** — `window`, `document`, or (critically in this framework)
**a long-lived signal's subscriber set**. That's the real hazard in §5:
`effect(() => t.textContent = child())` puts the effect's `run` into
`signal.subs`, and `run` closes over the detached text node. If the signal is
top-level (`todos`), it keeps every dead row's effect — and node — alive
forever, _and_ keeps firing into detached DOM.

So: **auto-removing `events` handlers is mostly a correctness/tidiness win**
(stop late firing, clean up window/document listeners). The thing that actually
stops the leak is **effect disposal** — and the good news is both are driven by
the _same_ mechanism. Solve disposal once, and event removal falls out for free.

## The unifying tool: one `AbortController` per disposal scope

`addEventListener(name, fn, { signal })` auto-detaches when the signal aborts.
`fetch(url, { signal })` auto-cancels. And effects can listen for `'abort'` to
clear themselves from signal subscriber sets. One `ctrl.abort()` cleans up all
three. notes §5 already lands here — it's the right call.

The only real design decision left is: **what fires `abort()`?** The DOM gives
no native "removed" event for plain elements, so you need a trigger. The repo
has two documented candidates:

|                                               | Owner tree (notes §5)                                           | Custom-element `disconnectedCallback` (to-consider.md)                |
| --------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Trigger                                       | Structural primitives dispose child scopes on swap-out          | Browser fires `disconnectedCallback` natively on removal              |
| Catches imperative `node.remove()`?           | ❌ invisible                                                    | ✅ for component roots (native hook); ❌ only for bare plain elements |
| Cost                                          | a `currentScope` module global threaded through `el`/components | components must be custom elements → kebab tag names                  |
| Fit with "components are just functions" (§1) | ✅ preserved                                                    | ⚠️ breaks it — to-consider.md flags this tension itself               |

**Recommendation: the owner tree.** It's the proven Solid model notes already
lean toward, and it keeps "components are just lowercase functions" intact. The
custom-element approach is elegant (native removal hook is genuinely nice) but
it forces every component into a `<kebab-tag>` custom element, which collides
with §1's whole identity. Not worth it for v1.

## Concrete sketch (owner tree)

```js
// scope.js
let currentScope = null;

export function createScope() {
  const ctrl = new AbortController();
  const disposers = [];
  const scope = {
    signal: ctrl.signal,
    onDispose: (fn) => disposers.push(fn),
    dispose() {
      ctrl.abort(); // detaches every listener + fetch tied to this signal
      for (const d of disposers) d(); // effect teardown, onMount disposers
      disposers.length = 0;
    },
  };
  return scope;
}

export function runInScope(scope, fn) {
  const prev = currentScope;
  currentScope = scope;
  try {
    return fn();
  } finally {
    currentScope = prev;
  }
}

export const getScope = () => currentScope;
```

**1. `events` in `applyProps`** (replace the `on*` branch at `rendering.js:55`):

```js
if (k === "events") {
  const signal = getScope()?.signal;
  for (const name in v) {
    const entry = v[name];
    const [fn, opts] = Array.isArray(entry) ? entry : [entry, {}];
    node.addEventListener(name, fn, { ...opts, signal }); // §1: supports [fn, {once}]
  }
  continue;
}
```

If there's no current scope (top-level render), `signal` is `undefined` and the
listener is permanent — which is correct for app-root handlers.

**2. Effects register their teardown** so they leave the signal's `subs` Set:

```js
export function effect(fn) {
  const run = () => {/* ...track deps... */};
  run.deps = new Set(); // signals add themselves here on read
  run();
  getScope()?.onDispose(() => { // on unmount: drop from every subscriber set
    for (const subs of run.deps) subs.delete(run);
  });
  return run;
}
```

**3. Structural primitives own child scopes.** `when`/`each`/route swaps create
a scope per slot/row and dispose it when that subtree leaves:

```js
// inside when(), when swapping out the old branch:
if (currentScope) currentScope.dispose(); // aborts listeners + tears down effects in that branch
oldNode.remove();
```

For `each`, each keyed row gets its own scope stored alongside the node in
`nodesByKey`; deleting a key calls `rowScope.dispose()` before `node.remove()`.

**4. `onMount` disposers** (§4.5) just push to `getScope().onDispose(...)` —
same channel.

## Net effect

- Every `events` handler attached inside a component/slot/row detaches
  automatically when that subtree unmounts — no manual `removeEventListener`.
- The effects (the actual leak) get torn down on the same signal, so detached
  nodes are released and stop receiving updates.
- `fetch`/websocket abort rides the same `signal` for free.
- The one documented gap stays as notes §1 already states it: bare
  `node.remove()` on a non-component element is invisible — use the structural
  primitives or `onMount`'s own controller.

## Notes follow-up

One thing to update in notes: §1 says the `events` AbortController is "owned by
the element's disposal scope," but the cleaner model is _one controller per
scope_ (component/slot/row), not per element — fewer objects, and it matches how
effects and fetches want to be grouped anyway. Open Q #5 in §7 is exactly this;
resolve it as "one AbortController per owner scope."
