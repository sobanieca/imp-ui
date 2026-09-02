# Special prop namespaces: class, style, events

## Context

Three prop keys carry structure that the plain property-first model, see
adr/property-first-prop-model.md, cannot express well:

- **`class`** is often conditional, such as "active when selected", and it is composed from several
  sources. A bare string forces the author to build that string by hand at every call site.
- **`style`** is a small language of keys and values. An inline string cannot be split. A CSS custom
  property, written as `--x`, and the difference between `camelCase` and kebab case both need
  handling.
- **An event handler is not an attribute.** The `onclick="..."` attribute form uses a string, and it
  is limited. `addEventListener` is the real mechanism, and it supports options such as `once`,
  `passive` and `capture`.

Each of these could be a separate top-level convention. But that multiplies the rules that an author
must learn.

## Decision

imp reserves three keys in the same props object, and gives each one richer handling:

- **`class`** accepts `'card'`, or `['card', maybe]`, where imp drops a falsy entry and joins the
  rest, or `{ active: cond }`, where each truthy entry turns its class on.
- **`style`** accepts a string, which imp sets without a change, or an object. In an object, imp
  maps a `camelCase` key to kebab case, and keeps a `--custom` key as it is.
- **`events`** is an object. Each key is a native DOM event name, with no `on` prefix. Each value is
  a handler `fn`, or a `[fn, options]` pair that imp passes straight to `addEventListener`. A custom
  event uses the same shape, as in `'chart-rendered': fn`.

## Consequences

- The common patterns of a conditional class and a CSS variable are expressible at the call site,
  with no helper code. That is what a component that an agent writes needs.
- A native DOM event name, such as `click` and not `onClick`, gives one naming system for a spec
  event and a custom event. The options of `addEventListener` are also available.
- These three keys are the only deviations from the rule "a key is an attribute name". Every other
  key follows adr/property-first-prop-model.md. The set of special cases is small, and you can list
  it.
- imp attaches an `events` listener with `addEventListener`, and it does not remove the listener
  automatically. A caller that must detach a listener does that itself.
