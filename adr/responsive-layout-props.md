# Responsive layout props: per-breakpoint values resolved into CSS custom properties

## Context

The layout group (`standard-component-library.md`) is the part of the standard library an app leans
on hardest, and its whole job is to look different at different widths: a filter bar that is a
column on a phone and a row on a desktop, a card grid that goes one-up then three-up, a sidebar that
disappears below a certain width. imp assumes app code is written by AI agents, so the spelling has
to be one thing an agent can apply uniformly rather than a different escape hatch per component.

Three constraints shaped the mechanism:

- **A component's `styles` string is compiled once and shared** by every instance of that element
  (`shadow-dom-isolation.md`). Per-instance CSS cannot be generated there, so a per-call breakpoint
  value has to reach the stylesheet some other way.
- **Media queries cannot read CSS custom properties.** `@media (min-width: var(--x))` is not valid
  CSS and no shim changes that, so the breakpoint widths themselves cannot be theme tokens the way
  every other design value is (`themable-by-default-tokens.md`).
- **Layout must be right before script settles.** Resolving widths in JS by subscribing to a
  `matchMedia` state would paint the wrong layout first and reflow every layout node on every
  breakpoint crossing.

## Decision

**Every layout-affecting prop accepts either one value or a per-breakpoint object**, and the two are
told apart by type, exactly as props and children already are (`type-based-argument-dispatch.md`):

```js
flex({ direction: { xs: 'column', md: 'row' }, gap: { xs: 2, lg: 5 } }, filters(), results())
```

- **The scale is `xs`, `sm`, `md`, `lg`, `xl`**, at 0, 40rem, 48rem, 64rem and 80rem, and a value
  applies from its breakpoint upward. A breakpoint the object does not name **inherits the nearest
  named one below it** rather than resetting to the default, so `{ md: 'row' }` means "the default
  under `md`, a row from `md` up". A plain value is shorthand for `{ xs: value }`.
- **The widths are fixed, not themeable.** This is the one design value in imp that a theme cannot
  change, forced by the media-query limitation above. Making them themeable would mean resolving
  every layout in JS, which costs correctness before first paint; imp takes the fixed scale instead
  and says so in the docs rather than shipping a token that silently does nothing.
- **Resolution is a ladder of CSS custom properties, written per instance.** At mount the component
  validates each breakpoint's value, converts it to a CSS value, fills it forward across the
  remaining breakpoints, and writes the result as inline custom properties on its own root element
  (`--gap-xs`, `--gap-sm`, …). The shared stylesheet consumes them through one static media query
  per breakpoint, with the component's default as the `var()` fallback:

  ```css
  .root {
    gap: var(--gap-xs, var(--imp-space-3, 12px));
  }
  @media (min-width: 48rem) {
    .root {
      gap: var(--gap-md, var(--imp-space-3, 12px));
    }
  }
  ```

  Because the fill-forward happens in JS, the CSS never needs a nested fallback chain, and because
  the media queries are static, the stylesheet is still compiled once and shared.
- **Visibility is the same mechanism, not a special case.** `hideBelow` and `hideAbove` resolve into
  the same `display` ladder every component already carries, so hiding a region at a width costs no
  extra machinery and never leaves a hidden element in the accessibility tree.
- **Invalid values are ignored, not fatal.** A value outside a prop's allowed set is logged through
  the shared `impLogger` and the breakpoint below it carries on, matching the log-and-continue
  posture of the rest of the library.
- **Per-child placement lives on the child.** A layout parent cannot style a child that is itself a
  component, because `:host { display: contents }` means the child's own root - inside its shadow -
  is the real flex or grid item and no selector from the parent can reach it. So `grow` is a prop of
  the box that grows, carried by every layout box itself and written onto its own root, rather than
  a prop the parent reads off arbitrary children. A child that is not a layout component and needs
  to grow is wrapped in a `box` or a `flex`.
- **The layout boxes share one prop surface.** `box`, `flex`, `grid`, `container` and `section` all
  accept the same padding, sizing, `radius`, `shadow`, `background`, `border`, `ratio`, `grow` and
  `scroll` props on top of their own, resolved through the same ladder - so an agent that has
  learned the surface on one has learned it on all five. Spacing is a step on the theme scale and a
  size is a plain CSS length, because a page width is not spacing. **Margins are not on the surface
  at all**: space between siblings is the parent's `gap` (`standard-component-library.md`), and
  neither is positioning, which would make a layout box the wrong place to solve overlays
  (`todo/overlay-seam.md`).

## Consequences

- One spelling covers every layout prop on every layout component, so an agent that has learned
  `direction: { xs, md }` has learned `gap`, `columns`, `padding`, `justify` and `maxWidth` too.
- Responsive layout is pure CSS: no resize listeners, no subscriptions, no layout thrash on
  breakpoint crossings, and the first paint is already correct. The per-instance cost is a handful
  of inline custom properties.
- Breakpoint widths are a fixed part of imp rather than a theme's choice. An app that needs a
  different scale writes its own media queries in a component's `styles`; the standard library does
  not bend.
- `grid` deliberately exposes a **column count**, not a track template: the responsive spelling
  stays uniform because every value is a number, and an uneven layout is nested boxes rather than a
  per-cell span vocabulary. `minItemWidth` covers the common "as many columns as fit" case with no
  breakpoints at all.
- Structural swaps that CSS cannot express - a table becoming cards - are not solved here. They need
  a readable, watchable `breakpoint` value, which lands with the first component that needs one
  rather than being invented in advance.
- Adding a responsive prop to a future component means adding one declaration to its stylesheet and
  one conversion function; the resolution, fill-forward, validation and visibility handling are
  already shared.
