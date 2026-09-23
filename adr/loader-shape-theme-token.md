# Loader shape: one shared drawing, selected by the loader token

## Context

Every loading state of the standard library draws the same loader. `button` shows it with `loading`.
A `progress` ring with no value is that loader alone. `table` and `list` show it while the next rows
load, and `richTextEditor` shows it while an image uploads. The catalog has no `spinner` component,
see `short-component-catalog.md`, so an app has one loader with one look. A design often asks for
another look, such as three bouncing dots. A theme is a flat map from a token name to a CSS value,
see `themable-by-default-tokens.md`. A custom property can carry a colour or a length, but no custom
property can swap an animation on its own. And `applyTheme` writes no attribute on the root, because
a descendant selector cannot cross a shadow root, so a `data-*` switch reaches no standard
component.

## Decision

The shape of the loader is a **theme token**, `loader`, with the keyword values `spinner`, `dots`,
`bar` and `pulse`. The built-in themes set `spinner`. The theme editor exposes it as a knob, next to
the radius and the shadow steps. `applyTheme` logs a warning through the shared `impLogger` for any
other value, and does not throw.

The drawing stays in **one shared module**, `std/shared/spinner.js`. It renders one `span` and
writes the four shapes in CSS alone. The ring is the base rule. Each other shape is a
`@container style(--imp-loader: <shape>)` block that replaces the border, the background and the
animation of the same element. Every element is a style container, and a custom property inherits
through a shadow root. So the parent of the loader, inside any component, carries the token, and the
query selects the block with no JavaScript and no attribute. A loader takes `currentColor` and the
`--spinner-size` of its place, whatever its shape.

There is **no loader component and no shape prop**. A component that shows a loader shows the one of
the theme. An app that wants a loader in a place of its own writes a `progress` ring with no value.

## Consequences

- One token re-skins every loading state at once, and a theme file stays a flat map of strings.
- A new shape is one CSS block in one module. No component changes.
- The look of a loader cannot differ between two places of one app. That is the point, and it is the
  same rule as the radius and the shadow steps.
- The style container query is a Baseline Newly available feature, which
  `browser-support-baseline.md` allows. Below the floor, every shape draws as the ring.
- A wrong value draws the ring and logs a warning, in the same way as a `color-surface` that imp
  cannot read.
