# Development checks: on under `imp start` and `imp test`, folded out by `imp build`

## Context

Some mistakes are silent in the browser. A node that a component passes into another component moves
into the shadow root of that component. The styles of the caller stop at the boundary, so the box
renders without its CSS, and nothing reports it. A lint rule cannot see this boundary. It reads one
file, and the callee is often in another file. The node can also arrive through a prop, or from a
`view` that renders later. A lint rule also flags correct code, when two components in one file
share a class name. The runtime knows the truth: which component created a node, where the node
ended up, and whether a rule of the creator matches it.

Such a check costs work on every render, and a production bundle must not carry it. imp already
folds a build flag out of the build, see `build-flags.md`. So there is a precedent for code that
exists in development only.

## Decision

A development check in the library runs behind `globalThis.__IMP_DEV__ === true`, written in full at
the call site. `imp start`, `imp preview` and the e2e page of `imp test` inject a script that sets
the global to `true` before any module runs. The unit test runner of `imp test` sets it on its DOM
environment. `imp build`, `imp preview --output` and the service worker build pass an esbuild
`define` that replaces the expression with `false`. The minifier drops the branch. A module that
only a dropped branch imports leaves the bundle with it.

The condition stands at the call site, not behind a helper function. esbuild folds a constant, and
it does not inline a function call. A helper would keep the check in the bundle. The check itself
lives in one module, `styles-boundary.js`, so the folded bundle carries none of it.

The first check is the styles boundary. In development, an element factory records the component
that is rendering as the creator of each element. A component renders in `setup`, `loading` and
`error`, and later in a `view` or an `each` that it wrote. When a component places nodes in its
shadow root, imp compares the creator of each element with the component that now holds it. When
they differ, and a rule of the styles of the creator matches the element, imp logs one warning per
rule. The warning names both components and the rule.

## Consequences

- A silent CSS failure has a message in development, in the console and in the session log. The
  message names the two components and the rule. It fires for a callee in another file, for a node
  passed through a prop, and for a node that a `view` or an `each` renders later.
- A production bundle holds no check, no message and no cost. A test asserts that the built output
  of a component contains no read of `__IMP_DEV__`.
- The check is precise about styles, not about intent. A class that no rule matches never warns, so
  a class used as a test hook stays quiet.
- A new development check follows the same pattern: one module, the full condition at the call site,
  and no work at module scope.
- Every path that runs an app has to set the global, or the checks stay off. That is the dev server,
  the preview, the e2e page and the unit test DOM.
