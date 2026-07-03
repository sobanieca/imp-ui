# imp-ui — Rendering

How imp turns element-factory calls into real DOM. imp is buildless: no compile step, no JSX — plain
JavaScript ES modules that run directly in the browser. Everything is imported from the bare `imp`
specifier (mapped automatically by `imp start`).

> Scope: this page covers building DOM from factory calls. Styling, theming, i18n, routing, and web
> components are not covered here yet.

## Mental model

- A **component** is a lowercase function that returns a real DOM node:
  `card({ title }) -> div(...)`. No framework component concept, no JSX.
- `el()` and the tag factories return actual `Node`s. You hold the reference and mutate it with
  normal DOM APIs — there is no virtual DOM and no diffing.
- Arguments are dispatched by **type**, not position.
- Prop keys are HTML attribute names **verbatim** (`class`, `for`, `data-id`, `aria-label`) — no
  aliases.

## Elements

```js
el(tag, ...args) -> Node            // the one primitive
div, p, span, h1..h6, ul, li, button, input, form, table, ...  // ~80 tag factories
```

Argument dispatch by **type**, order irrelevant:

| Arg type                          | Meaning                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| array                             | children, flattened recursively                                              |
| string / number / bigint          | text child                                                                   |
| `Node`                            | child                                                                        |
| plain object                      | props (one object per call — extras merge with later keys winning, and warn) |
| `null`/`undefined`/`false`/`true` | skipped (so `cond && el(...)` works)                                         |

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
- **Property-first.** If the name exists as a JS property on the node it is assigned as a property
  (`disabled`, `checked`, `value`, `selected`, custom-element props). Otherwise it becomes an
  attribute. `null`/`undefined`/`false` removes; `true` sets a bare attribute. `list` and `form` are
  always attributes.
- **`null` on properties.** For **built-in** elements a `null`/`undefined` property value is coerced
  to `''` (avoids the literal `"null"` string that non-`[LegacyNullToEmptyString]` IDL setters would
  produce). For **custom elements** (hyphenated tag, or `is=`) the raw value is passed through, so a
  setter typed as `T | null` receives real `null`. Caveat: this only applies once the property
  exists on the node — if the element is built **before** `customElements.define(...)`, the prop is
  not yet exposed and falls back to an attribute, so define custom elements before constructing
  nodes that pass rich/`null` props to them.
- **`class`**: `'card'` · `['card', extra]` (falsy entries dropped, joined) · `{ active: cond }`
  (object — each truthy entry toggles its class on).
- **`style`**: `'color:red'` · object (`camelCase` -> kebab, `--custom-props` kept verbatim).
- **`events`**: `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }` — native DOM event
  names, **no `on` prefix**. The optional second array element is `addEventListener` options.

## Mounting

```js
mount('#app', app) // selector or element; component fn or Node
const unmount = mount('#cart', () => cart({ id })) // server-HTML island
unmount() // clears the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment (trusted input only)
```

`mount(target, view)` runs `view` once (if a function), replaces the host's children with the
result, and returns an `unmount` function that empties the host. The result may be a `Node`, a
string (becomes a text node), or an array of either; `null`/`undefined`/`false` entries are skipped.
A `target` selector that matches nothing throws.
