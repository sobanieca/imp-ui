# imp - Accessibility

An app that you build from the standard components clears the common WCAG bar. You write no ARIA, no
focus handling and no keyboard handling for it. Accessibility is a property of the components that
imp ships, so every app gets the same baseline, with no work.

This page lists what the components do for you, what stays with your app, and how imp checks both.

## What every standard component does

imp holds every interactive standard component to one contract. A test in the imp repository backs
each point, so the contract is a guarantee, and not a habit.

- **The native element comes first.** A button is a `<button>`, a link is an `<a href>`, a field is
  an `<input>`, and a modal window is a `<dialog>`. So the role, the state and the keyboard behavior
  come from the browser. imp adds an ARIA role only where no native element fits, as in `tabs`,
  `tree` and the menu of `menuButton`. imp then writes the focus and the key handling too.
- **A keyboard reaches every interaction.** Tab and Shift+Tab move between controls. Enter and Space
  activate a control. The arrow keys move inside a composite widget: `tabs`, `radioGroup`,
  `menuButton`, `comboBox` and `tree`. Escape closes an overlay. The left and right arrow keys
  follow the text direction, so they mirror in a right-to-left language.
- **A modal overlay manages the focus.** A modal `dialog` and a `drawer` move the focus in when they
  open, keep Tab inside while they are open, and give the focus back to the control that opened
  them. The browser does this for a modal `<dialog>`. imp adds no focus trap of its own.
- **A window that blocks nothing moves from the keyboard too.** A non-modal `dialog` leaves the page
  behind it usable, so it traps nothing. A person can drag it by its title bar, and can also move it
  with the arrow keys on that bar.
- **The ARIA state follows the visible state.** `aria-expanded`, `aria-selected`, `aria-checked`,
  `aria-current`, `aria-invalid` and `aria-busy` read from the same state that paints the change. So
  what a screen reader hears always matches what a person sees.
- **Feedback announces itself.** `toast` keeps a live region for status messages and one for alerts.
  `notice` is a status or an alert, by its `kind`. A `loader` announces its `label` in a status
  region when it appears. Your app writes no live region for them.
- **Every control has a name.** A field renders its own `<label>`. Its help text and its error reach
  a screen reader as its description. An icon-only control takes a `label` prop.
- **The focus is visible, and motion is optional.** Keyboard focus draws a ring from the theme, in
  `color-primary` and `focus-ring-width`. A pointer click draws no ring. The ring and the borders
  stay visible in forced-colors mode. Every animation stops when the reader asks for reduced motion.

The focus trap and the announcements have no settings. No component takes a prop that tunes them. To
move the first focus into an overlay to one element, set the native `autofocus` attribute on that
element.

## What stays with your app

The components cannot know some facts about your app. These five are yours.

- **Name every icon-only control.** Pass `label` to a `button` that shows only an icon. Give an
  `img` an `alt` text, or `alt: ''` when the image only decorates the page.
- **A tooltip is not a name.** `tooltip` is visual only. imp hides it from a screen reader, because
  it cannot point at a control inside another component. So the tooltip text must never be the only
  name of a control. Name the control itself, and let the tooltip repeat that name for a sighted
  person.
- **Move the focus when the screen changes.** The router resets the scroll on a navigation. It
  leaves the focus alone, because only your app knows which screen must take it. One small component
  around the router slot does it for every screen. See
  **[Routing](routing.md#accessibility-scroll-and-focus)**.
- **Keep your theme readable.** The built-in themes reach the WCAG AA contrast for every text color.
  A custom theme is where contrast breaks. See
  **[Theming](theming.md#how-to-check-the-contrast-of-a-theme)**.
- **Build your own components to the same contract.** See
  **[Custom components](custom-components.md#make-it-accessible)**.

## How imp checks it

imp ships three checks with a high signal. Each one finds a problem that is common and that has one
clear fix.

- **`imp lint` finds a missing name in your source.** `imp/img-alt` reports an `img` with no `alt`.
  `imp/icon-button-name` reports a button that shows only an icon and has no name. See
  **[Linting](lint.md#impimg-alt)**.
- **An e2e matcher checks the running page.** `await expect(page).toHaveAccessibleControls()` reads
  the accessibility tree of the browser. It reports every control with no accessible name, and every
  focusable element with no role. It skips an element that a screen reader cannot reach, such as a
  hidden or an inert one. See **[Testing](testing.md#how-to-check-what-a-screen-reader-gets)**.
- **The theme editor checks contrast.** It lists every text color of the theme that reads below
  4.5:1 on its background, and every pair that it cannot check. `contrastProblems` from `imp/theme`
  runs the same check in a unit test. See
  **[Theming](theming.md#how-to-check-the-contrast-of-a-theme)**.

imp does not bundle a full audit engine, such as axe-core, and it does not audit the markup of your
app beyond these checks. A full audit reports many findings that need a person to judge them. The
three checks above report only problems that are always problems, so a failure always means work.

## Supported screen readers

"Supported" means these pairs of a screen reader and a browser:

- VoiceOver with Safari, on macOS and on iOS.
- NVDA with Chrome, and NVDA with Firefox, on Windows.
- TalkBack with Chrome, on Android.

JAWS is not in the list. A component can work with JAWS, but imp does not test it there.
