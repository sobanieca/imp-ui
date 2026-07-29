# skill — reading imp's manuals, and writing one for a component

```
imp skill                          the index: every subject and component, one line each
imp skill state routing            one or more subjects in full
imp skill std/button               a standard component
imp skill ./components/counter.js  a component of this project, by path to its module
```

Everything prints straight out of the binary: offline, no network, at the exact imp version the
project runs — so what you read is what the project executes. **No flags.** Skill text is the only
thing on stdout; diagnostics go to stderr with exit code 1, so "no skill yet" is distinguishable
from a failure and `imp skill state > state.md` captures exactly the manual.

## How to use it

- **Start with the bare `imp skill`.** The index is cheap; one call tells you what exists, a second
  teaches you the part you need. Do not guess an API from memory — imp is buildless and its call
  shapes differ from other frameworks in ways that look plausible either way.
- **Subjects answer to the name you already have**, case-insensitively: the subject (`state`), the
  import specifier (`imp/state`, `imp/std/button`), an alias (`router`, `imp.json`), or the page
  name (`state.md`). An unknown subject lists the real ones on stderr and exits 1.
- **Cross-references print as the command that fetches them** — `Rendering (imp skill rendering)` —
  and every target is repeated on a `Related:` line at the foot of the page, so you can always
  follow one manual to the next without guessing a path or a URL.
- **A component is asked for by file**, not by name: `imp skill ./components/counter.js`, or the
  skill file itself. Nothing is imported or bundled to answer — the file is read off disk.

## Writing a component's skill

A component documents itself in a markdown file with the module's name beside it:

```
components/counter.js
components/counter.skill.md
```

That one convention covers imp's standard components and yours, so an agent learns both the same
way. Keep it shorter and more mechanical than a guide for a person — the import, the call shape, a
prop table, the events it emits, the mistakes it invites:

````md
# counter — a self-contained increment/decrement widget

```js
import { counter } from './counter.js'

counter({ start: 0, step: 1 })
```

| Prop    | Values | Default | Notes                                 |
| ------- | ------ | ------- | ------------------------------------- |
| `start` | number | `0`     | The value it counts from              |
| `step`  | number | `1`     | How much each press adds or subtracts |

Emits a `change` event with the new value in `event.detail`.
````

- **The first line is the summary**, so start it with the component name and one clause saying what
  it is. That line is what the index shows.
- **The sidecar is the only place a component's skill is written.** Never declare `impSkill` in the
  module by hand — a module doing both alongside a sidecar is a build error.
- **Write one for every component you build.** A component without a sidecar is simply absent from
  the index, and `imp skill ./that/module.js` exits 1 naming the file to write.
- A skill file prints **verbatim** — no banner is added, because it is already titled and summarized
  by its author.

## What happens to it at build time

`imp build counter.js` (a JS entry — a component) folds the sidecar into the bundle as
`export const impSkill`, so the manual travels to whoever installs it with no second file to
distribute. `imp build` on an HTML page (an app) adds none, copies none, and strips any it finds,
including in lazy chunks — your users download your app, not your documentation. See
[build](build.md) and [components](components.md).
