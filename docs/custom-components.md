# imp-ui - Custom components

The standard library covers the controls most apps share: a button, a form, a dialog, a card. It
does not cover everything. A kanban board, a product tile, a seat map, or a chart more advanced than
the built-in one is yours to write. You write it with `component`, the same way imp writes its own. Check the gallery first: a bug
report, a notification bell or a theme menu is already there, and a second one of yours only drifts
from the first.
See **[Components](components.md)** for the mechanics: the definition object, `self`, the lifecycle,
and the styles.

This page is about what makes a component of yours fit next to a standard one. A standard component
follows the theme, reads in every language, mirrors in a right-to-left script, and works from a
keyboard and a screen reader. Yours can do the same. Follow these guidelines for every component you
build. An AI agent gets the same rules from `imp skill custom-components`.

## Read every value from the theme

Every color, length, radius, shadow, and font in a standard component comes from a design token. The
tokens are the `--imp-*` custom properties that `applyTheme` writes on the document root. They
inherit into every component through the shadow root. See **[Theming](theming.md)** for the full
list. Your styles read them the same way, so a component follows a theme change at once, with no
code.

Write a token with its fallback, as `var(--imp-color-border, #cbd5e1)`. The fallback is what the
component shows in a page with no theme applied. Never write a literal color, shadow, or radius
where a token exists. A literal value is the one thing on the page a theme cannot change.

This is the map from what you draw to the token that draws it:

| What you draw                | Token                                         |
| ---------------------------- | --------------------------------------------- |
| The background of a panel    | `color-surface`                               |
| The page behind a panel      | `color-surface-sunken`                        |
| The tint under a pointer     | `color-surface-hover`                         |
| Body text, muted text        | `color-text`, `color-secondary`               |
| A link                       | `color-primary`                               |
| A rule or a border           | `border-width` with `color-border`            |
| The corner of a small thing  | `radius-item`                                 |
| The corner of a panel        | `radius-container`                            |
| A panel on the page          | `shadow-sm`                                   |
| Something that floats nearby | `shadow-md`                                   |
| An overlay above everything  | `shadow-lg`                                   |
| A gap, a padding             | `space-1` to `space-6`                        |
| The gutter of a page         | `space-page`                                  |
| Type                         | `font-family`, `font-size-*`, `font-weight-*` |
| Code                         | `font-family-mono`                            |
| A transition                 | `duration-fast`, `duration-medium`            |
| The focus ring               | `focus-ring-width` with `color-primary`       |
| A disabled control           | `disabled-opacity`                            |

A panel of your own reads like this. It is the same CSS the `card` component uses:

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
```

Before you write a panel like this, check whether the `card` component already covers it. It usually
does. Write your own surface only when a card cannot hold what you need. See
**[Standard components](std-components.md)**.

Three tokens carry more than a look. `border-width` and `focus-ring-width` exist so contrast never
depends on color alone. Use them instead of a literal `1px` or `2px`, so a low-vision theme can
widen every edge at once. `duration-fast` and `duration-medium` time every transition. Wrap any
animation in a `prefers-reduced-motion` query, and set the transition to `none` there.

Some things draw from JavaScript, not CSS. A canvas is the common example. Read a token with
`getComputedStyle(self.host).getPropertyValue('--imp-color-primary')`, and paint again when the
theme changes, with `theme.watch(self, paint)`. See **[Theming](theming.md)**. CSS needs no
subscription: a custom property updates by itself.

Color is not always yours to keep. A Windows Contrast Theme replaces every color with the system
palette. Never let color be the only difference between two things. Build the focus ring from
`outline`, and restore a transparent border in a `forced-colors` query. The full rules and the
system color keywords are in **[Theming](theming.md)**.

## Write logical properties

Write every box in CSS logical properties. Use `inline-size` and `block-size`, not `width` and
`height`. Use `margin-inline-start`, not `margin-left`. Use `inset-block-end`, not `bottom`. Use
`text-align: start`, not `left`. A layout written this way mirrors by itself when the document
direction is right to left, and imp sets that direction from the language for you. See
**[Internationalization](i18n.md)**.

Match the axis on both sides of a calculation. A `max-inline-size` that subtracts from `100vw` ties
the text axis to the width of the screen. Write `100dvi` instead. `flex` and `stack` already follow
the direction, because their `horizontalAlign` prop takes `start` and `end`. Do the same in your own
props. Never expose `left` or `right`.

Check the result. The preview page has a direction picker. Pin it to **rtl** while you read English,
so a hardcoded `margin-left` shows up as a gap on the wrong side. See **[CLI](cli.md)**.

## Bring the words with the component

Text that belongs to a component travels with it. The **Cancel** of a dialog, the **No results** of
a list, and the **Loading** of a spinner are examples. Register the default wording where the
component defines itself, with `defaultMessages`, and read it with `t()`. An app with no translation
file then gets English, and an app that translates the key gets its own wording. See
**[Internationalization](i18n.md)** for the call shapes and the rule about module scope.

Render a translated string so it follows the language. `lang.text(() => t('shop.addToCart'))`
localizes again in place when the language changes. A bare `t('shop.addToCart')` freezes at the
first render. For an attribute such as `aria-label`, bind `computed([lang], () => t(key))`.

Text the app passes in is not yours to translate. A `title` prop arrives already translated, or as a
state the app localizes. Pass it through unchanged.

## Make it accessible

Accessibility is a property of the component, not of the app that uses it. Build it in, so every app
that renders your component clears the bar without extra work.

- **Render the native element wherever one exists.** A `button`, an `a` with an `href`, an `input`,
  and a `dialog` bring their role, states, and keyboard behavior from the browser. Add an ARIA role
  only where no element fits. A `role` on a `div` changes what is announced, never what the element
  does, so you must still write the focus and key handling yourself.
- **Give every pointer interaction a keyboard equivalent.** Tab reaches it. Enter or Space activates
  it. Arrow keys move inside a composite widget. Escape dismisses an overlay.
- **Give every interactive element an accessible name.** An icon-only control takes a `label` prop,
  and the component writes it to `aria-label`. A card whose body is a picture takes one too.
- **Bind ARIA state to the state that drives the visuals.** `aria-expanded`, `aria-selected`, and
  `aria-busy` must read from the same state as the class that paints the change. A state attribute
  written once at mount and never updated is worse than none: it lies.
- **Keep an id reference inside one component.** `label[for]`, `aria-labelledby`, `aria-controls`,
  and `aria-describedby` resolve by id, and an id cannot cross a shadow root. Two elements that
  refer to each other must be rendered by the same component. Settle this when you design the props.
  You cannot fix it later without a change to the API.
- **Draw the focus ring with `outline` on `:focus-visible`**, from `focus-ring-width` and
  `color-primary`. Never remove the outline without a replacement.

## Follow the shared contract

The standard components share a few conventions. A component of yours reads as one of them when it
shares these too. See **[Standard components](std-components.md)** for the reasoning.

- **Separate props from children by type.** A plain object is the props. Everything else is content.
  Take one props object.
- **Accept only the documented props.** Warn about an unknown prop, and about a value outside the
  allowed list, then use the default. Never forward an arbitrary attribute to an inner element.
- **Let a prop that changes take a state.** Subscribe with `watch(self, ...)` and update the one
  attribute in place. Do not render the component again.
- **Add no outer margin.** Spacing between two things is the job of whatever lays them out.
- **Make the host a box when the component is one.** The default display of a host is `contents`. A
  panel, a tile, or a map sets `:host { display: block }`, so a grid can size it.
- **Prefix the element name with your app's name**, as `my-app-seat-map`. The `imp-` prefix is
  reserved.

## Ship a skill and a preview

A component is finished when an agent can learn it and a person can look at it. Put a
`seat-map.skill.md` next to `seat-map.js`. Give it the import, the call shape, the prop table, the
events, and the mistakes the component invites. See **[Components](components.md)**. Put a
`seat-map.preview.js` next to it too, with one export per scenario, so the preview page renders it
in every theme and both directions. See **[CLI](cli.md)**.
