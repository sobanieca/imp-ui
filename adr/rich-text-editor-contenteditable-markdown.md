# Rich text editor - a contenteditable box with a toolbar, whose value is markdown

## Context

A comment, a post and the notes of a ticket need bold, lists, a link and a picture, from a person
who does not know a syntax. The usual answer is an editor library. ProseMirror, TipTap and Quill
bring a document model, a schema, a view layer and a plugin system of their own, and a second
selection model beside the platform's. imp's rules are that JavaScript never stands in for a
platform primitive, see `browser-support-baseline.md`, and that every colour comes from the theme
tokens, see `themable-by-default-tokens.md`.

The platform has a rich text control. A `contenteditable` element gives the caret, the selection,
the undo history, the composition of an input method, the clipboard, and the commands of
`document.execCommand` for bold, italic, lists, headings, links and alignment. What it lacks is a
value. Its content is a DOM tree, and an app cannot store a DOM tree, diff it, or render it
elsewhere.

## Decision

**`richTextEditor` is a standard component in `imp/std/inputs`. It is a `contenteditable` box under
a toolbar, and its value is a markdown string.** It binds to a form field or to a state through the
same contract as `textArea`, see `state-driven-forms.md`. On every `input` the component serializes
the box to markdown and commits it. When the value changes from outside, the component parses the
markdown into DOM nodes and replaces the content. A value equal to the last commit does not touch
the box, so the caret stays where it is while somebody types.

- **The formatting commands are the platform's.** Every tool runs `document.execCommand`: `bold`,
  `italic`, `strikeThrough`, `formatBlock`, `insertUnorderedList`, `insertOrderedList`, `indent`,
  `outdent`, `createLink`, `unlink`, `insertText`, `insertHTML`, `removeFormat` and the three
  `justify` commands. So every edit sits on the undo stack of the control, and Ctrl-Z takes it back.
  `execCommand` is a legacy API, and the platform has no replacement for an undoable edit of
  editable content. Every current browser supports it for this use. When the platform ships a
  successor, the tools move to it, and nothing else changes. Two edits are DOM replacements, because
  no command does them: the way out of a multi-line code block, and the swap of an image placeholder
  for its image.
- **The markdown dialect is CommonMark, plus `~~strikethrough~~` and one HTML form.** imp writes a
  small, stable subset: `**bold**`, `_italic_`, `~~struck~~`, code spans, `#` headings, `>` quotes,
  `-` and `1.` lists nested by indentation, fenced code blocks, `[text](url)`, `![alt](src)`, and a
  `\` hard line break. Markdown has no alignment, so an aligned block is written as an HTML block,
  `<p align="center">...</p>`, with HTML for the marks inside it. That is what every renderer that
  passes HTML through understands. The `align` value is physical, because the alignment belongs to
  the document, not to the page around it. The editor maps it from and to the logical tools by the
  direction of the box.
- **The parser is imp's own, and it sanitizes.** It reads the subset above, and it accepts the
  common variants, `*italic*`, `__bold__`, `1)` and `+` markers. A link passes with `http`, `https`,
  `mailto` or `tel`, or without a scheme. An image passes with `http`, `https` or `data:image/`.
  Anything else keeps its text and loses its address. The inline HTML of an aligned block goes
  through `DOMParser` and a copy with an allow-list, never through `innerHTML`. So a value written
  by another person is safe to open.
- **Images are resized in the browser and embedded as data URLs.** A file from the image tool, a
  paste, or a drop goes through `createImageBitmap`, an `OffscreenCanvas` and `convertToBlob`. Every
  step is asynchronous, so the page stays responsive. The longest edge is capped by `imageSize`. A
  PNG, GIF, SVG or WebP source becomes a PNG, so transparency survives. Anything else becomes a
  JPEG. The result is `![name](data:image/...)` in the value. There is no upload and no server. A
  placeholder with a spinner holds the place from the moment the file arrives. It is
  `contenteditable="false"`, it is left out of the markdown, and the caret lands in a text node
  after it, so a person keeps typing. When the file is decoded, the image replaces the placeholder
  in place. When decoding fails, the placeholder says so, and a person deletes it like a character.
- **The toolbar follows the WAI-ARIA toolbar pattern.** It is one tab stop. The arrow keys move
  between the tools, mirrored in a right-to-left box. Each tool is a native `button` with an
  `aria-label` from a message, and a tooltip with the same text. `aria-pressed` follows the
  selection through `getComposedRanges`, the platform's way to read a selection inside a shadow
  root. A `mousedown` on a tool is prevented, so a pointer never takes the focus out of the box. The
  link panel and the emoji panel are `popover="auto"` elements, anchored to their tools with CSS
  anchor positioning, see `overlay-top-layer.md`.
- **Tab indents a list item, and nothing else.** Outside a list, Tab moves the focus on. Inside a
  list, Escape, then Tab, leaves. A visually hidden description says so, through the message
  `imp.richTextEditor.keys`, the same design as `code-editor-textarea-mirror.md`.
- **The height is `rows`, as a minimum.** The box grows with the content, because it is a block
  element. It does not scroll inside.

## Consequences

- An app pays nothing for an editor library. It pays for imp's parser and serializer, which are a
  few hundred lines, and for the platform's editing engine, which is free.
- Browsers differ in the DOM that a command leaves behind. The serializer reads what any of them
  writes: `b` or `strong`, `div` or `p`, a nested list inside an item or beside it, a `br` inside a
  `pre`, and a span with an inline weight or style. A tool never reads the DOM it made. It reads the
  markdown, and a test on the markdown covers every browser.
- The value is markdown, so an app renders it with `markdown`, see
  `markdown-renderer-one-reader.md`, and an agent reads it as plain text. An app that needs HTML
  converts on its side, with the sanitizer of its choice.
- A value with images is large, because an image is inline. That is the price of no server. An app
  that stores images elsewhere replaces the data URLs on its side.
- Underline, tables, colours and font sizes are not offered, because the value could not hold them.
  That is the boundary of the component, and it is stated in the docs.
