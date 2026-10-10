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
> covers a component with a mount, loading, and unmount lifecycle. **[Routing](routing.md)** covers
> how to map a URL to a screen. **[Theming](theming.md)** covers theming, and
> **[Translations](i18n.md)** covers translated text.

## The mental model

- `el()` and the tag factories are **eager**. They return a real `Node` the moment you call them.
  You hold the reference and change it with normal DOM methods. There is no virtual DOM and no
  diffing.
- A plain helper function that groups elements, such as `card({ title }) -> div(...)`, is just a
  function, written with a lowercase name. There is no JSX and no framework concept behind it. When
  a piece of UI needs a lifecycle or state, make it a **component** with
  `component('my-app-card', ...)` instead. See **[Components](components.md)**. You call its factory
  the same way.
- imp reads an argument by its **type**, not by its position.
- A prop key is the exact HTML attribute name, such as `class`, `for`, `data-id`, and `aria-label`.
  There is no alias.

## Elements

```js
el(tag, ...args) -> Node            // the one primitive
div, p, span, h1..h6, ul, li, button, input, form, table, ...  // about 80 tag factories
```

Both live in `imp/html`. For a tag with no factory, use `el('tag', ...)`.

imp reads each argument by its type. The order does not matter:

| Arg type                                | Meaning                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| array                                   | children, flattened recursively                                                    |
| string / number / bigint                | text child                                                                         |
| `Node`                                  | child                                                                              |
| plain object                            | props (one object per call; extra objects merge in, later keys win, and imp warns) |
| `null` / `undefined` / `false` / `true` | skipped (so `cond && el(...)` works)                                               |

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
    'data-id': 42, // unknown name becomes an attribute
    class: 'btn', // see below
    style: { marginTop: '4px' }, // see below
    events: { click: onClick }, // see below
  },
  'Save',
)
```

- **Names are exact.** A key is the HTML attribute name, such as `class`, `for`, `data-*`, and
  `aria-*`. There is no camelCase alias.
- **imp sets a property first.** When the name exists as a JS property on the node, imp assigns the
  property. This covers `disabled`, `checked`, `value`, `selected`, and any prop of a custom
  element. Otherwise the name becomes an attribute. `null`, `undefined`, and `false` remove the
  attribute. `true` sets a bare attribute. `list` and `form` are always attributes.
- **A `null` property value.** For a **built-in** element, imp converts a `null` or `undefined`
  property value to `''`, so the element never shows the literal text `"null"`. When that property
  reflects an attribute, such as `href`, `src` or `id`, imp then removes the attribute. So
  `a({ href: null })` renders an `a` with no `href`, not `href=""`. For a **custom element**, imp
  passes the raw value, so a setter that expects `null` receives a real `null`. This only applies
  once the property exists on the node. If you build the element before you call
  `customElements.define(...)` for it, the property does not exist yet, and the prop becomes an
  attribute instead. Define a custom element before you build a node that passes it a rich value or
  a `null`.
- **`class`** takes `'card'`, or `['card', extra]` (imp drops a falsy entry and joins the rest), or
  `{ active: cond }` (the name of each truthy entry becomes a class). Every form sets the whole
  class: what you pass is what the element gets.
- **`style`** takes `'color:red'`, or an object. In an object, imp converts a `camelCase` key to
  kebab case, and keeps a `--custom-prop` name as it is.
- **`events`** is `{ click: fn, 'custom-event': fn, input: [fn, { once: true }] }`. Use a native DOM
  event name, with no `on` prefix. The optional second array element is the options object for
  `addEventListener`.
- **A prop value can be a state**, from `initState`, `useState`, or `computed`. The prop then stays
  **live**: imp applies it again on every change, and each form keeps its usual meaning, as in
  `div({ class: theme })` and `input({ disabled: busy })`. The binding goes live when a component,
  or `mount`, places the element, and it ends with that element. imp reports and skips a state you
  pass as a standalone argument instead of a prop value. See **[State](state.md)**, _Binding props_.

## Mounting

```js
mount('#app', app) // selector or element; component fn or Node
const unmount = mount('#cart', () => cart({ id })) // server-HTML island
unmount() // clears the host
html('<b>trusted</b>') // raw HTML -> DocumentFragment (trusted input only)
```

`mount(target, view)` runs `view` once, when `view` is a function. It replaces the children of the
host with the result, and returns an `unmount` function that empties the host. The result can be a
`Node`, a string (which becomes a text node), or an array of either. imp skips a `null`,
`undefined`, or `false` entry. A `target` selector that matches nothing throws.

`html(markup)` parses a string of trusted markup into a fragment. Use it for markup that your own
code wrote, never for text that a person typed. A strict Content Security Policy blocks a `style`
attribute inside that markup. Use a `class` and CSS instead, see
[Content Security Policy](cli.md#content-security-policy).

The first `mount` also sets the browser's default `body` margin to zero, so a full-height app (any
app built on [shell](std-components.md)) reaches the edges of the window. Without this, an
eight-pixel gutter remains and adds a scrollbar to a page that must not scroll. This rule sits in
its own CSS cascade layer, and unlayered CSS always wins against a layer. Write
`body { margin: 2rem }` in your own stylesheet to get your margin back. You do not need
`!important`.

## Rendering happens in the browser

imp renders in the browser only. It has no server rendering, no prerender, and no static export of
rendered pages. The HTML page that `imp build` writes is the page that you wrote. The content of the
app appears when its JavaScript runs.

That fits the apps that imp is for: an internal tool, a dashboard, an admin panel, a product behind
a sign-in, and an installable app. It does not fit a public content site that must show its text
before the JavaScript runs, such as a blog, a documentation site or a shop catalog. A crawler that
runs no script, and a link preview, read only the static HTML of such a page. For those pages, use a
static site generator. You can serve them beside an imp app on the same domain.

imp does two things for a page that a crawler reads:

- The router writes the title of the document and the description of the matched page on every
  navigation. See **[Routing](routing.md)**.
- Your HTML page keeps what you write in it. A `<title>`, a `<meta name="description">` and a short
  text in the page reach every reader, also with JavaScript off.

To add interactive parts to a page that your server renders, build a component as a JS entry, and
mount it into that page. See **[the CLI docs](cli.md#imp-build)**.
