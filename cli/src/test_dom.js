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

const toggleEvent = (window, type, oldState, newState) =>
  new window.Event(type, {
    bubbles: false,
    cancelable: type === 'beforetoggle',
    oldState,
    newState,
  })

const installPopoverApi = (window) => {
  const prototype = window.HTMLElement.prototype
  if (prototype.showPopover) return
  prototype.showPopover = function showPopover() {
    if (!this.hasAttribute('popover')) {
      throw new window.DOMException('Not supported', 'NotSupportedError')
    }
    if (this[POPOVER_OPEN]) return
    this.dispatchEvent(toggleEvent(window, 'beforetoggle', 'closed', 'open'))
    this[POPOVER_OPEN] = true
    this.dispatchEvent(toggleEvent(window, 'toggle', 'closed', 'open'))
  }
  prototype.hidePopover = function hidePopover() {
    if (!this[POPOVER_OPEN]) return
    this.dispatchEvent(toggleEvent(window, 'beforetoggle', 'open', 'closed'))
    this[POPOVER_OPEN] = false
    this.dispatchEvent(toggleEvent(window, 'toggle', 'open', 'closed'))
  }
  prototype.togglePopover = function togglePopover(force) {
    const open = force ?? !this[POPOVER_OPEN]
    if (open) this.showPopover()
    else this.hidePopover()
    return Boolean(this[POPOVER_OPEN])
  }
}

export function installDomEnvironment() {
  const window = new Window({ url: 'http://localhost/' })
  installPopoverApi(window)
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
