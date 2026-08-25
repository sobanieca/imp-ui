import { collectStatesFrom } from './state.js'

const MAX_PATH_STEPS = 12

const MAX_CONTROLS = 40

const TEXT_LIMIT = 200

const HTML_LIMIT = 400

const CONTROL_VALUE_LIMIT = 200

const FORM_CONTROLS = 'input, textarea, select'

const clip = (value, limit) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

const round = (value) => Math.round(value)

const nthOfType = (node) => {
  const parent = node.parentNode
  if (!parent) return ''
  const twins = [...parent.children].filter((child) => child.localName === node.localName)
  return twins.length > 1 ? `:nth-of-type(${twins.indexOf(node) + 1})` : ''
}

const stepLabel = (node) => {
  if (node.id) return `${node.localName}#${node.id}`
  const className = node.classList[0]
  return node.localName + (className ? `.${className}` : '') + nthOfType(node)
}

export const describeElementPath = (node) => {
  const parts = []
  let current = node
  let steps = 0
  while (current && current.nodeType === 1 && current !== document.documentElement) {
    if (steps === MAX_PATH_STEPS) {
      parts.unshift('...')
      break
    }
    const parent = current.parentNode
    const crossing = parent instanceof ShadowRoot
    parts.unshift(stepLabel(current))
    steps++
    if (crossing) parts.unshift('>>')
    else if (parent?.nodeType === 1 && parent !== document.documentElement) parts.unshift('>')
    current = crossing ? parent.host : parent
  }
  return parts.join(' ')
}

const controlsWithin = (node) => {
  const root = node.closest('form') ?? node
  const found = []
  const walk = (from) => {
    for (const element of from.querySelectorAll('*')) {
      if (found.length >= MAX_CONTROLS) return
      if (element.matches(FORM_CONTROLS)) found.push(element)
      if (element.shadowRoot) walk(element.shadowRoot)
    }
  }
  if (root.matches(FORM_CONTROLS)) found.push(root)
  walk(root)
  if (root.shadowRoot) walk(root.shadowRoot)
  return found
}

const controlName = (control) => {
  const named = control.getAttribute('name')
  if (named) return `${control.localName}[name=${named}]`
  if (control.id) return `${control.localName}#${control.id}`
  return stepLabel(control)
}

const readControl = (control) => {
  if (control.type === 'password') {
    return control.value ? { value: null, length: control.value.length } : { value: '' }
  }
  if (control.type === 'checkbox' || control.type === 'radio') {
    return { value: control.checked ? 'checked' : 'unchecked' }
  }
  if (control.localName === 'select') {
    return { value: [...control.selectedOptions].map((option) => option.value).join(', ') }
  }
  if (control.type === 'file') {
    return { value: [...control.files ?? []].map((file) => file.name).join(', ') }
  }
  return { value: control.value }
}

const describeControls = (node) =>
  controlsWithin(node).map((control) => {
    const read = readControl(control)
    return {
      name: controlName(control),
      ...read,
      value: read.value === null ? null : clip(read.value, CONTROL_VALUE_LIMIT),
      disabled: Boolean(control.disabled),
      readOnly: Boolean(control.readOnly),
    }
  })

const describeStates = (node) => {
  try {
    return collectStatesFrom(node).map(({ name, value }) => ({ name, value }))
  } catch {
    return []
  }
}

const describeEnvironment = () => ({
  viewport: `${innerWidth}x${innerHeight}${
    devicePixelRatio === 1 ? '' : ` at ${devicePixelRatio}x`
  }`,
  scroll: scrollX || scrollY ? `${round(scrollX)},${round(scrollY)}` : '',
  scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : '',
  lang: document.documentElement.lang,
  dir: getComputedStyle(document.documentElement).direction,
})

export const captureReport = (node) => {
  const rect = node.getBoundingClientRect()
  return {
    time: new Date().toISOString(),
    page: location.href,
    title: document.title,
    ...describeEnvironment(),
    element: {
      path: describeElementPath(node),
      rect: `${round(rect.width)}x${round(rect.height)} at ${round(rect.left)},${round(rect.top)}`,
      text: clip(node.innerText ?? node.textContent, TEXT_LIMIT),
      html: clip(node.outerHTML, HTML_LIMIT),
    },
    state: describeStates(node),
    controls: describeControls(node),
  }
}

export const placeOverElement = (outline, node) => {
  const rect = node.getBoundingClientRect()
  outline.style.top = `${rect.top}px`
  outline.style.left = `${rect.left}px`
  outline.style.width = `${rect.width}px`
  outline.style.height = `${rect.height}px`
}

export const pickElement = ({ ignore = [], onHover, onPick, onCancel } = {}) => {
  const skipped = Array.isArray(ignore) ? ignore : [ignore]
  const controller = new AbortController()
  const root = document.documentElement
  let hovered = null
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    controller.abort()
    root.style.cursor = ''
  }

  const under = (event) => {
    const path = event.composedPath()
    const node = path[0]
    if (!node || node.nodeType !== 1) return null
    if (skipped.some((element) => element && path.includes(element))) return null
    return node
  }

  const hover = (node) => {
    hovered = node
    onHover?.(node)
  }

  const take = (node) => {
    stop()
    onPick?.(node)
  }

  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { capture: true, signal: controller.signal })

  const onDocument = (type, handler) => listen(document, type, handler)

  onDocument('pointermove', (event) => hover(under(event)))
  onDocument('focusin', (event) => hover(under(event)))
  onDocument('click', (event) => {
    const node = under(event)
    if (!node) return
    event.preventDefault()
    event.stopPropagation()
    take(node)
  })
  onDocument('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      stop()
      onCancel?.()
      return
    }
    if (event.key === 'Enter' && hovered) {
      event.preventDefault()
      take(hovered)
    }
  })
  onDocument('scroll', () => {
    if (hovered) onHover?.(hovered)
  })
  listen(globalThis, 'resize', () => {
    if (hovered) onHover?.(hovered)
  })

  root.style.cursor = 'crosshair'
  return stop
}
