# UI Framework Design Notes

A small SPA framework. Below constraints shape everything:

1. **Buildless** — plain ES modules, runs directly in the browser.
2. **Element-factory syntax** — DOM expressed as JS function calls (`el(tag, ...)` plus per-tag shortcuts). HTML elements are the substrate, not the ceiling — imp-ui is an app framework, not a hypertext renderer.
3. **`render` produces real DOM** — no virtual DOM, no string templates.
4. **Solid-style signals** — fine-grained reactivity; components run once.
5. **Simplicity** - it's supposed to be very simple to use, without need to study long documentation
6. **AI Agents target** - Framework simple to use by AI agents. Assumption - no hand written code. Javascript instead of Typescript to save tokens.
7. **All in one toolkit** - This Framework will serve also as local runtime, provide reach std library (already good base of components)
8. **Reactivity is opt-in** — signals are a tool, not a religion. Plain imperative code is a first-class path: `el` returns real DOM nodes, so you can hold a reference, mutate `.textContent`, `appendChild`, set attributes, attach listeners directly. Nothing in the framework requires a signal to exist. Use signals when fine-grained reactivity earns its keep; reach for direct DOM manipulation when it's simpler.
9. **Themable and translatable by default** — theming (colors, radius, shadows, spacing, typography tokens) and i18n (locale + `t()`) are first-class framework concerns, not user-space layers bolted on top. Every stdlib component reads tokens from a reactive `theme` signal and pipes user-facing strings through a reactive `t()`. Changing either re-skins or re-localizes the whole app instantly. Every layer below must be designed with this in mind — rendering exposes a CSS-variable surface, reactivity carries the theme/locale signals, the CLI ships a live-editing showcase, and the stdlib is a downstream consumer of both systems.

SPA only. No SSR. No hydration.

---

## 0. Why this framework

**Fragmentation is the real problem.** Modern frontend forces a stack assembly exercise before any product work happens: pick a framework, pick a router, pick a state library, pick a forms library, pick a component kit, pick a build tool, pick a dev server, pick a testing harness. Each choice has five viable answers, each answer has its own conventions, and the seams between them are where bugs and onboarding pain live. This framework rejects that: one toolkit covers rendering, reactivity, routing, runtime, and a standard component library. Boring, consistent, opinionated.

**80% is the target, not 100%.** No claim of universality. Some apps need things this won't provide (heavy data viz, native-bridge mobile, complex collaborative editing, etc.). That's fine — pick something else for those. For the broad middle — dashboards, CRUD apps, internal tools, marketing-adjacent product UIs — this should be the full answer. And when something *is* missing, the framework is simple enough that an AI agent can produce the missing piece from scratch rather than introducing a heavy dependency.

**SPAs are still the right default.** SSR has captured a lot of mindshare lately, and a lot of that mindshare is downstream of the fact that companies selling compute love selling SSR compute. The original move — frontend on a CDN, backend serving clean readable JSON, clear separation of concerns — remains one of the best things that happened to web development. Backends become debuggable, cacheable, language-agnostic. Frontend deploys are cheap and instant. Loading states are a solved problem. This framework leans into that model unapologetically.

**Boring on purpose.** No novel rendering algorithm, no new reactivity paradigm, no breakthrough perf claim. Just a small, legible set of tools that get most of the job done. Novelty is a tax — both on the user and on the AI agents we expect to write code in this framework. If a feature isn't here, the assumption is that with an AI agent you can write it yourself, in user code, in an afternoon.

---

## 1. Elements

DOM expressed as function calls. `el(tag, ...args)` is the one primitive; per-tag shortcuts (`div`, `p`, `button`, …) are thin wrappers around it. Each call returns a real DOM node — no virtual DOM, no string template, no compile step. Element factories are the substrate; the framework's job is everything *above* them (reactivity, theming, i18n, routing, runtime, stdlib).

```js
p("This is a paragraph")
p({ style: { marginTop: '10px' } }, "with inline style")

div([
  p("paragraph inside div"),
  p("another paragraph"),
])
```

### Dispatch rule

Arguments are identified by **type**, not position. Order doesn't matter; `p({...}, "text")` and `p("text", {...})` are equivalent.

- **Array** → children
- **String / number** → text content
- **Plain object** (not array, not Node, not function) → props/attributes
- **Node** → single child
- **Function** → reactive child or reactive prop (see §3)
- `null`, `undefined`, `false` → ignored (so `cond && el` works)

```js
function el(tag, ...args) {
  const node = document.createElement(tag)
  const { props, children } = normalize(args)
  applyProps(node, props)
  appendChildren(node, children)
  return node
}
```

### Children flattening

`div([header(), items.map(renderItem), footer()])` mixes nodes with arrays. Flatten recursively when building, and drop `null`/`undefined`/`false` in the same pass so conditionals stay natural.

### Inline-text trade-off

`p("Hello ", strong("world"))` won't work — the second arg is interpreted as props. Use the array form: `p(["Hello ", strong("world")])`. The dispatch rule stays clean in exchange.

### Prop keys

Prop keys map directly to HTML attribute names. No aliases (`className`, `htmlFor`, `dataset`) — one name per attribute, and it's the HTML one. Names that aren't valid bare JS identifiers go in string-quoted keys:

```js
div({ class: "card", "data-id": "42", "aria-label": "Close" })
label({ for: "email" })
```

`class` and `for` are no longer reserved as object property names in modern JS, so they work bare; `data-*` and `aria-*` need quotes.

Dispatch order inside `applyProps`:

1. `events: {...}` — object map of event name → handler, attached via `addEventListener` with an `AbortController` signal owned by the element's disposal scope (see Events subsection below).
2. `style: {...}` — object → inline CSS (camelCase → kebab-case).
3. **Property-first fallthrough:** if `key in node`, assign as a property (`node[key] = v`); otherwise `setAttribute(key, v)`.

The property-first rule quietly absorbs the cases that would otherwise need special-casing:

- **Boolean attrs** (`disabled`, `checked`, `hidden`, `open`, …) — every one has a boolean *property*, so `{ disabled: true }` does `node.disabled = true` correctly; `false` clears it. No stringy `"true"` foot-gun.
- **Live form state** (`value`, `checked`, `selected`, `indeterminate`, `files`) — these must be set as properties, not attributes; the attribute only seeds the *initial* value and is ignored after the user types. Property-first makes reactive `{ value: draft }` actually work.
- **Custom element properties** — `myChart({ data: obj })` works: `"data" in node` is true on the custom element, so the object is assigned as a property instead of being stringified to `[object Object]` by `setAttribute`.

SVG branch skips step 4: SVG element properties are mostly read-only mirrors, and case-sensitive attribute names (`viewBox`, `preserveAspectRatio`) need to round-trip through `setAttribute(NS)` verbatim.

`null` / `undefined` / `false` as a prop value removes the attribute (or sets the property to `null`), so `{ disabled: isLocked }` toggles cleanly when `isLocked` flips.

### Events

Event listeners live under a single `events` prop — an object mapping event name to handler. The event name is the one you'd pass to `addEventListener`: bare, lowercase, no `on` prefix.

```js
button({ events: { click: add } }, "Add")
input({ events: { input: e => draft.set(e.target.value) } })
form({ events: { submit: handleSubmit } })
div({ events: { pointerdown: start, pointermove: drag, pointerup: end } })
```

Why a nested object instead of bare `onClick` props:

- `click` is the DOM-native event name; `onClick` is React legacy.
- Custom events (`'chart-rendered'`, `'my-component:ready'`) have no `on<name>` IDL property, so any prefix-based detection rule can't catch them. `events: { 'chart-rendered': fn }` works uniformly for spec and custom events.
- Listener options have a natural home: `events: { click: [fn, { once: true, passive: true }] }`.
- The nesting shape mirrors `style: { ... }` — users learn one pattern, not two.

Each entry is attached with `addEventListener(name, fn, { signal })` where `signal` comes from an `AbortController` owned by the element's disposal scope (§5). On framework-driven unmount — `when` / `each` swaps the subtree out, a route changes, the parent component tears down — the controller aborts and every listener attached this way detaches in one pass. No leaked handlers, no manual `removeEventListener`.

Caveat: this fires only on *framework-driven* unmount. Calling `node.remove()` imperatively is invisible to the disposal tree (the DOM emits no removal event for regular elements), so handlers attached that way persist until the node is garbage-collected. Stay inside the structural primitives, or use the eventual `onMount` hook (§4.5) to manage your own `AbortController` for imperative cases.

### Tag factories

Don't hand-write 100 factories:

```js
const tags = ['div', 'p', 'span', 'h1', 'h2', 'h3', 'ul', 'li',
              'a', 'button', 'input', 'label', 'section', 'header',
              'main', 'footer', 'nav', 'aside', /* … */]

export const { div, p, span, h1, h2, h3, ul, li, /* … */ } =
  Object.fromEntries(tags.map(t => [t, (...args) => el(t, ...args)]))
```

A `Proxy` would let any tag name work — easier for custom elements, but harder to tree-shake. Start with the explicit list.

### SVG

SVG elements need `createElementNS('http://www.w3.org/2000/svg', tag)`. Expose a separate `svg.rect`, `svg.circle` namespace, or detect SVG context when descending into children of an `<svg>` root.

### Components are just functions

`card({ title }) → div(...)`. No framework concept, no special syntax. Most of the readability gain in practice comes from naming subtrees rather than from the library itself.

**Naming convention: lowercase, always.** Components are functions just like the tag factories, and share their casing. No JSX-style `App` / `Card` capitalization — write `app`, `card`, `userMenu`. We pick consistency over the visual hint; AI agents don't benefit from casing-as-signal, and one rule ("everything is a lowercase function call") is easier to internalize than two.

Enforced by a custom Deno lint plugin shipped with the `imp` CLI — see Layer 4.

---

## 2. Signals

Solid-style fine-grained reactivity. Components run **once** to build the DOM; signals update specific nodes thereafter.

```js
let currentObserver = null

export function signal(initial) {
  let value = initial
  const subs = new Set()

  function read() {
    if (currentObserver) subs.add(currentObserver)
    return value
  }
  read.set = (next) => {
    if (Object.is(value, next)) return
    value = next
    for (const sub of [...subs]) sub()
  }
  read.update = (fn) => read.set(fn(value))
  return read
}

export function effect(fn) {
  const run = () => {
    const prev = currentObserver
    currentObserver = run
    try { fn() } finally { currentObserver = prev }
  }
  run()
  return run
}

export function computed(fn) {
  const s = signal()
  effect(() => s.set(fn()))
  return s
}
```

API:

- `const count = signal(0)` — `count()` reads, `count.set(1)` writes
- `effect(() => …)` — runs once, re-runs when any signal read inside changes
- `computed(() => …)` — derived signal

**Open for v1:** batching, cleanup/disposal on unmount, circular-dep handling.

---

## 3. Wiring Signals Into the DOM

**The rule:** if a prop value or a child is a **function**, it's reactive. Plain values are static.

```js
// Reactive child → live text node
if (typeof child === 'function') {
  const t = document.createTextNode('')
  effect(() => { t.textContent = String(child()) })
  node.appendChild(t)
}

// Reactive prop → live attribute / property
// (events live under `events: {...}`, so any function value at the
// top level of props is a reactive value, not a handler)
if (typeof v === 'function') {
  effect(() => setAttr(node, k, v()))
}
```

That covers the two easy cases: text content and attributes. Updates are surgical — only the affected text node or attribute touches the DOM. Surrounding siblings are untouched.

Everything else — conditionals, lists, lifecycle — is a reactive *primitive* layered on top of `effect`. See §4.

---

## 4. Reactive Primitives

The two-line `effect`-based wiring above handles text and attributes. Anything that changes the *structure* of the DOM needs a primitive.

**The unifying idea:** a primitive returns a **marker node** (a comment) that anchors a position in the DOM. The effect inside the primitive inserts/removes/swaps siblings around that marker. The marker stays put even when the slot is empty, so when the signal next fires we still know where the slot is.

### 4.1 `when` — conditional rendering

```js
export function when(signal, render) {
  const marker = document.createComment('when')
  let current = null

  effect(() => {
    const next = render(signal())
    if (current) current.remove()
    if (next && marker.parentNode) {
      marker.parentNode.insertBefore(next, marker.nextSibling)
    }
    current = next
  })

  return marker
}
```

Usage:

```js
div([
  h1("Dashboard"),
  when(isLoading, loading => loading ? Spinner() : Dashboard()),
  footer("© 2026"),
])
```

**The key insight:** the reactive boundary is the *slot*, not the element. You're not modifying an existing element conditionally — you're swapping which element occupies a position. The comment marker remembers where the slot is, even when the slot is empty.

### 4.2 `each` — keyed list rendering

The big one. Add / remove / reorder without recreating unchanged rows. Identity-tracked: keep `key → node`, diff old vs new, only touch what changed. This preserves focus, input state, and CSS animations on stable rows.

```js
export function each(listSignal, renderItem, getKey = (item) => item.id) {
  const marker = document.createComment('each')
  const nodesByKey = new Map()

  effect(() => {
    const items = listSignal()
    const parent = marker.parentNode
    if (!parent) return

    const seen = new Set()
    let prev = marker

    for (const item of items) {
      const key = getKey(item)
      seen.add(key)
      let node = nodesByKey.get(key)
      if (!node) {
        node = renderItem(item)
        nodesByKey.set(key, node)
      }
      if (prev.nextSibling !== node) {
        parent.insertBefore(node, prev.nextSibling)
      }
      prev = node
    }

    for (const [key, node] of nodesByKey) {
      if (!seen.has(key)) {
        node.remove()
        nodesByKey.delete(key)
      }
    }
  })

  return marker
}
```

**Open question — intra-item reactivity:** items receive plain objects. Toggling `done` on one todo currently re-runs the array signal and refreshes via `each`, which sees the same key and keeps the node. To get *granular* updates (only that row's `<span>` style changes), pass either:

- (a) an id, and let items look up their own reactive view via `computed`
- (b) per-field signals on each item
- (c) a Proxy-based store (Solid's approach)

Decide before v1.

### 4.3 `match` — multi-way branching

Built on `when`, but cleaner for finite-state UIs:

```js
match(status, {
  loading: () => Spinner(),
  error:   (err) => ErrorBox(err),
  ready:   (data) => Dashboard(data),
})
```

Worth having as a dedicated primitive once you have more than two branches.

### 4.4 Class / style toggling

A special case of reactive attributes, common enough to deserve sugar:

```js
div({
  class: { active: isSelected, disabled: isLocked }, // values are signals
  style: { color: theme, opacity: () => fading() ? 0.5 : 1 },
})
```

Implementation: when `class`/`style` is an object, iterate it and set up an effect per entry. Note that `class` overlaps with the static string form (`class: "card"`) — the implementation dispatches on value type: string → `setAttribute('class', v)`, object → reactive toggling.

### 4.5 Mount / unmount hooks — *not yet implemented*

Needed for: capturing the DOM node for later imperative use (focus, measurement), third-party library init (charts, maps), cleanup (timers, subscriptions, websockets), enter/exit animations. This subsumes the role that a `ref` callback would play in other frameworks — fires *after* the node is attached to the document, so `focus()`, `getBoundingClientRect()`, and library handoff all work, and it returns a disposer that ties cleanly into the owner tree.

```js
onMount(node, () => {
  node.focus()                       // works — node is in the document
  const chart = new Chart(node)
  return () => chart.destroy()       // disposer runs on unmount
})
```

A plain `ref` prop (callback that receives the node at construction time, before mount) is intentionally *not* exposed in v1. It fires too early to be useful for the common cases (the node isn't in the document yet), and the timing relative to other props is fragile (depends on object-key order). When users need a node reference, the path is: take it inside `onMount` and stash it in an outer variable or signal. One escape hatch, well-defined timing.

Couples to disposal (§5). Whatever owner model we land on, `onMount` is the user-facing surface.

### 4.6 Portals

Render a child into a different part of the DOM (modals, tooltips, toasts). Element is logically a child here, physically attached there.

```js
portal(document.body, Modal({ open: isOpen }))
```

### 4.7 Async values

`fetch` and async iterables. Could be expressed via `when` + a signal that captures the promise state, but a dedicated primitive is more ergonomic:

```js
async(fetchUser(id), {
  pending: () => Spinner(),
  then:    (user) => UserCard(user),
  catch:   (err)  => ErrorBox(err),
})
```

### 4.8 Two-way binding

Pure sugar over `value: signal` + `onInput: e => signal.set(e.target.value)`. Writing that by hand 50 times gets old.

```js
input({ bind: draft })   // ↔ draft is a signal
```

### What's in v1?

`when`, `each`, and `onMount` cover ~90% of real apps. `match`, class/style toggling, async, two-way binding are quality-of-life — ship them as the design firms up. Portals can wait until a real use case turns up.

---

## 5. Disposal

Effects need to be torn down when their owning DOM is removed. Otherwise effects leak — they keep their subscribers alive and keep firing into detached nodes.

Solid's approach: an **owner tree** that mirrors the component tree; disposing an owner disposes all child effects. Worth copying.

For the bigger cleanup surface (effects + event listeners + fetches + websockets), `AbortController` is the right unifying tool:

```js
const ctrl = new AbortController()
fetch(url,   { signal: ctrl.signal })
elem.addEventListener('click', fn, { signal: ctrl.signal })
// custom effects also listen for 'abort' and tear themselves down
// on unmount: ctrl.abort()  → everything cleans up
```

Decide whether the owner tree manages a single signal per scope or per effect.

---

## 6. Sample App (sketch)

```js
import { signal, computed } from './signals.js'
import { when, each } from './reactive.js'
import { div, ul, li, span, button, input, h1 } from './imp.js'

function TodoApp() {
  const todos = signal([])
  const draft = signal('')
  const remaining = computed(() => todos().filter(t => !t.done).length)

  const add = () => {
    const text = draft().trim()
    if (!text) return
    todos.update(l => [...l, { id: Date.now(), text, done: false }])
    draft.set('')
  }
  const toggle = (id) =>
    todos.update(l => l.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const remove = (id) =>
    todos.update(l => l.filter(t => t.id !== id))

  return div([
    h1("Todos"),
    input({
      value: draft,
      events: { input: e => draft.set(e.target.value) },
      placeholder: "What needs doing?",
    }),
    button({ events: { click: add } }, "Add"),
    when(() => todos().length === 0, empty =>
      empty ? p("Nothing here yet") : null),
    ul([
      each(todos, todo =>
        li([
          input({
            type: 'checkbox',
            checked: todo.done,
            events: { change: () => toggle(todo.id) },
          }),
          span({
            style: todo.done ? 'text-decoration: line-through' : '',
          }, todo.text),
          button({ events: { click: () => remove(todo.id) } }, "×"),
        ])
      ),
    ]),
    div(() => `${remaining()} remaining`),
  ])
}

document.body.appendChild(TodoApp())
```

---

## 7. Open Questions

1. **Item-level reactivity in `each`** — see §4.2. Pick (a) id + `computed`, (b) per-field signals, or (c) Proxy store before v1.
2. **Owner tree for disposal** — Solid-style. Effects need a parent so unmount cascades.
3. **Batching** — multiple `.set()`s in one tick should flush once. `batch(() => …)` helper.
4. **Circular dependencies** — detect or just accept the stack overflow?
5. **`AbortController` integration** — unify effect disposal with `fetch`/`addEventListener` cleanup.
6. **Class / style sugar shape** — confirm the `{ name: signal }` form before locking the prop API.

---

## References

- **SolidJS** — closest existing design; study its store, owner tree, and `<For>`.
- **`htm` / `lit-html`** — alternative buildless templating, if the element-factory ergonomics frustrate.
- **WICG Context Protocol** — out of scope for v1, but the bubbling-event pattern is worth knowing if cross-component state surfaces later.

---

## Implementation Plan

Build layer by layer. Each layer should be usable on its own before moving to the next. Don't pre-build for layers you haven't reached yet.

### Layer 1 — Rendering

The foundation. Everything else assumes you can produce real DOM from JS.

- [ ] **1a. Element factory core (`imp.js`)**
  - [ ] `el(tag, ...args)` with type-based dispatch (array → children, string/number → text, object → props, node → child, function → reactive, falsy → skip)
  - [ ] Recursive children flattening; drop `null`/`undefined`/`false`
  - [ ] Tag factories: explicit list exported via `Object.fromEntries`
  - [ ] Special prop keys (the only ones needing dedicated branches): `style` (object → inline CSS, camelCase → kebab) and `events` (object map, attached via `addEventListener` with disposal-scoped `AbortController` signal — see §1 Events, §5). Everything else — `class`, `for`, `data-*`, `aria-*`, boolean attrs (`disabled`, `checked`, `hidden`, …), live form state (`value`, `selected`, `indeterminate`), and custom-element properties — flows through the property-first fallthrough (`k in node` → property, else `setAttribute`).
  - [ ] Fallthrough to `setAttribute` for everything else
  - [ ] SVG namespace handling (`svg.rect`, `svg.circle`, …)
- [ ] **1b. External / raw HTML interop**
  - [ ] Accept existing `Node` instances as children (already implicit; verify)
  - [ ] `html("<div>…</div>")` helper for trusted raw HTML → parsed DOM nodes
  - [ ] Wrapping a 3rd-party component (Chart.js, Leaflet, etc.) — usually via `onMount`; document the pattern
  - [ ] Decide on `innerHTML` escape hatch vs. forcing the `html()` helper

### Layer 2 — Reactivity

Once Layer 1 renders static trees, signals make them live.

- [ ] **2a. Signal primitives (`signals.js`)**
  - [ ] `signal(initial)` — read/`set`/`update`, observer tracking
  - [ ] `effect(fn)` — runs once, re-runs on dependency change
  - [ ] `computed(fn)` — derived signal
  - [ ] Wiring reactive props/children in `el` (function value → effect)
- [ ] **2b. Structural primitives (`reactive.js`)**
  - [ ] `when(signal, render)` — conditional via marker comment
  - [ ] `match(signal, branches)` — multi-way branching
  - [ ] `each(listSignal, renderItem, getKey)` — keyed list diffing
  - [ ] Decide item-level reactivity strategy (id + `computed` / per-field signals / Proxy store) — Open Q #1
  - [ ] Component hierarchy via signal-as-context (children read parent's signal directly — close over it)
- [ ] **2c. Custom subscription hook**
  - [ ] Expose `subscribe(signal, fn)` for 3rd-party scripts (charts, etc.) that need raw notifications outside the effect system
  - [ ] Return an unsubscribe handle; tie into disposal
- [ ] **2d. Disposal & ownership**
  - [ ] Owner tree mirroring component tree
  - [ ] `onMount(node, fn)` with disposer return
  - [ ] `AbortController` integration for unified cleanup (effects + fetch + listeners)
- [ ] **2e. Quality-of-life (defer until core works)**
  - [ ] Class/style object sugar (`{ name: signal }`)
  - [ ] Two-way `bind:` sugar
  - [ ] `async(promise, { pending, then, catch })`
  - [ ] `batch(() => …)`
  - [ ] `portal(target, node)`

### Layer 3 — Routing

Independent of rendering/reactivity but builds on them.

- [ ] **3a. Router implementation**
  - [ ] Hash vs. History API (pick one; History is the default)
  - [ ] Route definitions: path pattern → component factory
  - [ ] `route` signal — current path/params drive a `match`-style render
  - [ ] Navigation: `navigate(path)`, `<Link>` component (or `a({ href, onClick })`)
  - [ ] Nested routes & route params
  - [ ] Lazy route loading via dynamic `import()` (still buildless)

### Layer 4 — Runtime / dev tooling

Make the framework runnable without a build step locally. **Deno is the runtime** for the `imp` CLI — chosen for: built-in JS/TS handling, native file watcher, native HTTP server, native test runner, native linter with a custom-rule plugin API, single static binary, zero `node_modules`. The CLI is distributed as a `deno compile`d binary (and as `deno run -A jsr:@imp/cli` for those who already have Deno).

- [ ] **4a. Static dev server (`imp dev`)**
  - [ ] `Deno.serve` over the current directory as static files
  - [ ] Live reload via `Deno.watchFs` → SSE → page reload script auto-injected into served HTML
  - [ ] Bare-specifier resolution (decide: import maps generator vs. rewrite-on-the-fly vs. force user-relative imports)
- [ ] **4b. `imp` engine injection**
  - [ ] Decide how engine is delivered: import map → CDN, bundled local copy, or auto-injected `<script>` tag
  - [ ] CLI scaffolder: `imp new my-app` → minimal `index.html` + `app.js`
  - [ ] Decide whether the engine is one file or multi-file ES modules (one file = easier to vendor, multi = better dev DX)
- [ ] **4c. Bundler (`imp build`)**
  - [ ] Production bundle via `deno bundle` (fallback to `esbuild` through Deno's npm interop if `deno bundle` is insufficient — tree-shaking, minification, sourcemaps)
  - [ ] Single-file ES module: framework engine + user app + stdlib components used, minified
  - [ ] Asset copy step (images, CSS, fonts) + `index.html` rewrite to point at the bundled entry and hash-stamped filenames for cache-busting
  - [ ] No code-splitting in v1 — flat output is easier to reason about and the bundles will be small
- [ ] **4d. Custom lint rules (`imp lint`)**
  - [ ] Thin wrapper around `deno lint` that pre-registers the framework's lint plugin (Deno's lint plugin API: a JS module exporting AST visitor rules)
  - [ ] `no-capital-component` — flag any user-defined function whose name starts with an uppercase letter. Component convention is lowercase (see §1)
  - [ ] Users opt out via standard `deno lint` config
- [ ] **4e. Test runner (`imp test`)**
  - [ ] Thin wrapper around `deno test`. The CLI's job is to inject a UI-aware environment and ergonomic helpers; assertions, reporters, watch mode, and filtering are inherited from Deno verbatim so users get one mental model, not two
  - [ ] **DOM polyfill auto-loaded.** Default is `happy-dom` (`linkedom` as fallback if perf or compat warrants). Polyfill is wired into `globalThis` (`document`, `window`, `Node`, `Event`, `customElements`) before any user test module loads — same surface `imp.js` uses in the browser, so the same code under test runs unchanged
  - [ ] **Test file convention.** `*_test.js` or `*.test.js` next to source. No separate `tests/` directory required; co-located tests are the norm. Discovery matches `deno test`'s defaults so users who already know Deno don't have to relearn
  - [ ] **UI test helpers** (exported from `imp/testing.js`):
    - [ ] `mount(component)` — renders into a detached container, returns `{ el, unmount, query, queryAll, fire }`. `unmount` runs the disposal tree from Layer 2d so leak-checks are possible
    - [ ] `query(selector)` / `queryAll(selector)` — CSS selector helpers scoped to the mounted root
    - [ ] `fire(node, eventType, detail?)` — wraps `dispatchEvent`, fills in sensible defaults (`bubbles: true`), supports `'click'`, `'input'`, `'change'`, keyboard events with shorthand
    - [ ] `tick()` — awaits one microtask flush so signal updates propagate before assertions. Pairs with the eventual `batch()` primitive (Open Q #3)
    - [ ] `withTheme(theme, fn)` / `withLocale(locale, fn)` — scoped overrides that auto-restore after the test, so visual/i18n assertions don't pollute siblings
  - [ ] **Signal testing.** Encourage testing signals directly (`signal()`, `effect()`, `computed()` are framework-public). Add `flushEffects()` for tests that need a synchronous boundary
  - [ ] **Async helpers.** `waitFor(predicate, { timeout = 1000 })` polls until truthy or rejects — needed for fetch / `async()` primitive testing without sprinkling `setTimeout`s
  - [ ] **Snapshot avoidance.** No built-in snapshot DSL in v1. Snapshots rot and hide intent in UI code; prefer explicit assertions on `textContent`, `getAttribute`, `classList`. Revisit only if real demand surfaces
  - [ ] **Watch mode.** `imp test --watch` passes through to `deno test --watch`. No reinvention
  - [ ] **Coverage.** Pass-through to `deno test --coverage=…`; the CLI just ensures the polyfill is still installed when coverage instrumentation is active
  - [ ] **CI integration.** Stable, machine-readable reporter (`--reporter=tap` / `--reporter=junit` via Deno's options). No bespoke output format
  - [ ] **Per-test isolation.** Each test gets a fresh polyfilled `document` (`beforeEach`-style hook installed by the runner), so tests can't leak DOM state across files. Cheap with `happy-dom`
- [ ] **4f. Showcase (`imp showcase`)**
  - [ ] Stub here for completeness — full design lives in Layer 5. The CLI command boots a local server that serves a gallery of every stdlib component with a live theme editor and locale switcher

### Layer 5 — Theme & i18n

Cross-cutting framework concern (constraint #9). Sits between foundations (Layers 1–2) and the stdlib (Layer 6): stdlib components are downstream consumers, user apps are too. Builds on the reactivity primitives from Layer 2 — theme and locale are just signals — but is called out as its own layer because the design decisions here (token shape, override scope, translation key strategy) propagate into every component.

- [ ] **5a. Theme tokens**
  - [ ] Source of truth: CSS custom properties on `:root`. Browser-native, scoped, inspectable in devtools, no runtime style recalculation cost
  - [ ] Token categories (minimum v1): `color.*` (background, surface, surface-alt, text, text-muted, primary, secondary, accent, danger, warning, success, border), `radius.*` (none/sm/md/lg/full), `shadow.*` (sm/md/lg), `space.*` (4–64px scale), `font.family` (sans/mono), `font.size.*` (xs–2xl), `font.weight.*`
  - [ ] `mode`: `'light' | 'dark'` — colour-scheme flag carried on the theme object itself so a theme always knows which palette it is. Drives the `color-scheme` CSS property (form controls, scrollbars get matching native styling) and the `data-imp-mode` attribute on `<html>` for CSS hooks
  - [ ] `direction`: `'ltr' | 'rtl'` — text-flow setting carried by the theme. Drives `<html dir="…">` and the `--imp-direction` CSS variable. Stdlib components must use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-*`, `text-align: start/end`) instead of left/right counterparts so layouts mirror automatically when direction flips. Default `'ltr'`; RTL locales (Arabic, Hebrew, Persian, Urdu) ship with `direction: 'rtl'` as a sensible default in their locale-paired themes
  - [ ] Token naming flat & predictable: `--imp-color-primary`, `--imp-radius-md`, `--imp-shadow-lg`. AI-friendly; no nested theme path resolution at runtime
- [ ] **5b. Theme runtime**
  - [ ] `theme` signal holds the active theme object (including `mode` and `direction`)
  - [ ] `defineTheme(name, tokens)` registers a theme; `setTheme(name)` swaps it. Swap writes all `--imp-*` variables to `:root` in one pass, plus sets `<html data-imp-mode="…" dir="…">` and the CSS `color-scheme` property — every component re-skins (and re-mirrors, if direction changed) instantly with no re-render
  - [ ] Default themes shipped: `light` (mode: light, ltr), `dark` (mode: dark, ltr). Both are plain objects users can copy and tweak; user-defined themes pick their own `mode` and `direction`
  - [ ] Convenience helpers: `setMode('light' | 'dark' | 'system')` — `'system'` syncs to `window.matchMedia('(prefers-color-scheme: dark)')` and updates live as the OS preference changes. `setDirection('ltr' | 'rtl' | 'auto')` — `'auto'` derives direction from `locale()`'s script via `Intl.Locale().textInfo.direction`
  - [ ] Per-component override scope: components can declare their own `--imp-<component>-*` variables that default to the global tokens but can be overridden by parent containers — keeps customization local without forking
- [ ] **5c. i18n runtime**
  - [ ] `locale` signal holds the active locale code (`'en'`, `'pl'`, …)
  - [ ] `t(key, params?)` reads `locale()`, returns the translated string. Used as a reactive child or prop value (a function), so changing locale updates only affected text nodes
  - [ ] Message catalogs: plain JS object per locale, registered via `defineMessages(locale, catalog)`. Eager loading in v1; lazy per-locale via dynamic `import()` later
  - [ ] Fallback chain: requested locale → default locale → key as-is (visible enough to catch missing translations)
  - [ ] Interpolation: `t('greeting', { name })` — simple `{name}` placeholder substitution
  - [ ] Pluralization: `Intl.PluralRules`-based — `t('items', { count })` selects the right variant from `{ zero, one, other }`. ICU MessageFormat deferred unless real cases demand it
  - [ ] Number / date / relative-time formatting via `Intl.*`, locale pulled from `locale()` automatically — exported as `n(value, opts)`, `d(date, opts)`, `rt(date)`
- [ ] **5d. Showcase / sandbox page (`imp showcase`)**
  - [ ] CLI command that serves an auto-generated gallery page listing every stdlib component, each with a live preview and copy-paste source
  - [ ] **Live theme editor panel:** color pickers for every `color.*` token, sliders for `radius.*` and `shadow.*`, font-family + size selectors. Edits write into the `theme` signal in real time, so every component on the page re-skins as you drag
  - [ ] **Mode toggle:** light / dark / system in the editor panel — flips `mode` on the active theme and every component restyles instantly. Lets users sanity-check both palettes without code changes
  - [ ] **Direction toggle:** ltr / rtl / auto in the editor panel — verifies every stdlib component mirrors correctly. Catches components that accidentally hardcoded `left`/`right` instead of `start`/`end`
  - [ ] Theme export: "copy as `defineTheme(...)`" button so a tweaked theme can be lifted into user code
  - [ ] Locale switcher in the same panel — flips `locale()` to preview translations side by side (and, with `direction: 'auto'`, demonstrates automatic RTL switching when an RTL locale is picked)
  - [ ] Page itself is built with `imp` (eats its own dogfood, doubles as the largest example app)
- [ ] **5e. Layer-by-layer integration notes**
  - [ ] *Layer 1 (rendering):* tag factories don't need to know about theme. Components must never hardcode colors / radii / shadows — always reference `--imp-*` variables via CSS so theme swaps work
  - [ ] *Layer 2 (reactivity):* `theme` and `locale` are ordinary signals; no special machinery. `t()` is just a function that closes over `locale()` and is used as a reactive child
  - [ ] *Layer 3 (routing):* no coupling, but locale-aware routes (`/en/...`, `/pl/...`) are a future option to consider
  - [ ] *Layer 4 (runtime):* `imp new` scaffold includes `theme.js` (light + dark) and `messages/en.js`; `imp showcase` is the visible payoff
  - [ ] *Layer 6 (stdlib):* every component reads tokens; every user-facing string passes through `t()`; default catalogs ship with the framework. **Logical CSS only** — no `margin-left`, `padding-right`, `left`, `right`, `text-align: left/right`; always `margin-inline-*`, `inset-inline-*`, `text-align: start/end` so RTL flips for free. Lint rule candidate: flag forbidden physical properties in stdlib CSS

### Layer 6 — Standard library

Ready-made components covering the 80% of UI building blocks. Built on Layers 1–2 and consumes Layer 5 (theme tokens + `t()`).

All names below are lowercase per §1 convention.

- [ ] **6a. Layout** — `stack`, `row`, `grid`, `spacer`, `container`
- [ ] **6b. Inputs** — `textField`, `selectBox`, `checkbox`, `radio`, `switchToggle`, `slider`, `datePicker`, `formBox`
- [ ] **6c. Display** — `card`, `badge`, `avatar`, `tag`, `tooltip`
- [ ] **6d. Feedback** — `toast`, `modal`, `drawer`, `spinner`, `progressBar`, `alert`
- [ ] **6e. Navigation** — `tabs`, `menuList`, `breadcrumbs`, `pagination`
- [ ] **6f. Data** — `dataTable` (sortable, paginated), `listView`, `tree`

### Layer 7 — Example apps

Prove the framework on realistic apps, not just `todoApp`. Each example must exercise theme switching and at least two locales.

- [ ] **7a. Todo list** (canonical sanity check)
- [ ] **7b. Markdown notes app** (routing, persistence, forms)
- [ ] **7c. Dashboard** (charts via 3rd-party lib → tests interop)
- [ ] **7d. Chat/feed** (real-time, `each` under load, async)
- [ ] **7e. Settings panel** (every stdlib input exercised, includes theme + locale switcher)

### Layer 8 — Documentation & landing

- [ ] **8a. Landing page** — pitch, code sample, "try it" CodePen-style embed
- [ ] **8b. Tutorial** — todo app, step by step
- [ ] **8c. API reference** — every export, signal/effect/primitive
- [ ] **8d. Component gallery** — points at the `imp showcase` page from Layer 5; docs site embeds the same gallery so visitors can play with themes without installing anything
- [ ] **8e. AI-agent-friendly docs** — flat, terse, machine-readable section/page that an agent can ingest as a single context
