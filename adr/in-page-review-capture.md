# One in-page capture engine: dev reviews write files, bugReport hands the app a report

## Context

imp is built for a workflow where a person looks at the running app and an AI agent writes the code
(`agent-skills.md`). The dev server already carries the agent's half of that loop: console, error
and network telemetry stream to the terminal and to `.imp/dev.log`, so the agent can read what the
browser did without a devtools session (`built-in-logger.md`).

The other direction had no channel. What the person sees - a control that is too small, a label that
lies, a focus ring clipped at 320px - reached the agent as prose typed into a chat: "the save button
on the settings page is wrong". The agent then has to guess which page, which of four buttons, and
which of the nested components actually renders it. The information that would settle all three -
the URL and the exact node - is on the screen in front of the person and nowhere in what they type,
and typing it out by hand means reading a DOM tree they should not have to look at.

Every other part of this loop is already local and file-shaped: reviews want to be the same, not a
service, an account, or a browser extension.

The **same problem exists one layer out**, for the people using a finished app. "Report a problem"
is a feature most products need, every implementation of it re-derives the same context by hand, and
the interesting half - which element, which named state, what was typed into the form - is exactly
what imp already knows how to collect. A capture engine that only the dev server can reach would
have been the wrong place to put it.

## Decision

**Picking an element and capturing its context is one library module, `lib/src/report.js`. Two
things sit on it: the dev server's review widget, which writes a plain-text file under
`.imp/reviews/`, and the `bugReport` standard component, which hands the app a plain-data report.**

The shared module is three functions and no UI:

- `pickElement({ ignore, onHover, onPick, onCancel })` runs the picking interaction - the crosshair
  cursor, the element under the pointer, `Enter` to take the outlined one, `Escape` to cancel - and
  returns a `stop`. It draws nothing; it calls `onHover` and the consumer places its own outline
  with `placeOverElement`, so the dev widget can be dev-coloured and the component can be
  theme-token-coloured while the behaviour is identical.
- `captureReport(element)` returns the whole context below as **plain JSON-safe data**, not as
  pre-formatted lines. Formatting is the consumer's job: the dev server renders it into the text
  file format below, and an app's `onSubmit` gets the object.
- It listens on `document` rather than `window`, which is the one thing that makes it testable in
  imp's test DOM.

The dev widget reaches it by dynamically importing the same served module the app imports
(`/@imp/report.js`), so there is one implementation at runtime, not a copy compiled into the CLI.

**Neither surface shows the element path to the person using it.** The path is a DOM description
written for whoever reads the report; putting it in front of a person is asking them to check a
selector they should not have to look at. Both keep the picked element **outlined while the comment
is typed** instead - the picking affordance doubles as the "this is what you are describing"
affordance, which is the same answer for a developer reviewing a preview and for a customer
reporting a bug.

- **It rides the injected client script**, so `imp start` and `imp preview` both have it for free
  and `imp build` cannot emit it - a preview page is the same dev server underneath
  (`component-preview.md`), so a component is reviewable in isolation with no extra wiring. There is
  no config key: the widget is present on every dev page or on none.
- **The widget is one small button in the corner, opening a toolbox that holds one action: add a
  review.** Pressing it enters pick mode: the element under the pointer is outlined, a click chooses
  it, and the comment field opens with the chosen element still outlined. `Escape` cancels, `Enter`
  takes the highlighted element, `Ctrl`/`Cmd` + `Enter` saves. Nothing else is configurable - a
  review is one element and one comment, because anything more is a bug tracker.
- **The widget lives in its own shadow root** on a host appended to `<body>`, styled from a reset
  (`all: initial`) and re-appended by a `MutationObserver` if the app replaces the body's children.
  It cannot inherit the app's styles, and mounting an app cannot remove it.
- **The picked element is recorded as a path from `<body>`, with `>>` where it crosses a shadow
  boundary** - `body > div#app > acme-settings >> form.panel > button.save`. imp components are
  custom elements with open shadow roots (`shadow-dom-isolation.md`), so a plain CSS selector cannot
  name a node inside one; the path is read off `composedPath()[0]` and walked up through hosts, and
  it tells the agent both the component and the node within it. The element's text and outerHTML go
  in the file beside it, clipped, so the agent can recognise the node even after the DOM moves.
- **A review records the state the app was in, not just where it was.** A URL and an element path
  say which screen and which node, and nothing about what the app was doing - which is the half that
  makes a report actionable. Four things are captured at the moment the element is picked, because
  by the time the comment is typed the app may have moved on:
  - **Every imp state in scope at the picked element**, by name, as JSON. This is what imp has that
    a generic feedback widget does not: state is **named**, holds **plain, JSON-safe data**
    (`state-plain-data-values.md`), and is reachable from any node - so the block is not a
    description of the state, it **is** the state, and setting the same names to the same values
    reproduces the screen. State was previously only findable one name at a time
    (`findProvided(kind, name, origin)` answers a single lookup), which is why the preview state
    editor has to scan source for literal `initState` calls. A `collect` variant of the same
    bubbling lookup - every provider answers instead of the first match stopping it - makes the set
    enumerable from a node, nearest provider first.
  - **Live form-control values**, because `outerHTML` genuinely lies here: a typed-in value is a
    property, not an attribute, so a review of a filled-in form would otherwise record an empty one.
    Picking anything inside a `<form>` records the whole form, so a complaint about a disabled
    submit button carries the field values that explain the disabling. **Password inputs record
    their length and never their value.**
  - **The last 20 dev-log lines**, added server-side from the buffer `createDevLog` already keeps in
    memory. It costs nothing and answers "how did it get here" - the error that fired, the request
    that failed - which is the one thing a screenshot would not have told anyone either.
  - **The environment**: viewport and device pixel ratio, scroll offset, colour scheme, reduced
    motion, language and direction, plus the picked element's own rect. "Only when narrow" and "only
    in dark mode" are most of what makes a report irreproducible, and none of it should have to be
    typed.
- **A screenshot is deliberately not among them.** The platform has no DOM-to-image;
  `getDisplayMedia` prompts and captures the whole screen, and a JavaScript rasteriser is exactly
  the shadow implementation of a platform primitive that `browser-support-baseline.md` forbids.
- **One file per review, named `<ISO timestamp with : and . replaced by ->.txt`**, written with
  `createNew` and a numeric suffix on the (millisecond) collision. There is no index, no JSON
  envelope and no append-to-one-log: separate files mean two reviews can never interleave or
  overwrite, and a plain header of `label: value` lines, then `label:` blocks indented two spaces,
  then the free-text comment last, is greppable, diffable and readable by a person and an agent
  alike without a parser. The comment goes last and everything machine-written is indented, so
  splitting on the first `comment:` at column 0 is an unambiguous parse no matter what the person
  types.
- **`.imp/reviews/` is the location**, next to `dev.log`, `screenshots/` and `videos/`: reviews are
  local working state about a session, not source, and `.imp/` is already git-ignored by a
  scaffolded project.
- **`bugReport` is a component, not a second widget.** It renders a trigger (`as: 'button'` or
  `as: 'link'`, both a real `<button>` since it performs an action), runs the same pick, and opens a
  comment panel. It **stores nothing**: the app passes `onSubmit`, which may return a promise, and
  imp ships no endpoint, no queue and no `localStorage` fallback. Where a report goes, and what is
  stripped out of it first, is a decision only the app can make - imp's job ends at collecting it.
  The panel is a `<dialog>` inside a `popover="manual"` layer, so it reaches the top layer without a
  portal and without a backdrop hiding the element being described (`todo/overlay-seam.md`).
- **`imp review` reads the folder back and `imp review clear` empties it.** The files are plain text
  precisely so the command is a convenience rather than the only way in - it sorts, counts and
  resolves the project root from any subdirectory, and `cat .imp/reviews/*.txt` remains equivalent.
  **Nothing clears reviews implicitly**: not a server restart, not a build, unlike `dev.log`, which
  is truncated per run. A review is a backlog item, and only the person who wrote it knows when it
  is settled, so deleting one is an explicit command and never a side effect.
- **Local-only, twice.** The widget mounts only when the page's hostname is a loopback address, and
  the server accepts `POST /@imp/review` only when the connection's peer is loopback. The dev server
  binds every interface, so a phone on the same network can load the app - it must not be able to
  write files into the developer's project.

## Consequences

- The agent's input about what a person saw is a folder it can `cat`, in the same place it already
  greps `.imp/dev.log` - one convention for "what happened in the browser", read the same way.
- A report and a review carry the same fields, so an agent learns one shape. An app that forwards
  `bugReport` output into a tracker is handing the agent something it already knows how to read.
- **The library grew `lib/src/report.js`, which the dev server depends on at runtime.** A page
  served by `imp start` now fetches one more module when the review widget is first used;
  `imp build` still cannot emit the widget, and an app that never calls `bugReport` never bundles
  the module.
- A vague report gains the two facts that make it actionable, at zero cost to the person: which page
  and which node. The `>>` in the path names the owning component, which is usually the file to
  open.
- Reviews are not shared. They are git-ignored and local by construction, so imp has no story for
  "send this to a teammate" - that is a bug tracker's job, and pasting the file into one is a copy.
- The element path is a description, not a selector: it is not guaranteed to resolve later, and an
  agent that treats it as a query it can run will be wrong the moment a class or an index changes.
  The text and HTML in the file are what disambiguate it. Paths are cut at twelve steps from the
  picked node, keeping the end that names the component - the preview shell alone is deeper than
  that.
- **A review is close to a reproducible scenario, and is not one yet.** The state block has the
  names and values needed to rebuild the screen, but replaying it is manual: nothing re-applies a
  snapshot on load, and nothing turns a review into a `*.preview.js`. Those are the obvious next
  steps and the format was shaped to leave room for them.
- The state block is only as good as the app's state discipline. What a component keeps in a local
  closure instead of imp state is invisible here, which is a mild pull toward naming state - and a
  real blind spot for an app that does not.
- Enumerating state costs every provider one extra branch in the lookup it already answers, and the
  library gains a non-public `collectStatesFrom` export (`imp/state` still exports only `computed`,
  `initState` and `useState`, so no public API grew).
- A review taken during a session survives the session - the file is not truncated at startup the
  way `dev.log` is - so a folder that is never cleared grows. That is deliberate: losing a review
  because the server restarted is worse than a stale one, and `imp review clear` is one command.
- **`bugReport` can leak.** `state` and `controls` are collected in full, and an app that wires
  `onSubmit` straight to a third-party endpoint sends whatever its states hold. Passwords are the
  one thing imp redacts; everything else is documented as the app's call, which is a real sharp edge
  accepted in exchange for the report being useful.
- The widget is another thing on top of the app in development. It sits in the bottom-inline-end
  corner and can cover an app element pinned there; it is dismissible but not movable, and a
  component previewed in isolation has room around it either way.
