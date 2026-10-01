# Joined control seam - inherited custom properties, because a host has no box

## Context

A joined `flex` row makes its children read as one control. The children are buttons, inputs, and
any component at all, such as a text field in a pager or a `menuButton` at the end of a split
button. The stepper of `textField` and the row of `segmented` are joined rows of their own. In every
case two neighbours must square the corners that face each other, and their two borders must
collapse into one line.

A component composes `button` rather than restyling a native one, which
`adr/in-page-review-capture.md` settled. So the neighbours in a row are separate custom elements,
each with its own shadow root. A stylesheet cannot reach into a child shadow root, so the parent
cannot square a child's corners directly.

Two facts about imp decide the mechanism:

- **Every component host is `display: contents`.** `component.js` applies that to every shadow root
  it makes. So a host has no layout box. A margin on a host does nothing. A `z-index` on a host does
  nothing. An `anchor-name` on a host names no box, and a panel anchored to it lands in the corner
  of the viewport.
- **A custom property inherits through a shadow boundary.** It is the one channel the platform gives
  from a parent stylesheet into a child shadow tree.

The `overflow: hidden` alternative was measured and rejected. A row with a radius and
`--imp-radius-item: 0` on its children clips the square corners for free and needs no new property.
But `focusRing` is an `outline` with `outline-offset: 2px`, so the row clips the focus ring of every
child, and clips it away completely between two children. Overlays survive the clip, because they
all promote to the top layer. The focus ring does not, and accessibility is a shipping requirement
of a component.

## Decision

A **groupable control** reads three inherited custom properties, through `groupableSeam()` in
`lib/src/std/shared/css.js`:

| Property                    | What it sets                                   |
| --------------------------- | ---------------------------------------------- |
| `--imp-corner-inline-start` | Both corners on the inline-start edge          |
| `--imp-corner-inline-end`   | Both corners on the inline-end edge            |
| `--imp-seam-shift`          | `margin-inline-start`, to collapse two borders |

Each one falls back to the value the control has on its own, so a control outside a row is
unchanged. `button` and `control-css.js` adopt the helper, so every standard button and every
standard input fits a seam with no prop.

A **row** applies `groupSeamRules(row)`, which is two rules over `row > *`:

- `:not(:first-child)` sets the inline-start corners to 0 and the shift to one negative border
  width.
- `:not(:last-child)` sets the inline-end corners to 0.

The rules select the child hosts. The properties inherit into each child shadow tree and land on the
control inside it. The structural pseudo-classes read the DOM, which a `display: contents` host does
not change, so the rules re-evaluate when a child is added or removed and no JavaScript runs.

Three further points follow from the boxless host:

- **A control lifts itself.** `seamLift()` gives the control `z-index: 1` on hover and on focus, in
  its own stylesheet. The negative shift puts the next neighbour's border over the focus ring of the
  one before it, and a `z-index` on the host could not fix that. A pressed button and a checked
  segment take `z-index: 2` through `seamKeep()`, so a hovered neighbour never covers the coloured
  border of the chosen control.
- **A panel anchors to a box of its own root, never to a host.** `anchor-name` goes on the `.box`
  element that `menuButton` owns and which has a box. The box and the trigger share every edge, so
  the geometry is the same as anchoring to the trigger, and the anchor name never has to cross a
  tree.
- **A row member that is not a component renders inside the row's own shadow root.** That is a
  segment of `segmented`. Same root means the borders match exactly with no property involved.

A `popovertarget` attribute cannot cross a shadow root either, because it resolves an id. The
`popoverTargetElement` property can. It accepts any element under a shadow-including ancestor of the
button, and the panel of `menuButton` is one. So `button` takes a `popoverTarget` element prop and
sets that property, and `menuButton` hands its panel to the trigger. The platform then owns the
toggle, the light dismiss, Escape and the top layer. imp still writes `aria-expanded` from the
`toggle` event of the panel, so a test can read the state from the DOM.

The seam properties inherit without limit, so they would reach a control inside a panel that a row
member opens. Every nested surface resets them with `seamReset()`: the panel of `anchoredStyles`,
and the panel of `dialog` and `drawer`. A component that adds a nested surface must do the same. The
lift is scoped the same way. `seamLift()` reads `--imp-seam-lift` and `seamKeep()` reads
`--imp-seam-keep`, which only a row sets, so a control outside a row keeps `z-index: auto`.

## Consequences

- One mechanism serves the trigger of a menu, the step buttons of a text field and every child of a
  joined row, and it serves a foreign component in a row. Nothing in imp measures a box or follows a
  neighbour.
- The direction is correct with no second code path, because all four corner properties and the
  shift are logical. A row is tested in LTR and in RTL.
- A component that does not adopt `groupableSeam()` keeps its own rounded corners in a row. It looks
  wrong at the seam. Nothing breaks. Adopt the helper when a component becomes a row member.
- The property set is two corners, not four. A horizontal row squares only the inline pair. Add the
  block pair when a vertical stack of joined controls has a real call site.
- A test asserts that the seam rules carry no physical property, so a `margin-left` or a
  `border-top-left-radius` cannot get in.
