# imp todos — a sample app

A todo app written to exercise most of imp in one place: routing with a lazily loaded area, named
state, the http client answered by mock files, standard components and forms, two languages, a
custom theme, a feature flag, one vendored dependency, and both levels of testing.

```
imp start           serve it with live reload (mocks are on, so no backend is needed)
imp test --unit     the in-process tests
imp test --e2e      the browser specs
imp preview         the components on their own, in every state
imp build --env prod
```

## What lives where

| Path                      | Shows                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/main.js`             | `init({ theme, lang, translations })`, then `mount`                        |
| `src/app.js`              | the root: one http client, one app-wide state, the route table             |
| `src/shell.js`            | header, nav, language and theme switches, the router slot passed in as DOM |
| `src/screens/todos.js`    | async load, computed filtering, a keyed list, an empty state               |
| `src/screens/new_todo.js` | a form with validation, including an async check                           |
| `src/screens/todo.js`     | edit, save, delete, a tracked request and an error boundary                |
| `src/stats/`              | a lazily loaded area with its own root, routes and messages                |
| `src/components/`         | two components of our own, each with its skill file and its preview        |
| `mocks/todos.mock.js`     | the whole API, answered in the browser                                     |
| `locales/`                | English and Polish, including imp's own form and empty-state wording       |
| `src/theme/midnight.js`   | a complete custom theme                                                    |
| `dependencies/micromark/` | the one vendored package, added by `imp install` and committed             |

## The things worth copying

**State lives at the narrowest scope that spans its readers.** `todo.items` is initialized in the
root because the list, the detail screen and the stats area all read it. The search text and the
status filter are initialized in the list screen, so they disappear with it.

**Nothing re-renders.** The summary line is a computed state bound with `text()`, the list is a
keyed `each`, and the empty state sits in a `view`. Adding a todo updates exactly the nodes that
changed.

**Every request goes through one client.** `initHttpClient('todo.api', …)` in the root; every screen
below calls `useHttpClient('todo.api')` before its first `await`. Nothing imports a fetch wrapper,
and nothing knows the mocks exist.

**The row saves itself.** `todo_item.js` owns a per-instance `todo.item.done` state, patches the API
when it changes, and puts the switch back if the request fails — no callback threaded down from the
screen.

**Position-sensitive calls come first.** In an async `onMount`, `useState`, `useHttpClient` and —
less obviously — `router()` inside an area root all have to run before the first `await`. The stats
shell keeps its `router()` slot in a variable and awaits afterwards.

**A route change moves focus, once for every screen.** The shell renders its `main` with a
`tabindex` of `-1` and focuses it from `useRoute().watch(...)` whenever the path changes, so a
keyboard or screen-reader user lands in the new screen instead of staying on the link they followed.
It watches the path, not the whole route, so a query change never pulls focus out of an input, and
the first call — the route the page loaded on — is skipped. `main:focus` clears the outline, since
nothing here was focused by hand.

**A dependency is one command, and then it is just a module.** Notes are Markdown, rendered by
[micromark](https://github.com/micromark/micromark):

```
imp install micromark
```

That vendored the package into `dependencies/micromark/micromark.js` (52 kB, one file, no
`node_modules`), pinned `"micromark": "npm:micromark@4.0.2"` in `imp.json`, and printed every
package that went into the bundle. Both are committed, so a clone runs with no registry access. From
then on it is an ordinary import by its bare alias — `import { micromark } from 'micromark'` — and
only `markdown_note.js` mentions it. micromark escapes raw HTML and drops `javascript:` URLs by
default, which is why its output can go straight into `html()` with no sanitizer.

**Translated text is bound, not read once.** `words('todo.list.title')` is a live text node and
`message('todo.form.title')` is a live state for a prop, so switching language re-localizes in
place. Props that imp does not keep live — a `select`'s `options`, a `placeholder` — sit inside a
`lang.view(...)` instead, which is why the filter row rebuilds on a language change but the new-todo
form does not (rebuilding it would throw away what you had typed).

## Testing notes

`test/todos.test.js` is plain logic. `test/todo_item.test.js` mounts the component under a tiny host
that provides the state and the client, and spies on `fetch`. Both walk `shadowRoot` with a small
recursive `find` — a component's content is never in the light DOM.

In the e2e spec, waiting needs care: `page.waitForSelector` does not see nodes that appear **inside
a shadow root** after it starts watching, so the spec waits with `page.waitForFunction` and a deep
query instead. `textContent` does not cross a shadow root either — read the innermost element,
`#summary >>> p`, not the wrapper.

## The feature flag

`TODO_STATS` gates the stats area. `env/dev.json` turns it on; `env/prod.json` leaves it off, and
`imp build --env prod` folds the branch away — the area's chunk is never emitted. Compare the two
builds:

```
imp build --env dev     chunks/area-*.js is emitted
imp build --env prod    flags folded in — TODO_STATS off
```
