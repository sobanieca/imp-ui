# Shadow-DOM isolation - open roots per component, styles entry

## Context

A component used to render into the light DOM of its host. One global injected rule,
`:where(name) { display: contents }`, kept the host invisible to the layout. That made the boundary
of a component soft. A page stylesheet reached into the internals of a component. CSS that belonged
to a component leaked across the page. `document.querySelector` saw straight through a component.
Every app carried one global stylesheet that grew, and somebody had to give each of its rules a
namespace by hand. imp chose full isolation instead. A component must own its DOM and its CSS
completely, and everything that crosses the boundary must cross through an explicit channel. The
channels for communication already met that requirement. The handshake for a state, and the routing
of an error, both dispatch a custom event with `composed: true`, see `event-propagated-state.md` and
`error-boundaries.md`. Somebody designed both to cross a shadow boundary.

## Decision

**The host of every component attaches an open shadow root, and everything that the component
renders lives there.** imp attaches the root in the constructor of the host. The placeholder, the
output of the mount, an error fallback, and the placeholder that imp renders again on a remount, all
render into the shadow root. The light DOM of the host stays empty, and imp does not touch it.

- **Styling is per component, through a `styles` entry in the definition.** That entry is an
  optional CSS string, beside `build`. imp compiles it once per component, into a constructable
  stylesheet, at the moment when it defines the component. A parse failure throws there, with the
  imp brand on the message. The shadow root of every instance adopts that stylesheet. To share CSS
  between two components, share a string. That is a plain JavaScript constant, or a module, that you
  compose into `styles`. It is not a mechanism of the framework.
- **A host stays invisible to the layout by default.** Every root adopts a shared default sheet
  first, and that sheet holds `:host { display: contents }`. It replaces the old global rule. The
  `styles` of a component can override it, with `:host { display: block }`, because imp adopts the
  sheet of the component after the default sheet.
- **A root delegates the focus.** imp attaches it with `delegatesFocus: true`. So `host.focus()`
  reaches the control that the component rendered. It does not do nothing without a message. See
  `focus-delegation.md`.
- **A root is open, not closed.** A person can inspect the internals in the developer tools, and
  reach them through `element.shadowRoot`. That is the approved escape hatch for a test, and for a
  deliberate reach inside. imp holds no private reference to a root, and it needs no API for
  internal access. A closed mode would add ceremony, and not protection, because imp itself would
  keep a capable reference in any case.
- **Everything that crosses the boundary is an explicit channel.** The resolution of a state, and
  the routing of an error, travel on a composed, bubbling custom event. They work without a change,
  through any depth of shadow roots. An inherited CSS custom property passes through a root. So
  theming at page level, with a variable on `body`, continues to work. Data still enters through a
  factory argument. That includes a DOM node. A parent that needs a handle into the output of a
  child creates the node itself, keeps the reference, and passes it as an argument. There is no
  slot. Composition happens at the moment of the call.

## Consequences

- The encapsulation is full, and it works in both directions. Page CSS cannot reach the internals of
  a component. The CSS of a component cannot leak out. `document.querySelector` no longer sees into
  a component. The look of a component ships with the component. So a component library carries its
  own styling, and a page needs no setup.
- The global stylesheet shrinks to concerns at page level. Those are the variables, `body`, and any
  light-DOM content outside a component. imp no longer injects anything into `document.head`.
- Theming crosses the boundary through an inherited custom property only. So a component that must
  be themable consumes a variable. It must not expect a page rule to restyle its internals.
- The native couplings of the platform that cannot cross a shadow boundary are now contained. A form
  control inside a component does not join a `<form>` outside it. A `label[for]` reference, and an
  ARIA id reference, cannot point across the boundary. So a component must keep such a pair inside
  itself. The CSS `anchor-name` and `position-anchor` resolve within one tree scope, for the same
  reason. So one component must render both an element that is positioned against an anchor, and the
  anchor itself. Both are couplings by reference. They decide where a component boundary falls, and
  taste does not.
- To read the rendered text or the DOM of a component from outside, you must go through the
  boundary. `host.textContent` is empty by design, and a unit test walks the `shadowRoot`. That
  would otherwise put a deep combinator in front of every e2e selector, because an imp app has no
  other kind of element. So the page that imp gives a spec goes through a shadow root by default.
  `>>>` remains, and it names a path when a selector is ambiguous.
- Code in `build` that reaches for DOM across the page, with `document.querySelector`, sees the
  light DOM only. The idioms are these. Hold a reference and pass it as an argument. Use
  `getRootNode().host` for the host of the component itself. Use a state for anything shared.
- A scoped registry of custom elements is the answer of the platform to a collision of component
  names. Such a registry attaches to a shadow root. So this decision makes it structurally possible
  to adopt one later.
