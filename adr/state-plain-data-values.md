# State values are plain data: validated, structurally compared, and frozen

## Context

Every structural comparison in the state layer — keyed `each` reconciliation, `computed`
notification suppression, consumer rebinding on component moves (`component-moves-rebind.md`), and
the `set` write gate itself — runs through one `valuesEqual` walk that understands plain objects,
arrays, and primitives, and falls back to `Object.is` identity for everything else. A value outside
that vocabulary never fails loudly; it silently degrades: two content-equal `Date`s in a keyed item
counted as a change and rebuilt DOM, a `computed` producing a fresh value object re-notified on
every source set, and a provider switch on a move rebuilt regions whose data had not changed. Cyclic
values degrade the same way — the walk terminates on them but always reports unequal.
`event-propagated-state.md` already declares that state holds plain data (the `set` updater-form
dispatch depends on it) and the docs promise it, but nothing enforced the rule, so a `Map`, a class
instance, or a cycle entered state without a sound and broke change detection somewhere else, later.

## Decision

State values must be **plain data without cycles**: plain objects (`Object.prototype` or `null`
prototype), arrays, primitives (string, number, boolean, bigint, `null`, `undefined`) — and a closed
set of **value objects**, admitted under one criterion: an immutable value type with cheap,
synchronous content equality. Admitted, with their equality rules in `valuesEqual`:

- **`Date`** — by timestamp, compared with `Object.is` so two invalid dates are equal.
- **Temporal types** (feature-detected via `globalThis.Temporal`, so their absence in a runtime
  costs nothing) — same type and `equals()`; `Temporal.Duration`, which has no `equals`, falls back
  to `toString()`, so `PT1H` and `PT60M` count as different — erring toward a spurious rebuild, not
  a missed one.
- **`URL`** — by `href`.
- **`RegExp`** — by `source` and `flags`.

`initState` validates the initial value and `set` validates every resolved value (the consumer
helper delegates to the provider's `set`, so both sides are covered) with a recursive walk mirroring
`valuesEqual`'s vocabulary. The first offense is reported via `console.error`, naming the state and
the path to the offending value (`sessions[0].startedAt`), including a self-reference cycle; a value
shared twice without a cycle passes. The invalid value is **still stored** — log-and-continue,
consistent with the defensive rendering elsewhere (`each` on a non-array) — so the app keeps running
while the error points at the bug rather than replacing it with a different one.

Validation and comparison are the **same walk** (`inspectValue`): `set` runs one traversal that
carries a pointer to the previous value, so it validates the resolved value and decides structural
equality in a single `O(size)` pass — the write pays one walk, not two, the same class as the
`valuesEqual` comparisons subscribers already pay. That equality decision is the `set` **write
gate**: a resolved value structurally equal to the current value is suppressed, not just a
referentially identical one, so a freshly deserialized-but-unchanged payload (a poll response, a
socket message) does not rebuild the regions bound to it.

Structural equality cannot see an in-place mutation — the previous value is not snapshotted, so
`state.get().field = x; set(state.get())` compares the mutated object against itself and reports
"equal", silently dropping the update. Every value read from state is therefore **deep-frozen**: a
base state freezes on store, a `computed` freezes each result it produces, so `get()`, `watch`,
`view`, and `each` always hand out frozen values, and mutating one throws in strict mode (all
modules are) instead of failing quietly. Freezing is `O(size)` but skips already-frozen subtrees, so
structural sharing across immutable updates keeps it cheap — a `computed` returning a source value
untouched re-freezes nothing; it forces the fresh-object update style that makes the write gate
meaningful.

Deliberately excluded:

- **`Symbol`** — the subtle case, because identity equality would be _correct_ for it (`Object.is`
  already compares symbols exactly). It is excluded on two other grounds. First, symbols are
  non-serializable: `JSON.stringify` drops them and `structuredClone` throws, so they would quietly
  poison anything later built on state values — persistence, snapshots, transfer to a worker.
  Second, the validator and `valuesEqual` walk string keys only (`Object.keys`), so symbol-_keyed_
  entries are invisible to both; admitting symbol values while ignoring symbol keys would make
  support half-true. String tokens cover the enum-like use case symbols would serve.
- **`Error`** — tempting for `myapp.loadError`-style states, but it has no defined content equality:
  stacks are host-defined and differ per throw site, `cause` chains and subclass fields are
  open-ended, and comparing by `name` + `message` would silently treat distinct failures as
  unchanged. Store the derived plain shape (`{ name, message }`) instead.
- **`Map` / `Set`** — mutable collections, not values; `Set` content equality is quadratic without
  hashing and `Map` keys may be objects. Plain objects and arrays cover the data shapes.
- **Functions** — already impossible by the `set` dispatch (`event-propagated-state.md`).
- **Binary and host objects** (`TypedArray`, `ArrayBuffer`, `Blob`, `File`, DOM nodes) — `Blob`
  equality is not even synchronous; DOM belongs in the tree, not in state.

Future candidates must pass the same criterion; an excluded type is reconsidered only against a
concrete consumer, not speculatively.

## Consequences

- The plain-data promise is enforced where it is broken, with a path, instead of surfacing later as
  unexplained rebuilds or missed updates.
- Value objects are compared by content everywhere `valuesEqual` runs, so freshly constructed but
  equal `Date`/Temporal/`URL`/`RegExp` instances stay quiet through keyed `each`, `computed`,
  provider rebinds, and now the `set` gate itself.
- A component that re-sets a freshly built but unchanged value — the common shape when a value
  crosses a serialization boundary (network, storage, worker) and comes back as a new reference — no
  longer notifies subscribers or rebuilds its `view` region.
- Every value read from state — a base state's `get()`, a `computed`'s result — is deep-frozen;
  mutating it throws, so the mutate-then-set anti-pattern surfaces as a loud error at the mutation
  site instead of a silently dropped update.
- The error is advisory: the invalid value is stored anyway, so change detection may misbehave after
  the report — the error is the bug signal, not a guardrail that keeps the state clean.
- Every `set` pays one fused validate-and-compare walk plus a freeze pass, each proportional to the
  value's size, accepted as being in the same complexity class as the structural comparisons the
  model is already built on — and the freeze pass skips already-frozen shared subtrees.
- Symbol-keyed properties remain outside the model entirely — not validated, not compared — which is
  a consequence of walking `Object.keys`, kept deliberate by the `Symbol` exclusion above.
