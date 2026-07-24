# Shadow-DOM isolation — open roots per component, styles entry

## Context

Components used to render into their host's light DOM, kept invisible to layout by one global
injected `:where(name) { display: contents }` rule. That made component boundaries soft: page
stylesheets reached into component internals, component-oriented CSS leaked across the page,
`document.querySelector` saw straight through components, and every app carried one growing global
stylesheet whose rules had to be namespaced by hand. Full isolation was chosen instead: a component
should own its DOM and its CSS outright, and everything crossing the boundary should do so through
an explicit channel. The communication channels already qualified — the state handshake and error
routing both dispatch `composed: true` custom events (`event-propagated-state.md`,
`error-boundaries.md`), designed from the start to cross shadow boundaries.

## Decision

**Every component host attaches an open shadow root, and everything the component renders lives
there.** The root is attached in the host's constructor; the placeholder, the mount output, error
fallbacks, and the placeholder re-rendered on remount all render into the shadow root — the host's
light DOM stays empty and untouched.

- **Styling is per component via a `styles` definition entry** — an optional CSS string next to
  `onMount`. It is compiled once per component into a constructable stylesheet at define time (a
  parse failure throws there, imp-branded) and adopted by every instance's shadow root. Sharing CSS
  between components is sharing strings — plain JS constants or modules composed into `styles` — not
  a framework mechanism.
- **Hosts stay invisible to layout by default.** A shared default sheet with
  `:host { display: contents }` is adopted first in every root, replacing the old global rule; a
  component's own `styles` may override it (`:host { display: block }`) since its sheet is adopted
  after the default.
- **Roots are open, not closed.** Internals stay inspectable in devtools and reachable through
  `element.shadowRoot` — the sanctioned escape hatch for tests and for deliberate reaching-in. imp
  holds no private root references and needs no internal-access API; closed mode would add ceremony,
  not protection, since imp itself would keep a capable reference anyway.
- **Everything crossing the boundary is an explicit channel.** State resolution and error routing
  ride composed, bubbling custom events and work unchanged through any depth of shadow roots.
  Inherited CSS custom properties pass through roots, so page-level theming (variables on `body`)
  keeps working. Data still enters through factory args — including DOM nodes: a parent that needs a
  handle into a child's output creates the node itself, keeps the reference, and passes it as an
  arg. There are no slots; composition stays call-time.

## Consequences

- Full two-way encapsulation: page CSS cannot reach component internals, component CSS cannot leak
  out, and `document.querySelector` no longer sees into components. A component's look ships with
  the component, so a component library carries its own styling with zero page setup.
- The global stylesheet shrinks to page-level concerns: variables, `body`, and any light-DOM content
  outside components. imp injects nothing into `document.head` anymore.
- Theming crosses the boundary only through inherited custom properties; a component that wants to
  be themable must consume variables rather than expect page rules to restyle its internals.
- Native platform couplings that cannot cross shadow boundaries are confined: form controls inside a
  component do not participate in outside `<form>`s, and `label[for]`/ARIA id references cannot
  point across the boundary — a component must keep such pairs inside itself.
- Reading a component's rendered text or DOM from outside requires piercing: `host.textContent` is
  empty by design; unit tests walk `shadowRoot`, e2e selectors use deep combinators (`>>>`).
- `onMount` code reaching for page-wide DOM (`document.querySelector`) only sees light DOM; the
  idioms are held references passed as args, `getRootNode().host` for a component's own host, and
  state for anything shared.
- Scoped custom-element registries — the platform's own answer to component-name collisions — attach
  to shadow roots, so this decision makes adopting them structurally possible later.
