# Skills

Let every part of imp — and every component an app writes — ship a **skill**: a piece of text that
teaches an AI agent how to use it. Its purpose, its call shape, its props or arguments, its events,
its pitfalls, and short usage examples. imp assumes app code is written by AI agents, not by hand,
so a feature is only useful if an agent can discover how to call it before writing code against it.
The skill is the machine-readable usage manual the agent reads first.

Two sets of skills exist, with different owners:

- **imp's own skills** — the standard components (`adr/standard-component-library.md`) first, then
  the library subjects (`imp/state`, `imp/router`, `imp/theme`, `imp/html`) and the toolkit topics
  an agent has to get right to work in an imp repo (testing, config, dependencies). imp's
  documentation, versioned with the binary, written by imp's maintainers.
- **A project's skills** — user code, versioned with the app, written by whoever builds the app.

One command reads both. The **authoring** mechanism differs, because the delivery vehicles differ:
an imp skill ships inside the imp binary and must never reach an app's runtime graph, while a
project component's skill lives in the project's own source and must survive being published.

## Authoring — imp's own skills: a sibling `*.skill.md`

An imp skill is a markdown file next to whatever it describes:

```
lib/src/std/general/button.js   → lib/src/std/general/button.skill.md
lib/src/api/state.js            → lib/src/api/state.skill.md
cli/src/test.js                 → cli/src/test.skill.md
```

"Next to the thing it documents" is the whole rule, for a component, a subject API, or a CLI command
alike — so a skill is reviewed in the same diff as the behaviour it describes, which is the only
thing that keeps it honest. A shared table maps a skill name to its file, in the spirit of
`IMP_SUBPATH_MODULES` in `cli/src/specifiers.js`: one place to register a new skill, one place a
test can walk.

The CLI resolves the files the way `cli/src/build.js` already resolves library modules
(`import.meta.resolve('../../lib/src/…')`); `deno compile --include lib/src --include cli/src`
already ships both trees into the binary, exactly as `THIRD_PARTY_LICENSES.md` is shipped for
`imp licenses`. Consequences of this shape:

- **Zero bytes reach an app.** The skill is CLI data, never a runtime module export, so it cannot
  land in an app bundle and there is no stripping pass to write for imp's own skills.
- **Nothing is executed to read a skill.** No module import, no import-time side effects, no DOM.
- **Markdown stays markdown** — headings, prop tables and fenced examples, formatted by `imp fmt`
  like any other markdown file, instead of a template literal fighting the formatter inside a JS
  module.

Size is not a concern: a few kB per skill against a ~160 MB binary, well inside
`binary-size-limit.json`.

Keep a skill deliberately shorter and more mechanical than `docs/`: call shape, prop or argument
table, the rules an agent gets wrong (props object must be first, no `type` prop on `button`, no
outer margins), one or two examples. It is not a second copy of the docs — the docs teach a person a
subject, a skill tells an agent how to call the thing correctly on the first try.

**Start with the std components** (`button`, `heading`, `text`, `link`), because they are the
surface an agent writes against most, then add subject and toolkit skills as their text settles.

## Authoring — project components: an `impSkill` export

A project component declares its skill by exporting a string named `impSkill` from its module, next
to the component itself:

```js
import { button, div } from 'imp/html'

export const impSkill = `
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

The name is **`impSkill`**, not `skill`: it is imp-branded like every other reserved name in the
toolkit, it cannot collide with an app that has its own notion of a "skill", and it is unambiguous
to grep for — which matters because `imp build` treats it specially.

A plain string export is right here for a reason imp's own skills do not share: a component
published for others to consume is distributed **as a bundle**, and a bundle's entry exports are
preserved — so the skill travels with the component, with no sidecar file to publish alongside it.

### `impSkill` in the production bundle

The rule: **a skill survives only when the build is for an imp host, and is stripped otherwise.**
That is exactly `impProvidedByHost` in `cli/src/build.js` (`targetImpHost: true` on a JS entry) —
the "I am publishing this for another imp app to consume" build, where the skill is part of what is
being published. An HTML entry is an end-user app and ignores `targetImpHost` already, so it strips.

Most of this happens on its own. Measured with esbuild 0.28.1 (the bundler `imp build` uses,
`adr/production-bundling.md`), an unreferenced `export const impSkill` re-exported through a barrel
is dropped by tree-shaking:

```
button.js  export const impSkill = 'LONG SKILL TEXT…'; export const button = () => 'btn'
index.js   export * from './button.js'
app.js     import { button } from './index.js'; console.log(button())
→ bundle   var o=()=>"btn";console.log(o());
```

So the explicit strip is a **guarantee, not a fix** — the bundler is not fighting us. What it covers
is the case tree-shaking cannot: a component module pulled in by a **dynamic** import becomes a
chunk whose exports are its public surface, so its skill text would otherwise ship. With code
splitting on by default, that is a real path, not a hypothetical.

Implementation: in the app-source load step, when not building for an imp host, replace a top-level
`export const impSkill = <string>` initializer with an empty string. The declaration stays valid, so
nothing that references it breaks, and normal tree-shaking then removes the empty const. To keep
that transform trivially safe, an **`imp lint` rule constrains the shape**: `impSkill` must be a
top-level `export const` initialized with a plain string or an interpolation-free template literal.
An author who writes a computed skill is told at lint time rather than silently shipping the text
into production.

## Reading — `imp skill`

One command, three forms, no flags:

```
imp skill                         # index of every skill: imp's own + the project's
imp skill std/button              # one imp skill, in full
imp skill ./components/counter.js # one project component's skill, in full
```

- **`imp skill`** with no argument prints an **index**, not every skill in full: one line per skill
  — name and a one-line summary — covering imp's own skills plus every project module exporting
  `impSkill`, discovered with the shared walker (`cli/src/walk.js`) like `imp test` and
  `imp preview`. This is deliberate. Dumping the full text of a 60-component catalog would be a few
  hundred kB into an agent's context to answer "what exists?". An index costs one cheap call to
  discover and one to learn. The summary is the skill file's first line (or the first line of the
  `impSkill` string), so it needs no separate metadata.
- **`imp skill <name>`** prints an imp skill in full. Component names accept `std/<name>`,
  `imp/std/<name>` and `<group>/<name>`, so an agent that saw an import specifier can paste it back;
  subject and topic skills are the plain name (`state`, `router`, `testing`). An unknown name fails
  with an imp-branded message listing what exists, matching how an unknown `imp/std/<group>` subpath
  fails today (`cli/src/specifiers.js`).
- **`imp skill <file>`** prints a project component's skill. The file is bundled through the shared
  resolver in `cli/src/bundling.js` — the same seam `imp test` and `imp preview` use, so `imp`,
  `imp/std` and vendored `dependencies/` specifiers resolve — imported as a data URL, and its
  `impSkill` export printed. No `impSkill` export exits non-zero with `no impSkill export in <file>`
  on stderr, so tooling can tell "component without a skill" apart from a real failure. A non-string
  `impSkill` is an error: the contract is a string.

Across all forms: skill text goes to **stdout and nothing else does**, so an agent can pipe or
capture it cleanly; diagnostics go to stderr.

**No flags.** No `--json`, no `--out`: the output is prose an agent reads, and a JSON envelope
around prose has no consumer that plain text does not already serve. Running the command and reading
stdout is the entire interface, and keeping it that way is what makes the command trivial for an
agent to reach for.

**Name:** `imp skill`, not `imp describe` — it matches the term agents already use for this kind of
document.

## Work

- `cli/src/skill.js`: the name → file table for imp's own skills, project extraction through the
  shared bundling seam, index assembly.
- Wire `imp skill` into `cli/src/main.js` and the `HELP` block.
- `imp build`: strip `impSkill` initializers unless the build is `impProvidedByHost`
  (`cli/src/build.js`).
- `imp lint`: a rule constraining `impSkill` to a top-level `export const` with a literal string, so
  the strip is always safe (`cli/src/lint_rules.js`).
- Write a `*.skill.md` for each std component that exists (`button`, `heading`, `text`, `link`), and
  make shipping one part of the definition of done for every std component that lands after
  (`todo/stdlib-components.md`). Subject and toolkit skills follow.
- A test asserting every component exported from a `lib/src/std/**/index.js` barrel has a registered
  skill — this is what keeps sidecar files in sync, since nothing else forces it.
- CLI test coverage for each form, including the non-zero exits, plus a build test proving the skill
  text is absent from an app bundle and present in a `targetImpHost` one.

## Relationship to `imp preview`

`imp preview` (`adr/component-preview.md`) shows a component's visual states to a **human**; a skill
describes its usage to an **agent**. They are complementary and share the "a component is a
self-describing unit" framing: a well-published component has a `.preview.js` for eyeballing and a
skill for agents. Keep them independent — neither depends on the other — but document them together
as the two halves of shipping a reusable component.

## Docs

Document both halves in `docs/`: that imp's own usage manuals are one `imp skill` call away, and
that a project component publishes its own by exporting an `impSkill` string. Frame it as "publish a
component your (or someone else's) AI agent can learn to use", and explain in plain language that a
shipped app never carries the text while a component published for another imp app does. Never
mention Deno, internal file paths or loader functions, per the hide-Deno and docs rules in
`CLAUDE.md`.

## ADR impact

If accepted, record a `skills.md` ADR: the skill as imp's agent-facing usage contract, the split
between sidecar markdown for imp's own skills (CLI data, never in an app graph, nothing executed to
read it) and an `impSkill` string export for project components (survives publishing to an imp host,
stripped from an end-user app bundle), and `imp skill` as the single, flagless reading surface over
both — an index by default, full text by name. Update the ADR table in `adr/README.md`.

## Open questions

- **String vs. structured skill.** Free-form text is the contract, because the reader is an agent
  and agents read text. Nothing planned consumes a skill field-by-field; revisit only if a real
  consumer that needs parsed fields turns up, and not before.
- **Skill for a module with several components.** A project module may export more than one
  component. Is `impSkill` one string for the module, or should there be a way to attach a skill per
  named export?
- **How far the imp-side catalog goes.** Components and subject APIs are clear. Whether toolkit
  topics (testing, config, dependencies, build) are skills or are better left to `docs/` is worth
  deciding once the first few component skills have been used in anger by an agent.
- **Sidecar for project components too.** If projects end up wanting markdown skills with no runtime
  export at all, `<component>.skill.md` next to a project component is the obvious extension of the
  imp-side convention. Do not add it up front — wait for the ask, and keep the `impSkill` export as
  the documented path so a component stays self-contained when published.
