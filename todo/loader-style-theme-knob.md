# Loader style - a theme knob, not a per-component choice

A loading state today draws one shape: a rotating ring, written as `.spinner` in `button.js`. The
shape is not themable. A person who edits a theme can change the radius and the shadow, but not the
loader. Make the loader a theme step, the same as `radius` and `shadow`.

## The knob

Add `loader` to `THEME_DEFAULTS` in `lib/src/theme.js`, beside `radius` and `shadow`. The value is a
step name. The default is `spinner`, so an existing theme keeps the look it has.

| Step      | What it draws                                                      |
| --------- | ------------------------------------------------------------------ |
| `spinner` | A rotating ring with one open quarter. The default                 |
| `dots`    | Three dots that fade in turn                                       |
| `bar`     | A short bar that slides along a track                              |
| `pulse`   | One shape that scales and fades, for a theme with no motion at all |

Four steps, so the knob covers the shapes that a dashboard, a CRUD screen and an internal tool ask
for. Do not add a fifth without a call site.

`theme-colors.js` gets `LOADER_LEVELS`, `loaderSteps()`, `loaderTokens(level)` and
`loaderLevelOf(tokens)`, to match `RADIUS_LEVELS` and `SHADOW_LEVELS`. `buildTokens` spreads
`loaderTokens(loader)` with the rest. The theme editor adds one `choiceField` over `loaderSteps()`,
next to the radius and shadow fields in `lib/src/theme-editor.js`.

## The tokens

A loader is a shape plus an animation, so a single token cannot carry it. The step resolves to a
small set:

- `--imp-loader-track` - the colour behind the moving part. `transparent` for `spinner`.
- `--imp-loader-thickness` - the stroke of the ring, the size of a dot, the height of the bar.
- `--imp-loader-duration` - one cycle.

The shape itself cannot be a token, because a token is a value and a shape needs its own rules and
its own `@keyframes`. So the drawing lives in one shared module, and the token set selects which
block applies. Write `lib/src/std/shared/loader-css.js`, which exports `loaderStyles()` for the
rules and `loaderNode()` for the element. It emits every step, and a `[data-imp-loader='<step>']`
attribute selects one. `applyTheme` writes that attribute on the document element, beside the tokens
it already writes.

Check the alternative first: one `@container style(--imp-loader: dots)` query per step keeps the
selection in CSS and writes no attribute. Style container queries on a custom property are Baseline
in Chrome 111, Firefox 128 and Safari 18. Confirm all four current browsers against MDN before
building, per `adr/browser-support-baseline.md`. If they hold, prefer the query. It removes the
attribute and the JavaScript that writes it.

## It applies to every loading state

The loader is one shape for the whole app, so every component that shows progress reads the same
module. Nobody re-draws a spinner. These are the call sites today:

- `button` - the `loading` prop.
- `bugReport` - the `sending` state of its send button, through the nested `button`.
- `submitButton` - `imp.form.submitting`, through the nested `button`.
- `userCard` - the `running` state of its sign-in and sign-out actions.
- `richTextEditor` - its busy state.

`spinner` and `progress`, in `todo/stdlib-components.md`, land on the same module. So does the
`aria-busy` state of any component that follows. A component must not write its own `@keyframes`.

## Accessibility

- `prefers-reduced-motion: reduce` must stop the motion of every step, not slow it down. Draw a
  static shape instead. The `pulse` step is the one that already reads well when still.
- The loader is decorative. `aria-busy` on the control carries the meaning, so the loader element
  keeps `aria-hidden="true"`. Do not give it a `role="status"`.
- A forced-colors block must keep the moving part and the track apart, because colour alone
  separates them.

## ADR impact

`adr/themable-by-default-tokens.md` lists what a theme controls. Add the loader step to it, and name
the three tokens. Record why the shape is a step and not a token: a token is a value, and a shape
needs rules and keyframes.
