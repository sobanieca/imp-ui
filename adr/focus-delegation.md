# Focus delegation - component hosts forward focus to the control inside them

## Context

A component host renders nothing itself: it attaches a shadow root, carries `display: contents`, and
has no `tabindex` (`shadow-dom-isolation.md`). Everything focusable a component owns therefore lives
one shadow root deeper than the handle a caller holds. `host.focus()` on such a host did not throw -
it silently focused nothing, the worst failure mode there is.

That made composition a one-way street. A component could nest another and drive it through props,
but it could never put focus back on it, which is the defining behaviour of any component that opens
an overlay: `bugReport` has to return focus to the trigger that started the flow, and `modal`,
`drawer`, `popconfirm` and toast actions (`todo/overlay-seam.md`) all need the same restore. The
only ways out were to reach through the nested component's shadow root - exactly what
`shadow-dom-isolation.md` exists to prevent, and unavailable at mount time anyway, since the nested
host has not rendered its control yet - or to stop composing and re-render the control's markup and
CSS locally, which is what `bugReport` first did.

The platform already owns this job. `attachShadow({ delegatesFocus: true })` forwards focus from the
host to the first focusable element in its shadow tree, so writing a `focus()` method on every
interactive component would be JavaScript standing in for a platform primitive, which
`browser-support-baseline.md` rules out.

## Decision

**Every component's shadow root is attached with `delegatesFocus: true`.** It is set once in the
host constructor, for every component imp defines - there is no per-component opt-in and no
`focus()` entry in the component definition.

- **A component is focusable from the outside like a native control.** `host.focus()` focuses the
  first focusable element the component rendered, so a parent holding a factory's return value can
  restore focus to it without knowing what it renders.
- **No component reaches into another's shadow root to focus it**, and no component writes a focus
  forwarder of its own.
- **A component with nothing focusable in it stays inert.** Delegation resolves the target at call
  time, so `focus()` on such a host does nothing and does not throw - the same as before.

## Consequences

- Composition is symmetric: a component can drive a nested one through props (a state handle for
  `disabled` or `loading`) and focus it afterwards. That removed the reason `bugReport` rendered its
  own buttons instead of composing `button`.
- Overlay components can meet the focus-restore requirement in `todo/accessibility.md` with the
  handle they already hold, so the decision does not have to be revisited per component.
- `:focus` can match a host, and the platform may give focus to the first focusable descendant when
  a non-focusable part of a host is clicked. Sequential tab order is unaffected - each control is
  reached exactly once, not once for the host and once for itself - and a test in the standard suite
  covers a host forwarding focus to the control inside it.
- `document.activeElement` retargets to the outermost host, as it already did for focus set from
  inside a component; the focused element is reached through `shadowRoot.activeElement`, and a spec
  asserts focus with `:focus` on the pierced element rather than by comparing `activeElement`.
- The setting applies to every component at once, including app components. A component that renders
  something focusable is now a focus target for its parent whether or not it was designed to be one.
