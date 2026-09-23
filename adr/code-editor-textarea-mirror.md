# Code editor - a native textarea over a highlighted mirror, and three keys

## Context

A settings page with custom CSS, a rule that a person writes as JSON, and the tokens view of the
theme editor, see `theme-editor.md`, all need a place to type code. The usual answer is an editor
library. CodeMirror and Monaco bring a document model, a view layer, a keymap and a theme format of
their own, hundreds of kilobytes, and a second focus and selection model beside the platform's.
imp's rule is that every colour comes from the theme tokens, see `themable-by-default-tokens.md`,
and that JavaScript never stands in for a platform primitive, see `browser-support-baseline.md`.

The platform has a multi-line text control. `<textarea>` gives the caret, the selection, the undo
history, the composition of an input method, the clipboard, the scroll, and a role and a name that
assistive technology knows. It has no colour inside the text, and it has no notion of indentation.
Those two things are what a code editor adds.

## Decision

**`codeEditor` is a standard component in `imp/std/inputs`, and it is a `<textarea>`.** It binds to
a form field or to a state through the same contract as `textField`, see `state-driven-forms.md`.
The value is the text, on every keystroke. A parse check belongs in `validate`, and the error shows
after the person leaves the control, as in every other control.

- **The colours come from a mirror behind the text.** The component renders a `pre` under the
  textarea, in the same box, the same font, the same padding and the same `white-space: pre`. The
  mirror holds the code view of `codeBlock`, see `code-block-syntax-highlighting.md`: one `span` per
  line, and one `span` per coloured token. The text of the textarea is transparent, and its caret
  and selection keep their colour. So the person types into the real control, and they see the
  mirror through it. On every `input` the mirror is rendered again, and on every `scroll` it takes
  the scroll offsets of the textarea. The textarea is the scroll container, so the browser reveals
  the caret by itself. The mirror is a scroll container too, with the same `overflow: auto` and the
  same content, and it takes no pointer event. A classic scrollbar then takes the same gutter in
  both boxes, and the two scroll ranges are equal. A mirror that only clipped would be 15px taller
  than the textarea as soon as a long line put a horizontal scrollbar there, and the last rows would
  sit one row under the caret. This is the one thing that imp writes in JavaScript here, and it
  paints. It handles no input.
- **One rule set gives the mirror and the textarea their metrics.** The code view holds the font,
  the size, the line height, the tab size and both insets, and it names the `textarea` in the same
  rule as the mirror. A style that reached only one of the two would misplace every coloured token
  under the caret.
- **The line height and the block padding sit on a grid of 4px.** The rule rounds
  `1em * line-height-normal` and `space-3` with the CSS `round()` function. A theme can give a line
  height such as 20.41px. A textarea and a block of inline boxes place such lines on different
  device pixels, most of all on a screen scaled to 125% or 150%. The rows of the mirror then leave
  the rows of the caret. A multiple of 4px is a whole number of device pixels at each of those
  scales, so both layers put each row in the same place.
- **Three keys are handled, and nothing else.** Tab inserts two spaces, or indents every line of a
  selection, and Shift-Tab outdents. Enter keeps the indentation of the line. The edits go through
  `document.execCommand('insertText')`, so they sit on the undo stack of the control like a
  keystroke, and `Ctrl-Z` takes them back. Nothing else is intercepted. There is no bracket pair, no
  completion and no multiple caret.
- **Tab must not trap the keyboard.** A person presses Escape, then Tab, and the next Tab moves the
  focus. A visually hidden description on the control says so, through the message
  `imp.codeEditor.keys`, see `translatable-by-default.md`. Escape also bubbles, so a `dialog` or a
  `drawer` around the editor closes on it. That is the platform's answer, and the editor does not
  stop it.
- **The height is `rows`, and it does not grow.** The platform grows a control with
  `field-sizing: content`, and that property is not in every current browser yet. Until it is, the
  editor has the fixed height of its `rows`, and it scrolls inside. The rule of
  `browser-support-baseline.md` forbids a JavaScript measure in its place.
- **Line numbers and the copy button come from the code view.** `lineNumbers: true` renders the same
  sticky rail that a `codeBlock` has, inside the mirror, and insets the text of the textarea by the
  width of the rail. Both halves of that width are declared in the code view, so they cannot drift.
  The numbers are plain, not links: a line of a text that somebody is editing has no stable address.
  The copy button takes the current value of the textarea. It is a focusable control inside the
  component, so Escape, then Tab, reaches it, and the next Tab leaves.

## Consequences

- An app pays for the code view, the scanner and the language table once, whether it renders a
  `codeBlock`, a `codeEditor` or both, and it pays nothing for an editor library. An app that only
  shows a listing ships no textarea, no key handler and no form binding, because the two components
  are two exports in two entry points.
- The mirror is only as good as the box match. A font that the page loads after the first paint
  reflows both boxes at once, because they share the tokens, so nothing drifts. The rail is measured
  in `ch`, in the font of the code, so the inset of the textarea follows the same font.
- The textarea paints above the mirror, so its selection tints the number rail while a selection
  spans a line. The rail stays readable, and the alternative stacking hides the caret.
- `execCommand` is a legacy API, and the platform has no replacement for an undoable insert into a
  textarea. Every current browser supports it for this use. When the platform ships a successor, the
  three keys move to it, and nothing else changes.
- The theme editor uses the component for the tokens view, so a regression in `codeEditor` shows up
  in the tool that is used to design a theme.
