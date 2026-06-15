# To Consider

Design ideas captured for later evaluation. Not yet committed to `notes.md`.

---

## Custom elements as the cleanup unit, `imp:dispose` as the signal

### The idea

Framework components are custom elements. When a custom element is removed from
the DOM, its `disconnectedCallback` walks its subtree and dispatches a custom
event (`imp:dispose`) on every descendant. Each element that owns handlers,
effects, or async work listens for that event once and cleans up its own
resources via a local `AbortController`. No central scope tree, no module-level
context stack.

### Mechanics

**Base class** dispatches the event on disconnect:

```js
class ImpElement extends HTMLElement {
  disconnectedCallback() {
    const walker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT);
    let n = this;
    do {
      n.dispatchEvent(new Event("imp:dispose"));
    } while ((n = walker.nextNode()));
  }
}
```

**`applyProps`** wires each element's `events` locally:

```js
const ctrl = new AbortController();
for (const name in v) {
  node.addEventListener(name, v[name], { signal: ctrl.signal });
}
node.addEventListener("imp:dispose", () => ctrl.abort(), { once: true });
```

**Reactive effects** clean up via the same hook (paired with a `dispose()`
method on effects that removes them from signal subscriber sets):

```js
const eff = effect(() => setAttr(node, k, v()));
node.addEventListener("imp:dispose", () => eff.dispose(), { once: true });
```

**Structural primitives** (`when`, `each`, route changes) call a helper instead
of `node.remove()` directly:

```js
function dispose(node) {
  // walk + dispatch imp:dispose on each descendant
  // then remove
}
```

### Why it's appealing

- No `currentScope` module variable, no `withScope` wrapper, no stack.
- No parent/child controller chaining for `when`/`each` — just walk-and-dispatch
  when a subtree leaves.
- `imp:dispose` listeners are `once: true`, so they clean themselves up. No leak
  in the cleanup mechanism.
- Each element is self-contained: it knows how to dispose itself, doesn't depend
  on any framework-global state.
- Nested custom elements compose naturally — the browser fires
  `disconnectedCallback` on each, both dispatch, descendants receive twice,
  `once: true` makes the second dispatch a no-op.

### Open / accepted costs

- **Imperative `node.remove()` by user code is invisible.** Handlers on the
  removed subtree won't receive `imp:dispose`. Documented as an opt-in pitfall:
  use the structural primitives or call `dispose(node)` if removing
  imperatively.
- **Walk-and-dispatch is O(n)** in the subtree size at disconnect time. Fine for
  typical UI; revisit if a perf case emerges.
- **Redundant dispatch on deeply nested custom elements** (outer + inner each
  walk overlapping subtrees). `once: true` listeners make this safe but
  wasteful. Optimization: outer walker stops at custom-element boundaries and
  lets the inner one handle its own subtree.
- **Custom elements require kebab-case tag names.** Conflicts mildly with §1's
  "lowercase function" convention — the JS factory wrapper can stay lowercase
  (`todoApp` → `<todo-app>`), but the convention needs an addendum.

### Implications for existing notes.md

If adopted, the changes are small (not a sprawl):

1. **New short subsection §1.5 "Custom element lifecycle"** — introduces
   `ImpElement`, `imp:dispose`, the walk-and-dispatch mechanism, the
   `dispose(node)` helper.
2. **§1 Events subsection** — change "AbortController owned by the disposal
   scope" → "local AbortController, aborted on `imp:dispose`".
3. **§5 Disposal** — collapse to a single paragraph describing the event-based
   cleanup. No owner tree.
4. **§2 Signals** — add the effect `dispose()` contract (clears its entries from
   observed signals' subscriber sets, triggered by the `imp:dispose` listener on
   its anchor node).
5. **Open Questions** — drop the owner-tree question; add disconnect/reconnect
   ping-pong handling (custom elements that get moved across the tree fire
   disconnect→connect rapidly; deferring abort to a microtask avoids destroying
   state the user expected to keep).

### Decision still needed

- Is this the cleanup model? (Strong candidate; simpler than the Solid-style
  owner tree.)
- Does every framework component have to be a custom element, or only some?
  (Leaning: yes for components, plain function factories stay available as
  lightweight helpers that produce subtrees but don't own lifecycle.)
- Disconnect/reconnect debounce window — needed at all, or accept a wipe on any
  disconnect?
