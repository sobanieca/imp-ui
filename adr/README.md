# Architecture Decision Records

Each ADR captures one architectural decision: the context that forced it, the choice made, and the
consequences. Every ADR in this folder is the current, accepted state of that decision — there is no
status field. When a decision changes, replace the ADR with a new one describing the new decision;
when a decision is dropped, delete its ADR.

Conventions:

- **File name** is a short descriptive slug of the decision (`real-dom-no-virtual-dom.md`) — no
  numbering.
- **Format per record:** Context · Decision · Consequences.
- **Presence means accepted.** Nothing in the folder is a proposal or history; the folder always
  reflects what the code does (or must do).

## Rendering phase

| ADR                                                             | Decision                                          |
| --------------------------------------------------------------- | ------------------------------------------------- |
| [real-dom-no-virtual-dom](real-dom-no-virtual-dom.md)           | Real DOM, no virtual DOM                          |
| [type-based-argument-dispatch](type-based-argument-dispatch.md) | Type-based argument dispatch                      |
| [element-factory-syntax](element-factory-syntax.md)             | Element-factory syntax, no JSX or templates       |
| [property-first-prop-model](property-first-prop-model.md)       | Verbatim attribute names, property-first fallback |
| [special-prop-namespaces](special-prop-namespaces.md)           | Special prop namespaces: class, style, events     |

## CLI

| ADR                                                                 | Decision                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| [in-process-toolchain](in-process-toolchain.md)                     | fmt and lint run in-process, no subprocess            |
| [in-process-dependency-bundling](in-process-dependency-bundling.md) | Bundle deps in-process via esbuild-wasm + Deno plugin |
| [no-lockfile-exact-versions](no-lockfile-exact-versions.md)         | No lock/generated files; exact versions in code       |
