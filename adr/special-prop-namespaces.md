# Special prop namespaces: class, style, events

## Context

Three prop keys carry structure that the plain property-first model
(adr/property-first-prop-model.md) cannot express well:

- **`class`** is frequently conditional ("active when selected") and composed from several sources.
  A bare string forces the author to build that string by hand at every call site.
- **`style`** is a mini key/value language; inline strings are unsplittable and CSS custom
  properties (`--x`) and `camelCase`-vs-`kebab` naming need handling.
- **Event handlers** are not attributes at all. The `onclick="..."` attribute form is string-based
  and limited; `addEventListener` is the real mechanism and supports options (`once`, `passive`,
  `capture`).

These could each be separate top-level conventions, but that multiplies the rules an author learns.

## Decision

Three reserved keys in the same props object, each with richer handling:

- **`class`** accepts: `'card'` | `['card', maybe]` (falsy dropped, joined) | `{ active: cond }`
  object where each truthy entry toggles its class on.
- **`style`** accepts: a string (set verbatim) | an object mapping `camelCase`/`--custom` keys to
  values (`camelCase` -> kebab; `--*` kept verbatim).
- **`events`** is an object of native DOM event names (no `on` prefix) to either a handler `fn` or a
  `[fn, options]` pair passed straight to `addEventListener`. Custom events use the same shape
  (`'chart-rendered': fn`).

## Consequences

- The common conditional-class and CSS-variable patterns are expressible at the call site without
  helper code, which is what agent-authored components need.
- Native DOM event names (`click`, not `onClick`) mean one naming system for spec and custom events,
  and `addEventListener` options are available.
- These three keys are the only deviations from "key = attribute name"; everyone else follows
  adr/property-first-prop-model.md. The special-casing is enumerable and small.
- `events` listeners are attached with `addEventListener` and are not auto-removed; callers that
  detach listeners do so themselves.
