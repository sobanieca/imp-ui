// Owner-tree disposal (essence #13, decided in review.md).
// One scope per component/slot/row. Disposing a scope:
//   1. disposes child scopes,
//   2. aborts the scope's AbortController (detaches every `events` listener
//      and cancels every fetch attached with its signal),
//   3. runs registered disposers (effect teardown, onMount cleanups).
// Structural primitives (when/each/match/router) create and dispose scopes;
// user code normally never touches this module directly.

let current = null

export function createScope(parent = current) {
  const scope = {
    parent: parent && !parent.disposed ? parent : null,
    children: null,
    disposers: null,
    ctrl: null,
    disposed: false,
  }
  if (scope.parent) (scope.parent.children ??= new Set()).add(scope)
  return scope
}

export function runInScope(scope, fn) {
  const prev = current
  current = scope
  try {
    return fn()
  } finally {
    current = prev
  }
}

export const getScope = () => current

// Register a cleanup on the active scope. No-op at top level (top-level
// effects and listeners are intentionally permanent).
export function onDispose(fn) {
  if (current) (current.disposers ??= []).push(fn)
  return fn
}

// Lazy AbortSignal of the active scope — pass to addEventListener/fetch.
// undefined at top level.
export function scopeSignal() {
  if (!current) return undefined
  current.ctrl ??= new AbortController()
  return current.ctrl.signal
}

export function disposeScope(scope) {
  if (!scope || scope.disposed) return
  scope.disposed = true
  if (scope.children) {
    for (const child of [...scope.children]) disposeScope(child)
    scope.children = null
  }
  if (scope.ctrl) scope.ctrl.abort()
  if (scope.disposers) {
    for (const d of scope.disposers) {
      try {
        d()
      } catch (e) {
        console.error('imp: disposer threw', e)
      }
    }
    scope.disposers = null
  }
  scope.parent?.children?.delete(scope)
  scope.parent = null
}
