# preview - one component at a time, from a `*.preview.js` file

```
imp preview [path] [--port 4517] [--env <name>] [--mock | --no-mock]
imp preview --list [--json]
```

`imp preview` serves every **preview file** of the project in one app. The catalog is down the side,
and a click opens a component in place, at `/<group>/<name>`. The page shows the `imp skill` command
of the component at the top of its Skill tab. Then it shows a vertical tab per named export. A panel
holds the component in a resizable stage, with the code of the call site and a state editor behind
two toggle buttons. A **Skill** tab renders the component's `*.skill.md`. There is no app boot, no
backend, and no navigation to the right screen. It is the same dev server as [start](start.md)
underneath, with terminal telemetry and reload on save.

## The preview file

A component in `todos.js` gets a sibling `todos.preview.js`. **Every named export except the two
metadata exports below is a scenario.** The export name is the panel label. Panels appear in the
order written.

```js
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

export const name = 'Todo list'
export const group = 'Widgets'

mockModule('./http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk', done: false }]),
}))

export const empty = todoList({ todos: [] })
export const populated = todoList()
export const busy = todoList({ loading: true })
export const lazy = () => todoList(buildFixture()) // a function is called at render time
export const overdue = {
  scenario: 'Three overdue items, one of them done',
  component: todoList({ todos: overdueFixture() }),
}
```

A component that calls a backend has two ways to get data here. `mockModule` replaces a module the
component imports. `--mock` serves the project's `*.mock.js` files to the previewed component, so
its real requests get answers (see [mocks](mocks.md)). A component that uses an [http](http.md)
client needs one initialized above it. Preview it inside a small host component that calls
`initHttpClient`.

`mockModule(specifier, factory)` behaves exactly as in [testing](testing.md). The specifier is
relative to the preview file, or it is a dependency alias. The factory receives `{ spy, orig }`.
Every import of that module, at any depth, resolves to what you return. **A mock applies to the
whole preview app**, because every preview shares one module graph. Two files that mock the same
module must return the same factory, or imp reports both and leaves them out of the build. Scenarios
that need different data differ by the arguments you pass.

## Metadata exports

`name` and `group` are **not scenarios**. They name the component on the page. Each is optional.
Each must be a plain string literal, or imp ignores it.

| export  | what it does                                                            |
| ------- | ----------------------------------------------------------------------- |
| `name`  | the label in the catalog, the search, the page head and the browser tab |
| `group` | the group the component is listed under, replacing the folder name      |

Without them, the label falls back to the file name and the folder. `inputs/text-field.preview.js`
is `text_field` under `inputs`.

## The code of a scenario

The code toggle of a panel shows the call site of the scenario. imp cuts it from the preview file:
the expression of the export, the imports that it uses, and every helper of the file that it
reaches, in file order. A function export shows the call inside it. So write a scenario as the call
you want a person to copy. A helper is fine. It is shown above the call.

## Rules an agent gets wrong

- **A scenario is the component pre-filled. There is no story format**, no `args`, no `meta` export,
  no decorators. Write the call you would write at a real call site.
- **`name` and `group` are reserved.** A scenario cannot have one of these names. A scenario named
  `name` becomes the component's label and never renders.
- **Do not describe the component in the preview file.** The `*.skill.md` next to the component is
  the description, and the page shows it as the Skill tab. The `imp skill` command at the top of
  that tab is derived from the path. There is nothing to declare.
- **Export an instance, or a function that returns one.** imp calls a function when the panel
  renders. Use a function when the fixture must be built fresh.
- **Give a scenario a readable label with the object form.** `{ scenario, component }` labels the
  tab and the panel with the `scenario` string. `component` is the instance or the function. Write
  `scenario: 'With a click handler'` in place of an export named `withClickHandler`. The export name
  stays the id in `?scenario=<name>`. The code panel shows the `component` expression.
- **Preview files are never part of the app.** Nothing imports them, so `imp build` never sees them.
  Put fixtures there, not app code.
- **The state editor reads the running scenario.** It lists every state that a component in the
  scenario initialized, with the tag of that component. A computed name is listed like a literal
  one. A state a child reads with `useState` appears once, under its provider. A non-JSON value is
  read-only. A component that calls `useState` does not mount without a provider. Wrap it in a
  component that calls `initState` with that name and a fixture value, and pass the wrapper as the
  scenario. The editor lists the state under the wrapper.
- Write a `*.preview.js` **and** a `*.skill.md` for a component you ship. The preview is for a
  person. The skill is for an agent. See [components](components.md).

## The page

- **The shell.** One frame, one app. The catalog of components is down the side, one row per group
  with the components under it, and the component you look at is marked. A click opens a component
  in place, with no page load. The theme button and the language and direction pickers are in a
  settings panel beside the page. `/` opens the catalog as a card per group. A group name opens
  `/<group>`, a card per component with its first scenario rendered. A click on a card opens the
  component. A preview file that fails to build shows its error in place of its panels, and the rest
  of the catalog stays up.
- **Scenario tabs.** One vertical tab per export, in file order. The selected tab is in the address
  as `?scenario=<name>`, so a link opens a scenario. Every panel mounts at once, so a stage keeps
  its state across a change of tab. The button at the foot of the strip folds the tabs away, so the
  panel gets the width. The strip starts folded on a screen narrower than `40rem`, and imp remembers
  a fold in the browser.
- **Stage.** Drag the right, bottom or corner handle to resize. A readout shows the size. The
  component re-lays-out live, which is how you find the width where it breaks.
- **State editor.** The sliders toggle in the panel head opens it in a movable window under the
  toggle, so the stage keeps the full width. A close of the window releases the toggle. A scenario
  with no state gets no toggle. It shows the state the components in the scenario hold, as JSON.
  Edit a value and apply it (or press `Ctrl`/`Cmd`+`Enter`). The component updates through imp's
  normal fine-grained path, with no remount and no reload. Each panel is bound to its own instance,
  and the list is read again each time the window opens.
- **Code.** The code toggle in the panel head opens the call site under the stage, as a highlighted
  `codeBlock` with a copy button. The choice is remembered, so every panel opens with the code shown
  until you hide it.
- **Skill.** The second tab of the page. It is the component's `*.skill.md`, rendered to HTML, the
  same text that `imp skill` prints. A component without one says so.
- **Agent line.** The `imp skill` command of the component, ready to copy, at the top of the Skill
  tab. A standard component gets `imp skill std/<name>`, a project component gets
  `imp skill ./<path>.js`. A component without a skill file says so there.
- **Theme editor.** _edit theme_ is beside the theme button. Knobs: mode (light/dark), primary,
  secondary, font, mono font, border radius (`none` | `small` | `medium` | `large`), shadow (`none`
  | `soft` | `strong`). Every other colour token is derived from the two base colours. Under the
  knobs, **Tokens** is the whole theme of the mode as JSON. An edit there applies as soon as it
  parses, and a knob rewrites the tokens it drives. A token with no knob, such as `background-app`
  or a font weight, starts as the selected theme sets it. Copy or download the result as a
  `theme.js` that exports `light` and `dark`, then pass it to `init({ theme })`. Drafts are kept per
  theme name in `localStorage`. _reset_ clears one. The review widget of `imp start` opens the same
  editor on a page of the app. See [theming](theming.md).
- **Entry page.** imp generates the page around a preview, with no stylesheet of the app in it. So a
  web font that `index.html` links does not load there. Set `preview.entry` in `imp.json` to an HTML
  file of your own, such as `preview.html`, that holds the font links in its `<head>` and an empty
  `<body>`. imp replaces the `<title>` and appends its scripts to the body. It adds the imp icon
  when the head has no icon link. It keeps every other tag, so never point it at the app's
  `index.html`, whose scripts would start the app. A path that resolves to no file fails at startup.
- **Review widget.** The same widget that `imp start` injects, as the imp mark in the bottom corner,
  without its **Theme editor** button, because the page has _edit theme_. The person picks a part of
  the previewed component and comments on it. imp writes the note to `.imp/reviews/` with the
  preview page it came from. Read the folder before you rework a component on a vague report. See
  [start](start.md).
- **Theme button, language and direction pickers.** `preview.themes` and `preview.translations` in
  `imp.json` feed them (see [config](config.md)). Choices survive reloads. imp lists your themes
  first, then the built-in ones. A theme of yours named like a built-in theme replaces it. The theme
  button shows the current theme with an icon. A click steps to the next theme. A pointer over the
  button, or the focus on it, opens a menu that lists every theme with an icon. So one click picks
  any of them. Direction has **auto** (follows the language), **ltr** and **rtl**. Pin it while you
  read English to catch a hardcoded `margin-left`. Direction applies to the component only, never to
  the toolbar, so the controls stay in place. The theme applies to the whole page, because the page
  is itself built from `imp/std`. See [theming](theming.md) and [i18n](i18n.md).

## Finding previews

With no path, imp discovers every `*.preview.js` in the project and `/` lists them. A path narrows
it. A preview file opens straight to it. The address of a component is `/<group>/<name>`, in lower
case with hyphens, such as `/widgets/counter`. A reload keeps it, and a bookmark opens it. A
**component** path opens its sibling preview (`imp preview components/todos.js` ->
`components/todos.preview.js`). A folder limits discovery. `?scenario=<name>` selects a scenario
tab, and a click on a tab writes it.

A component is listed as **`group/name`**, taken from the file's `group` and `name` exports. Without
them, imp uses the folder that holds the preview file and the file's own name without `.preview.js`.
So `src/inputs/text-field.preview.js` with no metadata is `inputs/text_field` in the catalog and in
the search. Put your components in folders and the catalog groups itself. Declare `group` to group
them your own way. Two files that declare the same `group` land in one group, whatever folders they
are in.

## Groups, their icons and their order

A component belongs to the folder of its preview file, with a folder icon, until `preview.groups` in
`imp.json` names a module:

```json
{ "preview": { "groups": "src/preview-groups.js" } }
```

```js
import { luLayoutGrid, luTextCursorInput } from 'imp/icons'

export const groups = {
  widgets: { name: 'Widgets', icon: luLayoutGrid },
  inputs: { name: 'Inputs', icon: luTextCursorInput },
}
```

A preview file imports the object and exports one entry as `group`:

```js
import { groups } from '../preview-groups.js'

export const group = groups.widgets
```

- The export must be an object named `groups`. Each key is a group, with a `name` for the catalog,
  an `icon` from `imp/icons`, and an optional `priority` number.
- **`priority` puts a group ahead of the rest.** A group with a priority comes before every group
  without one. A lower number comes first. Groups without one keep the key order.
- **`group` is `groups.<key>`, imported from the module that `preview.groups` names.** Not a string.
  imp reads the key from the source, so the value must be that plain member expression.
- Listed groups come first, by priority and then in the order written. A component with no `group`
  lands in its folder, after them, with the folder icon. A listed group with no previews is not
  shown.
- A missing module path fails `imp preview` at startup. A `group` that is not a key of the module,
  or that is imported from another file, is reported in the terminal, and the component falls back
  to its folder. A malformed export is reported in the browser console, and the catalog falls back
  to folder icons.

`imp preview --list` prints the discovered files, one per line. `--list --json` prints them as a
JSON array. Keep folders out with `preview.exclude`.
