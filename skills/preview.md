# preview — one component at a time, from a `*.preview.js` file

```
imp preview [path] [--port 4517] [--env <name>] [--mock | --no-mock]
imp preview --list [--json]
```

Serves each **preview file** as its own page: one labelled panel per named export, under a
**Preview** tab holding the component in a resizable stage with a state editor beside it, and a
**Code** tab showing the call that built it. No app boot, no backend, no navigating to the right
screen. It is the same dev server as [start](start.md) underneath — terminal telemetry and reload on
save included.

## The preview file

A component in `todos.js` gets a sibling `todos.preview.js`. **Each named export is a scenario** and
the export name is the panel label; panels appear in the order written.

```js
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

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
requests are answered — see [mocks](mocks.md). A component reaching for an [http](http.md) client
needs one initialized above it, so preview it inside a small host component that calls
`initHttpClient`.

`mockModule(specifier, factory)` behaves exactly as in [testing](testing.md) — the specifier is
relative to the preview file or a dependency alias, the factory receives `{ spy, orig }`, and every
import of that module at any depth resolves to what you return. **A mock applies to the whole
preview file**, so scenarios that need different data differ by the arguments you pass.

## Rules an agent gets wrong

- **A scenario is the component pre-filled — there is no story format**, no `args`, no `meta`
  export, no decorators. Write the call you would write at a real call site.
- **Export an instance, or a function returning one.** A function is invoked when the panel renders,
  which is what you want when the fixture must be built fresh.
- **Preview files are never part of the app** — nothing imports them, so `imp build` never sees
  them. They are the place to put fixtures, not app code.
- **The state editor is discovery, not a contract.** It lists names found by reading your source for
  literal `initState`/`useState` calls; a computed name or one behind a helper simply is not listed,
  and a non-JSON value shows read-only. Do not restructure a component to make it appear.
- Write a `*.preview.js` **and** a `*.skill.md` for a component you ship: the preview is for a
  person, the skill is for an agent. See [components](components.md).

## The page

- **Stage** — drag the right, bottom or corner handle to resize; `phone`, `tablet`, `desktop` jump
  to common viewports and `fit` returns to full width. The component re-lays-out live, which is how
  you find the width where it breaks.
- **State editor** — the state the component manages, as JSON. Edit and apply (or `Ctrl`/`Cmd`+
  `Enter`) and the component updates through imp's normal fine-grained path — no remount, no reload.
  Each panel is bound to its own instance.
- **Code tab** — the scenario's own call plus the preview file's import lines, syntax-highlighted in
  the current theme's colours and ready to copy. It is read out of the file, so it cannot drift from
  what rendered. Only exports written as `export const name = …` have one; a re-export through
  `export { … }` shows a note instead.
- **Theme, language and direction switchers** — fed by `preview.themes` and `preview.translations`
  in `imp.json`, see [config](config.md); choices survive reloads. Direction has **auto** (follows
  the language), **ltr** and **rtl** — pinning it while reading English is the quickest way to catch
  a hardcoded `margin-left`. Direction applies to the component only, never the toolbar, so the
  controls stay put; the theme applies to the whole page, because the page is itself built from
  `imp/std`. See [theming](theming.md) and [i18n](i18n.md).

## Finding previews

With no path, every `*.preview.js` in the project is discovered and `/` lists them. A path narrows
it: a preview file opens straight to it, a **component** path opens its sibling preview
(`imp preview components/todos.js` → `components/todos.preview.js`), and a folder limits discovery.
`?scenario=<name>` — or the panel's **isolate** button — renders one scenario alone.

`imp preview --list` prints the discovered files one per line, `--list --json` as a JSON array. Keep
folders out with `preview.exclude`.
