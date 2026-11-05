# custom-components - the rules that make a component of yours fit next to a standard one

`imp/std` does not cover every app. A kanban board, a product tile, a seat map or a chart more
advanced than the built-in one is yours to write with `component`, see [components](components.md)
for the mechanics. **First check the list of standard components that `imp skill` prints**, see
[std](std.md). A bug report, a notification bell, a confirmation toast or a theme menu already
exists there. Do not write a second one. This page is the contract that a standard component follows, so that yours
follows it too: theme, direction, words, accessibility, props. Check every item before you consider
a component done.

## Compose standard components, do not re-skin them

A component of yours is a new **arrangement**, not a new look. Its own CSS places things: grid,
flex, position, size of a canvas or a board. Every control inside it is a standard one.

- **Every control is a standard component.** A button is `button`, a link is `link`, an icon-only
  action is `button({ square: true, label })`, a choice is `segmented`, `radioGroup` or `select`, a
  switch is `toggle`, a modal is `dialog`, a short message is `text`. Never write a `button`, `a` or
  `input` from `imp/html` with your own colours, radius, padding or hover rules.
- **Never restyle a standard component from outside.** No wrapper that paints a background, a border
  or a radius on it. No `--imp-*` property set in your `styles` to change it. Both make one control
  look different from the same control elsewhere in the app.
- **The theme owns the look.** Want pill buttons, rounder inputs, a softer surface, another accent?
  Change the token in the theme, see [theming](theming.md). The whole app follows, every standard
  component together.
- **A size or a shape that no prop and no token offers is not available.** Use what the library
  gives. Do not copy the look of a standard component into a custom element to get one.
- What is genuinely yours, such as the tile of a kanban card or a seat on a map, follows the token
  table below, so it still matches the standard components next to it.

## Theme: every value is a token

Read every colour, length, radius, shadow and font from an `--imp-*` custom property, with its
fallback. The full list is in [theming](theming.md). Never write a literal where a token exists.

| You draw                 | Token                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Panel background         | `color-surface`                                                   |
| Page behind a panel      | `color-surface-sunken`                                            |
| Tint under a pointer     | `color-surface-hover`                                             |
| Text, muted text         | `color-text`, `color-secondary`                                   |
| Link                     | `color-primary`                                                   |
| Rule or border           | `border-width` with `color-border`                                |
| Corner of a small thing  | `radius-item`                                                     |
| Corner of a panel        | `radius-container`                                                |
| Panel on the page        | `shadow-sm`                                                       |
| Floats near its trigger  | `shadow-md`                                                       |
| Overlay above everything | `shadow-lg`                                                       |
| Gap, padding             | `space-1` to `space-6`                                            |
| Page gutter              | `space-page`                                                      |
| Type, code               | `font-family`, `font-size-*`, `font-weight-*`, `font-family-mono` |
| Transition               | `duration-fast`, `duration-medium`                                |
| Focus ring               | `focus-ring-width` with `color-primary`                           |
| Disabled control         | `disabled-opacity`                                                |

A panel of your own is this block. It is the CSS of `card`, so first check whether `card` already is
the panel you need, see [std](std.md):

```css
.panel {
  padding: var(--imp-space-4, 16px);
  background-color: var(--imp-color-surface, #ffffff);
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  border-radius: var(--imp-radius-container, 10px);
  box-shadow: var(--imp-shadow-sm, 0 1px 2px rgb(15 23 42 / 10%));
  color: var(--imp-color-text, #0f172a);
  font-family: var(--imp-font-family, system-ui, sans-serif);
}

.panel:focus-visible {
  outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-primary, #2563eb);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: none;
  }
}

@media (forced-colors: active) {
  .panel {
    border-color: CanvasText;
  }
}
```

Rules an agent gets wrong:

- **`border-width` and `focus-ring-width` are tokens, not `1px` and `2px`.** They exist so that a
  theme for low vision can widen every edge at once.
- **A transition uses `duration-fast` or `duration-medium`**, and a `prefers-reduced-motion` query
  sets it to `none`.
- **In CSS you subscribe to nothing.** A custom property updates by itself. Only a canvas needs
  `getComputedStyle(self.host).getPropertyValue('--imp-color-primary')` and
  `theme.watch(self, paint)`.
- **Forced colours replace every colour.** Never let colour alone separate two things. Build the
  focus ring from `outline`, never `box-shadow`. Restore a `transparent` border with a system
  keyword. The keywords are in [theming](theming.md).

## Direction: logical properties only

- `inline-size` / `block-size`, not `width` / `height`. `margin-inline-start`, not `margin-left`.
  `inset-block-end`, not `bottom`. `text-align: start`, not `left`. `padding-inline`, not
  `padding-left` and `padding-right`.
- Both sides of a `calc()` name the same axis. `calc(100dvi - ...)` for an inline size, never
  `100vw`.
- A prop of yours takes `start` and `end`, never `left` and `right`, as `flex` does.
- imp sets `dir` from the language, see [i18n](i18n.md). Pin the direction picker of
  [preview](preview.md) to **rtl** to catch a physical property.

## Words: the component brings its own

- Register the default wording where the component defines itself, with `defaultMessages`, never at
  module scope. Read it with `t()`. The shapes are in [i18n](i18n.md).
- Render it live. `lang.text(() => t('shop.addToCart'))` localizes again on a language change. A
  bare `t(key)` freezes at the first render. An attribute binds `computed([lang], () => t(key))`.
- Text the app passes in is already translated. Pass it through. Do not call `t()` on a prop.

## Accessibility: built in, not wired by the app

- **Render the native element wherever one exists.** `button`, `a[href]`, `input`, `dialog`. A
  `role` on a `div` changes what is announced, never what the element does. The focus and the keys
  are then yours to write.
- **Every pointer interaction has a keyboard equivalent.** Tab reaches it. Enter or Space activates
  it. Arrow keys move inside a composite widget. Escape dismisses an overlay.
- **Every interactive element has an accessible name.** An icon-only control takes a `label` prop
  that becomes `aria-label`. So does a control whose content is a picture.
- **Bind ARIA state to the state that drives the visuals.** `aria-expanded`, `aria-selected`,
  `aria-checked` and `aria-busy` read from the same state as the class that paints the change. Never
  write one once at mount.
- **An id reference stays inside one component.** `label[for]`, `aria-labelledby`, `aria-controls`,
  `aria-describedby` and `aria-activedescendant` cannot cross a shadow root. Two elements that refer
  to each other render in the same component. Decide this with the props. It cannot be retrofitted.
- **The focus ring is an `outline` on `:focus-visible`**, from `focus-ring-width` and
  `color-primary`. Never remove an outline without a replacement.
- **Test it.** An interactive component ships a test for its role, its name and its keys, see
  [testing](testing.md).

## Props: the shared contract

- A plain object is the props. Everything else is the content. Take one props object.
- Accept the documented props only. Warn on an unknown prop or value, then use the default. Forward
  nothing to an inner element.
- A prop that changes takes a state. `watch(self, ...)` it and update the one attribute in place.
- Add no outer margin. The layout around the component owns the spacing.
- A component that is a box sets `:host { display: block }`. The default host is
  `display: contents`, and a grid cannot size it.
- Name the element `my-app-*`. The `imp-` prefix is reserved.

## Done means formatted, linted, learnable and visible

- `imp fmt`, then `imp lint`, run clean: no error and no warning. See [fmt](fmt.md) and
  [lint](lint.md).
- `seat-map.skill.md` next to `seat-map.js`: import, call shape, prop table, events, the mistakes it
  invites. See [skill](skill.md).
- `seat-map.preview.js` next to it: one export per scenario. The preview page shows the skill file
  as its Skill tab. See [preview](preview.md).

Related: [components](components.md) for the definition object, `self` and the lifecycle;
[theming](theming.md) for every token and the forced-colours keywords; [i18n](i18n.md) for `t`,
`defaultMessages` and `dir`; [std](std.md) for the components you compose with;
[preview](preview.md) for the direction picker; [testing](testing.md) for a test through a shadow
root; [skill](skill.md) for the sidecar.
