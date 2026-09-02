# Element-factory syntax, no JSX or templates

## Context

A framework must express the DOM structure somehow. There are three common options. JSX needs a
compile step. A tagged-template HTML string, such as `` html`<div>...` ``, is parsed at runtime. A
plain function call needs nothing. imp-ui is buildless by design. It uses plain ES modules in the
browser, and it never transpiles. That rules JSX out. A template string keeps the buildless
property, but it brings back a parser, a second syntax in the shape of HTML, and string
interpolation that is awkward to compose from code.

## Decision

imp expresses the DOM as **JavaScript function calls**:

- `el(tag, ...args)` is the one primitive.
- A shortcut per tag, such as `div`, `p` and `button`, is a thin wrapper over `el`. There are about
  80 of them, and imp generates them from a tag list.
- imp exports both from the `imp/html` specifier, see `library-import-namespaces.md`. That keeps the
  80 or so names out of the namespace of the framework itself.

There is no JSX and there is no string template. A UI helper is a lowercase function that calls
these factories and returns nodes. A component with a lifecycle wraps the same calls, see
`web-component-lifecycle.md`.

## Consequences

- There is no build step. The code that ships runs in the editor, in a test and in the browser,
  without a change.
- Composition is ordinary JavaScript. You use `map`, spread, a conditional and a helper function.
  There is no boundary between a template and an expression.
- The list of tag shortcuts is a fixed export surface. For a tag outside the list, use
  `el('tag', ...)`. To add a shortcut, edit one line of the list.
- The trade is more text against markup that looks like HTML, and an export surface of about 80
  names in one specifier. imp accepts that. An agent generates a function call most reliably, and a
  function call composes with no special case.
- imp generates a shortcut by destructuring a map. So every tag behaves exactly like `el`, and there
  is no special behaviour per tag to document.
