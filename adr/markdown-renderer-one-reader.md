# Markdown renderer - one reader and one prose stylesheet under the editor and the renderer

## Context

`richTextEditor` writes markdown, see `rich-text-editor-contenteditable-markdown.md`. An app that
takes a comment, a post or a release note must show that value again. It also has markdown from
elsewhere: a README, a help panel, the body of a ticket.

Without a renderer in the library, an app reaches for a markdown package and assigns `innerHTML`.
That is the exact path the editor's own sanitizer exists to close. The value is also styled twice.
The editor sets the prose in theme tokens, and the app sets it again in its own CSS, so a draft and
the published page indent their lists and set their quotes differently.

The same split already happened with code. `codeBlock` and `codeEditor` share one code view, see
`code-editor-textarea-mirror.md`, so a block and an editor render a line the same way.

## Decision

**`markdown` is a standard component in `imp/std/display`. It takes a `text` prop, a string or a
state, and renders it as prose. It shares its reader and its stylesheet with `richTextEditor`.**

- **One parser.** `markdown` and `richTextEditor` call the same `markdownToNodes`. The dialect, the
  accepted variants and the link and image allow-lists are the ones in
  `rich-text-editor-contenteditable-markdown.md`. There is no second dialect to keep in step.
- **The renderer never assigns `innerHTML`.** The parser builds DOM nodes. A `<script>` in the text
  is text, and a link or an image with an address outside the allow-list keeps its text and loses
  the address. So markdown from another person is safe to render, with no sanitizer on the app side.
- **One prose stylesheet, scoped by its caller.** `markdownViewStyles(scope)` returns the block,
  heading, list, quote, code, image and rule rules for one selector. The editor passes its editable
  box, and `markdown` passes its prose box. So the two cannot drift.
- **A fenced code block is a plain monospace panel.** `markdown` does not import the scanner of
  `codeBlock`. A component that renders a paragraph must not pull the whole highlighter into the
  bundle, see `tree-shakeable-library.md`. An app that wants colour calls `codeBlock` itself.
- **The component takes text, not children, and it has no style prop.** Every space, colour and font
  comes from a theme token, see `themable-by-default-tokens.md`.

## Consequences

- The value of a `richTextEditor` has a renderer in the same library, with the same reading of the
  same text. A draft and the published page look alike.
- An app that renders untrusted markdown needs no sanitizer and no markdown package.
- The two components share the parser, so a fix to the dialect reaches both. It also means that
  neither can take a dialect of its own. A renderer-only feature has to be a feature of the editor
  as well, or it is not added.
- A table is not supported, because the editor cannot write one.
- Markdown with images is rendered inline, so a value that carries data URLs is as large in the page
  as it is in the store.
