# imp-ui Concept Review

A review of all design documentation (README.md, notes.md, to-consider.md, handlers-removal.md)
plus the current source (`src/`) and example app, looking for weak spots in the concept and a
simpler way to structure it.

**TLDR:** The core idea is sound and well-argued — element factories + Solid-style signals + real
DOM is a coherent, defensible kernel. The two big weaknesses are (1) the *scope* contradicts the
*pitch*: a framework whose selling point is "simple, no long docs" is specced across 8 layers,
~30 stdlib components, theming, i18n with RTL, a 6-command CLI, and 50KB of notes; and (2) the
single most load-bearing decision — disposal — is still open and discussed inconsistently across
three documents while peripheral things (RTL toggles in the showcase theme editor) are fully
specified. The fix for both is the same move: split the concept into a tiny **kernel** and a
**distribution** built on top, and restructure the docs around decisions rather than layers.

## Weak spots in the concept

### 1. The simplicity claim and the scope are at war

Constraints #5/#6 promise "very simple to use, without need to study long documentation." But
constraint #9 alone (theming + i18n as concerns that "every layer below must be designed with")
is a paragraph long, and Layer 5 is the largest section in the plan — bigger than reactivity.
Preset Facebook-like themes, `Intl.PluralRules` pluralization, `direction: 'auto'` via
`Intl.Locale().textInfo`, a live theme-editor showcase with export buttons — this is an ecosystem
spec, not a small framework. None of it is *bad*, but treating it all as "the framework" means v1
can't ship until all of it exists, and the docs an agent must ingest grow accordingly.

The doc also shows **detail inversion**: the highest-stakes open questions (disposal model,
item-level reactivity in `each`, batching, error handling) are one-liners or absent, while the
lowest-stakes features (showcase direction toggle, theme export button) have full bullet specs.
A design doc should be most precise where the cost of being wrong is highest.

### 2. Disposal is the keystone, and it's unresolved in three places at once

Events, effects, `onMount`, `when`/`each` swaps, and route teardown all hang off the disposal
model. Right now:

- notes.md §1 says listeners use an AbortController "owned by the **element's** disposal scope"
- handlers-removal.md correctly argues it should be one controller **per scope**
  (component/slot/row), not per element, and recommends the owner tree
- to-consider.md proposes a completely different model (custom elements + `imp:dispose`
  walk-and-dispatch)
- src/rendering.js:55 implements none of this — it still uses the legacy `on*` prefix with no
  cleanup

handlers-removal.md already contains the right analysis (including the genuinely important
insight that the real leak is signal subscriber sets, not DOM listeners). This decision should be
**made**, not kept open: adopt the owner tree, fold to-consider.md into a "rejected, here's why"
note, and fix the §1 wording. Until then, Layer 2 is blocked and Layer 1's `events` design is
provisional.

### 3. "Reactivity is opt-in" (constraint #8) isn't true in practice

The stdlib reads a reactive `theme`, every user-facing string flows through a reactive `t()`,
routing is a signal driving a `match`. You cannot use the toolkit without signals. Meanwhile the
imperative path interacts *badly* with the reactive one: the docs themselves admit imperative
`node.remove()` is invisible to disposal. So the two "first-class paths" are actually one blessed
path plus an escape hatch with a documented leak. Be honest about that: signals are the model;
direct DOM mutation is supported *inside* a component you own, not a parallel architecture.
That's a simpler story too.

### 4. The "function means reactive" dispatch rule has real holes

- **Function-valued properties are unreachable.** `events` rescues event handlers, but a custom
  element with a callback property — `chart({ formatter: fn })` — gets `fn` *invoked* as a signal
  getter and the result assigned. There's no escape hatch. You need one (e.g. a `raw()`/`prop()`
  marker, or rule: function props on `wc()`-wrapped elements assign as-is).
- **Component-reference footgun**, aimed straight at your primary user (AI agents):
  `div(userMenu)` instead of `div(userMenu())` silently creates an effect that calls the
  component on every dependency change and stringifies the result into a text node. A dev-mode
  warning ("function child returned a Node — did you mean to call it?") is cheap and high-value.
- **The docs contradict themselves on inline text.** §1 says `p("Hello ", strong("world"))`
  "won't work — the second arg is interpreted as props." But by your own dispatch rule,
  `strong("world")` returns a Node, and Node → child. Your actual `normalize()` in rendering.js
  handles this case correctly *in document order*. Either the trade-off section is stale or the
  dispatch rule is — right now an agent reading the doc will avoid a pattern the implementation
  supports.

### 5. Property-first fallthrough needs an exception list

`k in node → node[k] = v` breaks on **read-only properties**: `input({ list: 'suggestions' })`
silently fails (`list` is a read-only IDL property; it must be `setAttribute`). Same class of
problem for `form` on inputs. Every framework that does property-first ends up with a small
attribute-forcing exception list — plan for it now rather than discovering it via bug reports.
Also, rendering.js does `node[k] = v ?? ''` while the doc says `null`/`undefined` removes/nulls —
small drift, but for `value` the difference is observable.

### 6. File-based routing contradicts buildless

Deriving routes from `modules/<module>/pages/<page>.js` requires someone to scan the filesystem.
That's either the dev server (making the CLI mandatory — goodbye "runs directly in the browser")
or a generated manifest (a build step wearing a disguise). Explicit
`route(path, () => import('./pages/x.js'))` registration is simpler, honest about being
buildless, still lazy-loads, and is trivially writable by an agent. Make explicit registration
the model and drop file-based routing, or move it to the CLI as an optional manifest generator
later.

### 7. The AI-agent rationale is asserted, not designed

Two claims deserve scrutiny because they justify real decisions:

- *"JavaScript instead of TypeScript to save tokens."* Dubious trade. Type errors are exactly
  the class of mistake agents make and types catch cheaply; the token overhead is marginal. You
  can stay buildless and still ship `.d.ts` + JSDoc types so agents (and their tooling) get
  checking for free. The current rationale will read as a weakness to anyone evaluating the
  framework.
- *"AI agents don't benefit from casing-as-signal"* (lowercase components). The opposite argument
  is at least as strong: making components indistinguishable from tag factories removes
  information from the code, and you're shipping a lint rule to *enforce* the ambiguity. Fine to
  keep the convention, but the stated reason doesn't hold it up.

The genuinely strong AI-agent feature in the docs — the browser→CLI telemetry bridge in 4a,
letting an agent read console output and failed requests from the terminal — is buried in a
sub-bullet. That, plus the flat machine-readable docs (8e) and one-command toolkit, is the real
"AI-ready" story. Lead with it.

### 8. Missing pieces that belong in the kernel

While theming gets pages, these have nothing:

- **Error handling.** What happens when an effect throws? When a component factory throws during
  `each`? When `async()`'s promise rejects outside the `catch` branch? Agents especially need
  predictable failure behavior.
- **Shared/cross-component state.** "Signal-as-context — close over it" is one bullet. For
  dashboards and CRUD apps (your target 80%), the store question (`each` item reactivity,
  Open Q #1) *is* the data-model question. It's flagged "decide before v1" — it should be decided
  in the same pass as disposal, because they're the two decisions everything else sits on.

## How to restructure it — simpler concept, simpler docs

### Concept: kernel vs. distribution

One split resolves the scope/simplicity tension:

**The kernel** (the framework, must be perfect for v1, fits in one short doc):

- `el()` + dispatch + `css()` — rendering
- `signal` / `effect` / `computed` / `batch` — reactivity
- `when` / `each` / `onMount` / `mount()` — structure + lifecycle
- Owner-tree disposal with one AbortController per scope

**The distribution** (the toolkit, built *on* the kernel, ships incrementally):

- `imp` CLI (dev server + telemetry bridge first; lint/fmt/test wrappers next; build last)
- Router (explicit registration)
- Theme + i18n (as stdlib modules — they're just signals + CSS variables; they never needed to
  be a "framework constraint")
- Component stdlib, showcase, `wc()`/server-islands

Then "simple framework" is true (the kernel is genuinely tiny) and "all-in-one toolkit" is also
true (the distribution delivers it) without one claim undermining the other. v1 = kernel + dev
server + todo example. Explicitly defer from v1: RTL, preset themes, showcase theme editor,
`wc()`, pluralization, file-based routing, portals/async/bind (already deferred).

Also compress the 9 constraints to 5 — they overlap (#5≈#6, #2≈#3) and #9 is a design section
masquerading as a constraint: **buildless · real DOM from function calls · run-once components
with signals · one toolkit · agent-ergonomic**.

### Docs: organize around decisions, not layers

The current shape — one 50KB notes.md mixing vision, API spec, inline implementation source, and
a project checklist, plus two satellite docs that partially contradict it — is exactly the
structure that produced the disposal inconsistency. Proposed:

```
README.md            — pitch (yours is already good)
docs/
  principles.md      — the 5 constraints + the "why" section, one page
  decisions.md       — ADR-style log: one entry per decision with a status
                       (decided / open / rejected-because). Disposal, each-item
                       reactivity, dispatch rule, JS-vs-TS, routing model,
                       light-vs-shadow DOM all live HERE, nowhere else
  kernel.md          — the spec for el/css/signals/primitives/disposal.
                       This is also the agent-ingestible doc (8e) — same file,
                       not a separate artifact
  distribution.md    — CLI, router, theme/i18n, stdlib: scope and intent only,
                       detailed spec written when each part is next to build
  roadmap.md         — the checklist from notes.md, trimmed to match v1 scope
```

Then **delete** handlers-removal.md and to-consider.md by folding their conclusions into
`decisions.md` (handlers-removal.md's owner-tree recommendation becomes the "decided" entry;
to-consider.md's custom-element model becomes the "rejected, reasons preserved" entry). Satellite
analysis docs that outlive their decision are how a project ends up with three simultaneous
disposal models.

The decision log is the piece doing the most work here: it gives every open question one home
with one current answer, it's the first thing to check before writing code, and it's the document
an AI agent most needs and least gets from typical framework docs.
