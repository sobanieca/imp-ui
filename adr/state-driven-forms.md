# State-driven forms: values are named state, fields are dot paths

## Context

A control inside its own shadow root does not join a `<form>` outside it, see
`shadow-dom-isolation.md`. So a native submit, the collection of a `FormData` object, and constraint
validation, cannot reach a standard component. imp therefore had to build the form layer, and could
not borrow one. The open question was how a control takes hold of **one field** of the values of a
form.

Named state, see `event-propagated-state.md`, shares a whole object down the tree. `computed` can
project one field out of that object, but only for a read. imp cannot invert a write out of a
function. So a control that receives `computed([user], (u) => u.address.city)` can display a value,
and it can never commit one. There were two candidates. The first was a split contract, where
`value` reads and a separate `commit` prop writes. The second was a writable projection of a path,
added to the kernel.

## Decision

**The values of a form are ordinary named state, and a control names its field with a dot path.**

- **`form({ initialValues })` calls `initState(self, 'imp.form', initialValues ?? null)` on
  itself.** The values live at the position of the form in the tree. So a second form on the page
  owns a second `imp.form`, and an unmount of a form releases its values with the rest of the
  subtree. Nobody registers anything, connects anything, or tears anything down by hand.
- **A control declares `field: 'user.firstName'`.** It resolves `imp.form` from its own position,
  with `useState(self, 'imp.form')`. That is the same lookup that every other component does. So it
  works at any depth of nesting, through a layout component and through an app component. The
  control then reads its value by a walk along the path, and it writes by rebuilding the object
  along that path.

  That is what makes a nested field work with **no change to the kernel**. A path is data, and the
  form layer can walk it in both directions. `computed` is a function, and it walks one way only. So
  imp still rejects the writable projection of a path as unearned, and the split contract is not
  needed. `value` remains, for a standalone control outside a form. It takes a state, or a plain
  value.
- **Everything that the form layer must agree on is state, and not a registry.** That is
  `imp.form.errors`, `imp.form.touched`, `imp.form.submitting`, `imp.form.submits`,
  `imp.form.validating`, `imp.form.dirty` and `imp.form.formError`. A submit increases
  `imp.form.submits`. Every mounted control watches that counter, runs its own validators again,
  synchronously, and writes its result into `imp.form.errors`. When the notification of the counter
  returns, the form reads the errors, and runs `onSubmit` only when there is none. There is no
  registry of controls, and there is no bookkeeping of a lifecycle. A control that unmounts stops
  mattering, because it is no longer subscribed.
- **A control renders its own label, its help text and its error.** `label[for]`, `aria-describedby`
  and `aria-invalid` resolve by id, and they cannot cross a shadow root. So a separate `formField`
  wrapper component could never label the control that it wraps. The wrapper is therefore not a
  component. Every control takes `label`, `ariaLabel`, `help` and `required`, and renders the whole
  field group in one shadow root. `radioGroup` renders a real `<fieldset>` with a `<legend>`, for
  the same reason. The name of the group, and its options, must share a root.
- **imp stores an error as a message key with its parameters, and not as a resolved string.** So a
  change of language renders the error again, in place, like every other word that the library
  shows, see `translatable-by-default.md`. imp stores the plain string that a custom `validate`
  returns as it is.
- **imp shows an error only after the person changes the field and leaves it, or tries to submit.**
  imp tracks that with `imp.form.touched` and `imp.form.submits`. A field counts as changed when its
  value differs from the value it had when it mounted. So a form does not report a problem while
  somebody still types in the first box. A keyboard or screen reader user who tabs through the form
  does not hear "This field is required" from every field that they pass.
- **An async check is a separate prop, with a different rhythm.** `validate` is synchronous, and it
  runs at every commit. `validateAsync` returns a promise, and it runs on **blur and on submit**
  only. A round trip that asks "is this username taken?" must not fire on every keystroke. A
  synchronous failure stops the async check. So imp never asks a server about a value that is
  already invalid. While a check is in flight, imp marks the field in `imp.form.validating`, and the
  field carries `aria-busy`. The newest run wins, through a token. So a stale answer can never
  overwrite a fresh one, and a control that unmounts during a check clears its own entry. A check
  that rejects reports `imp.form.checkFailed`. It does not open the gate. A server that nobody can
  reach must not let invalid data through.
- **A submit waits only when something is really in flight.** `runSubmit` increases the counter.
  When `imp.form.validating` is empty, it decides in the same tick. So a form with no async check
  still submits synchronously. Otherwise it sets `imp.form.submitting`, which spins the submit
  button, and it continues when the last check clears. The form learns that by a watch on the state,
  and not by a promise that a control gave it.
- **The form tracks whether its values changed.** `imp.form.dirty` is `true` while `imp.form`
  differs from one baseline, by the same structural comparison that `set` uses. It is a boolean, and
  not a map per field, because its readers ask one question: "is there anything to save or to
  lose?". A save button and a `beforeLeave` guard read it.
- **A successful submit moves the baseline.** The baseline starts as `initialValues`. When
  `onSubmit` returns, or its promise resolves, the values that the form passed to `onSubmit` become
  the baseline. Those are the values at the start of the submit, not at its end. So an edit made
  while the save runs keeps the form dirty. A failed submit leaves the baseline alone. A
  `beforeLeave` guard must not ask the person to discard work that the server has.
- **`resetForm` restores the same baseline.** One baseline serves both questions, so a reset always
  makes the form clean. `resetForm(source, values)` replaces the baseline first. That covers data
  that arrives after the mount, and a save outside `onSubmit`. A reset while a submit runs wins over
  that submit. So a form that clears itself inside `onSubmit`, to take the next record, is clean
  when the save resolves.
- **A failure that belongs to no single field is state too.** When `onSubmit` throws, or its promise
  rejects, the form writes into `imp.form.formError`. The next submit and `resetForm` write `null`.
  The form shows the failure in an error `notice` that it renders above its last child, where the
  buttons sit. The notice is mounted from the start, with `open` bound to the state. So a screen
  reader announces the failure, because the words change inside a live region that is already on the
  page. The value is a string, and not the error object, because a state holds plain data only, see
  `state-plain-data-values.md`.
- **Only a `FormError` speaks to the person.** `imp/std/inputs` exports `FormError`, a subclass of
  `Error`. For a `FormError`, the form writes the first line of its message. For any other error it
  writes `''`, and the notice shows the translated `imp.form.submitFailed`. The message of an
  arbitrary exception is written for a developer, such as `TypeError: ...`, and it is in English. So
  the author opts in to a message. imp logs the original error with `impLogger`.
- **A submit is an action, and not a mode of a button.** `submitForm(source)` and
  `resetForm(source, values?)` are plain functions of `imp/std/inputs`. They take the click event,
  or a node inside the form, and dispatch a composed, bubbling, cancelable event from it. The form
  catches the event and claims it. So any `button` is the submit button, at any depth:
  `button({ events: { click: submitForm } }, 'Save')`. There is no `submitButton` component and no
  `resetButton` component. A button that must spin reads `imp.form.submitting`, in a component of
  the app. `button` keeps no `type` prop, see `standard-component-library.md`. **The implicit
  submit**, which is Enter in a single-line field, is implemented by the form. The platform would
  otherwise have provided it.

## Consequences

- A form is declarative and flat. `initialValues` goes in, `onSubmit` comes out, and each control
  carries one string. That is the shape that an agent writes correctly, and imp can check it. A
  malformed path, and a `field` with no form around it, both fail loudly at mount. They do not bind
  to nothing in silence.
- Anything in the subtree can read the values, with `useState(self, 'imp.form')`. So a live summary,
  a preview panel and a dependent field are ordinary consumption of a state. They are not a form
  API.
- Nothing is added to the kernel. All of this builds on `initState`, `useState`, `watch` and `set`.
  That keeps the state layer complete as it is.
- Async validation cost nothing structurally. The question "who is still checking?" is another piece
  of state. So the form waits for a state to become empty. It does not wait on a set of promises
  that it would have to collect from a registry that it deliberately does not have.
- The split between `validate` and `validateAsync` is a real thing to learn. The reward is that
  neither one has a surprising rhythm. Synchronous feedback is immediate, and imp touches the
  network only when the person leaves the field, or submits. An app that wants an async check on
  every keystroke must debounce it, and drive it itself.
- A write rebuilds the object along the path. So the deduplication of `set`, by structural equality,
  keeps working, and a branch that nobody touched keeps its identity. The cost is one shallow copy
  per level of the path, on each keystroke. That is nothing beside the DOM work that it avoids.
- A control owns the markup of its label. So an app cannot supply its own label element for a
  standard control. To name a control from outside, use `ariaLabel`. That is a plain string, and it
  crosses a boundary freely.
