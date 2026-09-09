# State values are plain data: validated, structurally compared, and frozen

## Context

Every structural comparison in the state layer runs through one `valuesEqual` walk. That covers the
reconciliation of a keyed `each`, the suppression of a notification in a `computed`, the rebinding
of a consumer when a component moves, see `component-moves-rebind.md`, and the write gate of `set`
itself. That walk understands a plain object, an array and a primitive. For everything else it falls
back to the identity comparison of `Object.is`. A value outside that vocabulary never failed loudly.
It degraded in silence. Two `Date` values with equal content, inside a keyed item, counted as a
change, and imp rebuilt the DOM. A `computed` that produced a fresh value object notified again on
every set of a source. A change of provider on a move rebuilt a region whose data had not changed. A
cyclic value degraded in the same way. The walk ends on a cycle, and it always reports that the two
values differ. `event-propagated-state.md` already declares that a state holds plain data, and the
dispatch of the updater form of `set` depends on that. The documentation promises it. But nothing
enforced the rule. So a `Map`, a class instance, or a cycle, entered a state with no sound, and
broke the change detection somewhere else, later.

## Decision

A state value must be **plain data with no cycle**. That is a plain object, with `Object.prototype`
or with a `null` prototype, an array, and a primitive, which is a string, a number, a boolean, a
bigint, `null` or `undefined`. It also covers a closed set of **value objects**. imp admits a value
object under one criterion. It must be an immutable value type, with content equality that is cheap
and synchronous. These are admitted, with their rules of equality in `valuesEqual`:

- **`Date`**, by its timestamp, compared with `Object.is`, so two invalid dates are equal.
- **A Temporal type.** imp detects the feature through `globalThis.Temporal`, so its absence in a
  runtime costs nothing. Two values are equal when they have the same type, and `equals()` returns
  true. `Temporal.Duration` has no `equals`, so imp falls back to `toString()`. That makes `PT1H`
  and `PT60M` different. The error is toward a rebuild that nobody needs, and not toward an update
  that imp misses.
- **`URL`**, by its `href`.
- **`RegExp`**, by its `source` and its `flags`.

`initState` validates the initial value. `set` validates every resolved value. The helper of a
consumer delegates to the `set` of the provider, so imp covers both sides. The validation is a
recursive walk that mirrors the vocabulary of `valuesEqual`. imp reports the first problem through
`console.error`. The message names the state, and the path to the value that broke the rule, such as
`sessions[0].startedAt`. It also reports a cycle to the value itself. A value that appears twice,
with no cycle, passes. imp **still stores** the invalid value. It logs and continues, which is
consistent with the defensive rendering elsewhere, such as an `each` over a value that is not an
array. So the app continues to run, and the error points at the bug. imp does not replace the bug
with a different one.

The validation and the comparison are the **same walk**, in `inspectValue`. `set` runs one traversal
that carries a pointer to the previous value. So it validates the resolved value, and decides
structural equality, in one pass of `O(size)`. A write pays one walk, and not two. That is the same
class as the `valuesEqual` comparisons that a subscriber already pays for. That decision about
equality is the **write gate** of `set`. imp suppresses a resolved value that is structurally equal
to the current value, and not only a value that is the same reference. So a payload that imp
deserialized again, and that did not change, does not rebuild the regions that are bound to it. A
poll response, and a socket message, are the common examples.

Structural equality cannot see a change in place. imp does not take a snapshot of the previous
value. So `state.get().field = x; set(state.get())` compares the changed object against itself,
reports "equal", and drops the update with no message. So imp **deep-freezes** every value that you
read from a state. A base state freezes on store. A `computed` freezes each result that it produces.
So `get()`, `watch`, `view` and `each` always hand out a frozen value. A change to a frozen value
throws in strict mode, and every module is strict. It does not fail quietly. The freeze is
`O(size)`, and it skips a subtree that is already frozen. So structural sharing across an immutable
update keeps it cheap. A `computed` that returns a source value without a change freezes nothing
again. The freeze forces the style of update that builds a fresh object, and that is what makes the
write gate meaningful.

imp deliberately excludes these:

- **`Symbol`** is the subtle case, because identity equality would be _correct_ for it. `Object.is`
  already compares two symbols exactly. imp excludes it on two other grounds. First, a symbol is not
  serializable. `JSON.stringify` drops it, and `structuredClone` throws on it. So a symbol would
  quietly break anything that somebody later builds on a state value, such as persistence, a
  snapshot, or a transfer to a worker. Second, the validator and the `valuesEqual` walk read a
  string key only, through `Object.keys`. So an entry with a symbol _key_ is invisible to both. To
  admit a symbol value, and to ignore a symbol key, would make the support half true. A string token
  covers the enum-like case that a symbol would serve.
- **`Error`** is tempting for a state such as `myapp.loadError`. But it has no defined content
  equality. A stack is defined by the host, and it differs per throw site. A chain of `cause`
  values, and the fields of a subclass, are open ended. A comparison by `name` and `message` would
  treat two different failures as unchanged, with no message. Store the plain shape that you derive,
  such as `{ name, message }`.
- **`Map` and `Set`** are mutable collections, and not values. Content equality for a `Set` is
  quadratic with no hashing, and a key of a `Map` can be an object. A plain object and an array
  cover the shapes of the data.
- **A function** is already impossible, because of the dispatch of `set`, see
  `event-propagated-state.md`.
- **A binary object and a host object** are excluded. That covers a `TypedArray`, an `ArrayBuffer`,
  a `Blob`, a `File` and a DOM node. Equality for a `Blob` is not even synchronous. DOM belongs in
  the tree, and not in a state.

A future candidate must pass the same criterion. imp reconsiders an excluded type only against a
concrete consumer, and never in advance.

## Consequences

- imp enforces the promise about plain data where somebody breaks it, and gives a path. The problem
  does not appear later, as a rebuild that nobody can explain, or as an update that imp missed.
- imp compares a value object by content, everywhere that `valuesEqual` runs. So a freshly
  constructed but equal `Date`, Temporal value, `URL` or `RegExp`, stays quiet through a keyed
  `each`, a `computed`, a rebind of a provider, and the gate of `set`.
- A component that sets a freshly built but unchanged value does not notify a subscriber, and does
  not rebuild its `view` region. That is the common shape when a value crosses a boundary of
  serialization, such as the network, storage or a worker, and comes back as a new reference.
- Every value that you read from a state is deep-frozen. That covers the `get()` of a base state,
  and the result of a `computed`. A change to such a value throws. So the anti-pattern of a change
  followed by a set appears as a loud error, at the place of the change. It is not an update that
  imp drops in silence.
- The error is advice. imp stores the invalid value anyway. So the change detection can behave badly
  after the report. The error is the signal about the bug. It is not a guard that keeps the state
  clean.
- Every `set` pays one combined walk, which validates and compares, and one pass that freezes. Each
  one is proportional to the size of the value. imp accepts that, because it is the same complexity
  class as the structural comparisons that the model already rests on. The freeze pass also skips a
  shared subtree that is already frozen.
- A property with a symbol key stays completely outside the model. imp does not validate it, and it
  does not compare it. That follows from the walk over `Object.keys`, and the exclusion of `Symbol`
  above keeps it deliberate.
