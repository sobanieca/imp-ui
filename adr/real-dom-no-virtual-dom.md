# Real DOM, no virtual DOM

## Context

A rendering layer can produce two things. It can produce a virtual representation of the UI, which
the framework diffs against the previous one and reconciles into the DOM, in the manner of React. Or
it can produce real DOM nodes directly. The virtual-DOM route brings a diffing algorithm, a
reconciliation model, and a lifecycle for a component instance. That machinery is not small. An AI
agent, which is the main author here, and a human reader must both hold it in their heads. It is
also the source of most surprises about why a component rendered again.

The guiding principle of imp-ui is simplicity above capability, and it is deliberately boring. So
there is no new rendering algorithm. imp uses real DOM, with no diffing.

## Decision

`el(tag, ...)` and the tag factories return **real DOM `Node` objects**. There is no virtual DOM, no
diffing and no reconciliation. You compose the UI from plain functions. Each function runs and
returns the nodes that it built. A caller can hold the reference and change it directly. A component
with a lifecycle is a real custom element, see `web-component-lifecycle.md`. That is still real DOM,
and there is still no diffing.

`mount(target, view)` runs `view` once, and inserts the resulting nodes. To update DOM that already
exists, you change a specific node or attribute directly. imp never diffs markup again.

## Consequences

- There is no diff or reconcile code to write, to document, or to reason about. You inspect the
  output with the normal DOM tools.
- Direct DOM manipulation with the normal DOM APIs is a first-class, supported path.
- Nothing renders the whole tree again. So an update targets a specific node or attribute. There is
  no automatic reconciliation of children for a structural change or a list change.
- A stale reference to a node that imp later replaces is a problem that the framework does not
  protect against. That is the trade that imp accepts for simplicity.
