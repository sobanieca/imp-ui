# Focus delegation - component hosts forward focus to the control inside them

## Context

The host of a component renders nothing itself. It attaches a shadow root, carries
`display: contents`, and has no `tabindex`. See `shadow-dom-isolation.md`. So everything focusable
that a component owns lives one shadow root deeper than the handle that a caller holds.
`host.focus()` on such a host did not throw. It focused nothing, and it reported nothing. That is
the worst failure mode.

That made composition work in one direction only. A component could nest another component and drive
it through props. But it could never put the focus back on that component, and a focus restore is
the defining behaviour of any component that opens an overlay. `bugReport` must return the focus to
the trigger that started the flow. `modal`, `drawer`, `popconfirm` and a toast action all need the
same restore. See `todo/overlay-seam.md`. There were two ways out, and neither one was acceptable.
The first was to reach through the shadow root of the nested component. That is exactly what
`shadow-dom-isolation.md` exists to prevent, and it is not possible at mount time in any case,
because the nested host has not rendered its control yet. The second was to stop composing, and to
render the markup and the CSS of the control again, locally. That is what `bugReport` did first.

The platform already owns this job. `attachShadow({ delegatesFocus: true })` forwards the focus from
the host to the first focusable element in its shadow tree. So a `focus()` method on every
interactive component would be JavaScript that stands in for a platform primitive, and
`browser-support-baseline.md` rules that out.

## Decision

**imp attaches the shadow root of every component with `delegatesFocus: true`.** imp sets it once,
in the constructor of the host, for every component that it defines. There is no choice per
component, and there is no `focus()` entry in the definition of a component.

- **A component is focusable from outside, like a native control.** `host.focus()` focuses the first
  focusable element that the component rendered. So a parent that holds the return value of a
  factory can restore the focus to it, and it does not know what the component renders.
- **No component reaches into the shadow root of another component to focus it**, and no component
  writes a focus forwarder of its own.
- **A component with nothing focusable in it stays inert.** The delegation resolves the target at
  the moment of the call. So `focus()` on such a host does nothing, and it does not throw. That is
  the same as before.

## Consequences

- Composition is symmetric. A component can drive a nested component through props, such as a state
  handle for `disabled` or for `loading`, and it can focus that component afterwards. That removed
  the reason why `bugReport` rendered its own buttons instead of composing `button`.
- An overlay component can meet the focus-restore requirement of `todo/accessibility.md` with the
  handle that it already holds. So nobody has to reconsider this decision for each component.
- `:focus` can match a host. The platform can also give the focus to the first focusable descendant
  when a person clicks a part of a host that is not focusable. The sequential tab order does not
  change. A control is reached exactly once, and not once for the host and once for itself. A test
  in the standard suite covers a host that forwards the focus to the control inside it.
- `document.activeElement` retargets to the outermost host, as it already did for a focus that was
  set from inside a component. You reach the focused element through `shadowRoot.activeElement`. A
  spec asserts the focus with `:focus` on the element that it pierced to, and not by a comparison of
  `activeElement`.
- The setting applies to every component at once, and that includes an app component. A component
  that renders something focusable is a focus target for its parent, whether or not somebody
  designed it to be one.
