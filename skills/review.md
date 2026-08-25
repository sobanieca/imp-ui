# review - what the person looking at the page said, as files you can read

```
imp review          list every saved review: page, element picked, comment left
imp review clear    delete them all
```

The dev server puts a **review widget** on every page it serves. The person presses it, presses
**Add review**, clicks an element and types a comment; imp writes that to `.imp/reviews/`. This is
the inbound half of the dev loop - [start](start.md) is the outbound half (`.imp/dev.log`).

It shares its element picker and its capture with `bugReport` (`imp skill std/bugReport`), the
component an app ships to its own users, so a review and a bug report record the same things. The
difference is where they go: a review is a local file for you, a bug report goes wherever the app's
`onSubmit` sends it.

**This is where a vague report becomes actionable.** When you are told "the button is wrong", read
this folder before guessing.

## The file

One file per review, named after the moment it was saved so two can never collide:

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

**Header** - `label: value`, one per line, at column 0. An empty one is omitted, so do not assume
every line is present.

| field      | what it is                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| `time`     | when it was saved, ISO 8601                                                |
| `page`     | the full URL that was open - a preview page names the `*.preview.js` file  |
| `title`    | the document title at the time                                             |
| `viewport` | `<width>x<height>` in CSS pixels, `at <n>x` appended when the DPR is not 1 |
| `scroll`   | `<x>,<y>` page scroll - **present only when the page was scrolled**        |
| `scheme`   | `light` or `dark`, from `prefers-color-scheme`                             |
| `motion`   | `reduce` - **present only when reduced motion is on**                      |
| `lang`     | `<html lang>`                                                              |
| `dir`      | the computed direction of `<html>`, `ltr` or `rtl`                         |
| `element`  | a path from `<body>` to the picked node, `>>` at every shadow boundary     |
| `rect`     | the picked element's `<w>x<h> at <x>,<y>` in the viewport                  |
| `text`     | the element's rendered text, clipped                                       |
| `html`     | the element's `outerHTML`, clipped - **does not carry typed-in values**    |

**Blocks** - `label:` on its own line, then lines indented two spaces. Omitted when empty.

| block      | what it is                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| `state`    | `<state name> = <JSON>` for every imp state in scope at the picked element         |
| `controls` | `<tag>[name=<n>] = <JSON>` for every form control, plus `(disabled)`/`(read-only)` |
| `log`      | the last 20 `.imp/dev.log` lines as of that moment                                 |

**`comment`** is last, flush left, and runs to the end of the file with newlines kept. Parse a
review by splitting on the first `\ncomment:\n`; nothing above it can produce that line, because
block content is indented.

## Reading `state` - this is the reproducible part

`state` is what makes a review more than a URL. imp state is named and holds plain data, so the
block is a **snapshot you can put back**: set the same names to the same values in a test or a
`*.preview.js` scenario and you are looking at the same screen the reviewer was.

- Only state **in scope at the picked element** is listed, **nearest provider first**. A name absent
  from the block was not reachable from that node - that is information, not an omission.
- On a preview page imp's own `imp.preview.*` entries appear as well: the theme, language and
  direction the component was being previewed under.

## Reading `controls` - the HTML lies without it

A typed-in value lives on the element, not in the markup, so `html` shows `value=""` for a field the
person had filled in. `controls` is where what they actually typed, checked and selected is
recorded. **Picking anything inside a `<form>` records the whole form**, so a review of a disabled
submit button carries the field values that explain why it is disabled.

**Password fields are never recorded** - the line reads
`input[name=password] = <8 characters, not recorded>`. Do not ask for the value; it is not there.

## Reading `element`

`body > div#app > acme-settings >> form.panel > button.save`

- **`>` is an ordinary parent-child step**, `>>` **crosses into a component's shadow root.** So
  `acme-settings >> form.panel` is the `form` **rendered by** `acme-settings`, which names the file
  to open: the component before the last `>>` owns the node.
- Each step is `tag`, plus `#id` if the element has one, else `.first-class`, plus `:nth-of-type(n)`
  only when siblings share the tag.
- **It is a description, not a selector.** `>>` is not valid CSS and the rest drifts as the DOM
  changes - never feed it to `querySelector`. `text` and `html` are what confirm you found the right
  node.
- **The person who wrote the review never saw it.** They picked the element by clicking it and it
  stayed outlined while they typed, so do not quote the path back at them - quote `text`.
- **A path deeper than twelve steps is cut and starts with `...`.** The end is kept, because the end
  is what names the component.

## Rules an agent gets wrong

- **Do not delete a review after acting on it.** `imp review clear` is the person's call - they
  decide when a comment is settled. Do not run it unless you are asked to.
- **Reviews are not truncated between runs** the way `.imp/dev.log` is, so the folder is the whole
  backlog, not the current session.
- **Everything below the header was true at the moment the element was picked**, not when the person
  finished typing - so `state` and `controls` describe the screen being complained about, even if
  the app moved on while the comment was written.
- **Reproduce from `state` before asking a follow-up question.** The names and values are enough to
  rebuild the screen in a test or a preview scenario; "what were you doing?" usually is not needed.
- **`.imp/` is git-ignored**, so a review exists only on the machine that wrote it - never point a
  teammate or an issue at the path, paste the contents.
- **There is nothing to wire up.** The widget is injected by `imp start` and `imp preview` and never
  by `imp build`; do not write review UI or a `/@imp/review` caller into the app. An app that wants
  its own users to report problems ships `bugReport` from `imp/std/feedback`
  (`imp skill std/bugReport`) - that is a component, it never writes `.imp/reviews/`, and it is not
  a substitute for this widget.
- `imp review` reads the project it is run from, from any subdirectory. An unknown argument exits
  `1`; `clear` and no argument are the only two forms.
