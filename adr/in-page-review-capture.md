# One in-page capture engine: dev reviews write files, bugReport hands the app a report

## Context

imp is built for a workflow where a person looks at the running app, and an AI agent writes the
code, see `agent-skills.md`. The dev server already carries the half of that loop that belongs to
the agent. The telemetry of the console, of an error and of the network streams to the terminal, and
to `.imp/dev.log`. So the agent can read what the browser did, with no session in the developer
tools, see `built-in-logger.md`.

The other direction had no channel. What the person sees reached the agent as prose that somebody
typed into a chat, such as "the save button on the settings page is wrong". Examples of what they
see are a control that is too small, a label that is untrue, and a focus ring that is clipped at
320px. The agent must then guess which page, which of four buttons, and which of the nested
components really renders it. Two facts would settle all three questions. Those are the URL, and the
exact node. Both are on the screen in front of the person, and neither is in what they type. To type
them out by hand means to read a DOM tree that they must not have to look at.

Every other part of this loop is already local, and shaped like a file. A review must be the same.
It must not be a service, an account, or an extension of the browser.

The **same problem exists one layer out**, for the people who use a finished app. "Report a problem"
is a feature that most products need. Every implementation of it derives the same context again, by
hand. The interesting half is exactly what imp already knows how to collect. That is which element,
which named state, and what somebody typed into the form. A capture engine that only the dev server
could reach would be the wrong place for that.

## Decision

**To pick an element, and to capture its context, is one library module, `lib/src/report.js`. Two
things sit on that module. The first is the review widget of the dev server, which writes a
plain-text file under `.imp/reviews/`. The second is the `bugReport` standard component, which hands
the app a report of plain data.**

The shared module is three functions, and no UI:

- `pickElement({ ignore, onHover, onPick, onCancel })` runs the interaction of the pick. It handles
  the crosshair cursor, the element under the pointer, `Enter` to take the outlined element, and
  `Escape` to cancel. It returns a `stop` function. It draws nothing. It calls `onHover`, and the
  consumer places its own outline with `placeOverElement`. So the widget of the dev server can carry
  the colour of the development tools, and the component can carry the colour of a theme token, and
  the behaviour is identical.
- `captureReport(element)` returns the whole context, described below, as **plain data that is safe
  as JSON**. It does not return pre-formatted lines. The formatting is the job of the consumer. The
  dev server renders the data into the text format below. The `onSubmit` of an app gets the object.
- The module listens on `document`, and not on `window`. That is the one thing that makes it
  testable in the test DOM of imp.

The widget of the dev server reaches the module by a dynamic import of the same served module that
the app imports, which is `/@imp/report.js`. So there is one implementation at runtime, and not a
copy that somebody compiled into the CLI.

**Neither surface shows the element path to the person who uses it.** The path is a description of
the DOM, written for whoever reads the report. To put it in front of a person asks them to check a
selector that they must not have to look at. Both surfaces keep the picked element **outlined while
the person types the comment**. So the affordance of the pick is also the affordance that says "this
is what you describe". That is the same answer for a developer who reviews a preview, and for a
customer who reports a bug.

- **The widget rides the injected client script.** So `imp start` and `imp preview` both have it,
  with no work, and `imp build` cannot emit it. A preview page is the same dev server underneath,
  see `component-preview.md`. So a component is reviewable in isolation, with no extra wiring. There
  is no config key. The widget is present on every development page, or on none.
- **The widget is one small button in the corner. It opens a toolbox that holds one action, which is
  to add a review.** A press enters pick mode. imp outlines the element under the pointer. A click
  chooses that element. The comment field then opens, and the chosen element stays outlined.
  `Escape` cancels. `Enter` takes the highlighted element. `Ctrl` or `Cmd` with `Enter` saves.
  Nothing else is configurable. A review is one element and one comment, because anything more is a
  bug tracker.
- **The widget lives in its own shadow root**, on a host that imp appends to `<body>`. imp styles it
  from a reset, with `all: initial`. A `MutationObserver` appends the host again when the app
  replaces the children of the body. So the widget cannot inherit the styles of the app, and to
  mount an app cannot remove the widget.
- **imp records the picked element as a path from `<body>`, with `>>` where the path crosses a
  shadow boundary.** An example is `body > div#app > acme-settings >> form.panel > button.save`. An
  imp component is a custom element with an open shadow root, see `shadow-dom-isolation.md`. So a
  plain CSS selector cannot name a node inside one. imp reads the path off `composedPath()[0]`, and
  walks up through the hosts. So the path tells the agent the component, and the node inside it. imp
  puts the text of the element, and its `outerHTML`, in the file beside the path, clipped. So the
  agent can recognize the node, also after the DOM moves.
- **A review records the state that the app was in, and not only where it was.** A URL and an
  element path say which screen, and which node. They say nothing about what the app was doing, and
  that is the half that makes a report something a person can act on. imp captures four things at
  the moment when somebody picks the element, because by the time when they type the comment, the
  app can have moved on:
  - **Every imp state in scope at the picked element**, by name, as JSON. That is what imp has, and
    a general widget for feedback does not. A state is **named**. It holds **plain data that is safe
    as JSON**, see `state-plain-data-values.md`. It is reachable from any node. So the block is not
    a description of the state. It **is** the state. To set the same names to the same values
    reproduces the screen. Before this decision, a state was findable one name at a time, because
    `findProvided(kind, name, origin)` answers one lookup. That is why the state editor of the
    preview must scan the source for a literal `initState` call. A `collect` variant of the same
    bubbling lookup makes the set enumerable from a node, with the nearest provider first. In that
    variant every provider answers, and the first match does not stop the walk.
  - **The live values of the form controls.** `outerHTML` really is untrue here. A value that
    somebody typed is a property, and not an attribute. So a review of a form that somebody filled
    in would otherwise record an empty form. When the person picks any element inside a `<form>`,
    imp records the whole form. So a complaint about a disabled submit button carries the field
    values that explain why the button is disabled. **A password input records its length, and never
    its value.**
  - **The last 20 lines of the development log.** The server adds them, from the buffer that
    `createDevLog` already keeps in memory. It costs nothing, and it answers the question "how did
    it get here?". It gives the error that fired, and the request that failed. That is the one thing
    that a screenshot would not tell anybody either.
  - **The environment.** That is the viewport, the device pixel ratio, the scroll offset, the colour
    scheme, the state of reduced motion, the language and the direction, plus the rect of the picked
    element. "Only when the window is narrow", and "only in dark mode", are most of what makes a
    report impossible to reproduce. Nobody must have to type any of it.
- **imp deliberately does not capture a screenshot.** The platform has no way to turn DOM into an
  image. `getDisplayMedia` prompts the person, and captures the whole screen. A rasterizer in
  JavaScript is exactly the shadow implementation of a platform primitive that
  `browser-support-baseline.md` forbids.
- **There is one file per review, named with an ISO timestamp, where imp replaces `:` and `.` with
  `-`, and adds the `.txt` extension.** imp writes it with `createNew`, and adds a numeric suffix on
  a collision, which needs the same millisecond. There is no index, no envelope of JSON, and no
  append to one log. Separate files mean that two reviews can never interleave, and can never
  overwrite each other. The format is a plain header of `label: value` lines, then a `label:` block
  whose lines are indented by two spaces, then the free text of the comment, last. A person and an
  agent can both search it, difference it and read it, with no parser. The comment goes last, and
  imp indents everything that it writes itself. So a split on the first `comment:` at column 0 is an
  unambiguous parse, whatever the person types.
- **The location is `.imp/reviews/`**, beside `dev.log`, `screenshots/` and `videos/`. A review is
  local working state about a session, and it is not source. A scaffolded project already tells git
  to ignore `.imp/`.
- **`bugReport` is a component, and not a second widget.** It renders a trigger, with `as: 'button'`
  or `as: 'link'`. Both are a real `<button>`, because the trigger performs an action. It runs the
  same pick, and opens a comment panel. It **stores nothing**. The app passes `onSubmit`, which can
  return a promise. imp ships no endpoint, no queue, and no fallback to `localStorage`. Where a
  report goes, and what somebody removes from it first, is a decision that only the app can make.
  The job of imp ends when it collects the report. The panel is a `<dialog>` inside a
  `popover="manual"` layer. So it reaches the top layer with no portal, and with no backdrop that
  hides the element that the person describes, see `todo/overlay-seam.md`.
- **`imp review` reads the folder back, and `imp review clear` empties it.** The files are plain
  text, exactly so that the command is a convenience, and not the only way in. The command sorts,
  counts, and resolves the project root from any subdirectory. `cat .imp/reviews/*.txt` stays
  equivalent. **Nothing clears a review by itself.** A restart of the server does not, and a build
  does not. `dev.log` is different, because imp truncates it per run. A review is an item on a
  backlog. Only the person who wrote it knows when it is settled. So to delete one is an explicit
  command, and never a side effect.
- **The feature is local only, in two ways.** The widget mounts only when the hostname of the page
  is a loopback address. The server accepts `POST /@imp/review` only when the peer of the connection
  is loopback. The dev server binds every interface, so a phone on the same network can load the
  app. That phone must not be able to write a file into the project of the developer.

## Consequences

- The input of the agent about what a person saw is a folder that the agent can read with `cat`. It
  is in the same place where the agent already searches `.imp/dev.log`. So there is one convention
  for "what happened in the browser", and the agent reads it in one way.
- A report and a review carry the same fields. So an agent learns one shape. An app that forwards
  the output of `bugReport` into a tracker hands the agent something that it already knows how to
  read.
- **The library grew `lib/src/report.js`, and the dev server depends on it at runtime.** A page that
  `imp start` serves now fetches one more module, when somebody first uses the review widget.
  `imp build` still cannot emit the widget. An app that never calls `bugReport` never bundles the
  module.
- An unclear report gains the two facts that make it something a person can act on, and it costs the
  person nothing. Those are the page, and the node. The `>>` in the path names the component that
  owns the node, and that is usually the file to open.
- imp does not share a review. git ignores it, and it is local by construction. So imp has no story
  for "send this to a colleague". That is the job of a bug tracker, and to paste the file into one
  is a copy.
- The element path is a description, and not a selector. imp does not guarantee that it resolves
  later. An agent that treats it as a query to run will be wrong the moment when a class or an index
  changes. The text and the HTML in the file are what remove that doubt. imp cuts a path at twelve
  steps from the picked node, and keeps the end that names the component. The shell of the preview
  alone is deeper than that.
- **A review is close to a scenario that somebody can reproduce, and it is not one yet.** The state
  block holds the names and the values that a person needs to rebuild the screen. To replay it is
  manual. Nothing applies a snapshot again on load, and nothing turns a review into a `*.preview.js`
  file. Those are the obvious next steps, and the format leaves room for them.
- The state block is only as good as the discipline of the app about its state. What a component
  keeps in a local closure, in place of an imp state, is invisible here. That is a mild pull toward
  naming a state, and a real blind spot for an app that does not name one.
- To enumerate the states costs every provider one extra branch, in the lookup that it already
  answers. The library gains a `collectStatesFrom` export that is not public. `imp/state` still
  exports `computed`, `initState` and `useState` only. So no public API grew.
- A review that somebody took during a session survives that session, because imp does not truncate
  the file at startup, in the way that it truncates `dev.log`. So a folder that nobody clears grows.
  That is deliberate. To lose a review because the server restarted is worse than a review that is
  old, and `imp review clear` is one command.
- **`bugReport` can leak data.** imp collects `state` and `controls` in full. An app that connects
  `onSubmit` straight to a third-party endpoint sends whatever its states hold. A password is the
  one thing that imp removes. The documentation says that everything else is the decision of the
  app. That is a real sharp edge, and imp accepts it in exchange for a report that is useful.
- The widget is another thing on top of the app, in development. It sits in the corner at the block
  end and the inline end. It can cover an element of the app that somebody pinned there. A person
  can dismiss it, and cannot move it. A component that somebody previews in isolation has room
  around it in any case.
