# Code block - imp's own scanner, theme-mixed colours, line links in the fragment

## Context

A documentation page, a settings screen with a snippet to paste, and the code panel of `imp preview`
all show source code. The usual answer is a highlighting library. Shiki brings TextMate grammars and
an Oniguruma engine in WebAssembly, several megabytes for the languages a page needs. Prism and
highlight.js are smaller, but each one is a dependency with its own theme format, and imp's rule is
that every colour comes from the theme tokens (`themable-by-default-tokens.md`). The library must
also stay tree-shakeable (`tree-shakeable-library.md`), so nothing can register grammars at import
time.

A code block also needs three things that a highlighter does not give: a copy button, line numbers
that a person can link to, and text that stays selectable. GitHub sets the pattern for the links:
`#L12` selects a line and `#L12-L20` a range.

## Decision

`codeBlock` is a standard component in `imp/std/display`. It renders a `figure` with a `pre` and a
`code`, one `span` per line, and a `span` per coloured token. The text of the lines is the source,
unchanged, so a selection and a copy give the source back.

- **imp ships its own scanner, with no highlighting dependency.** One generic scanner reads a
  language from a small table: comment markers, string quotes, keyword lists, and a few flags such
  as `$` variables, `@` decorators or case-insensitive keywords. The table covers the languages a
  developer meets in a day: the C family, the scripting languages, the shells, SQL, the data formats
  and the build files. Four scanners of their own cover the structured formats that have no keyword
  grammar: HTML, CSS, Markdown and diff. HTML hands the content of a `script` and a `style` element
  to the JavaScript and the CSS scanner. Markdown hands a fenced block to the scanner of its fence.
  The scanner is a few hundred lines, and the tables are plain strings that compile to a `Set` on
  first use. A wrong colour on an unusual construct is the accepted cost. A scanner that is right on
  common code and small is worth more to imp than one that is right on every construct and large.
- **The colours are mixed from the palette of the theme.** Each token class takes one palette
  colour, such as `color-purple` for a keyword, and mixes it with `color-text`. On a light theme
  that darkens the colour, and on a dark theme it lightens it, so one rule reads on both, and a new
  theme recolours the code with the rest of the app. There is no theme prop, and no separate code
  theme. In forced-colours mode the tokens fall back to the system text colour.
- **Line numbers are CSS counters on anchors, and the anchors are links.** A `::before` rule paints
  the number, so the number is never part of the text, and a copy never includes it. Each anchor
  points at `#L<n>`, or `#<id>-L<n>` when the block has an `id`. A plain click writes the fragment
  into the address with `history.replaceState`, so it does not add a history entry and does not wake
  the router. A Shift-click extends the selection to a range. The fragment is read again on every
  `hashchange`, and once after mount, when the block scrolls the first selected line into view. The
  browser cannot do that scroll itself, because the line lives in a shadow root and fragment
  navigation does not cross one (`shadow-dom-isolation.md`). The number rail is sticky, so it stays
  in view while long lines scroll sideways.
- **The copy button is `button`, in a `tooltip`, and it copies the source prop.** It does not read
  the DOM, so what it copies is exactly what was passed in, without numbers and without the trimming
  of a selection. The label switches to "Copied" for a moment, in the `aria-label` and in a live
  region, and every word goes through `t()` (`translatable-by-default.md`).
- **The code is the `code` prop, a string or a state.** A child cannot be a state in imp, and a live
  source matters for a settings page that builds a snippet from the form beside it. imp drops one
  line break at each end of the string, so a template literal can open and close on its own line,
  and it changes nothing else.

## Consequences

An app pays about 50 KB of unminified source for the component, the scanner and the language table,
and only when it calls `codeBlock`. It pays nothing for languages it does not show, because the
scanner is one function and the tables are strings.

The highlighting is approximate. Nested template literals, heredocs, regular expressions in unusual
positions and language extensions such as JSX are coloured as plain text or as the nearest simple
token. A person who needs exact grammar-driven highlighting has to bring a library, and a
`codeBlock` does not accept pre-rendered HTML.

Two blocks on one page must not both be anonymous with line numbers, because `#L12` would select a
line in each. The `id` prop exists for that, and the skill says so.

The preview page uses the component twice: for the call site of a scenario and for every fenced
block of a skill (`component-preview.md`). So a regression in `codeBlock` shows up in the tool that
is used to fix it. The build-failure path of the page stays raw DOM for that reason.
