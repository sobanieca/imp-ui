// Element-factory rendering core (essence #7-#9, #15).
//
// `el(tag, ...args)` returns a real DOM node. Arguments are dispatched by
// TYPE, never by position:
//   array            -> children (flattened recursively)
//   string / number  -> text child
//   Node             -> child
//   plain object     -> props (merged)
//   null/undefined/false/true -> skipped
//
// Prop keys are HTML attribute names verbatim (`class`, `for`, `data-*`,
// `aria-*`) — no aliases. This module turns factory calls into static DOM.

const SVG_NS = 'http://www.w3.org/2000/svg'

// Attributes whose IDL property is read-only or detached from the attribute —
// they must round-trip through setAttribute (see adr/0004).
const FORCE_ATTR = new Set(['list', 'form'])

export function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function normalize(args) {
  let props = null
  let seenProps = false
  const children = []
  const push = (v) => {
    if (v === null || v === undefined || v === false || v === true) return
    if (Array.isArray(v)) {
      for (const c of v) push(c)
      return
    }
    if (v instanceof Node) {
      children.push(v)
      return
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
      children.push(String(v))
      return
    }
    // anything else at child position is dropped
  }
  for (const a of args) {
    if (isPlainObject(a)) {
      // A single props object per call (adr/0002). Merging multiple silently
      // clobbers structured keys (class/style), so warn and let last-wins apply.
      if (seenProps) {
        console.warn(
          'imp: multiple props objects passed to one element; pass a single props object instead. Later keys win.',
        )
      }
      seenProps = true
      props = Object.assign(props ?? {}, a)
    } else push(a)
  }
  return { props, children }
}

function setAttr(node, k, v) {
  // Only null/undefined remove the attribute. `false` serializes to the string
  // "false" — ARIA and other tri-state attributes treat absent and "false" as
  // distinct (e.g. aria-expanded="false"). `true` sets a bare attribute.
  if (v === null || v === undefined) node.removeAttribute(k)
  else node.setAttribute(k, v === true ? '' : String(v))
}

// Property-first fallthrough (adr/0004): handles booleans (disabled/checked),
// live form state (value/selected/indeterminate), and custom-element
// properties in one path. Names not exposed as JS properties (class, for,
// data-*, aria-*) fall to setAttribute. SVG is always attribute-based.
function setProp(node, k, v) {
  if (node.namespaceURI === SVG_NS || FORCE_ATTR.has(k)) {
    return setAttr(node, k, v)
  }
  if (k in node) {
    try {
      node[k] = v === null || v === undefined ? '' : v
      return
    } catch {
      // read-only property — fall through to attribute
    }
  }
  setAttr(node, k, v)
}

// events: { click: fn } or { click: [fn, { once: true }] } — native DOM event
// names, no `on` prefix. The optional second array element is addEventListener
// options.
function applyEvents(node, events) {
  for (const name in events) {
    const entry = events[name]
    const [fn, opts] = Array.isArray(entry) ? entry : [entry, null]
    if (typeof fn !== 'function') continue
    node.addEventListener(name, fn, opts ?? undefined)
  }
}

const styleKey = (k) => k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

function setStyleEntry(node, k, v) {
  if (v === null || v === undefined || v === false) {
    node.style.removeProperty(styleKey(k))
  } else node.style.setProperty(styleKey(k), String(v))
}

// style: string | object (camelCase -> kebab, --custom-props verbatim).
function applyStyle(node, style) {
  if (typeof style === 'string') {
    node.setAttribute('style', style)
    return
  }
  if (!style || typeof style !== 'object') return
  for (const k in style) setStyleEntry(node, k, style[k])
}

// class: 'card' | ['card', extra] | { active: cond }
function applyClass(node, cls) {
  if (typeof cls === 'string') {
    node.setAttribute('class', cls)
    return
  }
  if (Array.isArray(cls)) {
    node.setAttribute('class', cls.filter((c) => typeof c === 'string' && c).join(' '))
    return
  }
  if (!cls || typeof cls !== 'object') return
  for (const name in cls) node.classList.toggle(name, !!cls[name])
}

function applyProps(node, props) {
  for (const k in props) {
    const v = props[k]
    if (k === 'events') {
      if (v && typeof v === 'object') applyEvents(node, v)
      continue
    }
    if (k === 'style') {
      applyStyle(node, v)
      continue
    }
    if (k === 'class') {
      applyClass(node, v)
      continue
    }
    setProp(node, k, v)
  }
}

function appendChildren(node, children) {
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
}

export function el(tag, ...args) {
  const node = document.createElement(tag)
  const { props, children } = normalize(args)
  // Children first: live props like <select>.value and <textarea>.value depend
  // on the relevant child nodes already existing (or must win over text children).
  appendChildren(node, children)
  if (props) applyProps(node, props)
  return node
}

// svg.circle({ r: 40 }) — any SVG tag via proxy. Attributes are set verbatim,
// so case-sensitive names like viewBox round-trip correctly.
export const svg = new Proxy({}, {
  get: (_, tag) => (...args) => {
    const node = document.createElementNS(SVG_NS, tag)
    const { props, children } = normalize(args)
    appendChildren(node, children)
    if (props) applyProps(node, props)
    return node
  },
})

const TAGS = [
  'div',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'a',
  'button',
  'input',
  'label',
  'textarea',
  'select',
  'option',
  'optgroup',
  'datalist',
  'output',
  'progress',
  'section',
  'header',
  'main',
  'footer',
  'nav',
  'aside',
  'article',
  'img',
  'picture',
  'source',
  'pre',
  'code',
  'strong',
  'em',
  'small',
  'hr',
  'br',
  'b',
  'i',
  'u',
  'sub',
  'sup',
  'mark',
  'kbd',
  'abbr',
  'time',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'col',
  'colgroup',
  'form',
  'fieldset',
  'legend',
  'dialog',
  'details',
  'summary',
  'blockquote',
  'figure',
  'figcaption',
  'canvas',
  'video',
  'audio',
  'iframe',
  'address',
  'menu',
]

export const {
  div,
  p,
  span,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  ul,
  ol,
  li,
  dl,
  dt,
  dd,
  a,
  button,
  input,
  label,
  textarea,
  select,
  option,
  optgroup,
  datalist,
  output,
  progress,
  section,
  header,
  main,
  footer,
  nav,
  aside,
  article,
  img,
  picture,
  source,
  pre,
  code,
  strong,
  em,
  small,
  hr,
  br,
  b,
  i,
  u,
  sub,
  sup,
  mark,
  kbd,
  abbr,
  time,
  table,
  thead,
  tbody,
  tfoot,
  tr,
  th,
  td,
  caption,
  col,
  colgroup,
  form,
  fieldset,
  legend,
  dialog,
  details,
  summary,
  blockquote,
  figure,
  figcaption,
  canvas,
  video,
  audio,
  iframe,
  address,
  menu,
} = Object.fromEntries(TAGS.map((t) => [t, (...args) => el(t, ...args)]))

// Render a view into the app root or a server-emitted placeholder (essence
// #19). `view` is a component function (run once) or an already-built Node.
// Returns an unmount function that clears the target.
export function mount(target, view) {
  const host = typeof target === 'string' ? document.querySelector(target) : target
  if (!host) throw new Error('imp: mount target not found: ' + target)
  const out = typeof view === 'function' ? view() : view
  host.replaceChildren()
  for (const n of Array.isArray(out) ? out : [out]) {
    if (n === null || n === undefined || n === false) continue
    host.appendChild(n instanceof Node ? n : document.createTextNode(String(n)))
  }
  return () => host.replaceChildren()
}

// Trusted raw HTML -> DocumentFragment. Never pass user input through this.
export function html(str) {
  const tpl = document.createElement('template')
  tpl.innerHTML = str
  return tpl.content
}
