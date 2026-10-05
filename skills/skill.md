# skill - reading imp's manuals, and writing one for a component

```
imp skill                          the index: every subject and component, one line each
imp skill state routing            one or more subjects in full
imp skill std/button               a standard component
imp skill ./components/counter.js  a component of this project, by path to its module
imp skill widget                   an imp component installed as dependencies/widget/
imp skill --init                   create the /imp skill, so the agent reads these manuals
```

Every page prints out of the binary. The command works offline and needs no network. It prints at
the exact imp version that the project runs, so you read what the project executes. The only flag is
`--init`, see below. Skill text is the only output on stdout. Diagnostics go to stderr with exit
code 1. So you can tell "no skill yet" from a failure, and `imp skill state > state.md` captures the
manual only.

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
- **Ask for an installed imp component by its alias:** `imp skill widget` prints
  `dependencies/widget/imp-skill.md` verbatim. The index lists these under `INSTALLED COMPONENTS`. A
  subject with the same name wins over the alias.

## How to make the agent find imp - `--init`

`imp skill --init` writes one `SKILL.md` to `.agents/skills/imp/` (Codex, Cursor) and
`.claude/skills/imp/` (Claude Code, Cursor). The skill tells the agent to run `imp skill` before it
writes code. Then the person asks with `/imp` (Claude Code, Cursor) or `$imp` (Codex).

- imp looks for `.git` from the current folder up to the home folder.
- In a git repository, the files go to the git root. The agent sees the skill in every folder of the
  repository.
- Outside a git repository, the files go to the home folder. Then the agent sees the skill in every
  project.
- imp does not replace a skill that exists. It exits 1 and names the file to delete.

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
- **The sidecar is the only place where you write the skill of a component.** Never put skill text
  in the module.
- **Write a sidecar for every component that you build.** A component with no sidecar is absent from
  the index, and `imp skill ./that/module.js` exits 1 and names the file to write.
- A skill file prints **without a change**. imp adds no banner, because the author already gave the
  page a title and a summary.

## What happens to the sidecar at build time

`imp build counter.js` builds a JS entry, which is a component. It copies `counter.skill.md` to
`imp-skill.md` beside the bundle. A JS entry with no sidecar stops the build. Publish `imp-skill.md`
with the bundle. `imp install` copies it into `dependencies/<alias>/`, and `imp skill <alias>`
prints the manual there. `imp build` on an HTML page builds an app, and copies no skill. imp puts no
skill text into any bundle. See [build](build.md), [dependencies](dependencies.md) and
[components](components.md).
