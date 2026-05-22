// Layer 1 — element factory core. Pure rendering, no signals yet.

const BOOLEAN_ATTRS = new Set([
  'disabled', 'checked', 'readonly', 'required', 'multiple',
  'selected', 'autofocus', 'hidden', 'open',
])

function camelToKebab(s) {
  return s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false
  if (Array.isArray(v)) return false
  if (v instanceof Node) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function normalize(args) {
  let props = {}
  const children = []

  const push = (v) => {
    if (v === null || v === undefined || v === false) return
    if (Array.isArray(v)) { v.forEach(push); return }
    if (v instanceof Node) { children.push(v); return }
    if (typeof v === 'string' || typeof v === 'number') {
      children.push(document.createTextNode(String(v)))
      return
    }
    if (typeof v === 'function') { children.push(v); return } // reactive slot (layer 2)
    // anything else is dropped silently
  }

  for (const a of args) {
    if (isPlainObject(a)) {
      props = Object.assign(props, a)
    } else {
      push(a)
    }
  }
  return { props, children }
}

function applyStyle(node, style) {
  if (typeof style === 'string') { node.setAttribute('style', style); return }
  if (!style || typeof style !== 'object') return
  for (const k in style) {
    node.style.setProperty(camelToKebab(k), style[k])
  }
}

function applyProps(node, props) {
  for (const k in props) {
    const v = props[k]

    if (k === 'style') { applyStyle(node, v); continue }
    if (k === 'className' || k === 'class') { node.setAttribute('class', v); continue }
    if (k === 'dataset' && v && typeof v === 'object') {
      for (const dk in v) node.dataset[dk] = v[dk]
      continue
    }
    if (k === 'ref' && typeof v === 'function') { v(node); continue }

    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v)
      continue
    }

    if (BOOLEAN_ATTRS.has(k)) {
      if (v) node.setAttribute(k, '')
      else node.removeAttribute(k)
      continue
    }

    if (v === false || v === null || v === undefined) continue
    node.setAttribute(k, v === true ? '' : String(v))
  }
}

export function el(tag, ...args) {
  const node = document.createElement(tag)
  const { props, children } = normalize(args)
  applyProps(node, props)
  for (const c of children) {
    if (c instanceof Node) node.appendChild(c)
    // function children — wired in layer 2
  }
  return node
}

const TAGS = [
  'div', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'button', 'input', 'label', 'textarea', 'select', 'option',
  'section', 'header', 'main', 'footer', 'nav', 'aside', 'article',
  'img', 'pre', 'code', 'strong', 'em', 'small', 'hr', 'br',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'form',
]

export const {
  div, p, span, h1, h2, h3, h4, h5, h6,
  ul, ol, li, a, button, input, label, textarea, select, option,
  section, header, main, footer, nav, aside, article,
  img, pre, code, strong, em, small, hr, br,
  table, thead, tbody, tr, th, td, form,
} = Object.fromEntries(TAGS.map(t => [t, (...args) => el(t, ...args)]))

export function render(node, mount) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount
  target.innerHTML = ''
  target.appendChild(node)
}
