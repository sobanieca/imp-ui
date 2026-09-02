# Verbatim attribute names, property-first fallback

## Context

There are two ways to apply a prop to a DOM node, and they look the same to the caller. An HTML
**attribute** goes through `setAttribute`, and it is always a string. An IDL **property** goes
through `node.x = v`, and it is typed and live. The two differ in important cases:

- A boolean reflects differently. `node.disabled = true` is not `setAttribute('disabled', '')`.
- Live form state works correctly only as a property. That covers `value`, `checked`, `selected` and
  `indeterminate`. The attribute is the _default_, not the current value.
- A custom element exposes rich data through a property, not through an attribute.
- A few attributes have an IDL property that is read-only, or detached from the attribute. Those
  must go through `setAttribute`. `list` and `form` are the examples.
- Another framework invents an alias, such as `className` and `htmlFor`, to avoid a reserved word in
  JavaScript. That adds a translation table that the author must remember.

## Decision

There are two rules:

1. **A prop key is the HTML attribute name, without a change.** Write `class`, `for`, `data-*` and
   `aria-*`, exactly as in HTML. There is no `className` alias and no `htmlFor` alias.
2. **imp sets a property first, and falls back to an attribute.** For a key `k` on a node `n`: when
   `k in n`, imp assigns `n[k] = v`. That covers a boolean, live form state and a property of a
   custom element. Otherwise imp calls `setAttribute`. When a read-only property throws on
   assignment, imp falls back to `setAttribute`. `null`, `undefined` and `false` remove the
   attribute, or clear the property. `true` sets a bare attribute when imp takes the attribute path.

There is one exception. A name in a small **force-attribute** set, which holds `list` and `form`,
always uses `setAttribute`. The IDL property of such a name is read-only, or detached from the
attribute.

## Consequences

- One mental model covers everything: use the HTML name. It covers an attribute, a boolean prop,
  form state and a custom element, and the author selects no mechanism.
- `class`, `for`, `data-*` and `aria-*` arrive at `setAttribute` naturally, because they are not own
  JavaScript property names. So the exact naming and the property-first rule agree.
- The force-attribute set is a named list of exceptions, and not a set of special cases spread
  through the code. To grow it, somebody makes a deliberate change that a reviewer can read.
- `class` and `style` look like a plain attribute, but they get richer handling, with an object and
  an array. That is a separate decision, see adr/special-prop-namespaces.md. It sits on top of this
  base rule.
- There is one risk at the edge. When the property and the attribute of a custom element differ in
  meaning, imp follows the property path. An author who needs the literal attribute uses the
  force-attribute escape, or sets the attribute directly.
