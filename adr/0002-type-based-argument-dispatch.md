# 0002 — Type-based argument dispatch

**Status:** Accepted

## Context

Factory functions need a way to tell props from children from text. The common approach fixes
argument **position** — e.g. `el(tag, props, children)` — which forces callers to pass `null`/`{}`
placeholders when a slot is unused (`el('div', null, [...])`) and makes the common "just children"
case noisy. For agent-authored code (essence #3) that regularity-with-ceremony is pure token
overhead.

JavaScript values already carry enough type information to disambiguate the roles without positions.

## Decision

Arguments to `el`/tag factories are dispatched by **runtime type, in any order**:

| Arg type                                | Role                            |
| --------------------------------------- | ------------------------------- |
| array                                   | children, flattened recursively |
| string / number / bigint                | text child                      |
| `Node`                                  | child                           |
| plain object                            | props (multiple objects merged) |
| `null` / `undefined` / `false` / `true` | skipped                         |

"Plain object" means a direct `Object`/`null`-prototype object, so `Node`s, arrays, and class
instances are never mistaken for props. Skipping `null`/`undefined`/`false` lets `cond && el(...)`
and `list?.length && ...` drop out cleanly without wrapper syntax.

## Consequences

- The frequent cases read naturally: `div('hi')`, `div([a, b])`, `div({ class: 'x' }, 'hi')` — no
  positional placeholders.
- Multiple prop objects merge, so props can be spread/composed across call sites.
- The cost is a small dispatch function and one rule to learn instead of an argument signature; type
  confusion is possible in principle (e.g. an array meant as a prop value must sit inside a props
  object, not float as an argument) but rare in practice.
- `true` is intentionally skipped at child position (mirrors `false`) so boolean short-circuits are
  symmetric; a literal `"true"` string is still text.
- Anything unrecognized at child position is dropped silently rather than throwing, keeping render
  resilient to stray values.
