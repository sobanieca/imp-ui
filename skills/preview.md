# preview - one component at a time, from a `*.preview.js` file

```
imp preview [path] [--port 4517] [--env <name>] [--mock | --no-mock]
imp preview --list [--json]
```

Serves each **preview file** as its own page: the file's `description` as one agent instruction
below the page head, then one labelled panel per named export, under a **Preview** tab holding the
component in a resizable stage with a state editor beside it and a **Code** tab showing the call
that built it. No app boot, no backend, no navigating to the right screen. It is the same dev server
as [start](start.md) underneath - terminal telemetry and reload on save included.

## The preview file

A component in `todos.js` gets a sibling `todos.preview.js`. **Every named export except the three
metadata ones below is a scenario** and the export name is the panel label; panels appear in the
order written.

```js
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

export const name = 'Todo list'
export const category = 'Widgets'
export const description = "Run 'imp skill ./components/todos.js' before writing code with it."

mockModule('./http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk', done: false }]),
}))

export const empty = todoList({ todos: [] })
export const populated = todoList()
export const busy = todoList({ loading: true })
export const lazy = () => todoList(buildFixture()) // a function is called at render time
```

A component that calls a backend has two ways to be fed here: `mockModule` replaces the module it
imports, and `--mock` serves the project's `*.mock.js` files to the previewed component so its real
requests are answered - see [mocks](mocks.md). A component reaching for an [http](http.md) client
needs one initialized above it, so preview it inside a small host component that calls
`initHttpClient`.

`mockModule(specifier, factory)` behaves exactly as in [testing](testing.md) - the specifier is
relative to the preview file or a dependency alias, the factory receives `{ spy, orig }`, and every
import of that module at any depth resolves to what you return. **A mock applies to the whole
preview file**, so scenarios that need different data differ by the arguments you pass.

## Metadata exports

`name`, `category` and `description` are **not scenarios** - they name the component in the page
instead. Each is optional and each must be a plain string literal; anything else is ignored.

| export        | what it does                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| `name`        | the label in the catalog, the search, the page head and the browser tab          |
| `category`    | the group the component is listed under, replacing the folder name               |
| `description` | the agent instruction below the page head: the command an agent should run first |

Without them the label falls back to the file name and the folder - `inputs/text_field.preview.js`
is `text_field` under `inputs`.

## Rules an agent gets wrong

- **A scenario is the component pre-filled - there is no story format**, no `args`, no `meta`
  export, no decorators. Write the call you would write at a real call site.
- **`name`, `category` and `description` are reserved**, so a scenario cannot be called any of
  them - a scenario named `name` becomes the component's label and never renders. `description` is
  an instruction, not prose about the component: write the exact command, like
  `"Run 'imp skill std/button' to learn what button can do before using it."`
- **Export an instance, or a function returning one.** A function is invoked when the panel renders,
  which is what you want when the fixture must be built fresh.
- **Preview files are never part of the app** - nothing imports them, so `imp build` never sees
  them. They are the place to put fixtures, not app code.
- **The state editor is discovery, not a contract.** It lists names found by reading your source for
  literal `initState`/`useState` calls; a computed name or one behind a helper simply is not listed,
  and a non-JSON value shows read-only. Do not restructure a component to make it appear.
- Write a `*.preview.js` **and** a `*.skill.md` for a component you ship: the preview is for a
  person, the skill is for an agent. See [components](components.md).

## The page

- **The shell** - every page is the same frame: the catalog of components down the side, grouped by
  category, with the one you are looking at marked; and the theme, language and direction pickers in
  a settings panel beside the page. `/` opens the catalog as a card per category.
- **Stage** - drag the right, bottom or corner handle to resize; `phone`, `tablet`, `desktop` jump
  to common viewports and `fit` returns to full width. The component re-lays-out live, which is how
  you find the width where it breaks.
- **State editor** - the state the component manages, as JSON. Edit and apply (or `Ctrl`/`Cmd`+
  `Enter`) and the component updates through imp's normal fine-grained path - no remount, no reload.
  Each panel is bound to its own instance.
- **Agent instruction** - the file's `description`, ready to copy, once per page below the head
  rather than per scenario: the command to hand an agent before it writes code with this component.
  A file that declares none says so there.
- **Theme editor** - _edit theme_ beside the switcher. Knobs: mode (light/dark), primary, secondary,
  border radius (`none` | `small` | `medium` | `large` | `full`), shadow (`none` | `soft` |
  `strong`). Every other colour token is derived from the two base colours. Copy or download the
  result as a `theme.js` exporting `light` and `dark`, then pass it to `init({ theme })`. Drafts are
  kept per theme in `localStorage`; _reset_ clears one. See [theming](theming.md).
- **Review widget** - the same one `imp start` injects, in the bottom corner: the person picks a
  part of the previewed component, comments on it, and imp writes the note to `.imp/reviews/` with
  the preview page it came from. Read the folder before reworking a component on a vague report. See
  [start](start.md).
- **Theme, language and direction switchers** - fed by `preview.themes` and `preview.translations`
  in `imp.json`, see [config](config.md); choices survive reloads. Direction has **auto** (follows
  the language), **ltr** and **rtl** - pinning it while reading English is the quickest way to catch
  a hardcoded `margin-left`. Direction applies to the component only, never the toolbar, so the
  controls stay put; the theme applies to the whole page, because the page is itself built from
  `imp/std`. See [theming](theming.md) and [i18n](i18n.md).

## Finding previews

With no path, every `*.preview.js` in the project is discovered and `/` lists them. A path narrows
it: a preview file opens straight to it, a **component** path opens its sibling preview
(`imp preview components/todos.js` → `components/todos.preview.js`), and a folder limits discovery.
`?scenario=<name>` - or the panel's **isolate** button - renders one scenario alone.

A component is listed as **`category/name`**, taken from the file's `category` and `name` exports
and falling back to the folder holding the preview file and the file's own name without
`.preview.js` - so `src/inputs/text_field.preview.js` with no metadata is `inputs/text_field` in the
catalog and in the search. Group your components into folders and the catalog groups itself; declare
`category` to group them your own way, and two files declaring the same `category` land in one group
whatever folders they sit in.

`imp preview --list` prints the discovered files one per line, `--list --json` as a JSON array. Keep
folders out with `preview.exclude`.
