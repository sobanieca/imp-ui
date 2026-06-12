// Test helpers (essence #20: DOM-polyfilled `deno test`). Importing this
// module installs happy-dom as the global DOM when none exists, so the same
// component code runs unchanged in the browser and under `imp test`.
// Signal updates are synchronous — assert right after the event; `tick()` is
// for onMount and other microtask work.

if (typeof globalThis.document === 'undefined') {
  // Keep the runtime's own schedulers and event dispatch: happy-dom wraps
  // them in its AsyncTaskManager (stray internal timers that trip Deno's
  // leak sanitizer), and its dispatchEvent rejects Deno's load/unload events.
  const keep = {}
  for (
    const k of [
      'dispatchEvent',
      'queueMicrotask',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ]
  ) {
    keep[k] = globalThis[k]
  }
  const { GlobalRegistrator } = await import('npm:@happy-dom/global-registrator@^20')
  GlobalRegistrator.register()
  for (const k in keep) {
    if (keep[k]) globalThis[k] = keep[k]
  }
}

import { createScope, disposeScope, runInScope } from './scope.js'
import { flushStyles } from './styles.js'
import { setTheme, theme } from './theme.js'
import { locale, setLocale } from './i18n.js'

flushStyles() // css`` rules registered before the DOM existed
setTheme(theme.peek()?.name ?? 'light') // re-apply tokens now that :root exists

// Renders a component into a fresh container attached to document.body.
// view: component function (run in its own root scope) or a built Node.
export function mount(view) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const scope = createScope(null)
  const out = typeof view === 'function' ? runInScope(scope, view) : view
  for (const node of Array.isArray(out) ? out : [out]) {
    if (node) host.append(node)
  }
  return {
    el: host,
    query: (sel) => host.querySelector(sel),
    queryAll: (sel) => [...host.querySelectorAll(sel)],
    fire: (target, type, init) =>
      fire(typeof target === 'string' ? host.querySelector(target) : target, type, init),
    unmount: () => {
      disposeScope(scope)
      host.remove()
    },
  }
}

// fire(node, 'click') · fire(node, 'keydown', { key: 'Enter' }) ·
// fire(input, 'input') (set input.value first). Bubbles and is cancelable by
// default; pass { detail } for a CustomEvent.
export function fire(node, type, init = {}) {
  if (!node) throw new Error('fire: target node is null')
  const Ctor = type.startsWith('key')
    ? KeyboardEvent
    : (type === 'click' || type.startsWith('mouse'))
    ? MouseEvent
    : 'detail' in init
    ? CustomEvent
    : Event
  node.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, ...init }))
}

// Drains the microtask queue (twice) — lets onMount callbacks run.
// Timer-free so Deno's op sanitizer never races it.
export const tick = () => new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)))

// Polls predicate until truthy (sync or async) or times out.
export async function waitFor(predicate, { timeout = 1000, interval = 10 } = {}) {
  const start = Date.now()
  for (;;) {
    const value = await predicate()
    if (value) return value
    if (Date.now() - start > timeout) throw new Error('waitFor: timed out')
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

// Scoped overrides that auto-restore, so theme/locale assertions don't leak
// into sibling tests.
export async function withTheme(name, fn) {
  const prev = theme.peek()?.name
  setTheme(name)
  try {
    return await fn()
  } finally {
    if (prev) setTheme(prev)
  }
}

export async function withLocale(loc, fn) {
  const prev = locale.peek()
  setLocale(loc)
  try {
    return await fn()
  } finally {
    setLocale(prev)
  }
}
