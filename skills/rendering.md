# rendering - element factories, props and mount

Element factories come from `imp/html`, `mount` from `imp`. Factories are **eager**: they return
real DOM nodes when called. No virtual DOM, no diffing, no JSX, no build step - you hold the node
and mutate it with ordinary DOM APIs.

```js
import { mount } from 'imp'
import { div, h1 } from 'imp/html'

mount('#app', div(h1('Hello')))
```

## Elements

```js
el(tag, ...args) -> Node   // the primitive, for tags with no factory
div, p, span, h1..h6, ul, li, button, input, form, table, ...   // ~80 factories
```

Arguments dispatch **by type, in any order**:

| Argument type                     | Meaning                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| string / number / bigint          | text child                                                              |
| `Node`                            | child                                                                   |
| array                             | children, flattened recursively                                         |
| plain object                      | props - **one object per call**; extras merge (later keys win) and warn |
| `null`/`undefined`/`false`/`true` | skipped, so `cond && el(...)` works                                     |

```js
p('Hello ', strong('world')) // same as p(['Hello ', strong('world')])
```

## Props

```js
button({
  type: 'submit',
  disabled: true, // property-first: sets node.disabled
  'data-id': 42, // no property -> attribute
  class: 'btn',
  style: { marginTop: '4px' },
  events: { click: onClick },
}, 'Save')
```

- **Keys are HTML names verbatim** - `class`, `for`, `data-*`, `aria-*`. No camelCase aliases, no
  `className`, no `htmlFor`.
- **Property-first.** A name that exists as a JS property on the node is assigned as a property
  (`disabled`, `checked`, `value`, custom-element props); otherwise it becomes an attribute.
  `null`/`undefined`/`false` removes, `true` sets a bare attribute. `list` and `form` are always
  attributes.
- **`class`** takes `'card'`, `['card', maybe]` (falsy dropped), or `{ active: cond }` (truthy keys
  become classes). Each form sets the class **whole**.
- **`style`** takes a string or an object (camelCase -> kebab; `--custom-props` verbatim).
- **`events`** is `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }` - native event
  names, **no `on` prefix**. An array's second entry is `addEventListener` options.
- **A state may be a prop value** and the prop stays live - `div({ class: theme })`,
  `input({ disabled: busy })`. Pass the state itself, never `state.get()`. See [state](state.md).
- On **custom elements** (hyphenated tag or `is=`) a `null` property value passes through as real
  `null`; on built-ins it is coerced to `''`. Define a custom element before building nodes that
  pass it rich props, or the prop falls back to an attribute.

## Mounting

```js
mount('#app', app) // selector or element; component factory, function, or Node
const unmount = mount('#cart', () => cart({ id })) // island in server HTML
unmount() // empties the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment; trusted input only
```

`mount(target, view)` calls `view` once if it is a function, replaces the host's children with the
result, and returns an `unmount` function. The result may be a `Node`, a string, or an array;
`null`/`undefined`/`false` entries are skipped. A selector matching nothing throws.

Rules an agent gets wrong:

- **A plain helper function is not a component.** `card({ title }) => div(...)` is just a function -
  lowercase, no lifecycle. Promote it to `component(...)` only when it needs mount/unmount, state
  resolution, or a loading placeholder. See [components](components.md).
- **Never pass two props objects** to one call (`imp/single-props-object` lint error).
- **Never pass a state as a bare child** - `div(count)` is reported and skipped; write
  `div(count.text())`.
- Bindings built here are inert until a component or `mount` places the DOM.
