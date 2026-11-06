# App-wide component defaults - `init({ defaults })`, one flat props object per standard component

## Context

An app has two ways to change the standard components everywhere at once. Theme tokens change the
look, see `themable-by-default-tokens.md`. Message keys change the words, see
`translatable-by-default.md`. A third kind of choice has no global place: a prop such as the `icon`
of `emptyState` or the `size` of `button`.

Some instances of a standard component are not in the code of the app. `list`, `table`, `timeline`
and `notifications` render their own `emptyState`. The app cannot
pass a prop to those instances. With no `icon` and no `image`, `emptyState` draws the imp mark. That
mark is the deliberate fallback, because it shows the toolkit in a new app. An app that wants a
neutral picture had no way to replace it in those instances.

Other libraries solve this with defaults per component name: the `components` key of a theme in MUI
and Mantine, `createVuetify({ defaults })`, the `ConfigProvider` of Ant Design.

## Decision

`init` takes a `defaults` option. It is an object keyed by the export name of a standard component.
Each value is a props object of that component.

```js
await init({ defaults: { emptyState: { icon: luInbox }, button: { size: 'sm' } } })
```

- **The defaults apply in the one function that defines every standard component.** So they reach
  every instance, also an instance that another standard component renders. No component reads
  them on its own.
- **A prop of the call wins.** A default fills only a prop that the call leaves out. A prop set to
  `undefined` counts as left out.
- **A component can declare props that replace each other.** For `emptyState`, `icon` and `image`
  are one group. A member of the group in the call drops every default of the group. So an `image`
  in a call does not meet a default `icon` and cause a warning.
- **`init` validates the shape at once.** An unknown component name and a value that is not a plain
  object throw. imp checks the props lazily, on the first instance of each component, against the
  props of that component. An unknown prop warns once and is left out.
- **A DOM node in a default is copied for each instance.** A node can be in one place only.
- **`init({ defaults })` replaces all earlier defaults.** The defaults are app-wide. There is no
  scope for a part of the tree.
- **There are no defaults per `variant`.** One flat props object per component covers the case that
  started this decision. A layer per variant can come later without a change to this shape.

`list`, `table` and `timeline` also take an `empty` prop, and `table` takes `noResults`. Each one
is the props of `emptyState` or a DOM node, for one instance. So an app can say "No teams yet" on
one list and "No webhooks" on another, without a branch around the component.

## Consequences

- The imp mark stays the fallback of `emptyState`. One line in `init` replaces it in the whole app.
- Words stay in translations. A default `title` is fixed text and does not follow the language. The
  docs tell the app to translate the `imp.` key instead.
- The list of standard component names in the defaults module must match the barrels. A unit test
  checks that `init` accepts every component export of the barrels.
- A default changes instances that the app does not see in its own code. `button: { size: 'sm' }`
  also changes the buttons inside a `dialog` that pass no `size`. That is the intent.
