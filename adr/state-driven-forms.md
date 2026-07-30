# State-driven forms: values are named state, fields are dot paths

## Context

A control inside its own shadow root does not participate in an outside `<form>`
(`shadow-dom-isolation.md`), so native submit, `FormData` collection and constraint validation
cannot reach standard components. The form layer therefore had to be built rather than borrowed, and
the open question was how a control gets hold of **one field** of a form's values.

Named state (`event-propagated-state.md`) shares a whole object down the tree, and `computed` can
project one field out of it — but only to read. A write cannot be inverted out of a function, so a
control handed `computed([user], (u) => u.address.city)` can display a value and never commit one.
The two candidates were a split contract (`value` reads, a separate `commit` prop writes) and a
writable path projection added to the kernel.

## Decision

**A form's values are ordinary named state, and a control names its field with a dot path.**

- **`form({ initialValues })` calls `initState('imp.form', initialValues ?? null)` on itself.** The
  values live at the form's own position in the tree, so a second form on the page owns a second
  `imp.form`, and unmounting a form disposes its values with the rest of the subtree. Nothing is
  registered, wired or torn down by hand.
- **A control declares `field: 'user.firstName'`.** It resolves `imp.form` from its own position
  with `useState` — the same lookup every other component does, so it works at any nesting depth,
  through layout components and app components alike — then reads its value by walking the path and
  writes by rebuilding the object along it.

  This is what makes nested fields work with **no kernel change**: a path is data the form layer can
  walk in both directions, where `computed` is a function that only walks one way. The writable path
  projection stays rejected as unearned, and the split contract is not needed. `value` remains for
  standalone controls outside a form, taking a state or a plain value.
- **Everything the form layer needs to agree on is state**, not a registry: `imp.form.errors`,
  `imp.form.touched`, `imp.form.submitting` and `imp.form.submits`. Submitting increments
  `imp.form.submits`; every mounted control watches it, re-runs its own validators synchronously and
  writes its result into `imp.form.errors`; when the counter's notification returns, the form reads
  the errors and runs `onSubmit` only if there are none. No control registry, no lifecycle
  bookkeeping, and a control that unmounts stops mattering by virtue of no longer being subscribed.
- **A control renders its own label, help text and error.** `label[for]`, `aria-describedby` and
  `aria-invalid` resolve by id and cannot cross a shadow root, so a separate `formField` wrapper
  component could never label the control it wraps. The wrapper is therefore not a component: every
  control takes `label`, `ariaLabel`, `help` and `required` and renders the whole field group in one
  shadow root. `radioGroup` renders a real `<fieldset>`/`<legend>` for the same reason — the group's
  name and its options must share a root.
- **Errors are stored as a message key and params, not a resolved string**, so a language change
  re-renders them in place like every other word the library shows (`translatable-by-default.md`). A
  custom `validate` returning a plain string is stored as-is.
- **An error is only shown once its field has been left or a submit has been attempted**, tracked by
  `imp.form.touched` and `imp.form.submits`, so a form does not shout at someone still typing in the
  first box.
- **Async checks are a separate prop with a different rhythm.** `validate` is synchronous and runs
  at every commit; `validateAsync` returns a promise and runs only on **blur and submit**, because a
  "is this username taken" round trip must not fire on every keystroke. A sync failure
  short-circuits it, so a server is never asked about a value that is already invalid. In flight,
  the field is marked in `imp.form.validating` and carries `aria-busy`; the newest run wins by
  token, so a stale answer can never overwrite a fresh one, and a control that unmounts mid-check
  clears its own entry. A rejected check reports `imp.form.checkFailed` rather than failing open —
  an unreachable server must not let invalid data through.
- **Submit waits only when something is actually in flight.** `runSubmit` bumps the counter and, if
  `imp.form.validating` is empty, decides in the same tick — so a form with no async checks still
  submits synchronously. Otherwise it sets `imp.form.submitting` (spinning the submit button) and
  resumes when the last check clears, which the form learns by watching the state rather than by
  holding any promise a control gave it.
- **Submitting is an action, not a button mode.** `submitButton()` and `resetButton()` find their
  form by dispatching a composed, bubbling event that the form catches, and read
  `imp.form.submitting` to drive their own spinner. `button` keeps no `type` prop
  (`standard-component-library.md`), and **implicit submission** — Enter in a single-line field — is
  implemented by the form, which the platform would otherwise have provided.

## Consequences

- A form is declarative and flat: `initialValues` in, `onSubmit` out, and a string per control. That
  is the shape an agent gets right, and it is checkable — a malformed path or a `field` with no form
  around it fails loudly at mount rather than silently binding to nothing.
- The values are readable by anything in the subtree with `useState('imp.form')`, so a live summary,
  a preview pane or a dependent field is ordinary state consumption rather than a form API.
- The kernel gained nothing. All of this is built on `initState`, `useState`, `watch` and `set`,
  which keeps the state layer complete as it stands.
- Async validation cost nothing structurally: because "who is still checking" is just another piece
  of state, the form waits on a state becoming empty rather than on promises it would have had to
  collect from a registry it deliberately does not have.
- The split between `validate` and `validateAsync` is a real thing to learn, and the reward is that
  neither one has a surprising rhythm: sync feedback is immediate, and the network is touched only
  when the user leaves the field or submits. An app that wants an async check on every keystroke has
  to debounce and drive it itself.
- Writes rebuild the object along the path, so `set`'s structural-equality dedup keeps working and
  untouched branches keep their identity. The cost is one shallow copy per level of the path on each
  keystroke, which is nothing next to the DOM work it avoids.
- Because a control owns its label markup, an app cannot supply its own label element for a std
  control. Naming from outside is `ariaLabel`, which is a plain string and crosses boundaries
  freely.
