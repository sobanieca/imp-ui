# Accessibility - an a11y baseline for the standard library

Make the standard component library (`todo/stdlib-components.md`) accessible by default, so an app
built entirely from stdlib components clears the common WCAG bar without the app author wiring ARIA,
focus, or keyboard handling by hand. Accessibility is a property of the components imp ships, not
something each app re-implements - the same all-in-one argument that justifies the stdlib justifies
owning its a11y contract.

## Why imp owns this

Correct ARIA roles, focus management, and keyboard interaction are exactly the cross-cutting,
easy-to-get-wrong plumbing imp exists to absorb. imp assumes app code is written by AI agents; an
agent composing `modal`, `tabs`, and `menuList` should inherit a working accessibility story from
the components, not be expected to remember every ARIA authoring-practices detail per call site.
Baking the baseline into the stdlib means every app gets it for free and consistently.

## The baseline every interactive component must meet

Define one accessibility contract the stdlib is held to (this resolves the "Accessibility baseline"
open question left in `todo/stdlib-components.md`):

- **Semantic roles.** Prefer native elements (`button`, `a[href]`, `input`, `<dialog>`) so roles and
  states come from the platform; add ARIA roles only where no native element fits (`tabs`, `tree`,
  `menuList`).
- **Keyboard operability.** Every interaction reachable by pointer is reachable by keyboard -
  Tab/Shift-Tab order, Enter/Space activation, Arrow-key navigation for composite widgets (`tabs`,
  `radioGroup`, `menuList`, `tree`, `pagination`), Escape to dismiss overlays.
- **Focus management.** Overlays (`modal`, `drawer`) trap focus while open, restore focus to the
  invoking element on close, and are opened with focus moved into them - shared through the overlay
  management seam the stdlib already needs (`todo/stdlib-components.md` "Overlay management" open
  question), not re-rolled per component.
- **State wiring.** `aria-expanded`, `aria-selected`, `aria-checked`, `aria-current`,
  `aria-invalid`, `aria-busy`, `aria-live` for feedback (`alert`, `toast`, `spinner`) reflect the
  component's reactive state automatically - they bind to the same states that drive the visuals
  (`adr/event-propagated-state.md`), so they can never drift from what is shown.
- **Labels & descriptions.** Inputs associate a `<label>` (or `aria-label`/`aria-labelledby`);
  icon-only controls require an accessible name; error/help text links via `aria-describedby`.
- **Visible focus & motion.** A visible focus indicator built from `--imp-*` tokens
  (`adr/themable-by-default-tokens.md`) that survives theming, and `prefers-reduced-motion`
  respected by any component that animates.

## Router & app-level concerns

Some a11y concerns live below the component layer and pair with other items:

- **Route focus & scroll.** The router already resets scroll to the top on push navigation
  (`adr/client-side-router.md`); the remaining a11y gap is moving focus to the new view on
  navigation. A route change with no focus move strands keyboard and screen-reader users on the old
  page.
- **Live-region announcements** for route changes and toast/alert feedback, so assistive tech is
  told what changed without a full-page reload cue.

## Lint / verification (later)

Mirror imp's other static checks: consider a lint rule or check that flags obvious violations in app
code (an `img` factory call with no `alt`, an icon-only `button` with no accessible name). Full
automated a11y auditing is out of scope; a few high-signal checks that catch the common mistakes fit
imp's existing lint model. Whether to run an in-process axe-style pass over rendered stdlib
components as part of `imp test` is an open question.

## Dependencies

- The core contract depends on the standard component library (`todo/stdlib-components.md`) - it is
  the surface being made accessible - and is best defined **alongside** it rather than bolted on
  after, so every component ships accessible from its first version.
- State wiring binds to the landed state layer (`adr/event-propagated-state.md`); focus indicators
  use theme tokens (`adr/themable-by-default-tokens.md`); route focus management builds on the
  router (`adr/client-side-router.md`).
- Labels and announcements route user-facing strings through `t()`
  (`adr/translatable-by-default.md`) like the rest of the stdlib.

## ADR impact

Record an `accessible-by-default-stdlib.md` ADR: the accessibility contract every stdlib component
meets (native-first roles, keyboard operability, focus management via the shared overlay seam,
signal-bound ARIA state, labeling rules, token-based visible focus, reduced-motion), and the
deliberate scope boundary (imp guarantees a baseline for its own components and app-level route
focus; it does not audit arbitrary app markup beyond a few lint checks). Update the ADR table in
`adr/README.md`; document the a11y guarantees in `docs/`. Once accepted, remove the "Accessibility
baseline" open question from the stdlib item since it is answered here.

## Open questions

- **Contract strictness.** Is the baseline a hard guarantee every component is tested against, or a
  best-effort convention? A hard guarantee needs per-component a11y tests.
- **Automated auditing in `imp test`.** Whether to run an axe-core-style check over rendered
  components in the e2e path, and whether a pure-JS/vendored auditor exists that fits the in-process
  constraints (`adr/in-process-toolchain.md`).
- **How much is configurable.** Focus-trap and announcement behavior as fixed defaults vs.
  app-tunable props.
- **Screen-reader coverage.** Which assistive-tech / browser combinations define "supported" for the
  guarantee.
