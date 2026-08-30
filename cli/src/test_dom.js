import { Window } from './vendor/happy_dom.js'

const LOWERCASE_GLOBALS = new Set([
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'screen',
  'customElements',
  'localStorage',
  'sessionStorage',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'scrollTo',
  'scrollBy',
  'alert',
  'confirm',
  'prompt',
  'innerWidth',
  'innerHeight',
  'outerWidth',
  'outerHeight',
  'scrollX',
  'scrollY',
  'pageXOffset',
  'pageYOffset',
  'visualViewport',
  'devicePixelRatio',
])

const JS_INTRINSICS = new Set([
  'Object',
  'Function',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'Math',
  'JSON',
  'Reflect',
  'Proxy',
  'Promise',
  'RegExp',
  'Date',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'FinalizationRegistry',
  'Error',
  'AggregateError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Atomics',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Intl',
  'Iterator',
  'AsyncIterator',
  'Temporal',
  'Buffer',
  'Infinity',
  'NaN',
])

const shouldExpose = (name) =>
  !JS_INTRINSICS.has(name) && (/^[A-Z]/.test(name) || LOWERCASE_GLOBALS.has(name))

const POPOVER_OPEN = Symbol('imp.test.popoverOpen')

const toggleEvent = (window, type, oldState, newState) => {
  const event = new window.Event(type, { bubbles: false, cancelable: type === 'beforetoggle' })
  Object.defineProperties(event, {
    oldState: { value: oldState, enumerable: true },
    newState: { value: newState, enumerable: true },
  })
  return event
}

const installPopoverApi = (window) => {
  const prototype = window.HTMLElement.prototype
  if (prototype.showPopover) return
  const open = []
  prototype.showPopover = function showPopover() {
    if (!this.hasAttribute('popover')) {
      throw new window.DOMException('Not supported', 'NotSupportedError')
    }
    if (this[POPOVER_OPEN]) return
    this.dispatchEvent(toggleEvent(window, 'beforetoggle', 'closed', 'open'))
    this[POPOVER_OPEN] = true
    open.push(this)
    this.dispatchEvent(toggleEvent(window, 'toggle', 'closed', 'open'))
  }
  prototype.hidePopover = function hidePopover() {
    if (!this[POPOVER_OPEN]) return
    this.dispatchEvent(toggleEvent(window, 'beforetoggle', 'open', 'closed'))
    this[POPOVER_OPEN] = false
    open.splice(open.indexOf(this), 1)
    this.dispatchEvent(toggleEvent(window, 'toggle', 'open', 'closed'))
  }
  prototype.togglePopover = function togglePopover(force) {
    const next = force ?? !this[POPOVER_OPEN]
    if (next) this.showPopover()
    else this.hidePopover()
    return Boolean(this[POPOVER_OPEN])
  }

  const lightDismissable = () =>
    open.filter((element) => element.getAttribute('popover') === 'auto')

  const invokerTarget = (node) => {
    const id = node.getAttribute?.('popovertarget')
    return id ? node.getRootNode().getElementById(id) : null
  }

  const invokedFrom = (path, element) => path.some((node) => invokerTarget(node) === element)

  window.document.addEventListener('pointerdown', (event) => {
    const path = event.composedPath()
    for (const element of lightDismissable().reverse()) {
      if (path.includes(element) || invokedFrom(path, element)) return
      element.hidePopover()
    }
  })

  window.document.addEventListener('click', (event) => {
    for (const node of event.composedPath()) {
      const target = invokerTarget(node)
      if (!target) continue
      const action = node.getAttribute('popovertargetaction') ?? 'toggle'
      if (action === 'show') target.showPopover()
      else if (action === 'hide') target.hidePopover()
      else target.togglePopover()
      return
    }
  })

  window.document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    lightDismissable().at(-1)?.hidePopover()
  })
}

const installAnimationsApi = (window) => {
  const prototype = window.Element.prototype
  if (prototype.getAnimations) return
  prototype.getAnimations = function getAnimations() {
    return []
  }
}

const MODAL_STATE = Symbol('imp.test.modalState')

const deepActiveElement = (document) => {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

const containingChild = (document, node) => {
  let current = node
  while (current && current.parentNode !== document.body) {
    current = current.parentNode ?? current.host ?? current.getRootNode?.().host
  }
  return current
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const installTopLayer = (window) => {
  const prototype = window.HTMLDialogElement.prototype
  const showModal = prototype.showModal
  const close = prototype.close
  const stack = []

  prototype.showModal = function modalShowModal() {
    showModal.call(this)
    const document = this.ownerDocument
    const inside = containingChild(document, this)
    const inerted = [...document.body.children].filter((child) => child !== inside && !child.inert)
    for (const child of inerted) child.inert = true
    this[MODAL_STATE] = { restore: deepActiveElement(document), inerted }
    stack.push(this)
    const target = this.querySelector('[autofocus]') ?? this.querySelector(FOCUSABLE) ?? this
    target.focus()
  }

  prototype.close = function modalClose(returnValue) {
    const state = this[MODAL_STATE]
    if (state) {
      for (const child of state.inerted) child.inert = false
      stack.splice(stack.indexOf(this), 1)
      this[MODAL_STATE] = null
      state.restore?.focus()
    }
    close.call(this, returnValue)
  }

  window.document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || stack.length === 0) return
    const dialog = stack.at(-1)
    const cancel = new window.Event('cancel', { bubbles: false, cancelable: true })
    if (dialog.dispatchEvent(cancel)) dialog.close()
  })
}

export function installDomEnvironment() {
  const window = new Window({ url: 'http://localhost/' })
  installPopoverApi(window)
  installAnimationsApi(window)
  installTopLayer(window)
  const replaced = new Map()

  const names = new Set(['window', 'document', ...Object.getOwnPropertyNames(window)])
  for (const name of names) {
    if (!shouldExpose(name)) continue
    let value
    try {
      value = window[name]
    } catch {
      continue
    }
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    if (previous && !previous.configurable) continue
    try {
      Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true,
        enumerable: false,
      })
      replaced.set(name, previous ?? null)
    } catch {
      continue
    }
  }

  return async () => {
    for (const [name, previous] of replaced) {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else delete globalThis[name]
    }
    try {
      await window.happyDOM.abort()
      window.close()
    } catch {
      return
    }
  }
}
