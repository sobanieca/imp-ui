import { asNodes } from './nodes.js'

const COMPONENT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/

const RESERVED_NAMES = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
])

export const componentNameProblem = (name) => {
  if (typeof name !== 'string') {
    return `component name must be a dash-separated string like 'my-app-profile'`
  }
  if (!COMPONENT_NAME.test(name)) {
    return `component name '${name}' must be lowercase with at least one dash — like 'my-app-profile'`
  }
  if (RESERVED_NAMES.has(name)) {
    return `component name '${name}' is reserved by the HTML standard — pick another name`
  }
  return null
}

const assertValidComponentName = (name) => {
  const problem = componentNameProblem(name)
  if (problem) throw new Error(`imp: ${problem}`)
}

const assertValidDefinition = (name, definition) => {
  if (!definition || typeof definition !== 'object' || typeof definition.onMount !== 'function') {
    throw new Error(
      `imp: component '${name}' needs a definition object with an onMount function returning its DOM`,
    )
  }
  for (const hook of ['placeholder', 'onUnmount', 'onError']) {
    if (definition[hook] !== undefined && typeof definition[hook] !== 'function') {
      throw new Error(`imp: component '${name}': '${hook}' must be a function`)
    }
  }
}

const COMPONENT_ERROR_EVENT = 'ComponentError'

const reportComponentError = (host, error) => {
  const unhandled = host.dispatchEvent(
    new CustomEvent(COMPONENT_ERROR_EVENT, {
      detail: { error, source: host },
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  )
  if (unhandled) {
    console.error(`imp: component '${host.localName}' failed to mount`, error)
  }
}

const ARGS = Symbol('imp.component.args')
const MOUNTED = Symbol('imp.component.mounted')
const GENERATION = Symbol('imp.component.generation')
const CLEANUPS = Symbol('imp.component.cleanups')
const REBINDS = Symbol('imp.component.rebinds')
const ERRORED = Symbol('imp.component.errored')

const rebindSubscriptions = (host) => {
  for (const rebind of [...host[REBINDS]]) {
    if (host[REBINDS].has(rebind)) rebind()
  }
}

const mountScopes = []

export const activeMountScope = () => mountScopes.at(-1) ?? null

export const runInMountScope = (scope, run) => {
  mountScopes.push(scope)
  try {
    return run()
  } finally {
    mountScopes.pop()
  }
}

let hostStyles = null

const injectHostStyle = (name) => {
  if (!hostStyles) {
    hostStyles = document.createElement('style')
    document.head.append(hostStyles)
  }
  hostStyles.append(`:where(${name}) { display: contents }\n`)
}

const createHostClass = (definition) =>
  class extends HTMLElement {
    constructor() {
      super()
      this[ARGS] = []
      this[MOUNTED] = false
      this[GENERATION] = 0
      this[CLEANUPS] = []
      this[REBINDS] = new Set()
      this[ERRORED] = false
    }

    connectedCallback() {
      if (!this.isConnected) return
      if (this[MOUNTED]) {
        rebindSubscriptions(this)
        return
      }
      this[MOUNTED] = true
      const generation = ++this[GENERATION]
      const scope = {
        host: this,
        addCleanup: (cleanup) => this[CLEANUPS].push(cleanup),
        addRebind: (rebind) => this[REBINDS].add(rebind),
        removeRebind: (rebind) => this[REBINDS].delete(rebind),
      }
      if (definition.onError) {
        const renderErrorFallback = (event) => {
          if (this[ERRORED]) return
          event.stopPropagation()
          event.preventDefault()
          this[ERRORED] = true
          let fallback
          try {
            fallback = runInMountScope(
              scope,
              () => definition.onError(event.detail.error, ...this[ARGS]),
            )
          } catch (error) {
            console.error(`imp: component '${this.localName}': onError failed`, error)
            return
          }
          this.replaceChildren(...asNodes(fallback))
        }
        this.addEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        this[CLEANUPS].push(() =>
          this.removeEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        )
      }
      let output
      try {
        output = runInMountScope(scope, () => definition.onMount(...this[ARGS]))
      } catch (error) {
        reportComponentError(this, error)
        return
      }
      if (output && typeof output.then === 'function') {
        output.then(
          (resolved) => {
            if (this[GENERATION] !== generation || !this.isConnected) return
            this.replaceChildren(...asNodes(resolved))
          },
          (error) => {
            if (this[GENERATION] !== generation || !this.isConnected) {
              console.error(`imp: component '${this.localName}' failed to mount`, error)
              return
            }
            reportComponentError(this, error)
          },
        )
        return
      }
      this.replaceChildren(...asNodes(output))
    }

    connectedMoveCallback() {
      if (this[MOUNTED]) rebindSubscriptions(this)
    }

    disconnectedCallback() {
      if (this.isConnected || !this[MOUNTED]) return
      queueMicrotask(() => {
        if (this.isConnected || !this[MOUNTED]) return
        this[MOUNTED] = false
        this[GENERATION]++
        for (const cleanup of this[CLEANUPS].splice(0)) {
          try {
            cleanup()
          } catch (error) {
            console.error(`imp: component '${this.localName}': a cleanup failed`, error)
          }
        }
        this[REBINDS].clear()
        try {
          definition.onUnmount?.(...this[ARGS])
        } catch (error) {
          console.error(`imp: component '${this.localName}': onUnmount failed`, error)
        }
        this[ERRORED] = false
        this.replaceChildren(...asNodes(definition.placeholder?.(...this[ARGS])))
      })
    }
  }

const componentFactories = new Map()

export function component(name, definition) {
  assertValidComponentName(name)
  const existing = componentFactories.get(name)
  if (existing) {
    console.warn(
      `imp: component '${name}' is already defined — reusing it and ignoring the new definition`,
    )
    return existing
  }
  assertValidDefinition(name, definition)
  if (customElements.get(name)) {
    throw new Error(
      `imp: element name '${name}' is already taken by a custom element defined outside imp`,
    )
  }
  customElements.define(name, createHostClass(definition))
  injectHostStyle(name)
  const factory = (...args) => {
    const host = document.createElement(name)
    host[ARGS] = args
    host.append(...asNodes(definition.placeholder?.(...args)))
    return host
  }
  componentFactories.set(name, factory)
  return factory
}
