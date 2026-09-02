# Skills: a shipped `skills/` corpus plus `*.skill.md` sidecars, read with `imp skill`

## Context

imp assumes that an AI coding agent writes most of the app code. An agent cannot browse a
documentation site while it works. Even when it can, it reads whichever version somebody published,
and not the version that the project runs. With no local, versioned way to learn a feature, or a
component, an agent writes code from a stale memory of it.

Two bodies of text are necessary, and they have different owners. A **subject**, such as the state,
the routing or the CLI, belongs to imp. `docs/` explains a subject to a person, in prose that
somebody must read from start to end. That is the wrong shape for an agent. An agent needs the call
shape, the table, and the rule that it would otherwise get wrong. It does not need the rationale
between them. To serve one text to both readers made every page a compromise. It was too long to be
cheap context, and too short to teach a newcomer. A **component** is different again. The manual of
a component belongs to that component. Its owner is whoever wrote the component, which is imp for
the standard library, and the author of the app for everything else. That manual must also survive a
publication to another imp app, where the consumer has no access to the source tree.

## Decision

**`skills/` is the corpus of subjects, and imp writes it for an agent.** There is one page per
subject. Each page is short and mechanical. It gives the imports, the API tables, the rules that an
agent gets wrong, and a worked example. `deno compile` includes the `skills/` tree in the binary, in
the same way as it includes `THIRD_PARTY_LICENSES.md` for `imp licenses`. `imp skill` reads the
pages from there. There is no network, and there are no project files. The version is the version
that shipped with the binary that runs. imp no longer compiles `docs/` in. `docs/` is the site for a
person, and nothing reads it at runtime.

**The two corpora are otherwise independent.** They reach their readers through different channels.
`skills/` travels in the binary, and `docs/` travels through the published site. So neither one
dictates the structure of the other, and one subject can map to one page here, and to part of a page
there. A convention ties them, and not a mechanism. A change to a feature updates both, in the same
commit. imp deliberately does not enforce that. The failure that is worth catching is a page that is
**stale**, and no test that compares two file trees can see that.

**The skill of a component is a `<module>.skill.md` file beside it.** So `button.js` gets
`button.skill.md`. One convention covers the standard components of imp, and the components of an
app. So an agent learns both in the same way, and an author remembers one thing. The file is plain
markdown. imp executes nothing to read it. A reviewer sees it in the same diff as the component that
it describes. `imp fmt` formats it like any other markdown file. Its first line is its summary.

**`imp build` decides where that text goes, from the entry that you gave it, and not from a
configuration.** A JS entry is a component that somebody else programs against. imp appends the
sidecar of each module as `export const impSkill = '...'`. So the skill travels inside the bundle,
and there is no second file to distribute. An HTML entry is a finished app. imp injects nothing. It
copies no skill file into the output. It also removes the skill text that a module already carries,
for every module that enters the build. imp empties the initializer of an
`export const impSkill = <literal>` declaration. It also removes an `impSkill` specifier from the
export clause of a bundled module, so a bundler shakes the string behind it away. A module that
declares `impSkill` itself, beside a sidecar, is a build error, and the message points at the
sidecar. That keeps one concept, and not two.

To do both, and to inject nothing and remove what arrives, is what makes the guarantee for an app
structural, in place of a best effort. Tree-shaking alone is not enough. A bundler drops an
`impSkill` that nothing references from a module that somebody imports statically. But a module that
somebody imports **dynamically** becomes its own chunk, and the bundler keeps the exports of that
chunk. imp measured that on esbuild 0.28.1, with code splitting on, as imp builds it. So an app that
loads a pre-built component lazily would otherwise ship the prose.

`imp skill` is the one surface for reading both corpora:

- **There is one registry, in `cli/src/skill.js`, and one derivation.** `SKILLS` carries what nobody
  can read off the tree. That is the group of a subject, its aliases, such as `imp/state`,
  `state.md` and `router`, and its summary of one line. The page itself is `skills/<subject>.md`. So
  a subject names its own file. imp does not list a standard component there at all. imp reads the
  subject of a standard component out of the `imp/std` barrels at runtime, and follows an
  `export *`. So `std/button`, its sidecar at `std/general/button.skill.md`, and the `button` and
  `imp/std/button` aliases, all follow from the one `export { button }` line. To add a component to
  a barrel is the whole registration. A test asserts the derived set against the real exports of the
  barrels. Another test asserts that the page of every subject exists. So a new subject, and a new
  standard component, cannot land without a skill.
- **With no argument, imp prints an index.** That is one line per subject and per component, plus
  every module in the project that has a skill file beside it. imp discovers those with the shared
  walker. To discover what exists costs one cheap call, and to learn one part costs one more call.
  To print a whole catalog would cost a few hundred kB of context, to answer the question "what
  exists?".
- **For a subject, imp prints its manual with a banner.** The page prints without a change, except
  for two rewrites. imp rewrites a link between two documents into the command that prints the
  target, as in `Rendering (imp skill rendering)`. imp gathers those targets again into a `Related:`
  line at the foot of the page. imp also aligns a markdown table again, where a rewrite changed its
  width. **A skill file prints without a change**, for imp and for the project. Its author already
  gave it a title and a summary.
- **You ask for a component by file**, as in `imp skill ./components/counter.js`, or by the skill
  file itself. imp bundles nothing, and imports nothing, to answer. It reads the sidecar off disk. A
  missing skill file exits with a non-zero code, and imp names the file to write. So a tool can tell
  "no skill yet" from a real failure.
- **There is no flag, and there is stdout only.** Skill text is the only thing on stdout. A
  diagnostic goes to stderr, with exit code 1. To run the command and to read the output is the
  whole interface.
- **`imp` with no argument points an agent at the command.** The last line of the usage text is
  addressed to an AI agent. It tells the agent to run `imp skill` before it writes code. So the
  entry point is discoverable from the one command that anything runs first.

## Consequences

- There is one source of truth per audience. Somebody writes each subject twice, on purpose. Once
  for a person, in `docs/`, and once for an agent, in `skills/`. The manual of a component sits
  beside the component, and a reviewer sees it in the same diff.
- **A feature is not done until both pages are updated.** That is the cost of the split. A review
  carries that cost, and tooling does not.
- `docs/` can grow a page that the binary never carries, such as a page about the philosophy, or a
  landing page. `skills/` can carry a page that no reader needs.
- A page in `skills/` is read as plain text, in a terminal. So it stays concrete and self-contained.
  It holds a call shape, a prop table, and the rules that an agent gets wrong. It avoids anything
  that only works on a website.
- The binary grows by the `skills/` tree and the sidecars, which is about 110 kB against about 150
  MB. That is immaterial against `binary-size-limit.json`. It is also less than half of what `docs/`
  cost.
- To ship a standard component now means to ship its skill file. imp expects the same of the
  components of an app, and nothing forces it. A component with no skill file is simply absent from
  the index.
- No byte of skill text reaches an app of an end user, whatever that app is assembled from. imp
  injects nothing into a page build. It excludes a skill file from what it copies into the output.
  It removes a skill that a third-party bundle carries, on the way in.
- A published bundle carries the skill of its **entry module** only. A component that a barrel
  re-exports loses its skill. Two `export *` sources that export `impSkill` make the name ambiguous,
  and a bundler drops an ambiguous star export. So a package with several components either
  describes itself in the skill beside its entry, or publishes one entry per component.
- The skill of a published component is only as fresh as the bundle that it shipped in. imp bakes
  the text in at build time, like the code beside it.
