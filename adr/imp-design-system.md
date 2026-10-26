# The imp design system

## Context

imp has surfaces of its own: the page of `imp preview`, and the public home page with the
documentation. They must read as one product. A look that each surface invents for itself drifts,
and a visitor who moves from the home page to the component gallery must not see a second brand.

The look must also stay out of the library. The standard components take their look from theme
tokens (`themable-by-default-tokens.md`). An app never inherits the brand of imp.

## Decision

**imp has one design system, and every surface that imp owns uses it.** The identity is four colours
and one shape, the square, on a quiet ground.

### Colour

| Name              | Value     | Use                                                           |
| ----------------- | --------- | ------------------------------------------------------------- |
| `Main1`           | `#d700d1` | Brand block: the active marker, the first navbar bar          |
| `Main2`           | `#ee4b00` | Brand block: the second navbar bar, badge dots                |
| `Main3`           | `#0078ea` | Brand block: the third navbar bar, progress fills             |
| `Accent1`         | `#101010` | Structure: the navbar, the primary button, code, the geometry |
| `Main1-deep`      | `#c400bf` | `Main1` under white 14px text                                 |
| `Main2-deep`      | `#c93f00` | `Main2` under white 14px text                                 |
| `Main3-deep`      | `#0063c4` | `Main3` under white 14px text, and links                      |
| `surface`         | `#fafafa` | The ground of the page                                        |
| `surface-raised`  | `#ffffff` | The sidebar, a card, an input: all that sits on the ground    |
| `surface-sunken`  | `#f1f1f4` | The fill of a control at rest, and a hovered row              |
| `ink`             | `#101010` | Text                                                          |
| `ink-muted`       | `#5b5b63` | Secondary text and labels                                     |
| `line`            | `#e3e3e8` | A decorative hairline                                         |
| `line-strong`     | `#7c7c86` | A border that carries meaning                                 |
| `on-accent`       | `#ffffff` | Text on `Accent1` and on a deep Main fill                     |
| `on-accent-muted` | `#a3a3ad` | Secondary text on `Accent1`                                   |
| `success`         | `#137a3a` | Always with a word or a marker square                         |
| `warn`            | `#8a5a00` | Always with a word or a marker square                         |
| `danger`          | `#c62828` | Always with a word or a marker square                         |

- **A raw Main colour never sits under small text.** Its contrast on white is below 4.5:1. A fill
  that carries white 14px text uses the deep tone.
- **The order of the Main colours is always Main1, Main2, Main3.**
- **Borders replace shadows.** A raised surface has a `line` hairline. The one shadow is under a
  toast.

### Type

The faces are **Sora** for headings and the product name, **IBM Plex Sans** for text, and **IBM Plex
Mono** for code, versions and counts. imp hosts the Latin files of all three itself, in
`lib/src/public/fonts/`, with their licence texts. Sora is licensed under the SIL Open Font License
1.1, and so are the two IBM Plex families. The files are the ones that Google Fonts serves, not
changed. A changed file of IBM Plex must not carry the Reserved Font Name "Plex". The body text is
14px on a 22px line. A heading has the weight 600. A label is 11px, 600, uppercase, in `ink-muted`.

### Shape and spacing

The radius is 2px on a badge and a checkbox, 4px on a control, and 8px on a card, an alert and the
preview stage. Only a switch track and a count badge are a pill. The spacing scale has a 4px base.
The layout aligns to 32px, which is also the pitch of the geometry grid.

### The geometry

The geometry is a small mark in the lower end corner of the page, never a field, and never behind
text. It is at most 400px by 320px. It has a line grid of 32px cells in `Accent1` at 16% opacity. A
radial mask fades the grid toward the upper start corner. Six squares sit on the cells: an `Accent1`
slab of 2 by 2 cells in the corner, the three Main cells in a column beside it, one outlined cell,
and one cell at 30% opacity. On a phone the mark is 60% of the width and 30% of the height.

### The frame

The frame has a navbar and a sidebar. The navbar is 56px tall, in `Accent1`, with the inverse mark
and the name at the start. Three bars stand at its end edge: `Main1` 14px wide, then `Main2` and
`Main3` 10px wide, 6px apart. The sidebar is 248px wide, in `surface-raised`, with a `line` border.
Every component row starts with a square of 8px. The square of the current row is `Main1`. The
content column is at most 1040px wide.

### The mark

The mark is a round head, two horn triangles, two eyes and one curl of tail, with no outline. It has
an ink variant for a light surface and an inverse variant for `Accent1` and any filled block. Do not
change its colours, do not add a stroke, and do not draw it smaller than 20px.

### How `imp preview` applies it

- **The page chrome reads theme tokens, so it follows each theme.** `Accent1` maps to `color-text`.
  So the geometry inverts with a dark theme. The three Main colours are constants of the chrome.
- **The themes of the preview of imp itself carry the rest.** `lib/src/std/preview-look.js` maps the
  colours, the fonts, the type scale, the radii and the shadows to theme tokens. `Accent1` is
  `color-primary`. `surface` is `background-app`, and `surface-raised` is `color-surface`.
- **The dark theme is a derivation.** The design system defines a light scheme only. The dark theme
  swaps `ink` and the surfaces, and it keeps the Main colours.
- **The geometry belongs to the canvas, not to the frame.** The canvas is the main region of the
  page, and it ends where the bottom bar of a phone starts. So the mark stands in the lower end
  corner of the canvas, under the scrolling content, and the bottom bar never covers it. On a
  desktop that corner is the corner of the screen. On a phone the mark has its smaller size.
- **The cell of the geometry follows the width of the screen.** It is 16px on a phone and 32px from
  about 1440px, and it moves in steps of 4px between them, so each grid line stays on a whole pixel.
  The squares take their size from the same cell, so the whole mark gets smaller with the screen.
- **Text that a person reads at length sits on a raised surface.** The content scrolls over the
  geometry, and a paragraph over the ink slab cannot be read. So the Skill tab draws its manual on a
  panel in `color-surface`, with a border. The stage, the code panel and every card already are
  raised surfaces. A short label, such as the head of a scenario, stays on the ground.
- **The frame fills the screen, and the content column is 1040px.** The shell gets
  `maxWidth: 'none'`, so the sidebar stays at the start edge of a wide screen. The canvas caps its
  own column.
- **The top bar of a phone carries the three bars.** Below the `48rem` query the frame draws a top
  bar with the menu button and the title. The page passes `navbar: { hidden: true }` with the bars as
  its `background`, so they
  stand at the end edge of that bar: `Main1` 14px wide, then `Main2` and `Main3` 10px wide, 6px
  apart and 6px from the edge. A desktop screen has no top bar, so it shows no bars.
- **The page has no navbar.** The page hides the bar, so the frame draws the sidebar alone
  (`app-shell-component.md`). The navbar comes with the home page, which hosts the gallery.
- **The mark is the logo and the page icon.** `cli/src/templates/` holds `mark-light.svg`,
  `mark-dark.svg` and `favicon.ico`, which is the inverse mark on an `Accent1` tile.

## Consequences

- The home page and the gallery share one look, and the gallery needs no second skin when the home
  page embeds it.
- A theme has one border colour, and the design system has two. The preview themes set
  `color-border` to `line`. So the border of a control is quieter than `line-strong` asks.
- A theme has one accent. With `Accent1` as `color-primary`, a link and a focus ring are ink, not
  `Main3-deep`.
- A project that runs `imp preview` with its own themes gets the geometry and the marker of imp
  around its components. The chrome is the brand of the tool, as the logo is.
