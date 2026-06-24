# Architecture Decision Records

Each ADR captures one architectural decision: the context that forced it, the choice made, and the
consequences. They are append-only history — when a decision changes, add a new ADR that supersedes
the old one rather than editing it in place.

Format per record: **Status · Context · Decision · Consequences**. Status is one of `Accepted`,
`Superseded by NNNN`, or `Proposed`.

## Rendering phase

| #                                            | Title                                             | Status   |
| -------------------------------------------- | ------------------------------------------------- | -------- |
| [0001](0001-real-dom-no-virtual-dom.md)      | Real DOM, no virtual DOM                          | Accepted |
| [0002](0002-type-based-argument-dispatch.md) | Type-based argument dispatch                      | Accepted |
| [0003](0003-element-factory-syntax.md)       | Element-factory syntax, no JSX or templates       | Accepted |
| [0004](0004-property-first-prop-model.md)    | Verbatim attribute names, property-first fallback | Accepted |
| [0005](0005-special-prop-namespaces.md)      | Special prop namespaces: class, style, events     | Accepted |
