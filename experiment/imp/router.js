// SPA router. Explicit registration (decided in review.md — no file-based
// routing): route(path, factory), a router() outlet, navigate(), link().
// History API. The current location is a signal; the outlet is a marker-slot
// primitive like when/each.
//
//   route('/', () => homePage())
//   route('/todos/:id', ({ params }) => todoPage(params.id))
//   route('*', () => notFound())
//   // lazy, still buildless:
//   route('/admin', () => import('./pages/admin.js'))   // uses module default
//   mount('#app', () => div([nav(), router()]))
//
// A factory gets { params, query } and returns a Node — or a Promise of a
// Node / component function / module with a default component (dynamic
// import()). The slot is empty while a lazy route loads.

import { effect, signal, untrack } from './signals.js'
import { createScope, disposeScope, getScope, runInScope, scopeSignal } from './scope.js'
import { a } from './render.js'

const routes = []

// { path, query } of the current location. Route params are passed to the
// matched factory, not stored here (they depend on which route matched).
export const currentRoute = signal({ path: '/', query: {} })

export function route(pattern, factory) {
  routes.push({
    pattern,
    segments: pattern === '*' ? null : pattern.split('/').filter(Boolean),
    factory,
  })
}

function matchRoute(path) {
  const parts = path.split('/').filter(Boolean)
  for (const r of routes) {
    if (!r.segments || r.segments.length !== parts.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i]
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i])
      else if (seg !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { route: r, params }
  }
  const wildcard = routes.find((r) => !r.segments)
  return wildcard ? { route: wildcard, params: {} } : null
}

function setPath(href) {
  const url = new URL(href, 'http://x')
  currentRoute.set({
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
  })
}

export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path)
  setPath(path)
}

let started = false
function start() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('popstate', () => setPath(window.location.href))
  setPath(window.location.href)
}

export function router() {
  start()
  const frag = document.createDocumentFragment()
  const marker = document.createComment('router')
  frag.appendChild(marker)
  const owner = getScope()
  let scope = null
  let nodes = []
  let nav = 0

  const show = (out) => {
    for (const n of nodes) n.remove()
    nodes = []
    const push = (x) => {
      if (x === null || x === undefined || x === false) return
      if (Array.isArray(x)) return x.forEach(push)
      if (x instanceof DocumentFragment) return nodes.push(...x.childNodes)
      nodes.push(x instanceof Node ? x : document.createTextNode(String(x)))
    }
    push(out)
    const parent = marker.parentNode
    if (!parent) return
    let ref = marker
    for (const n of nodes) {
      parent.insertBefore(n, ref.nextSibling)
      ref = n
    }
  }

  effect(() => {
    const { path, query } = currentRoute()
    const m = matchRoute(path)
    const token = ++nav
    if (scope) disposeScope(scope)
    if (!m) {
      show(null)
      return
    }
    scope = createScope(owner)
    const ctx = { params: m.params, query }
    const out = runInScope(scope, () => untrack(() => m.route.factory(ctx)))
    if (out && typeof out.then === 'function') {
      show(null) // empty while the lazy chunk loads
      out.then((resolved) => {
        if (token !== nav || scope.disposed) return
        const view = resolved?.default ?? resolved
        show(runInScope(scope, () => untrack(() => typeof view === 'function' ? view(ctx) : view)))
      }).catch((e) => console.error('imp: route failed to load', e))
    } else {
      show(out)
    }
  })
  return frag
}

// In-app anchor: a real <a href> (middle-click, copy link, SEO all work) that
// intercepts plain left-clicks and navigates client-side.
export function link(...args) {
  const node = a(...args)
  node.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const href = node.getAttribute('href')
    if (!href || /^[a-z]+:/i.test(href) || node.target) return
    e.preventDefault()
    navigate(href)
  }, { signal: scopeSignal() })
  return node
}
