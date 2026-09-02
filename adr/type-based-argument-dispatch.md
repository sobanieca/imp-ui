# Type-based argument dispatch

## Context

A factory function needs a way to separate props from children, and from text. The common approach
fixes the **position** of an argument, as in `el(tag, props, children)`. That forces a caller to
pass a `null` or `{}` placeholder when a slot is unused, as in `el('div', null, [...])`. It also
makes the common case, which passes children only, noisy. For code that an agent writes, that
regular ceremony is pure token overhead.

A JavaScript value already carries enough type information to separate the roles, with no position.

## Decision

imp dispatches an argument to `el`, to a tag factory, and to a standard component, see
`standard-component-library.md`, by its **runtime type, in any order**. One shared `splitArgsByType`
does this:

| Arg type                                | Role                            |
| --------------------------------------- | ------------------------------- |
| array                                   | children, flattened recursively |
| string / number / bigint                | text child                      |
| `Node`                                  | child                           |
| plain object                            | props (one object per call)     |
| `null` / `undefined` / `false` / `true` | skipped                         |

A plain object is a direct `Object`, or an object with a `null` prototype. So imp never mistakes a
`Node`, an array or a class instance for props. imp skips `null`, `undefined` and `false`. So
`cond && el(...)` and `list?.length && ...` drop out cleanly, and they need no wrapper syntax.

## Consequences

- The frequent cases read naturally: `div('hi')`, `div([a, b])` and `div({ class: 'x' }, 'hi')`.
  There is no positional placeholder.
- Pass exactly one props object per call. A merge of several objects overwrites a structured key,
  such as `class` and `style`, with no message. So a second props object is a usage error. The
  runtime warns and applies the last value. The `single-props-object` rule of `imp lint` catches it
  statically, for a standard component and for an element factory. Compose the props into one object
  before the call, as in `div({ ...base, ...extra }, ...)`.
- The cost is a small dispatch function, and one rule to learn in place of an argument signature.
  Type confusion is possible in principle. For example, an array that you mean as a prop value must
  sit inside a props object, and it must not float as an argument. In practice this is rare.
- imp skips `true` at a child position, on purpose. That mirrors `false`, so a boolean short-circuit
  is symmetric. The literal string `"true"` is still text.
- imp drops an unrecognized value at a child position in silence. It does not throw. So a stray
  value does not break the render.
- The dispatch reaches one level into the props. A **prop value with the shape of a state**, which
  has a `get` function and a `watch` function, see `event-propagated-state.md`, means a live binding
  and not a literal value. A state helper is itself a plain object. So a state that you pass as a
  standalone argument would look like a props object. imp detects that case first, reports it, and
  skips the value.
