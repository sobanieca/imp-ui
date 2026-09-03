# rendering - element factories, props and mount

The element factories come from `imp/html`. `mount` comes from `imp`. A factory is **eager**. When
you call it, it returns a real DOM node. There is no virtual DOM, no diffing, no JSX and no build
step. You hold the node and change it with the ordinary DOM APIs.

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

imp dispatches an argument **by type, in any order**:

| Argument type                     | Meaning                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| string / number / bigint          | text child                                                                                        |
| `Node`                            | child                                                                                             |
| array                             | children. imp flattens the array recursively.                                                     |
| plain object                      | props. Pass **one object per call**. imp merges an extra object, a later key wins, and imp warns. |
| `null`/`undefined`/`false`/`true` | imp skips it, so `cond && el(...)` works                                                          |

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

- **A key is the HTML name, without a change.** Write `class`, `for`, `data-*` and `aria-*`. There
  is no camelCase alias, no `className` and no `htmlFor`.
- **imp sets a property first.** If the name exists as a JS property on the node, imp assigns the
  property. This covers `disabled`, `checked`, `value` and a prop of a custom element. If the name
  does not exist as a property, imp sets an attribute. `null`, `undefined` and `false` remove the
  attribute. `true` sets a bare attribute. `list` and `form` are always attributes.
- **`class`** takes `'card'`, or `['card', maybe]` where imp drops a falsy entry, or
  `{ active: cond }` where a truthy key becomes a class. Each form sets the **whole** class.
- **`style`** takes a string or an object. imp converts a camelCase key to kebab case, and keeps a
  `--custom-prop` name without a change.
- **`events`** is `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }`. Use the native
  event name, with **no `on` prefix**. The second entry of an array is the options object for
  `addEventListener`.
- **A prop value can be a state**, and the prop then stays live. Examples are
  `div({ class: theme })` and `input({ disabled: busy })`. Pass the state itself, never
  `state.get()`. See [state](state.md).
- On a **custom element**, which is a hyphenated tag or a tag with `is=`, a `null` property value
  passes through as a real `null`. On a built-in element imp converts it to `''`. Define a custom
  element before you build a node that passes rich props to it. If you do not, the prop becomes an
  attribute.

## Mounting

```js
mount('#app', app) // selector or element; component factory, function, or Node
const unmount = mount('#cart', () => cart({ id })) // island in server HTML
unmount() // empties the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment; trusted input only
```

`mount(target, view)` calls `view` once if `view` is a function. It replaces the children of the
host with the result, and returns an `unmount` function. The result can be a `Node`, a string or an
array. imp skips a `null`, `undefined` or `false` entry. A selector that matches nothing throws.

The first `mount` adopts one document rule, `body { margin: 0 }`, in a cascade layer of imp's own.
The user agent applies an 8px body margin. Without imp's rule, that margin makes a `100dvb` app
taller than the window, and the page scrolls. **Do not write your own `body { margin: 0 }`, and do
not use `!important` to override imp's rule.** Unlayered CSS wins against a layer, so a plain
`body { margin: 2rem }` in the stylesheet of the app already wins.

Rules an agent gets wrong:

- **A plain helper function is not a component.** `card({ title }) => div(...)` is a function only.
  Its name is lowercase and it has no lifecycle. Make it a `component(...)` only when it needs mount
  and unmount, state resolution, or loading content. See [components](components.md).
- **Never pass two props objects** to one call. imp reports the `imp/single-props-object` lint
  error.
- **Never pass a state as a bare child.** imp reports `div(count)` and skips it. Write
  `div(count.text())`.
- A binding that you build here is inert until a component or `mount` puts the DOM in the page.
