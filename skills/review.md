# review - what the person looking at the page said, as files you can read

```
imp review          list every saved review: page, element picked, comment left
imp review clear    delete them all
```

**Run `imp review` before you ask "which element?".** A person who says "I left a review", "see my
comment", "the button I marked", "fix what I reviewed in the browser" or "check the reviews" has
already told imp the page, the element and the state of the app. The command prints all of it. Read
it first, then act on it.

The dev server puts a **review widget** on every page that it serves. It is the imp mark in the
corner, and the person can drag it anywhere. The person presses the mark, presses **Add review**,
clicks an element and types a comment. imp writes the result to `.imp/reviews/`. This is the inbound
half of the development loop. [start](start.md) is the outbound half, through `.imp/dev.log`. The
mark also opens **Console logs** and **Network logs**, which show the person the same entries in the
page, live, since the page loaded. They add nothing that the file does not hold.

The widget shares its element picker and its capture with `bugReport`, see
`imp skill std/bugReport`. `bugReport` is the component that an app ships to its own users. So a
review and a bug report record the same items. They differ in where they go. A review is a local
file for you. A bug report goes where the `onSubmit` of the app sends it.

**This folder is where an unclear report becomes work that you can do.** When a person says "the
button is wrong", read this folder before you guess.

## The file

imp writes one file per review. The name is the moment when imp saved it, so two names can never
collide:

```
.imp/reviews/2026-08-25T12-10-36-682Z.txt
```

```
time: 2026-08-25T12:10:36.682Z
page: http://localhost:4507/settings
title: Settings - Acme
viewport: 1440x900
scroll: 0,1240
scheme: dark
lang: en
dir: ltr
element: body > div#app > acme-settings >> form.panel > button.save
rect: 96x36 at 512,604
text: Save changes
html: <button class="save" type="submit" disabled="">Save changes</button>

state:
  settings.profile = {"name":"Ada","role":"admin"}
  settings.dirty = false

controls:
  input[name=name] = "Ada"
  input[name=notifications] = "checked"
  select[name=timezone] = "Europe/Warsaw"

log:
  [BROWSER:error] TypeError: profile.email is undefined
  [HTTP] PATCH http://localhost:4507/api/profile -> 500 34ms

comment:
The save button is disabled until a field is touched, but nothing says so.
```

**The header** is `label: value`, one per line, at column 0. imp omits an empty line. So do not
assume that every line is present.

| field      | what it is                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------- |
| `time`     | when imp saved the review, in ISO 8601                                                       |
| `page`     | the full URL that was open. For a preview it is the address of the component, `/group/name`. |
| `title`    | the document title at that time                                                              |
| `viewport` | `<width>x<height>` in CSS pixels. imp adds `at <n>x` when the device pixel ratio is not 1.   |
| `scroll`   | the page scroll as `<x>,<y>`. It is **present only when the page was scrolled**.             |
| `scheme`   | `light` or `dark`, from `prefers-color-scheme`                                               |
| `motion`   | `reduce`. It is **present only when reduced motion is on**.                                  |
| `lang`     | `<html lang>`                                                                                |
| `dir`      | the computed direction of `<html>`, `ltr` or `rtl`                                           |
| `element`  | a path from `<body>` to the picked node. `>>` marks every shadow boundary.                   |
| `rect`     | the picked element as `<w>x<h> at <x>,<y>` in the viewport                                   |
| `text`     | the rendered text of the element, clipped                                                    |
| `html`     | the `outerHTML` of the element, clipped. It **does not carry a typed-in value**.             |

**A block** starts with `label:` on its own line. The lines after it are indented by two spaces. imp
omits an empty block.

| block      | what it is                                                                            |
| ---------- | ------------------------------------------------------------------------------------- |
| `state`    | `<state name> = <JSON>` for every imp state in scope at the picked element            |
| `controls` | `<tag>[name=<n>] = <JSON>` for every form control, plus `(disabled)` or `(read-only)` |
| `log`      | the last 20 lines of `.imp/dev.log` at that moment                                    |

**`comment`** is last. It starts at column 0 and runs to the end of the file, and imp keeps its
newlines. To parse a review, split on the first `\ncomment:\n`. Nothing above it can produce that
line, because imp indents the content of a block.

## How to read `state` - this is the reproducible part

`state` is what makes a review more than a URL. imp state is named and holds plain data. So the
block is a **snapshot that you can put back**. Set the same names to the same values in a test or in
a `*.preview.js` scenario. You then see the same screen as the reviewer.

- imp lists only the state that is **in scope at the picked element**, and puts the **nearest
  provider first**. A name that is absent from the block was not reachable from that node. That is
  information, not an omission.
- On a preview page imp also writes its own `imp.preview.*` entries. They give the theme, the
  language and the direction of the preview.

## How to read `controls` - the HTML is wrong without it

A typed-in value lives on the element, not in the markup. So `html` shows `value=""` for a field
that the person filled in. `controls` records what the person typed, checked and selected. **When
the person picks any element inside a `<form>`, imp records the whole form.** So a review of a
disabled submit button carries the field values that explain why the button is disabled.

**imp never records a password field.** The line reads
`input[name=password] = <8 characters, not recorded>`. Do not ask for the value. It is not there.

## How to read `element`

`body > div#app > acme-settings >> form.panel > button.save`

- **`>` is an ordinary parent-to-child step. `>>` crosses into the shadow root of a component.** So
  `acme-settings >> form.panel` is the `form` that `acme-settings` **renders**. That names the file
  to open. The component before the last `>>` owns the node.
- Each step is the tag. imp adds `#id` if the element has one, and `.first-class` if it does not.
  imp adds `:nth-of-type(n)` only when two siblings share the tag.
- **The path is a description, not a selector.** `>>` is not valid CSS, and the rest of the path
  changes as the DOM changes. Never pass it to `querySelector`. Use `text` and `html` to confirm
  that you found the correct node.
- **The person who wrote the review never saw the path.** They picked the element by clicking it,
  and it stayed outlined while they typed. So do not quote the path back to them. Quote `text`.
- **imp cuts a path that is deeper than twelve steps, and starts it with `...`.** imp keeps the end
  of the path, because the end names the component.

## Rules an agent gets wrong

- **Do not delete a review after you act on it.** `imp review clear` is the decision of the person.
  They decide when a comment is settled. Run the command only when a person asks for it.
- **imp does not truncate the reviews between runs**, as it truncates `.imp/dev.log`. So the folder
  is the whole backlog, not the current session.
- **Everything below the header was true at the moment when the person picked the element**, not
  when they finished typing. So `state` and `controls` describe the screen that the comment is
  about, even when the app moved on while the person wrote the comment.
- **Reproduce the screen from `state` before you ask a question.** The names and the values are
  enough to rebuild the screen in a test or in a preview scenario. Usually you do not need to ask
  "what were you doing?".
- **git ignores `.imp/`.** So a review exists only on the machine that wrote it. Never point a
  colleague or an issue at the path. Paste the contents.
- **There is nothing to set up.** `imp start` and `imp preview` inject the widget, and `imp build`
  never injects it. Do not write a review UI or a `/@imp/review` caller into the app. An app that
  wants its own users to report a problem ships `bugReport` from `imp/std/feedback`, see
  `imp skill std/bugReport`. That is a component. It never writes to `.imp/reviews/`, and it does
  not replace this widget.
- `imp review` reads the project that you run it from, and works from any subdirectory. An unknown
  argument exits `1`. The only two forms are `clear` and no argument.
