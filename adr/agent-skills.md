# Skills: a shipped `skills/` corpus plus `*.skill.md` sidecars, read with `imp skill`

## Context

imp assumes app code is largely written by AI coding agents. An agent cannot browse a documentation
site while it works, and even when it can, it reads whatever version is published rather than the
version the project runs. Without a local, versioned way to learn a feature — or a component — an
agent writes code from a stale memory of it.

Two bodies of text are needed and they have different owners. **Subjects** (state, routing, the CLI)
are imp's. `docs/` explains them to a person, in prose written to be read start to finish — and that
is the wrong shape for an agent, which needs the call shape, the table, and the rule it would
otherwise get wrong, not the rationale between them. Serving one text to both readers made every
page a compromise: too long to be cheap context, too terse to teach a newcomer. **Components** are
different again: a component's manual is per-component, it is owned by whoever wrote the component —
imp for the standard library, the app author for everything else — and it must survive being
published to another imp app, where the consumer has no access to the source tree.

## Decision

**`skills/` is the subject corpus, written for an agent.** One page per subject, kept short and
mechanical: the imports, the API tables, the rules an agent gets wrong, a worked example.
`deno compile` includes the `skills/` tree in the binary the same way `THIRD_PARTY_LICENSES.md` is
included for `imp licenses`, and `imp skill` reads it from there — no network, no project files, the
version that shipped with the binary being run. `docs/` is no longer compiled in; it is the
human-facing site and nothing reads it at runtime.

**The two corpora are otherwise independent.** They reach their readers through different channels —
`skills/` through the binary, `docs/` through the published site — so neither dictates the other's
structure, and one subject may map to one page here and part of a page there. What ties them is a
convention, not a mechanism: a change to a feature updates both in the same commit. That is
deliberately unenforced, because the failure worth catching is a page left **stale**, which no test
comparing file trees can see.

**A component's skill is a `<module>.skill.md` file next to it** — `button.js` → `button.skill.md`.
One convention covers imp's standard components and an app's own components, so an agent learns both
the same way and an author has one thing to remember. The file is plain markdown: nothing is
executed to read it, it is reviewed in the same diff as the component it describes, and `imp fmt`
formats it like any other markdown. Its first line is its summary.

**`imp build` decides where that text goes by the entry it was given, not by configuration.** A JS
entry is a component someone else will program against: imp appends each module's sidecar as
`export const impSkill = '…'`, so the skill travels inside the bundle with no second file to
distribute. An HTML entry is a finished app: nothing is injected, skill files are not copied into
the output, and every module loaded into the build is stripped of skill text it already carries — an
`export const impSkill = <literal>` initializer is emptied, and an `impSkill` specifier in a bundled
module's export clause is removed so the string behind it tree-shakes away. A module that declares
`impSkill` itself alongside a sidecar is a build error pointing at the sidecar, keeping one concept
rather than two.

Doing both — never injecting, and stripping what arrives — is what makes the app guarantee
structural rather than best-effort. Tree-shaking alone is not enough: an unreferenced `impSkill` is
dropped from a statically imported module, but a **dynamically imported** module becomes its own
chunk whose exports are preserved — measured on esbuild 0.28.1, with code splitting on as imp builds
it — so an app that lazy-loads a pre-built component would otherwise ship the prose.

`imp skill` is the single reading surface over both:

- **Two registries in `cli/src/skill.js`.** `SKILLS` maps a subject to its `skills/` page, a
  one-line summary, a group and its aliases (`imp/state`, `state.md`, `router`); `COMPONENT_SKILLS`
  maps a standard component to its sidecar (`std/button` → `std/general/button.skill.md`, answering
  also to `button` and `imp/std/button`). Tests assert both are in exact correspondence with the
  tree they describe, so a new subject or a new standard component cannot land without its skill.
- **No argument prints an index** — one line per subject and component, plus every module in the
  project with a skill file next to it, discovered with the shared walker. Discovery costs one cheap
  call, learning costs one more; dumping a whole catalog would cost a few hundred kB of context to
  answer "what exists?".
- **A subject prints its manual with a banner**, verbatim from the page, with cross-document links
  rewritten into the command that prints the target (`Rendering (imp skill rendering)`), gathered
  again into a `Related:` line at the foot of the page, and markdown tables re-aligned where a
  rewrite changed their width. **A skill file prints verbatim**, imp's and the project's alike — it
  is already titled and summarized by its author.
- **A component is asked for by file** — `imp skill ./components/counter.js`, or the skill file
  itself. Nothing is bundled or imported to answer; the sidecar is read straight off disk. A missing
  skill file exits non-zero naming the file to write, so "no skill yet" is distinguishable from a
  real failure.
- **No flags, stdout only.** Skill text is the only thing on stdout; diagnostics go to stderr with
  exit code 1. Running the command and reading the output is the entire interface.
- **`imp` with no arguments points agents at it.** The usage text ends with a line addressed to an
  AI agent telling it to run `imp skill` before writing code, so the entry point is discoverable
  from the one command anything runs first.

## Consequences

- One source of truth per audience unit. Each subject is written twice on purpose — once for a
  person in `docs/`, once for an agent in `skills/` — and a component's manual sits next to the
  component and is reviewed in the same diff.
- **A feature is not done until both pages are updated.** That is the cost of the split, and it is
  carried by review rather than by tooling.
- `docs/` is free to grow pages the binary never carries (a philosophy page, a landing page), and
  `skills/` is free to carry pages no reader needs.
- `skills/` pages are read as plain text in a terminal, so they stay concrete and self-contained —
  call shapes, prop tables, the rules an agent gets wrong — and avoid anything that only works on a
  website.
- The binary grows by the `skills/` tree and the sidecars (~110 kB against ~150 MB), which is
  immaterial against `binary-size-limit.json` — and under half of what shipping `docs/` cost.
- Shipping a standard component now means shipping its skill file; the same is expected of an app's
  components, though nothing forces it — a component without one is simply absent from the index.
- Zero skill bytes reach an end-user app, whatever it is assembled from: nothing is injected into a
  page build, skill files are excluded from what it copies to its output, and skills baked into
  third-party bundles are stripped on the way in.
- A published bundle carries the skill of its **entry module only**. Components re-exported through
  a barrel lose theirs — two `export *` sources exporting `impSkill` make the name ambiguous, and
  ambiguous star exports are dropped — so a multi-component package either describes itself in the
  skill next to its entry, or publishes one entry per component.
- A published component's skill is only as fresh as the bundle it shipped in — the text is baked in
  at build time, like the code beside it.
