# skill - reading imp's manuals, and writing one for a component

```
imp skill                          the index: every subject and component, one line each
imp skill state routing            one or more subjects in full
imp skill std/button               a standard component
imp skill ./components/counter.js  a component of this project, by path to its module
```

Every page prints out of the binary. The command works offline and needs no network. It prints at
the exact imp version that the project runs, so you read what the project executes. The command has
**no flags**. Skill text is the only output on stdout. Diagnostics go to stderr with exit code 1. So
you can tell "no skill yet" from a failure, and `imp skill state > state.md` captures the manual
only.

## How to use it

- **Start with the bare `imp skill`.** The index is cheap. One call tells you what exists, and a
  second call teaches you the part that you need. Do not guess an API from memory. imp is buildless,
  and its call shapes differ from other frameworks in ways that look correct either way.
- **A subject answers to the name that you already have**, and the match ignores case. Use the
  subject (`state`), the import specifier (`imp/state`, `imp/std/button`), an alias (`router`,
  `imp.json`), or the page name (`state.md`). For an unknown subject, imp lists the real subjects on
  stderr and exits 1.
- **A cross-reference prints as the command that fetches it**, for example
  `Rendering (imp skill rendering)`. Every target appears again on a `Related:` line at the foot of
  the page. So you can go from one manual to the next without a path or a URL.
- **Ask for a component by file**, not by name: `imp skill ./components/counter.js`, or the skill
  file itself. imp imports and bundles nothing to answer. It reads the file off disk.

## How to write the skill of a component

A component documents itself in a markdown file that carries the name of the module:

```
components/counter.js
components/counter.skill.md
```

That one convention covers imp's standard components and your own. So an agent learns both the same
way. Keep the page shorter and more mechanical than a guide for a person. Give the import, the call
shape, a prop table, the events that the component emits, and the mistakes that it invites:

````md
# counter - a self-contained increment/decrement widget

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

- **The first line is the summary.** Start it with the component name and one clause that says what
  the component is. The index shows that line.
- **The sidecar is the only place where you write the skill of a component.** Never declare
  `impSkill` in the module by hand. A module that declares `impSkill` and also has a sidecar is a
  build error.
- **Write a sidecar for every component that you build.** A component with no sidecar is absent from
  the index, and `imp skill ./that/module.js` exits 1 and names the file to write.
- A skill file prints **without a change**. imp adds no banner, because the author already gave the
  page a title and a summary.

## What happens to the sidecar at build time

`imp build counter.js` builds a JS entry, which is a component. It folds the sidecar into the bundle
as `export const impSkill`. So the manual goes to everyone who installs the component, and there is
no second file to distribute. `imp build` on an HTML page builds an app. It adds no skill, copies no
skill, and removes every skill that it finds, also in a lazy chunk. Your users download your app,
not your documentation. See [build](build.md) and [components](components.md).
