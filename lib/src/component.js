import { activateBindings, asNodes, hasPendingBinding } from './nodes.js'
import { impLogger } from './logger.js'

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

const EFFECT_HOOKS = ['loading', 'error', 'onMount', 'onRemove']

export const componentNameProblem = (name) => {
  if (typeof name !== 'string') {
    return `component name must be a dash-separated string like 'my-app-profile'`
  }
  if (!COMPONENT_NAME.test(name)) {
    return `component name '${name}' must be lowercase with at least one dash - like 'my-app-profile'`
  }
  if (RESERVED_NAMES.has(name)) {
    return `component name '${name}' is reserved by the HTML standard - pick another name`
  }
  return null
}

const assertValidComponentName = (name) => {
  const problem = componentNameProblem(name)
  if (problem) throw new Error(`imp: ${problem}`)
}

const assertValidDefinition = (name, definition) => {
  if (!definition || typeof definition !== 'object' || typeof definition.setup !== 'function') {
    throw new Error(
      `imp: component '${name}' needs a definition object with a setup function returning its DOM`,
    )
  }
  for (const hook of EFFECT_HOOKS) {
    if (definition[hook] !== undefined && typeof definition[hook] !== 'function') {
      throw new Error(`imp: component '${name}': '${hook}' must be a function`)
    }
  }
  if (definition.styles !== undefined && typeof definition.styles !== 'string') {
    throw new Error(`imp: component '${name}': 'styles' must be a CSS string`)
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
    impLogger.error(`component '${host.localName}' failed to mount`, error)
  }
}

const ARGS = Symbol('imp.component.args')
const MOUNTED = Symbol('imp.component.mounted')
const GENERATION = Symbol('imp.component.generation')
const SCOPE = Symbol('imp.component.scope')
const ERRORED = Symbol('imp.component.errored')
const SELF = Symbol('imp.component.self')
const ABORT = Symbol('imp.component.abort')
const LOADING_CONTENT = Symbol('imp.component.loadingContent')
const MOUNT = Symbol('imp.component.mount')

let hostsConnectedDuringMount = null

const mountTree = (root) => {
  const pending = [root]
  while (pending.length) {
    const host = pending.pop()
    if (!host.isConnected || host[MOUNTED]) continue
    const connected = []
    hostsConnectedDuringMount = connected
    try {
      host[MOUNT]()
    } finally {
      hostsConnectedDuringMount = null
    }
    for (let index = connected.length - 1; index >= 0; index--) pending.push(connected[index])
  }
}

const loadingBindingWarned = new WeakSet()

const renderLoading = (name, definition, args) => {
  const nodes = asNodes(definition.loading?.(...args))
  if (hasPendingBinding(nodes) && !loadingBindingWarned.has(definition)) {
    loadingBindingWarned.add(definition)
    impLogger.warn(
      `component '${name}': loading content is bound to state, so it renders empty and never updates - loading is built before the component mounts and its bindings are never activated; pass a plain value and move text, view, each and state-bound props into setup`,
    )
  }
  return nodes
}

const createMountScope = (host) => {
  const cleanups = []
  const rebinds = new Set()
  const scope = {
    host,
    ended: false,
    addCleanup: (cleanup) => cleanups.push(cleanup),
    addRebind: (rebind) => rebinds.add(rebind),
    rebind: () => {
      if (rebinds.size) {
        impLogger.debug(`component '${host.localName}' moved - rebinding state subscriptions`)
      }
      for (const rebind of [...rebinds]) {
        if (rebinds.has(rebind)) rebind()
      }
    },
    end: () => {
      scope.ended = true
      for (const cleanup of cleanups.splice(0)) {
        try {
          cleanup()
        } catch (error) {
          impLogger.error(`component '${host.localName}': a cleanup failed`, error)
        }
      }
      rebinds.clear()
    },
  }
  return scope
}

const mounts = new WeakMap()

const createSelf = (host, scope, abortSignal) => {
  const self = { host, abortSignal }
  mounts.set(self, { scope, handles: new Map() })
  return self
}

const requireMount = (self, call, afterwards) => {
  const mount = mounts.get(self)
  if (!mount) {
    throw new Error(
      `imp: ${call} - the first argument must be the self that imp passes to setup, error, onMount and onRemove`,
    )
  }
  if (mount.scope.ended) {
    throw new Error(
      `imp: ${call} runs after <${mount.scope.host.localName}> has left the page, so ${afterwards}`,
    )
  }
  return mount
}

const requireResolvingMount = (self, helper, name) =>
  requireMount(
    self,
    `${helper}(self, '${name}')`,
    `nothing can resolve it - resolve it in setup; in onRemove, ${helper} returns the handle that setup resolved`,
  )

export const resolveThroughSelf = (self, kind, helper, name, resolve) => {
  const key = `${kind}:${name}`
  const cached = mounts.get(self)?.handles.get(key)
  if (cached) return cached
  const mount = requireResolvingMount(self, helper, name)
  const handle = resolve(mount.scope)
  mount.handles.set(key, handle)
  return handle
}

export const claimThroughSelf = (self, kind, helper, name, provide) => {
  const mount = requireResolvingMount(self, helper, name)
  const handle = provide(mount.scope)
  mount.handles.set(`${kind}:${name}`, handle)
  return handle
}

export const cleanupThroughSelf = (self, name, cleanup) => {
  requireMount(
    self,
    `state '${name}': watch(self, fn)`,
    'nothing owns the subscription - call watch in setup, or hold the stop that watch(fn) returns',
  ).scope.addCleanup(cleanup)
}

let sharedHostSheet = null

const hostSheet = () => {
  if (!sharedHostSheet) {
    sharedHostSheet = new CSSStyleSheet()
    sharedHostSheet.replaceSync(':host { display: contents }')
  }
  return sharedHostSheet
}

const compileStyles = (name, styles) => {
  const sheet = new CSSStyleSheet()
  try {
    sheet.replaceSync(styles)
  } catch (error) {
    throw new Error(`imp: component '${name}': styles could not be parsed - ${error.message}`, {
      cause: error,
    })
  }
  return sheet
}

const componentStyleSheets = (name, styles) =>
  styles === undefined ? [hostSheet()] : [hostSheet(), compileStyles(name, styles)]

const createHostClass = (definition, styleSheets) => {
  let loadingNeverSeenWarned = false
  return class extends HTMLElement {
    constructor() {
      super()
      this.attachShadow({ mode: 'open', delegatesFocus: true })
      this.shadowRoot.adoptedStyleSheets = styleSheets
      this[ARGS] = []
      this[MOUNTED] = false
      this[GENERATION] = 0
      this[SCOPE] = null
      this[ERRORED] = false
      this[SELF] = null
      this[ABORT] = null
      this[LOADING_CONTENT] = false
    }

    connectedCallback() {
      if (!this.isConnected) return
      if (this[MOUNTED]) {
        this[SCOPE].rebind()
        return
      }
      if (hostsConnectedDuringMount) {
        hostsConnectedDuringMount.push(this)
        return
      }
      mountTree(this)
    }

    [MOUNT]() {
      this[MOUNTED] = true
      const isRemount = this[GENERATION] > 0
      const generation = ++this[GENERATION]
      this[ABORT]?.abort()
      if (isRemount) {
        try {
          const loadingNodes = renderLoading(this.localName, definition, this[ARGS])
          this[LOADING_CONTENT] = loadingNodes.length > 0
          this.shadowRoot.replaceChildren(...loadingNodes)
        } catch (error) {
          impLogger.error(`component '${this.localName}': loading failed`, error)
          this[LOADING_CONTENT] = false
          this.shadowRoot.replaceChildren()
        }
      }
      const scope = createMountScope(this)
      this[SCOPE] = scope
      const abortController = new AbortController()
      this[ABORT] = abortController
      const self = createSelf(this, scope, abortController.signal)
      this[SELF] = self
      const isCurrent = () => this[GENERATION] === generation && this.isConnected && !this[ERRORED]
      const runOnMount = () => {
        if (!definition.onMount) return
        requestAnimationFrame(() => {
          if (!isCurrent()) return
          try {
            definition.onMount(self, ...this[ARGS])
          } catch (error) {
            reportComponentError(this, error)
          }
        })
      }
      if (definition.error) {
        const renderErrorView = (event) => {
          if (this[ERRORED]) return
          event.stopPropagation()
          event.preventDefault()
          this[ERRORED] = true
          let rendered
          try {
            rendered = definition.error(self, event.detail.error, ...this[ARGS])
          } catch (error) {
            impLogger.error(`component '${this.localName}': error view failed`, error)
            return
          }
          const errorNodes = asNodes(rendered)
          this.shadowRoot.replaceChildren(...errorNodes)
          try {
            activateBindings(scope, errorNodes)
          } catch (error) {
            impLogger.error(`component '${this.localName}': error view failed`, error)
          }
        }
        this.addEventListener(COMPONENT_ERROR_EVENT, renderErrorView)
        scope.addCleanup(() => this.removeEventListener(COMPONENT_ERROR_EVENT, renderErrorView))
      }
      let output
      try {
        output = definition.setup(self, ...this[ARGS])
      } catch (error) {
        reportComponentError(this, error)
        return
      }
      const placeAndActivate = (rendered) => {
        const nodes = asNodes(rendered)
        this.shadowRoot.replaceChildren(...nodes)
        try {
          activateBindings(scope, nodes)
        } catch (error) {
          reportComponentError(this, error)
          return
        }
        impLogger.debug(`component '${this.localName}' mounted`)
        runOnMount()
      }
      if (output && typeof output.then === 'function') {
        output.then(
          (resolved) => {
            if (!isCurrent()) return
            placeAndActivate(resolved)
          },
          (error) => {
            if (this[GENERATION] !== generation || !this.isConnected) {
              impLogger.error(`component '${this.localName}' failed to mount`, error)
              return
            }
            reportComponentError(this, error)
          },
        )
        return
      }
      if (this[LOADING_CONTENT] && !loadingNeverSeenWarned) {
        loadingNeverSeenWarned = true
        impLogger.warn(
          `component '${this.localName}': loading is set but setup returned synchronously, so it is swapped out before paint and never seen - make setup async (or return a promise) to show it while loading, or remove loading`,
        )
      }
      placeAndActivate(output)
    }

    connectedMoveCallback() {
      if (this[MOUNTED]) this[SCOPE].rebind()
    }

    disconnectedCallback() {
      if (this.isConnected || !this[MOUNTED]) return
      const self = this[SELF]
      const scope = this[SCOPE]
      queueMicrotask(async () => {
        if (this.isConnected || !this[MOUNTED]) return
        this[MOUNTED] = false
        const generation = ++this[GENERATION]
        this[SELF] = null
        this[ERRORED] = false
        scope.end()
        try {
          await definition.onRemove?.(self, ...this[ARGS])
        } catch (error) {
          impLogger.error(`component '${this.localName}': onRemove failed`, error)
        }
        if (this[GENERATION] !== generation) return
        this[ABORT]?.abort()
        this[ABORT] = null
        impLogger.debug(`component '${this.localName}' unmounted`)
        this.shadowRoot.replaceChildren()
      })
    }
  }
}

const componentFactories = new Map()

export function component(name, definition) {
  assertValidComponentName(name)
  const existing = componentFactories.get(name)
  if (existing) {
    impLogger.warn(
      `component '${name}' is already defined - reusing it and ignoring the new definition`,
    )
    return existing
  }
  assertValidDefinition(name, definition)
  if (customElements.get(name)) {
    throw new Error(
      `imp: element name '${name}' is already taken by a custom element defined outside imp`,
    )
  }
  customElements.define(
    name,
    createHostClass(definition, componentStyleSheets(name, definition.styles)),
  )
  impLogger.debug(`component '${name}' defined`)
  const factory = (...args) => {
    const host = document.createElement(name)
    host[ARGS] = args
    const loadingNodes = renderLoading(name, definition, args)
    host[LOADING_CONTENT] = loadingNodes.length > 0
    host.shadowRoot.append(...loadingNodes)
    return host
  }
  componentFactories.set(name, factory)
  return factory
}
