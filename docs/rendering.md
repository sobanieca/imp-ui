# imp-ui - Rendering

This page explains how imp turns a call to an element factory into real DOM. imp is buildless. There
is no compile step and no JSX. Your code is plain JavaScript ES modules that run directly in the
browser. The element factories come from **`imp/html`**, and `mount` comes from **`imp`**. Both are
bare specifiers that imp resolves for you. See **[Imports](imports.md)** for the full map:

```js
import { mount } from 'imp'
import { div, h1 } from 'imp/html'

mount('#app', div(h1('Hello')))
```

> Scope: this page covers how to build DOM from a factory call. **[Components](components.md)**
> covers a component with a lifecycle of mount, loading and unmount. **[Routing](routing.md)**
> covers how to map a URL to a screen. **[Theming](theming.md)** covers theming, and
> **[Translations](i18n.md)** covers translated text.

## The mental model

- `el()` and the tag factories are **eager**. They return a real `Node` the moment when you call
  them. You hold the reference and change it with the normal DOM APIs. There is no virtual DOM and
  no diffing.
- A plain helper function that groups elements, such as `card({ title }) -> div(...)`, is a function
  only. Its name is lowercase. There is no JSX and no framework concept. When a piece of UI needs a
  lifecycle or state, make it a **component** with `component('my-app-card', ...)`. See
  **[Components](components.md)**. You call its factory in the same way.
- imp dispatches an argument by **type**, not by position.
- A prop key is the HTML attribute name **exactly**, such as `class`, `for`, `data-id` and
  `aria-label`. There is no alias.

## Elements

```js
el(tag, ...args) -> Node            // the one primitive
div, p, span, h1..h6, ul, li, button, input, form, table, ...  // ~80 tag factories
```

Both live in `imp/html`. For a tag with no factory, use `el('tag', ...)`.

imp dispatches an argument by **type**, and the order does not matter:

| Arg type                          | Meaning                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| array                             | children, flattened recursively                                              |
| string / number / bigint          | text child                                                                   |
| `Node`                            | child                                                                        |
| plain object                      | props (one object per call - extras merge with later keys winning, and warn) |
| `null`/`undefined`/`false`/`true` | skipped (so `cond && el(...)` works)                                         |

Inline text mixes with elements in document order. Both forms work:

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

- **Names are exact.** A key is the HTML attribute name, such as `class`, `for`, `data-*` and
  `aria-*`. There is no camelCase alias.
- **imp sets a property first.** If the name exists as a JS property on the node, imp assigns the
  property. This covers `disabled`, `checked`, `value`, `selected` and a prop of a custom element.
  Otherwise the name becomes an attribute. `null`, `undefined` and `false` remove the attribute.
  `true` sets a bare attribute. `list` and `form` are always attributes.
- **`null` on a property.** For a **built-in** element, imp converts a `null` or `undefined`
  property value to `''`. This avoids the literal string `"null"` that an IDL setter without
  `[LegacyNullToEmptyString]` would produce. For a **custom element**, which is a hyphenated tag or
  a tag with `is=`, imp passes the raw value. So a setter typed as `T | null` receives a real
  `null`. There is one condition. This applies only after the property exists on the node. When you
  build the element **before** `customElements.define(...)`, the property does not exist yet, and
  the prop becomes an attribute. So define a custom element before you build a node that passes a
  rich value or a `null` to it.
- **`class`** takes `'card'`, or `['card', extra]`, where imp drops a falsy entry and joins the
  rest, or `{ active: cond }`, where the name of each truthy entry becomes a class. Every form sets
  the class as a whole. What you pass is what the element gets.
- **`style`** takes `'color:red'`, or an object. In an object, imp converts a `camelCase` key to
  kebab case, and keeps a `--custom-prop` name as it is.
- **`events`** is `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }`. Use a native DOM
  event name, with **no `on` prefix**. The optional second element of an array is the options object
  for `addEventListener`.
- **A prop value can be a state**, from `initState`, `useState` or `computed`. The prop then stays
  **live**, and imp applies it again on every change. Each form keeps its usual meaning, as in
  `div({ class: theme })` and `input({ disabled: busy })`. The binding goes live when a component,
  or `mount`, places the element, and it ends with that element. imp reports and skips a state that
  you pass as a standalone argument in place of a prop value. See **[State](state.md)**, _Binding
  props_.

## Mounting

```js
mount('#app', app) // selector or element; component fn or Node
const unmount = mount('#cart', () => cart({ id })) // server-HTML island
unmount() // clears the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment (trusted input only)
```

`mount(target, view)` runs `view` once, when `view` is a function. It replaces the children of the
host with the result, and returns an `unmount` function that empties the host. The result can be a
`Node`, a string, which becomes a text node, or an array of either. imp skips a `null`, `undefined`
or `false` entry. A `target` selector that matches nothing throws.

The first `mount` also sets the default `body` margin of the browser to zero. So a full-height app,
which is anything built on [shell](std-components.md), reaches the edges of the window. Without the
rule, an eight-pixel gutter remains, and it puts a scrollbar on a page that must not scroll. The
rule sits in a cascade layer of imp's own, and unlayered CSS always wins against a layer. Write
`body { margin: 2rem }` in your own stylesheet and you get your margin back. You do not need
`!important`.
