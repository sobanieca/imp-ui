# State management review — overview

Working notes from the review of the `feat/state-management` branch (diff against `main`), the bug
fix that came out of it, and research into simplifying the design. Written 2026-07-10.

## What the branch contains

- `lib/src/component.js` — components as real custom elements: `component(name, definition)` with
  `onMount` (runs in `connectedCallback`), optional `placeholder` and `onUnmount`, microtask guard
  so same-task moves don't remount, mount-scope stack for subscription ownership.
- `lib/src/state.js` — named state: `initState(name, initial)` / `useState(name)` resolved by a
  bubbling `StateSubscription` DOM event (nearest ancestor provider answers; `document` for
  page-wide). Helper: `get / set / on / text / view / each` (`set` takes a value or an updater
  function), plus the read-only `computed(states, compute)` combinator.
- Lint rules `imp/state-name-namespace` and `imp/component-name`, docs (`docs/state.md`,
  `docs/components.md`), ADRs (`adr/event-propagated-state.md`, `adr/web-component-lifecycle.md`),
  and test suites (`lib/test/state.test.js`, `lib/test/component.test.js`).

## Review verdict

The design is coherent, small, and honest about trade-offs. Strong points: DOM-event resolution
gives React-Context-style scoping with no registry; custom-element lifecycle gives deterministic
subscription cleanup; the microtask move guard makes drag & drop safe; `computed` deduping by
outcome doubles as a selector; ADR/docs discipline is excellent.

## Bug found and FIXED on this branch

**Nested bindings inside `view`/`each` render functions threw on the first re-render** (verified
with a runtime probe): the render re-ran inside `set()` notification with no active mount scope, so
any nested `text()`/`on()`/`view()`/`each()` threw a misleading error, the region was left emptied,
and the exception escaped from the unrelated `set()` call site. Worse, if the `set` ran while
another component was synchronously mounting, the nested binding silently bound to the wrong
component's scope.

Fix (implemented, all tests green):

- `component.js`: extracted `runInMountScope(scope, run)`; `connectedCallback` uses it.
- `state.js`: each live region owns a **render scope** — every rebuild disposes the previous
  render's nested subscriptions, then runs the render inside `runInMountScope`. Scope reuses the
  owning component's host so `useState` resolves correctly during re-renders. Region disposal is
  registered with the component, so everything still ends at unmount. Nested regions compose.
- Five regression tests added to `lib/test/state.test.js` (t33–t37); docs and ADR updated to match.

Design note for later: a subscription made in a render lives until the region's _next rebuild_, not
tied to individual DOM nodes. Equivalent for unkeyed full rebuilds, but keyed `each`
(`todo/state-enhancements.md`) will need per-item ownership.

## Remaining issues from the review

Ranked by how soon developers would hit them. **Update 2026-07-11:** items 4, 5, and most of 7 are
now fixed — see _Second fix round_ at the end.

1. **No error isolation in `set()`** — one throwing subscriber aborts notification of all remaining
   subscribers and propagates to the setter. Should catch-and-report per subscriber.
2. **No batching → glitches** — consecutive `set`s expose inconsistent intermediate combinations to
   `computed` (e.g. new empty `items` with the old `selectedIndex`) and render them into the DOM.
   Listed as an enhancement in `todo/state-enhancements.md`; is really a correctness prerequisite
   for computed states over co-updating states.
3. **`useState` in event handlers** — resolves from `document` (no mount scope), so page-wide states
   resolve but component-scoped ones throw. Works-or-breaks depending on where the state was
   initialized; confusing.
4. **Portaled DOM (modals, toasts appended to `body`)** — can't see component-scoped state from its
   logical owner. Combined with no-rebind-on-move, guidance collapses to "use page-wide state".
5. **Unkeyed `each`** — inputs lose focus/IME/cursor on every rebuild. Known
   (`todo/state-enhancements.md`); interacts with the move-rebinding question
   (`todo/moved-component-state-scope.md`) — decide together.
6. **Page-wide state is immortal** — no disposal API, no per-route lifetime, no reset for tests
   (`state.test.js` works around it with unique names per test).
7. **Smaller edges** — stringly-typed names (typos surface only at runtime), shadowing can silently
   fork state for a subtree, zombie states (provider unmounts, holders keep a working reference),
   `asNodes` silently drops objects/functions, `liveRegion` loop crashes if outside code removes the
   end comment, no cycle guard on subscribers that `set`, `StateSubscription` isn't `composed` (no
   reach out of shadow roots).

## Simplification research — do real apps need all this?

**Conclusion: the reactive surface is fine; the plumbing is the complexity.** The six helpers +
`computed` map exactly onto what small/medium SPAs need (text, conditional fragment, list, derived
value, shared state, async load, no leaks). Nearly every user-facing rule traces back to two
architectural decisions:

- **Decision A — named, DOM-event-resolved, subtree-scoped state** (`initState`/`useState`).
  Generates: namespace rule + lint rule, init-before-use ordering, shadowing, init-once warning,
  zombie states, the moved-component todo, the portal blind spot, the event-handler asymmetry, the
  test-isolation problem. Most of the review issues come from this one decision.
- **Decision B — subscriptions exist only inside mounts.** Generates: mount-scope stack, render
  scopes, the before-first-`await` rule, and forces a component to exist just to subscribe (the test
  suite's `probe` component exists solely for this).

Everything Decision A provides — per-instance state, lifetime tied to the component, sibling
independence — falls out of ordinary JS closures once state is a plain value. Name lookup only adds
_getting a reference without being handed one_, and the issue list above is its price.

Ecosystem evidence: Svelte 5 deprecated its store machinery for "state is a plain value exported
from a module" (runes); VanJS (~1kB) has plain-value states with no lookup, no scoping, no component
lifecycle; Zustand/Preact signals/Jotai are all "import or pass the value". None ship DOM-scoped
resolution.

### Options considered

- **S1 (recommended): states become plain values; delete named lookup.** `state(initial)` returns
  the same helper. Page-wide → export from a module; per-instance → create in `onMount`, pass to
  children as args. Deletes the event protocol, `initState`/`useState`, name validation + lint rule,
  shadowing, zombies, `todo/moved-component-state-scope.md`, and fixes the portal + event-handler +
  test-isolation issues by removal. Cost: prop threading in deep trees (module scope covers ambient
  state); loses cross-island by-name interop (rare; can return later as an opt-in bridge).
- **S2 (spike later, not now): connectedness-based GC instead of mount ownership** (VanJS-style
  pruning of bindings whose anchor node left the document). Would delete the mount-scope machinery
  and make components optional — but trades for VanJS's documented gotchas (bindings in detached DOM
  collected if state changes before connect; async construction hazards; non-DOM `on(fn)` still
  needs manual disposal). Current ownership model is now sound and is imp's differentiator; keep.
- **S3: trim helpers** — done: `update` was folded into `set`, which now dispatches on a function
  argument as the updater form.
- **S4: no subscriptions, explicit `render()` calls** — what the old test app did; the floor, not
  recommended (focus loss, scattered manual calls).

### Recommendation

Do S1. Removes ~half the user-facing rules and the sharpest review findings by deletion, makes
dependencies visible in call signatures (more aligned with imp's explicitness principle), and
matches the ecosystem's direction. Keep Decision B and the component lifecycle. Revisit S2 only if
"must wrap in a component to subscribe" proves annoying in practice.

### Sources

- VanJS advanced topics (GC of state bindings): https://vanjs.org/advanced
- VanJS 1.1.0 GC discussion: https://github.com/vanjs-org/van/discussions/81
- Svelte, Introducing runes: https://svelte.dev/blog/runes
- Svelte tutorial, universal reactivity: https://svelte.dev/tutorial/svelte/universal-reactivity
- Svelte discussion, sharing reactive state: https://github.com/sveltejs/svelte/discussions/17603

## Second fix round (2026-07-11)

Implemented on this branch after a follow-up review:

- **Keyed `each(renderItem, getKey)`** — per-item records with their own cleanup lists; unchanged
  items (structural comparison) keep their DOM, changed items re-render individually, removed items
  dispose their nested bindings, reorders move existing nodes (`moveBefore` when available). Fixes
  issue 5; the per-item ownership question from the render-scope design note is answered by the
  record-scoped cleanups. Unit tests t38–t45 plus a browser spec (`lib/test/keyed.spec.js`) proving
  typed input text survives sibling updates.
- **Update-cycle guard** — `set` throws after 100 nested notifications instead of overflowing the
  stack when states set each other in a loop.
- **`StateSubscription` is now `composed`** — resolution escapes shadow roots an embedder wraps imp
  components in.
- **`valuesEqual` bails out on cyclic values** (treated as unequal) instead of recursing forever on
  rebinds.
- **`each` reports non-array values** (`null`/`undefined` still render as empty) and keyed `each`
  reports duplicate keys while still rendering every item; `each` validates its arguments.
- **Clearer zombie-binding error** — a failed rebind after a move now says the kept state still
  serves `get`/`set` but is invisible at the new position.
- **`imp/state-setup-before-await` lint rule** — flags `initState`/`useState` placed after an
  `await` in an async `onMount`, the silent page-wide-state trap from issue list item 7.
- **Docs hardening for newcomers** — keyed `each` guidance, the input-inside-a-region focus trap,
  computed-state glitching and "co-changing values live in one state", the headless-component
  pattern for non-UI subscribers, and passing helper objects to DOM rendered outside the provider's
  subtree (the portal recipe, issue 4).

Still open, deliberately: page-wide state lifetime (issue 6) and the S1 simplification decision.

## Third round (2026-07-11, later)

- **Batching rejected for good** (was issue 2): recorded in `adr/event-propagated-state.md`, removed
  from `todo/state-enhancements.md`. The documented answer is a ladder: co-changing values in one
  state → ordered sets → a derived display state coalesced per microtask by a headless component
  (`docs/state.md`, _Updating more than one state_).
- **Error boundaries implemented** (new `adr/error-boundaries.md`): `onError(error, ...args)`
  definition entry; mount failures (sync + async) dispatch a bubbling, composed, cancelable
  `ComponentError` event and the nearest boundary renders the fallback, one error per mounted
  period; unhandled keeps the old log-and-placeholder behavior.
- **Per-subscriber error isolation** (was issue 1): `set` guards each subscriber (cycle error still
  propagates via marker), consumer fan-out likewise; keyed `each` skips a throwing item render;
  component teardown isolates each cleanup and `onUnmount`.
- **Router/lazy-modules groundwork**: `todo/router.md` now requires route-lifetime resources to be
  scoped to the route root component (no module-scope `initState` in lazy modules) and names the
  outlet/route root as the error boundary for failed chunks; `docs/state.md` gained the
  screen-scoping guidance.
