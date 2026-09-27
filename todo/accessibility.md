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
that an AI agent writes the app code. An agent that composes `dialog`, `tabs` and `menuButton` must
inherit a story about accessibility that works, from the components. Nobody must expect that agent
to remember every detail of the ARIA authoring practices, at each call site. To put the baseline
into the standard library means that every app gets it, with no work, and in a consistent way.

## The baseline that every interactive component must meet

Define one accessibility contract, and hold the standard library to it. That resolves the open
question about an accessibility baseline, which `todo/stdlib-components.md` leaves:

- **Semantic roles.** Prefer a native element, such as `button`, `a[href]`, `input` and `<dialog>`.
  Then the roles and the states come from the platform. Add an ARIA role only where no native
  element fits, as in `tabs`, `tree` and `menuButton`.
- **Operability from a keyboard.** Every interaction that a pointer can reach, a keyboard can reach.
  That covers the order of Tab and Shift-Tab, the activation with Enter and Space, navigation with
  an arrow key in a composite widget, and Escape to dismiss an overlay. The composite widgets are
  `tabs`, `radioGroup`, `menuButton`, `comboBox` and `tree`.
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

- **The focus and the announcement on a route change belong to the app.** The router sets the scroll
  to the top on a forward navigation, and leaves the focus alone, see `adr/client-side-router.md`.
  Only a screen knows whether a navigation must take the focus. The routing docs and the routing
  skill show the one component that does it for every screen: a wrapper with `tabindex="-1"` around
  the router slot, focused on a change of the path, and a visually hidden `role="status"` node that
  reads the new `document.title`. imp ships no such component, so an app that wants the behaviour
  writes those twenty lines.
- **A toast and a notice announce themselves.** `toast` keeps a `status` and an `alert` live region,
  and `notice` is one, so assistive technology learns about feedback with no work in the app.

## What the e2e suite verifies today

Two spec files in `lib/test` hold the accessibility baseline of the standard library.
`accessibility.spec.js` reads the accessibility tree of the browser, through
`page.accessibility.snapshot`, and asserts what a screen reader gets: the name of every control in a
showcase, the roles and the states of `tabs`, `radioGroup`, `toggle`, `slider`, `progress`,
`notice`, `toast`, `table`, `chart`, `menuButton` and `shell`, the description of an invalid field,
the focus ring under keyboard focus only, the overlay with no transition under reduced motion, and
the border of a control under forced colours. `keyboard.spec.js` drives the composite widgets and
the overlays from the keyboard alone: `tabs` in both directions, `radioGroup`, `comboBox`, `tree`,
`accordion`, `menuButton`, the modal `dialog`, `drawer`, the movable window, the skip link of
`shell` and the focus after a failed submit of `form`. Add a case to those files when a component
gains a role, a state or a key.

## Known gaps

- **Fix: `calendar` has no keyboard path to a slot at a chosen time.** A click on an empty column
  creates a slot at that time. From the keyboard, the day button creates an all-day slot only. That
  breaks the rule that every pointer interaction has a keyboard equivalent. In the day view and the
  week view, the arrow keys move the focus across the time slots. Enter creates a slot at the
  focused time.
- **Accepted: `tooltip` is hidden from assistive technology.** It is not linked to its control, see
  `todo/overlay-seam.md`. So its text never reaches a screen reader. The control carries its own
  accessible name. The docs and the skill of `tooltip` say that the tooltip text must never be the
  only name of a control.

## Lint and verification

imp ships a few checks with a high signal. It does not ship a full automated audit.

- **`imp lint` gets two rules.** The first reports a call to the `img` factory with no `alt`. The
  second reports an icon-only `button` with no accessible name.
- **`imp/test` ships a matcher that walks the accessibility tree** of a rendered page in an e2e
  test. It reports every control with no accessible name, and every control with no role. The walk
  already exists in `accessibility.spec.js`. The matcher makes it available to an app.
- **imp does not bundle axe-core** or another wide audit engine.
- **The theme editor checks contrast.** It reports a pair of text and background tokens that fails
  the WCAG AA ratio, see `adr/theme-editor.md`. A custom theme is where contrast breaks.

## Dependencies

- The core contract depends on the standard component library, see `todo/stdlib-components.md`. That
  library is the surface that somebody makes accessible. Define the contract **beside** that
  library, and do not add it afterwards. So every component ships accessible, from its first
  version.
- The wiring of a state binds to the state layer that landed, see `adr/event-propagated-state.md`.
  An indicator of the focus uses a theme token, see `adr/themable-by-default-tokens.md`. The routing
  docs describe the management of the focus on a route change, and it builds on `useRoute()`, see
  `adr/client-side-router.md`.
- A label, and an announcement, route a user-facing string through `t()`, see
  `adr/translatable-by-default.md`, like the rest of the standard library.

## ADR impact

Record an ADR named `accessible-by-default-stdlib.md`. It states the accessibility contract that
every standard component meets. That covers native elements first for a role, operability from a
keyboard, management of the focus through the top layer, an ARIA state bound to a signal, the rules
about a label, a visible focus from a token, and reduced motion. It also states the deliberate
boundary of the scope. imp guarantees a baseline for its own components. The focus on a route change
belongs to the app, and the routing docs show how. imp does not audit arbitrary markup of an app,
beyond a few lint checks. Update the table of ADRs in `adr/README.md`. Document the guarantees about
accessibility in `docs/`. When somebody accepts the ADR, remove the open question about an
accessibility baseline from the item about the standard library, because this ADR answers it.

## Decisions

- **The focus trap and the announcements are fixed.** No component takes a prop that tunes them. The
  platform owns the focus trap of a modal. To move the first focus into an overlay, an app sets the
  native `autofocus` attribute on the element.
- **"Supported" means these pairs of screen reader and browser:**
  - VoiceOver with Safari, on macOS and on iOS.
  - NVDA with Chrome, and NVDA with Firefox, on Windows.
  - TalkBack with Chrome, on Android.

  JAWS is not in the list.
