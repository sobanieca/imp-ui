# imp-ui — Rendering

Reference for the rendering phase: turning element-factory calls into real DOM. Terse and
machine-ingestible. Buildless ES modules — no compile step, plain JS, runs directly in the browser.
Import surface: `src/imp.js`.

> Scope: this covers building static DOM from factory calls. Styling, theming, i18n, routing, and
> web components are separate phases and are not part of this module yet.

## Mental model

- A **component** is a lowercase function that returns a real DOM node:
  `card({ title }) -> div(...)`. No framework component concept, no JSX.
- `el()` and the tag factories return actual `Node`s. You hold the reference and mutate it with
  normal DOM APIs — there is no virtual DOM and no diffing (adr/0003).
- Arguments are dispatched by **type**, not position (adr/0002).
- Prop keys are HTML attribute names **verbatim** (`class`, `for`, `data-id`, `aria-label`) — no
  aliases (adr/0004).

## Elements

```js
el(tag, ...args) -> Node            // the one primitive
div, p, span, h1..h6, ul, li, button, input, form, table, ...  // ~80 tag factories
svg.circle({ r: 4 })                // any SVG tag via the svg.* proxy (attrs verbatim)
```

Argument dispatch by **type**, order irrelevant:

| Arg type                          | Meaning                              |
| --------------------------------- | ------------------------------------ |
| array                             | children, flattened recursively      |
| string / number / bigint          | text child                           |
| `Node`                            | child                                |
| plain object                      | props (multiple objects are merged)  |
| `null`/`undefined`/`false`/`true` | skipped (so `cond && el(...)` works) |

Inline text mixes with elements in document order — both forms work:

```js
p(['Hello ', strong('world')])
p('Hello ', strong('world'))
```

## Props

```js
button(
  {
    type: 'submit',
    disabled: true, // property-first: sets node.disabled
    'data-id': 42, // unknown-as-property -> attribute
    class: 'btn', // see below
    style: { marginTop: '4px' }, // see below
    events: { click: onClick }, // see below
  },
  'Save',
)
```

- **Verbatim names.** Keys are the HTML attribute names exactly: `class`, `for`, `data-*`, `aria-*`.
  No camelCase aliases.
- **Property-first** (adr/0004). If the name exists as a JS property on the node it is assigned as a
  property (`disabled`, `checked`, `value`, `selected`, custom-element props). Otherwise it becomes
  an attribute. `null`/`undefined`/`false` removes; `true` sets a bare attribute. `list` and `form`
  are always attributes; SVG nodes are always attribute-based.
- **`class`**: `'card'` · `['card', extra]` (falsy entries dropped, joined) · `{ active: cond }`
  (object — each truthy entry toggles its class on).
- **`style`**: `'color:red'` · object (`camelCase` -> kebab, `--custom-props` kept verbatim).
- **`events`**: `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }` — native DOM event
  names, **no `on` prefix**. The optional second array element is `addEventListener` options.

## Mounting

```js
mount('#app', app) // selector or element; component fn or Node
const unmount = mount('#cart', () => cart({ id })) // server-HTML island (essence #19)
unmount() // clears the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment (trusted input only)
```

`mount(target, view)` runs `view` once (if a function), replaces the host's children with the
result, and returns an `unmount` function that empties the host.
