# Reactivity — fine-grained signals

Give imp fine-grained reactivity so a component runs **once** to build real DOM, and signals
thereafter update only the specific nodes/attributes that changed — no virtual DOM, no re-render, no
diffing. This is the Solid-style model, consistent with `adr/real-dom-no-virtual-dom.md`.

## Current state

`src/render.js` renders statically: `el`/factory shortcuts build DOM, `mount` calls the view once,
function-valued props/children are **not** yet reactive. There is no signal graph, no effect, no
disposal. This item introduces all of it. A working draft lives in `prev/experiment/imp/`
(`signals.js`, `scope.js`, `primitives.js`) — treat it as prior art to adapt, not code to copy
verbatim.

## Signal graph

Port the `prev/experiment/imp/signals.js` model:

- `signal(initial)` — a readable function; calling it inside an effect subscribes that effect.
  `.set(next)` (no-op on `Object.is` equality), `.update(fn)`, `.peek()` for untracked reads.
- `effect(fn)` — runs now, re-runs when any signal read inside changes; re-tracks dependencies each
  run; returns a stop function and auto-stops when its owning scope disposes. A throwing effect is
  reported and skipped, not fatal.
- `computed(fn)` — derived read-only signal.
- `untrack(fn)` — read without subscribing.
- `batch(fn)` — coalesce multiple sets into one flush.
- `subscribe(sig, fn)` — raw change notifications for third-party code (charts, storage).

Updates are synchronous; `batch` coalesces; circular dependencies are an accepted non-goal (you get
the stack overflow). Keep the whole module pure JS with no DOM dependency so it is testable in
isolation.

## Reactive dispatch in the renderer

Wire the signal graph into `src/render.js` under the existing `adr/type-based-argument-dispatch.md`
rule: **a function-valued prop or child is reactive**, a plain value is static (essence #10/#11 in
`prev/essence.md`). A function child/prop is wrapped in an `effect` that surgically updates just
that text node or attribute. Reactivity stays **opt-in** — imperative DOM mutation remains fully
supported; nothing forces a signal to exist.

## Owner-tree disposal — the keystone

Port `prev/experiment/imp/scope.js`: one scope per component/slot/row, forming an owner tree.
Disposing a scope (1) disposes child scopes, (2) aborts the scope's `AbortController` — detaching
every `events` listener and cancelling every fetch tied to its signal, (3) runs registered disposers
(effect teardown, `onMount` cleanups). This is what makes automatic cleanup on framework-driven
unmount work (essence #13) with no manual `removeEventListener`. `events` handling in `render.js`
must be repointed to register through the active scope's `scopeSignal()`.

## Structural primitives

Port `prev/experiment/imp/primitives.js`: `when(cond, render)`, `each(list, renderItem, getKey)`
(keyed — stable keys keep their DOM so focus/input/animation survive reorders),
`match(sig,
branches)`, plus `onMount(node, fn)` and `portal(target, node)`. Each anchors a slot
with a comment marker and swaps siblings around it, running every branch/row in its own scope so
teardown is automatic. Essence note: ~90% of apps need only `when`, `each`, `onMount`.

## Foundation for other work

Signals + scope are the base layer the router (`router.md`), theming (`theme-styling.md`), and the
component stdlib (`stdlib-components.md`) all build on — land this first.

## ADR impact

- New ADR `fine-grained-signals.md` (run-once components, synchronous fine-grained updates, opt-in
  reactivity) and `owner-tree-disposal.md` (scope tree + AbortController-unified cleanup); update
  the ADR table.
- Extend `adr/type-based-argument-dispatch.md` to state that a function argument means "reactive".

## Open questions

- **`console.*` in the drafts.** `signals.js`/`scope.js`/`primitives.js` log via `console.error`;
  route these through the built-in logger (`todo/logger.md`) instead.
- **Sync vs. scheduled flush.** Drafts flush synchronously; decide whether a microtask-batched
  scheduler is worth it before v1.
- **Reactive props beyond text/attributes.** Exact set of prop kinds (class, style, boolean attrs)
  that accept a function and how each is surgically updated.
