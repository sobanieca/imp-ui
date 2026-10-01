# Focus survives a change - the focus stays where the person acts

## Context

A keyboard user and a screen reader user follow the focus. When the focused element leaves the page
or turns disabled, the browser moves the focus to the `<body>`. A screen reader then says nothing,
and the next Tab starts from a place that the person did not choose. A keyboard test of the todo
example found this after five common actions: a submit, a toggle in a list, a button that disabled
itself, a delete that closed a dialog and changed the route, and a sign-out.

Each case has the same cause. imp, or the app, replaced or disabled the element that had the focus.

- **A native `disabled` drops the focus.** A button that is busy during its own request, or that
  disables itself when its work is done, loses the focus at that moment.
- **A keyed `each` renders a changed item again.** The new DOM of the item replaces the old DOM, and
  the focused element inside it goes with it.
- **The sign-in layout of `shell` replaces the chrome.** The focused element is removed.

## Decision

**imp keeps the focus on the element that the person acted on, or on its replacement.**

- **A focused `button` keeps the focus when it turns disabled or loading.** It takes
  `aria-disabled="true"` and ignores a click. When the focus leaves it, it takes the native
  `disabled`. A button that turns disabled while it has no focus takes the native `disabled` at
  once.
- **A keyed `each` restores the focus into an item that it renders again.** Before the update, it
  finds the item of the focused element by a walk up from that element, through a map from each top
  node to its item, so the cost does not grow with the number of items. It records the path from the
  item root to the focused element. After the update, it focuses the element at the same path in the
  new DOM. When the item goes away, it uses the item that now holds the same position, or the last
  item. The host of a component delegates the focus, so the path can end at a component. See
  `focus-delegation.md`.
- **`shell` moves the focus when its layout changes.** When the chrome goes away, the focus goes to
  the centred region. When the chrome comes back, it goes to the main region. The first layout, and
  the end of a `wait` verdict, move nothing, so the skip link stays the first stop after a page
  load.

## Consequences

- The `aria-disabled` path is a judgement call under `browser-support-baseline.md`. The platform has
  no disabled state that keeps the focus. The button blocks a click in JavaScript for the short time
  that it keeps the focus. That is a state toggle, not a copy of `disabled`. The native attribute
  takes over as soon as the focus leaves.
- A busy button stays in the Tab order while it has the focus. A screen reader announces it as
  unavailable and busy.
- A focus restore in `each` finds the element by its place, not by identity. Each step of the path
  holds the position among the children, the tag and the class. A step first takes the child at the
  same position when its tag and class match. So a class that toggles on the focused control, such
  as a done marker, does not break the match, because the position still fits. When the position
  does not fit, it takes the first sibling with the same tag and class. So an optional element in
  one item, such as a description or a tag, does not shift the match in the next item. When neither
  fits, it takes the child at the same position when at least the tag matches, and it stops at the
  last element it found otherwise.
- An app that moves the focus on a route change must do it after the router has put the new screen
  in place. An open dialog on the old screen makes the page inert until then. The routing docs show
  the frame that does this in a microtask.
