# imp-ui — API reference

Terse, complete, machine-ingestible. One import surface: `imp/imp.js` (kernel), `stdlib/index.js`
(components), `imp/testing.js` (tests). Buildless ES modules — no compile step, plain JS, runs
directly in the browser.

## Core model

- Components are lowercase functions returning real DOM nodes. No framework component concept.
  `card({ title }) → div(...)`.
- Components run **once**. Signals surgically update text nodes/attributes afterward. No virtual
  DOM, no diffing.
- A **function-valued** prop or child is reactive; plain values are static.
- Reactivity is opt-in: `el()` returns real nodes — holding a reference and mutating `.textContent`
  imperatively is supported inside a component you own.
- Disposal is automatic on framework-driven unmount (`when`/`each`/`match`/`router` swaps, `mount`
  unmount): one scope per component/slot/row owns an AbortController; aborting detaches `events`
  listeners + fetches, and tears down effects. Imperative `node.remove()` is invisible to disposal —
  stay inside the primitives or clean up via `onMount`'s disposer.
- Errors: a throwing effect/disposer is logged via `console.error` and contained; the rest of the
  graph keeps running. Circular signal dependencies are not detected.

## Elements — `imp/render.js`

```js
el(tag, ...args) → Node            // one primitive
div, p, span, h1..h6, ul, li, button, input, form, table, ... // ~70 tag factories
svg.circle({ r: 4 })               // any SVG tag via svg.* proxy (attrs verbatim)
```

Argument dispatch by **type**, order irrelevant: array → children (flattened recursively) ·
string/number → text · plain object → props · Node → child · function → reactive ·
`null`/`undefined`/`false` → skipped (so `cond && el` works).

Props:

- Keys are HTML attribute names verbatim: `class`, `for`, `"data-id"`, `"aria-label"`. No aliases.
- Property-first: `disabled: true`, `value: draft` set DOM properties; unknown names become
  attributes. `list`/`form` always attributes. `null/undefined/false` removes.
- `class:` string | array (joined) | function (reactive) | object `{ active: isSelected }`
  (per-entry reactive toggle).
- `style:` string | object (camelCase→kebab, `--custom-props` kept verbatim); object entries and the
  whole value may be functions (reactive).
- `events: { click: fn, 'custom-event': fn, input: [fn, { once: true, passive: true }] }` — native
  DOM event names, no `on` prefix. Auto-detached on unmount.
- `raw(fn)` — escape hatch: assign a function as a property without reactive treatment:
  `chart({ formatter: raw(fn) })`.
- Reactive child: `div('Count: ', () => count())` → live text node. Structure changes need
  `when`/`each`/`match`, never a function child returning a Node (dev warning).

Inline text mixes fine in document order: `p(['Hello ', strong('world')])` or
`p('Hello ', strong('world'))` — both work (Node → child).

```js
mount('#app', app) // selector or element; component fn or Node
const unmount = mount('#cart', () => cartWidget({ userId })) // server-HTML island
html('<b>trusted</b>') // raw HTML → DocumentFragment (trusted only)
```

## Signals — `imp/signals.js`

```js
const count = signal(0)            // count() reads · count.set(1) · count.update(fn) · count.peek()
const stop = effect(() => ...)     // runs now, re-runs on change; auto-disposed with owning scope
const total = computed(() => ...)  // derived read-only signal
batch(() => { a.set(1); b.set(2) })// one flush
untrack(() => sig())               // read without subscribing
subscribe(sig, v => save(v))       // raw notifications (not on subscribe); returns unsubscribe
```

Updates are synchronous. Shared state = a signal in a module, components close over it
(signal-as-context).

## Structural primitives — `imp/primitives.js`

```js
when(isLoading, l => l ? spinner() : dashboard())   // cond change → branch re-render + old branch disposed
match(state, { loading: () => ..., error: e => ..., _: () => ... })
  // key = state(), or state() = [key, payload] → branch(payload)
each(todos, todo => li(todo.text), t => t.id)       // keyed; stable keys keep DOM (focus, animations)
onMount(node, n => { n.focus(); return () => cleanup() })  // after attach; disposer on unmount; returns node
portal(document.body, modalNode)                    // render elsewhere; removed on scope dispose
```

Row granularity in `each`: put signals **on the items** (`{ id, text, done: signal(false) }`) —
toggling `done` touches one row, no list re-run.

Async data pattern (no dedicated primitive): a state signal + `match`:

```js
const state = signal('loading')
fetch(url, { signal: scopeSignal() }).then((r) => r.json())
  .then((data) => state.set(['ready', data]), (err) => state.set(['error', err]))
return match(state, {
  loading: () => spinner(),
  ready: (d) => view(d),
  error: (e) => alert({ kind: 'danger' }, String(e)),
})
```

## Styles — `imp/styles.js`

```js
const cardStyle = css`
  background: var(--imp-color-surface);
  border-radius: var(--imp-radius-md);
  &:hover {
    box-shadow: var(--imp-shadow-md);
  }
  @media (max-width: 600px) {
    padding: var(--imp-space-8);
  }
` // → content-hashed class name, injected once
css.global`@keyframes spin { to { rotate: 360deg } }` // one top-level rule
```

Division of labor: shared statics → `css` at module level · per-instance dynamics → inline `style`
(prefer `style: { '--progress': pct }` consumed by the shared class) · state variants →
`class: { active: sig }`. Function interpolation in `css` `` throws.

## Theme — `imp/theme.js`

Tokens are `--imp-*` CSS variables on `:root`. Categories:
`color-{bg,surface,surface-alt,text,text-muted,primary,on-primary,secondary,accent,danger,warning,success,border}`,
`radius-{none,sm,md,lg,full}`, `shadow-{sm,md,lg}`, `space-{4,8,12,16,24,32,48,64}`,
`font-family[-mono]`, `font-size-{xs,sm,md,lg,xl,2xl}`, `font-weight-{normal,medium,bold}`.

```js
theme() // active theme: { name, mode, direction, tokens }
defineTheme('brand', { mode: 'dark', tokens: { 'color-primary': '#ff0066' } })
// starts from its mode's defaults; override only what differs
setTheme('brand') // writes all vars in one pass — instant re-skin, no re-render
setMode('light' | 'dark' | 'system') // 'system' follows prefers-color-scheme live
setDirection('ltr' | 'rtl' | 'auto') // 'auto' derives from locale; also sets <html dir>
```

`light` and `dark` ship built-in; `light` applies on import. `<html>` gets `data-imp-mode`, `dir`,
and `color-scheme`. Use **logical CSS properties** (`margin-inline-start`, `inset-inline-end`,
`text-align: start`) so RTL mirrors for free.

## i18n — `imp/i18n.js`

```js
defineMessages('en', { greeting: 'Hello, {name}!', items: { zero: 'none', one: '{count} item', other: '{count} items' } })
setLocale('pl')                      // locale is a signal; reactive t() re-localizes live text nodes
span(() => t('greeting', { name }))  // function child → updates on locale change
t('items', { count: 3 })             // Intl.PluralRules picks the form; numbers localized
n(1234.5) · n(p, { style: 'percent' })          // Intl.NumberFormat
d(date) · d(date, { dateStyle: 'long' })        // Intl.DateTimeFormat
rt(fiveMinAgo)                                  // Intl.RelativeTimeFormat — "5 minutes ago"
```

Catalogs are flat objects (dots are plain characters). Fallback: locale → base language → fallback
locale (`setFallbackLocale`, default `'en'`) → key as-is.

## Router — `imp/router.js`

Explicit registration (no file-based routing). History API; the dev server serves index.html for
unknown paths.

```js
route('/', () => homePage())
route('/todos/:id', ({ params, query }) => todoPage(params.id))
route('/admin', () => import('./pages/admin.js'))   // lazy: module default is the component
route('*', () => notFound())
mount('#app', () => div([navbar(), router()]))      // router() is the outlet slot
navigate('/todos/7?tab=info') · navigate(p, { replace: true })
link({ href: '/about' }, 'About')                   // real <a>, intercepts plain left-click
currentRoute()                                      // signal: { path, query }
```

Old page scope is disposed on every swap. Factories get `{ params, query }` and run inside the new
scope.

## Web components — `imp/wc.js`

```js
const chart = wc('my-chart') // consume: factory with full §dispatch
chart({ data: series, events: { 'chart-rendered': fn } })
wc.define('todo-app', todoApp) // expose: <todo-app> anywhere (server HTML islands)
wc.define('x-widget', widget, { shadow: true }) // opt-in shadow DOM (shared css`` sheet adopted)
```

Light DOM default (theme variables inherit). Host attributes → string props snapshot at connect;
disposal on disconnect.

## Stdlib — `stdlib/index.js`

All components: lowercase, consume `--imp-*` tokens, built-in strings through `t()` (keys
`imp.close`, `imp.loading`, `imp.empty`, `imp.prev`, `imp.next`, `imp.page` — override per locale).
Signature: `component(props?, ...children)`; `class` (string) merges; unknown props pass through.
Pass a **signal** as `value`/`checked` for two-way binding.

```js
// layout
stack({ gap: 'sm'|'md'|'lg' }, kids) · row({ gap, wrap, align, justify }, kids)
grid({ cols: 3, gap }, kids) · spacer() · container(kids)
// display
card({ title }, kids) · badge({ kind: 'primary|secondary|accent|danger|warning|success' }, text)
avatar({ src?, name, size? }) · tag(text) · tooltip({ text }, child)
// inputs (signal → two-way)
textField({ label, value, hint, placeholder, type?, ... }) · textArea({ label, value, rows })
datePicker({ label, value }) · selectBox({ label, options: ['a'] | [{value,label}], value })
checkbox({ label, checked }) · switchToggle({ label, checked })
radioGroup({ label, options, value, name? }) · slider({ label, min, max, step, value })
formBox({ events: { submit } }, fields)            // preventDefault built in
// feedback
spinner({ size }) · progressBar({ value, max? })   // value: number or signal
alert({ kind }, kids) · toast('Saved', { kind?, duration? })
modal({ open, title }, kids) · drawer({ open, title, side: 'end'|'start' }, kids)
  // open: boolean signal — backdrop/×/Escape set it false; events.close also fires
// navigation
tabs({ tabs: [{ id, label, content: () => node }], active? })
menuList({ items: [{ id, label, onSelect }], active? })
breadcrumbs({ items: [{ label, href? }] }) · pagination({ page, pages })  // page: signal, 1-based
// data
dataTable({ columns: [{ key, label, sortable?, render? }], rows, getKey?, pageSize? })
listView({ items, render, getKey?, empty? }) · tree({ nodes: [{ id, label, children? }], onSelect? })
```

## Testing — `imp/testing.js`

Importing installs happy-dom under Deno (no-op in a browser). Signal updates are synchronous —
assert right after firing.

```js
import { mount, fire, tick, waitFor, withTheme, withLocale } from './imp/testing.js'
const view = mount(() => app())     // fresh container on document.body, own scope
view.query('button') · view.queryAll('li') · view.fire('button', 'click') · view.unmount()
fire(node, 'keydown', { key: 'Enter' }) · fire(node, 'input')   // set .value first
await tick()                        // drain microtasks — onMount etc.
await waitFor(() => view.el.textContent.includes('done'))
await withLocale('pl', () => { ... }) · await withTheme('dark', () => { ... })
```

Test files: `*_test.js` co-located with source; plain `deno test` semantics. Prefer explicit
assertions on `textContent`/attributes — no snapshots.

## CLI — `cli/main.js`

```
imp dev [--port 4507]    static server, live reload, browser→CLI telemetry
                         (console.*, uncaught errors, fetch timings print in the terminal)
imp test [...args]       deno test -A passthrough (DOM via imp/testing.js import)
imp lint                 deno lint + no-capital-component rule
imp fmt                  deno fmt passthrough
imp build [--outdir]     esbuild bundle: minified ESM, code-split dynamic imports,
                         hashed names, index.html rewritten, assets copied
imp showcase [--port]    stdlib gallery + live theme/locale editor
imp new <dir>            scaffold: index.html + app.js + test, framework vendored
```

Compile the binary: `deno compile -A -o imp cli/main.js`.
