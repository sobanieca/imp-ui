# UI Framework Design Notes

A small SPA framework. Four constraints shape everything:

1. **Buildless** — plain ES modules, runs directly in the browser.
2. **Hyperscript syntax** — HTML expressed as JS function calls.
3. **`render` produces real DOM** — no virtual DOM, no string templates.
4. **Solid-style signals** — fine-grained reactivity; components run once.

SPA only. No SSR. No hydration.

---

## 1. Hyperscript

HTML expressed as function calls. Each tag is a factory that returns a real DOM node.

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
function h(tag, ...args) {
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

### Special prop keys

- `style: {...}` — object → inline CSS, camelCase → kebab-case
- `className` — sets `class`
- `onClick`, `onChange`, … — strip `on`, lowercase, `addEventListener`
- `dataset: {...}` — `data-*` attributes
- Boolean attrs (`disabled: true`) — toggle, don't set the string `"true"`
- `ref: (el) => …` — imperative escape hatch (see §4.7)

Everything else falls through to `setAttribute`.

### Tag factories

Don't hand-write 100 factories:

```js
const tags = ['div', 'p', 'span', 'h1', 'h2', 'h3', 'ul', 'li',
              'a', 'button', 'input', 'label', 'section', 'header',
              'main', 'footer', 'nav', 'aside', /* … */]

export const { div, p, span, h1, h2, h3, ul, li, /* … */ } =
  Object.fromEntries(tags.map(t => [t, (...args) => h(t, ...args)]))
```

A `Proxy` would let any tag name work — easier for custom elements, but harder to tree-shake. Start with the explicit list.

### SVG

SVG elements need `createElementNS('http://www.w3.org/2000/svg', tag)`. Expose a separate `svg.rect`, `svg.circle` namespace, or detect SVG context when descending into children of an `<svg>` root.

### Components are just functions

`Card({ title }) → div(...)`. No framework concept, no special syntax. Most of the readability gain in practice comes from naming subtrees rather than from the library itself.

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
if (typeof v === 'function' && !k.startsWith('on')) {
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
  className: { active: isSelected, disabled: isLocked }, // values are signals
  style:     { color: theme, opacity: () => fading() ? 0.5 : 1 },
})
```

Implementation: when `className`/`style` is an object, iterate it and set up an effect per entry.

### 4.5 Mount / unmount hooks

Needed for: third-party library init (charts, maps), cleanup (timers, subscriptions, websockets), enter/exit animations.

```js
onMount(node, () => {
  const chart = new Chart(node)
  return () => chart.destroy()  // disposer runs on unmount
})
```

Couples to disposal (§5). Whatever owner model we land on, `onMount` is the user-facing surface.

### 4.6 `refs`

Imperative escape hatch — focus an input, measure a node, hand a DOM node to a non-reactive library.

```js
let inputEl
input({ ref: el => inputEl = el, type: 'text' })
// later: inputEl.focus()
```

### 4.7 Portals

Render a child into a different part of the DOM (modals, tooltips, toasts). Element is logically a child here, physically attached there.

```js
portal(document.body, Modal({ open: isOpen }))
```

### 4.8 Async values

`fetch` and async iterables. Could be expressed via `when` + a signal that captures the promise state, but a dedicated primitive is more ergonomic:

```js
async(fetchUser(id), {
  pending: () => Spinner(),
  then:    (user) => UserCard(user),
  catch:   (err)  => ErrorBox(err),
})
```

### 4.9 Two-way binding

Pure sugar over `value: signal` + `onInput: e => signal.set(e.target.value)`. Writing that by hand 50 times gets old.

```js
input({ bind: draft })   // ↔ draft is a signal
```

### What's in v1?

`when`, `each`, `ref` cover ~90% of real apps. `match`, class/style toggling, `onMount`, async, two-way binding are quality-of-life — ship them as the design firms up. Portals can wait until a real use case turns up.

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
import { div, ul, li, span, button, input, h1 } from './h.js'

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
      onInput: e => draft.set(e.target.value),
      placeholder: "What needs doing?",
    }),
    button({ onClick: add }, "Add"),
    when(() => todos().length === 0, empty =>
      empty ? p("Nothing here yet") : null),
    ul([
      each(todos, todo =>
        li([
          input({
            type: 'checkbox',
            checked: todo.done,
            onChange: () => toggle(todo.id),
          }),
          span({
            style: todo.done ? 'text-decoration: line-through' : '',
          }, todo.text),
          button({ onClick: () => remove(todo.id) }, "×"),
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
- **`htm` / `lit-html`** — alternative buildless templating, if hyperscript ergonomics frustrate.
- **WICG Context Protocol** — out of scope for v1, but the bubbling-event pattern is worth knowing if cross-component state surfaces later.
