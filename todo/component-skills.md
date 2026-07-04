# Component skills

Let users publish custom components that other people's AI agents can learn to use. imp assumes app
code is written by AI agents, not by hand — so a shared component is only useful if an agent can
discover how to call it: its purpose, props, signals, events, and usage examples. A component skill
is the machine-readable description that teaches an agent how to use the component.

## The idea (approach still to be decided)

Ask the component author to export a `skill` describing the component from the component's ES module
(its main file):

```js
export const skill = "description of the component: what it does, its props, and how to use it";
```

imp's CLI then follows a convention to locate and import that exported `skill` from a component
module, so an agent can read it and learn how to use the component before writing code against it.

## Open questions

- **Discovery mechanism.** How the CLI finds skill-bearing modules — a dedicated command
  (`imp skills`?) that scans dependencies and installed components, an aggregate surface an agent can
  read, or something imported on demand.
- **Skill shape.** Plain string vs. a structured object (name, summary, props, examples). A string is
  the simplest starting point; structure makes props/events machine-parsable.
- **Where it surfaces to the agent.** How the collected skills reach the agent — e.g. emitted into a
  generated context file, exposed via a command's output, or surfaced through tooling.
- **Relationship to the standard component library** (`todo/stdlib-components.md`): whether built-in
  components ship their own skills through the same mechanism.

## ADR impact

If accepted, record an ADR describing the component-skill convention (the `skill` export, how the
CLI discovers and imports it) and update the ADR table.
