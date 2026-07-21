import { activateBindings, asNodes, registerBinding } from './nodes.js'
import { runInMountScope } from './component.js'
import { createLogger } from './logger.js'

const log = createLogger('imp')

const ATTRIBUTE_ONLY_PROPS = new Set(['list', 'form'])

export function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

export const isStateShaped = (value) =>
  !!value && typeof value.get === 'function' && typeof value.watch === 'function'

function normalize(args) {
  let props = null
  let seenProps = false
  const children = []

  for (const arg of args) {
    if (isStateShaped(arg)) {
      log.warn(
        'a state was passed directly to an element — pass it as a prop value ({ class: state }) or render it with text()/view()/each()',
      )
      continue
    }
    if (isPlainObject(arg)) {
      if (seenProps) {
        log.warn(
          'multiple props objects passed to one element; pass a single props object instead. Later keys win.',
        )
      }
      seenProps = true
      props = Object.assign(props ?? {}, arg)
    } else children.push(...asNodes(arg))
  }
  return { props, children }
}

function setAttribute(node, name, value) {
  if (value === null || value === undefined) node.removeAttribute(name)
  else node.setAttribute(name, value === true ? '' : String(value))
}

const isCustomElement = (node) => node.localName.includes('-') || node.hasAttribute('is')

function setProp(node, name, value) {
  const mustUseAttribute = ATTRIBUTE_ONLY_PROPS.has(name)
  if (mustUseAttribute) return setAttribute(node, name, value)

  const exposedAsProperty = name in node
  if (exposedAsProperty) {
    const nullish = value === null || value === undefined
    const propertyValue = nullish && !isCustomElement(node) ? '' : value
    try {
      node[name] = propertyValue
      return
    } catch {
      setAttribute(node, name, value)
      return
    }
  }
  setAttribute(node, name, value)
}

function applyEvents(node, events) {
  for (const eventName in events) {
    const entry = events[eventName]
    const [listener, options] = Array.isArray(entry) ? entry : [entry, null]
    if (typeof listener !== 'function') continue
    node.addEventListener(eventName, listener, options ?? undefined)
  }
}

const toStylePropertyName = (name) =>
  name.startsWith('--') ? name : name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

function setStyleEntry(node, name, value) {
  const propertyName = toStylePropertyName(name)
  if (value === null || value === undefined || value === false) {
    node.style.removeProperty(propertyName)
  } else node.style.setProperty(propertyName, String(value))
}

function applyStyle(node, style) {
  if (typeof style === 'string') {
    node.setAttribute('style', style)
    return
  }
  node.removeAttribute('style')
  if (!style || typeof style !== 'object') return
  for (const name in style) setStyleEntry(node, name, style[name])
}

const classNames = (cls) => {
  if (typeof cls === 'string') return cls
  if (Array.isArray(cls)) return cls.filter((c) => typeof c === 'string' && c).join(' ')
  if (cls && typeof cls === 'object') {
    return Object.keys(cls).filter((name) => cls[name]).join(' ')
  }
  return ''
}

function applyClass(node, cls) {
  const names = classNames(cls)
  if (names) node.setAttribute('class', names)
  else node.removeAttribute('class')
}

function bindProp(node, key, state) {
  registerBinding(node, (scope) =>
    runInMountScope(scope, () =>
      state.watch((value) => {
        if (key === 'class') applyClass(node, value)
        else if (key === 'style') applyStyle(node, value)
        else setProp(node, key, value)
      })))
}

function applyProps(node, props) {
  for (const key in props) {
    const value = props[key]
    if (key === 'events') {
      if (value && typeof value === 'object') applyEvents(node, value)
      continue
    }
    if (isStateShaped(value)) {
      bindProp(node, key, value)
      continue
    }
    if (key === 'style') {
      applyStyle(node, value)
      continue
    }
    if (key === 'class') {
      applyClass(node, value)
      continue
    }
    setProp(node, key, value)
  }
}

function build(node, args) {
  const { props, children } = normalize(args)
  node.append(...children)
  if (props) applyProps(node, props)
  return node
}

export function el(tag, ...args) {
  return build(document.createElement(tag), args)
}

export const TAGS = [
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

export function mount(target, view) {
  const host = typeof target === 'string' ? document.querySelector(target) : target
  if (!host) throw new Error('imp: mount target not found: ' + target)
  const out = typeof view === 'function' ? view() : view
  const cleanups = []
  const rebinds = new Set()
  const scope = {
    host,
    addCleanup: (cleanup) => cleanups.push(cleanup),
    addRebind: (rebind) => rebinds.add(rebind),
    removeRebind: (rebind) => rebinds.delete(rebind),
  }
  const nodes = asNodes(out)
  host.replaceChildren(...nodes)
  activateBindings(scope, nodes)
  log.debug(`mounted into <${host.localName}>`)
  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup()
    rebinds.clear()
    host.replaceChildren()
  }
}

export function html(str) {
  const tpl = document.createElement('template')
  tpl.innerHTML = str
  return tpl.content
}
