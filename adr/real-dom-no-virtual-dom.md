# Real DOM, no virtual DOM

## Context

A rendering layer can produce either a virtual representation of the UI that is diffed against the
previous one and reconciled into the DOM (React-style), or real DOM nodes directly. The virtual-DOM
route brings a diffing algorithm, a reconciliation model, and a component-instance lifecycle -
non-trivial machinery that AI agents (the primary authors) and human readers must hold in their
heads, and the source of most "why did this re-render" surprises.

imp-ui's guiding principle is simplicity over capability and "boring on purpose" - no novel
rendering algorithm, and explicitly real DOM with no diffing.

## Decision

`el(tag, ...)` and the tag factories return **actual DOM `Node`s**. There is no virtual DOM, no
diffing, and no reconciliation. UI is composed from plain functions that run and return the nodes
they built; callers may hold the reference and mutate it imperatively. Components with a lifecycle
are real custom elements (`web-component-lifecycle.md`) - still actual DOM, still no diffing.

`mount(target, view)` runs `view` once and inserts the resulting nodes. Updates to already-built DOM
are made by mutating specific nodes/attributes directly - never by re-diffing markup.

## Consequences

- No diff/reconcile code to write, document, or reason about. Output is inspectable with normal DOM
  tools.
- Imperative DOM manipulation with normal DOM APIs is a first-class, supported path.
- Because there is no whole-tree re-render, updates target specific nodes/attributes directly; there
  is no automatic child reconciliation for structural/list changes.
- Holding stale references to nodes that later get replaced is a foot-gun the framework does not
  protect against - the trade-off accepted for simplicity.
