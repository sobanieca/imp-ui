# Verbatim attribute names, property-first fallback

## Context

Applying props to a DOM node has two distinct mechanisms that look the same to the caller: HTML
**attributes** (`setAttribute`, always strings) and IDL **properties** (`node.x = v`, typed, live).
They diverge in important cases:

- Boolean reflection: `node.disabled = true` vs `setAttribute('disabled', '')`.
- Live form state: `value`, `checked`, `selected`, `indeterminate` only behave correctly as
  properties - the attribute is just the _default_, not the current value.
- Custom elements expose rich data through properties, not attributes.
- A handful of attributes have a read-only or detached IDL property and must go through
  `setAttribute` (`list`, `form`).
- Other frameworks invent aliases (`className`, `htmlFor`) to dodge JS reserved words, adding a
  translation table the author must memorize.

## Decision

Two rules:

1. **Prop keys are HTML attribute names, verbatim.** `class`, `for`, `data-*`, `aria-*` - exactly as
   written in HTML. No `className`/`htmlFor` aliases.
2. **Property-first with attribute fallback.** For a key `k` on node `n`: if `k in n`, assign
   `n[k] = v` (covers booleans, live form state, custom-element properties); otherwise
   `setAttribute`. A read-only property that throws on assignment falls back to `setAttribute`.
   `null`/`undefined`/`false` remove the attribute / clear the property; `true` sets a bare
   attribute when the attribute path is taken.

Exceptions: names in a small **force-attribute** set (`list`, `form`) always use `setAttribute`,
because their IDL properties are read-only or detached from the attribute.

## Consequences

- One mental model - "use the HTML name" - covers attributes, boolean props, form state, and custom
  elements without the author choosing a mechanism.
- `class`/`for`/`data-*`/`aria-*` naturally land on `setAttribute` because they are not own JS
  property names, so verbatim naming and property-first agree.
- The force-attribute set is a known, named exception list rather than scattered special cases;
  growing it is a deliberate, reviewable act.
- `class` and `style` look like plain attributes but get richer handling (objects, arrays); that is
  a separate decision (adr/special-prop-namespaces.md), layered on top of this base rule.
- Edge risk: a custom element whose property and attribute disagree in semantics will follow the
  property path; authors needing the literal attribute use the force-attribute escape or set it
  imperatively.
