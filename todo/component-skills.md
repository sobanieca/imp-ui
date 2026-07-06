# Component skills

Let a component author ship, alongside the component, a **skill**: a piece of text that teaches an AI
agent how to use the component — its purpose, its props, its signals/events, and short usage
examples. imp assumes app code is written by AI agents, not by hand, so a shared component is only
useful if an agent can discover how to call it before writing code against it. The skill is the
machine-readable usage manual the agent reads first.

## Authoring — a `skill` export

A component declares its skill by exporting a string named `skill` from its module, next to the
component itself:

```js
import { div, button } from 'imp'

export const skill = `
Counter — a self-contained increment/decrement widget.

Usage:
  import counter from './counter.js'
  counter({ start: 0, step: 1 })

Props:
  start  number  initial value (default 0)
  step   number  amount each button adds/subtracts (default 1)

Emits a 'change' event with the new value in event.detail.
`

export default function counter({ start = 0, step = 1 } = {}) {
  // ...
}
```

The skill is a **plain string** deliberately. Because it is just a value the module exports, it
survives `imp bundle` untouched — the string is preserved in the bundled output the same as any other
export, so a component distributed as a bundle carries its skill with it and an agent can still read
it. No separate sidecar file, no metadata format to keep in sync with the code; the skill lives in
the same module as the component and is reviewed in the same change.

## Reading — `imp skill <file>`

A new CLI command imports a module, reads its `skill` export, and prints it to stdout so an agent can
capture it:

```
imp skill ./components/counter.js
```

- Prints the value of the module's `skill` export to **stdout** (nothing else on stdout), so an agent
  can pipe or capture it cleanly. Diagnostics go to stderr.
- If the module has no `skill` export, exit non-zero with a clear message on stderr
  (`no skill export in <file>`) so tooling can tell "component without a skill" apart from a real
  failure.
- If the `skill` export is not a string, error out — the contract is a string.

### How it loads the module

Reuse the exact machinery `imp test` already uses to load user modules in-process
(`src/cli/test.js`): bundle the target file with esbuild through the shared resolver so `imp`,
`imp/test`, and vendored `dependencies/` specifiers resolve, then import the result as a data URL and
read the `skill` export. This means a component whose module imports `imp` or other dependencies
still resolves correctly when its skill is read, with no separate resolution path to maintain.

Reading only the `skill` export must not require the component to render — importing the module
should surface the exported string without mounting anything to the DOM. Component modules that do
heavy work at import time are the open question below.

## Multiple components / discovery (later)

Start with the single-file `imp skill <file>` command — it is the minimal useful surface and unblocks
agents immediately. A project-wide view can follow once the single-file path is proven:

- `imp skill` with no path could scan the project (reusing the `src/cli/walk.js` walker, like `imp
  test` and `imp preview`) for every module that exports a `skill`, and print an aggregated catalog
  (one section per component, JSON with `--json`) — a single surface an agent reads to learn the whole
  component set.
- Whether the standard component library (`todo/stdlib-components.md`) ships its built-in components'
  skills through this same `skill` export is a follow-up: if it does, `imp skill` becomes the one way
  an agent learns both first-party and project components.

## Relationship to `imp preview`

`imp preview` (`todo/component-preview.md`) shows a component's visual states to a **human**; a
component skill describes a component's usage to an **agent**. They are complementary and share the
"a component is a self-describing unit" framing: a well-published component has a `.preview.js` for
eyeballing and a `skill` export for agents. Keep them independent — neither depends on the other — but
they can be documented together as the two halves of shipping a reusable component.

## Commands

- `imp skill <file>` — print the component's `skill` export to stdout; non-zero exit if absent.
- (later) `imp skill` — aggregate every skill in the project; `--json` for structured output.

## Docs

Document the `skill` export convention and the `imp skill` command in `docs/`, framed for the reader
as "publish a component your (or someone else's) AI agent can learn to use": write a `skill` string in
the component module, run `imp skill <file>` to read it. Explain the bundle-survival benefit in plain
language. Never mention Deno or internal loader functions, per the hide-Deno and docs rules in
`CLAUDE.md`.

## ADR impact

If accepted, record a `component-skills.md` ADR: the `skill` string export as the component-usage
contract, the rationale for a plain string (bundle-safe, co-located, no sidecar), and the `imp skill`
command loading modules through the shared `imp test` resolver to read and print the export. Update
the ADR table in `adr/README.md`.

## Open questions

- **Skill ships into the production bundle.** The plain-string export is what makes the skill
  bundle-*safe* (it survives `imp bundle` so an agent can still read it from a distributed bundle) —
  but that same property is a downside for an app that only *consumes* a component: the skill text is
  dead weight in the shipped app bundle, because nothing references it at runtime and it won't be
  tree-shaken away (it is a used export as far as the bundler knows). This may not be the optimal
  shape. Possible directions to explore when working on this: have `imp bundle` strip `skill` exports
  from app output by default (an opt-out for anyone bundling a component *for redistribution*, where
  the skill must stay), or move the skill to a form that is only pulled in when explicitly requested.
  Leave this as an **open concern** and find a solution during implementation — do not assume the
  plain-string-in-bundle approach is final.
- **Import-time side effects.** Reading `skill` imports the whole module. Components that do work at
  import time (register globals, open connections) would run that work just to print a skill. Is
  documenting "keep module top level side-effect free" enough, or does the skill need a lazier
  extraction (e.g. static parse of the export) to avoid executing the module at all? (A static parse
  would also sidestep the bundle-bloat concern above, since the string need never be a real runtime
  export.)
- **String vs. structured skill.** A plain string is the starting contract. Is there later value in a
  structured form (name, summary, props, examples) that tooling can parse field-by-field, or does
  free-form text (which agents read well) stay the right shape?
- **Skill for a component with variants.** A module may export several components. Is `skill` one
  string for the module, or should there be a way to attach a skill per named export?
</content>
</invoke>
