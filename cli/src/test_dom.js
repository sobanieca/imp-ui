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

export function installDomEnvironment() {
  const window = new Window({ url: 'http://localhost/' })
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
