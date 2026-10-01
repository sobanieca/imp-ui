# Accessible by default - one contract for every standard component, and three checks

## Context

imp assumes that an AI agent writes most of the code of an app. An agent that composes `dialog`,
`tabs` and `menuButton` must inherit an accessibility story that works. Nobody can expect it to
remember the ARIA authoring practices at every call site. A correct role, the management of the
focus and the keyboard interaction are cross-cutting work that is easy to get wrong. That is the
kind of work that imp exists to absorb. The argument for a complete standard library, see
`standard-component-library.md`, is the same argument for imp to own the accessibility of that
library.

Some concerns sit outside a component. Only a screen knows if a navigation must move the focus. Only
the app knows the name of an icon-only button. A custom theme can break contrast that every built-in
theme keeps. And an app can write any markup at all, which no library can make accessible for it.

## Decision

**Every interactive standard component meets one contract, and a test backs each point.** A
component ships accessible from its first version. Nobody adds accessibility after the component.

- **The native element comes first.** A button is a `<button>`, a link is an `<a href>`, a field is
  an `<input>`, and a modal window is a `<dialog>`. The role, the state and the keyboard behaviour
  then come from the platform. An ARIA role is added only where no native element fits, as in
  `tabs`, `tree` and the menu of `menuButton`, and the component then writes the focus and the key
  handling too.
- **A keyboard reaches every interaction.** Tab and Shift+Tab move between controls. Enter and Space
  activate a control. The arrow keys move inside a composite widget, which is `tabs`, `radioGroup`,
  `menuButton`, `comboBox` and `tree`. Escape dismisses an overlay. A pointer drag has a key
  equivalent, so a non-modal `dialog` moves with the arrow keys on its title bar.
- **The top layer of the platform manages the focus of a modal overlay.** `showModal()` moves the
  focus in, traps Tab and restores the focus on close, for a modal `dialog` and for `drawer`. imp
  shares no focus trap of its own, see `overlay-top-layer.md`. A non-modal `dialog` traps nothing,
  because the page behind it stays usable.
- **An ARIA state binds to the state that drives the visuals.** `aria-expanded`, `aria-selected`,
  `aria-checked`, `aria-current`, `aria-invalid` and `aria-busy` read from the same state as the
  class that paints the change, see `event-propagated-state.md`. So they cannot differ from what a
  person sees. `toast`, `notice` and `loader` are live regions, so feedback announces itself.
- **Every control has a name.** A field renders its own `<label>`, and its help and its error reach
  it through `aria-describedby`. An icon-only control takes a `label` prop. A user-facing string
  goes through `t()`, see `translatable-by-default.md`. An id reference cannot cross a shadow root,
  see `shadow-dom-isolation.md`. So a control and its label, its description or its panel are
  rendered by one component, and a panel is a prop of the component that renders its trigger.
- **The focus is visible, and motion is optional.** The focus ring comes from `color-primary` and
  `focus-ring-width`, on `:focus-visible`, so it follows a change of theme, see
  `themable-by-default-tokens.md`. The shared `forcedColors` block keeps a border and a ring in
  forced-colors mode. Every animation obeys `prefers-reduced-motion`.

**The focus trap and the announcements are fixed.** No component takes a prop that tunes them. An
app that must move the first focus into an overlay to one element sets the native `autofocus`
attribute on it. A prop per component would multiply the ways to break the contract, for no case
that `autofocus` does not cover.

**The boundary of the scope is explicit.** imp guarantees the baseline of its own components. Four
things stay with the app:

- **The focus on a route change.** The router resets the scroll and leaves the focus alone, see
  `client-side-router.md`. Only a screen knows if a navigation must take the focus. The routing docs
  and the routing skill show one component that does it for every screen: a frame with
  `tabindex="-1"` and the `region` role around the router slot. It takes `document.title` as its
  `aria-label`, and it takes the focus when the path changes. imp ships no such component, because
  its correct behaviour depends on the app.
- **The name of an icon-only control and the `alt` of an image.** Only the app knows them.
- **The contrast of a custom theme.** Every built-in theme reaches 4.5:1 for each text pair.
- **The markup that the app writes itself.** imp does not audit it beyond the checks below.

`tooltip` is hidden from assistive technology on purpose. It cannot name its control, because the
control is a host in another tree scope, and `aria-describedby` on a host with no role names
nothing, see `overlay-top-layer.md`. So the docs and the skill of `tooltip` say that the tooltip
text must never be the only name of a control.

**imp ships three checks with a high signal, and no wide audit.**

- **`imp lint` has two rules.** `imp/img-alt` reports an `img` call with no `alt` key.
  `imp/icon-button-name` reports a standard or a plain `button` whose only children are `icon` calls
  with no `label`, and whose props give no name. An icon with a `label` names the button through the
  shadow tree, so the rule accepts it. Each rule checks only what it can see in the source, so it
  never reports a false problem for props that it cannot read.
- **`imp/test` has the matcher `toHaveAccessibleControls()`.** In an e2e spec, it reads the
  accessibility tree of the browser, below the page or below one element. It reports every control
  with no accessible name, and every element in the tab order whose role is a plain container. It
  skips an element that is not in the accessibility tree: a hidden, an invisible or an inert
  element, the content of an `aria-hidden="true"` subtree, and the content of a closed `<details>`
  or `<dialog>`. Such an element is not a problem that a person meets. The same walk runs over the
  showcases of the standard library, so the library and an app use one check.
- **The theme editor checks contrast.** It lists every text and background token pair below 4.5:1,
  and every pair whose colour it cannot read, see `theme-editor.md`. The check is part of the editor
  and not of the library an app ships. The derivation of a theme keeps the built-in themes above
  that line.

imp does not bundle axe-core or another wide audit engine. A wide audit reports many findings that
need a person to judge them, and an agent that reads such a report fixes the wrong ones. Each of the
three checks reports only a problem that is always a problem.

**"Supported" means these pairs of a screen reader and a browser:**

- VoiceOver with Safari, on macOS and on iOS.
- NVDA with Chrome, and NVDA with Firefox, on Windows.
- TalkBack with Chrome, on Android.

JAWS is not in the list.

## Consequences

- An app built from standard components clears the common WCAG bar with no ARIA, focus or keyboard
  code of its own. An agent gets it by calling the components.
- The contract decides where a component boundary falls. A pair of elements that an id reference
  joins must live in one shadow root. That is settled while the props are designed, and it cannot be
  changed later without a change to the public API.
- Two spec files in the library, `accessibility.spec.js` and `keyboard.spec.js`, hold the contract.
  A new role, state or key in a component adds a case there.
- The checks are narrow on purpose. They do not find a wrong name, a bad heading order, or a
  contrast problem in the CSS of an app component. Those need a person, and the docs say so.
- A dark theme carries a `color-danger` of its own, and not the palette reference, because the
  palette red is too dark for error text on a dark surface.
- The focus on a route change is twenty lines in every app that wants it. That is the price of not
  guessing which screen takes the focus.
