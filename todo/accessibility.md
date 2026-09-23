# Accessibility - an a11y baseline for the standard library

Make the standard component library accessible by default, see `todo/stdlib-components.md`. So an
app that somebody builds entirely from standard components clears the common WCAG bar. The author of
the app then connects no ARIA, no focus handling, and no keyboard handling, by hand. Accessibility
is a property of the components that imp ships. It is not something that each app implements again.
The argument for a complete toolkit justifies the standard library. The same argument justifies that
imp owns the accessibility contract of that library.

## Why imp owns this

A correct ARIA role, the management of the focus, and the interaction with a keyboard, are exactly
the cross-cutting plumbing that is easy to get wrong, and that imp exists to absorb. imp assumes
that an AI agent writes the app code. An agent that composes `modal`, `tabs` and `menuList` must
inherit a story about accessibility that works, from the components. Nobody must expect that agent
to remember every detail of the ARIA authoring practices, at each call site. To put the baseline
into the standard library means that every app gets it, with no work, and in a consistent way.

## The baseline that every interactive component must meet

Define one accessibility contract, and hold the standard library to it. That resolves the open
question about an accessibility baseline, which `todo/stdlib-components.md` leaves:

- **Semantic roles.** Prefer a native element, such as `button`, `a[href]`, `input` and `<dialog>`.
  Then the roles and the states come from the platform. Add an ARIA role only where no native
  element fits, as in `tabs`, `tree` and `menuList`.
- **Operability from a keyboard.** Every interaction that a pointer can reach, a keyboard can reach.
  That covers the order of Tab and Shift-Tab, the activation with Enter and Space, navigation with
  an arrow key in a composite widget, and Escape to dismiss an overlay. The composite widgets are
  `tabs`, `radioGroup`, `menuList` and `tree`.
- **Management of the focus.** A modal overlay traps the focus while it is open. It restores the
  focus to the element that invoked it, on close. It opens with the focus moved into it. That covers
  `dialog({ modal: true })` and `drawer`. Nobody writes any of that per component, and imp shares
  none of it as its own code. It comes from the top layer of the platform, through the seam that
  `todo/overlay-seam.md` settled. A non-modal `dialog` traps nothing, by design, because the page
  behind it stays operable. It adds the one thing that the platform does not give it. **A person can
  drag it from the keyboard**, with the arrow keys on its handle. Otherwise the drag is an
  interaction for a pointer only, and the rule about operability, above, forbids that.
- **The wiring of a state.** `aria-expanded`, `aria-selected`, `aria-checked`, `aria-current`,
  `aria-invalid`, `aria-busy`, and `aria-live` for feedback, all reflect the reactive state of the
  component automatically. `alert`, `toast` and `spinner` use `aria-live`. Those attributes bind to
  the same states that drive the visuals, see `adr/event-propagated-state.md`. So they can never
  differ from what a person sees.
- **Labels and descriptions.** An input associates a `<label>`, or it uses `aria-label` or
  `aria-labelledby`. An icon-only control needs an accessible name. The text of an error, and the
  help text, connect through `aria-describedby`.
- **A visible focus, and motion.** imp builds a visible indicator of the focus from the `--imp-*`
  tokens, see `adr/themable-by-default-tokens.md`. That indicator survives a change of theme. Any
  component that animates obeys `prefers-reduced-motion`.

## Concerns of the router, and of the app

Some concerns about accessibility live below the layer of the components, and they pair with another
item:

- **The focus and the scroll on a route change.** The router already sets the scroll to the top on a
  forward navigation, see `adr/client-side-router.md`. The remaining gap in accessibility is to move
  the focus to the new view, on a navigation. A change of route with no move of the focus leaves a
  user of a keyboard, and a user of a screen reader, on the old page.
- **An announcement through a live region**, for a change of route, and for the feedback of a toast
  or an alert. So assistive technology learns what changed, and it does not need the cue of a full
  page reload.

## Lint and verification, later

Mirror the other static checks of imp. Consider a lint rule, or a check, that reports an obvious
violation in app code. Two examples are a call to the `img` factory with no `alt`, and an icon-only
`button` with no accessible name. A full automated audit of accessibility is out of scope. A few
checks with a high signal, that catch the common mistakes, fit the existing lint model of imp.
Whether `imp test` runs a pass in the style of axe, in process, over rendered standard components,
is an open question.

## Dependencies

- The core contract depends on the standard component library, see `todo/stdlib-components.md`. That
  library is the surface that somebody makes accessible. Define the contract **beside** that
  library, and do not add it afterwards. So every component ships accessible, from its first
  version.
- The wiring of a state binds to the state layer that landed, see `adr/event-propagated-state.md`.
  An indicator of the focus uses a theme token, see `adr/themable-by-default-tokens.md`. The
  management of the focus on a route change builds on the router, see `adr/client-side-router.md`.
- A label, and an announcement, route a user-facing string through `t()`, see
  `adr/translatable-by-default.md`, like the rest of the standard library.

## ADR impact

Record an ADR named `accessible-by-default-stdlib.md`. It states the accessibility contract that
every standard component meets. That covers native elements first for a role, operability from a
keyboard, management of the focus through the top layer, an ARIA state bound to a signal, the rules
about a label, a visible focus from a token, and reduced motion. It also states the deliberate
boundary of the scope. imp guarantees a baseline for its own components, and it guarantees the focus
on a route change at app level. imp does not audit arbitrary markup of an app, beyond a few lint
checks. Update the table of ADRs in `adr/README.md`. Document the guarantees about accessibility in
`docs/`. When somebody accepts the ADR, remove the open question about an accessibility baseline
from the item about the standard library, because this ADR answers it.

## Open questions

- **An automated audit in `imp test`.** Does imp run a check in the style of axe-core, over a
  rendered component, in the e2e path? Does an auditor in pure JavaScript, or a vendored auditor,
  exist that fits the constraints about running in process, see `adr/in-process-toolchain.md`?
- **How much is configurable.** Is the behaviour of the focus trap, and of an announcement, a fixed
  default? Or can an app tune it with a prop?
- **The coverage of a screen reader.** Which combinations of assistive technology and browser define
  the word "supported", for this guarantee?
