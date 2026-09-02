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
  if (!definition || typeof definition !== 'object' || typeof definition.build !== 'function') {
    throw new Error(
      `imp: component '${name}' needs a definition object with a build function returning its DOM`,
    )
  }
  for (const hook of ['placeholder', 'teardown', 'fallback']) {
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
const CLEANUPS = Symbol('imp.component.cleanups')
const REBINDS = Symbol('imp.component.rebinds')
const ERRORED = Symbol('imp.component.errored')
const INSTANCE = Symbol('imp.component.instance')
const ABORT = Symbol('imp.component.abort')
const PLACEHOLDER_CONTENT = Symbol('imp.component.placeholderContent')

const placeholderBindingWarned = new WeakSet()

const renderPlaceholder = (name, definition, args) => {
  const nodes = runInMountScope(null, () => asNodes(definition.placeholder?.(...args)))
  if (hasPendingBinding(nodes) && !placeholderBindingWarned.has(definition)) {
    placeholderBindingWarned.add(definition)
    impLogger.warn(
      `component '${name}': placeholder content is bound to state, so it renders empty and never updates - a placeholder is built before the component mounts and its bindings are never activated; pass a plain value and move text, view, each and state-bound props into build`,
    )
  }
  return nodes
}

const rebindSubscriptions = (host) => {
  if (host[REBINDS].size) {
    impLogger.debug(`component '${host.localName}' moved - rebinding state subscriptions`)
  }
  for (const rebind of [...host[REBINDS]]) {
    if (host[REBINDS].has(rebind)) rebind()
  }
}

const mountScopes = []

export const activeMountScope = () => mountScopes.at(-1) ?? null

const teardownHosts = []

export const activeTeardownHost = () => teardownHosts.at(-1) ?? null

const startTeardown = (host, definition, instance, args) => {
  teardownHosts.push(host)
  try {
    return definition.teardown?.(instance, ...args)
  } finally {
    teardownHosts.pop()
  }
}

export const runInMountScope = (scope, run) => {
  mountScopes.push(scope)
  try {
    return run()
  } finally {
    mountScopes.pop()
  }
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
    throw new Error(`imp: component '${name}': styles could not be parsed - ${error.message}`)
  }
  return sheet
}

const componentStyleSheets = (name, styles) =>
  styles === undefined ? [hostSheet()] : [hostSheet(), compileStyles(name, styles)]

const createHostClass = (definition, styleSheets) => {
  let placeholderNeverSeenWarned = false
  return class extends HTMLElement {
    constructor() {
      super()
      this.attachShadow({ mode: 'open', delegatesFocus: true })
      this.shadowRoot.adoptedStyleSheets = styleSheets
      this[ARGS] = []
      this[MOUNTED] = false
      this[GENERATION] = 0
      this[CLEANUPS] = []
      this[REBINDS] = new Set()
      this[ERRORED] = false
      this[INSTANCE] = null
      this[ABORT] = null
      this[PLACEHOLDER_CONTENT] = false
    }

    connectedCallback() {
      if (!this.isConnected) return
      if (this[MOUNTED]) {
        rebindSubscriptions(this)
        return
      }
      this[MOUNTED] = true
      const isRemount = this[GENERATION] > 0
      const generation = ++this[GENERATION]
      this[ABORT]?.abort()
      if (isRemount) {
        try {
          const placeholderNodes = renderPlaceholder(this.localName, definition, this[ARGS])
          this[PLACEHOLDER_CONTENT] = placeholderNodes.length > 0
          this.shadowRoot.replaceChildren(...placeholderNodes)
        } catch (error) {
          impLogger.error(`component '${this.localName}': placeholder failed`, error)
          this[PLACEHOLDER_CONTENT] = false
          this.shadowRoot.replaceChildren()
        }
      }
      const instance = { host: this, root: this.shadowRoot }
      const abortController = new AbortController()
      this[ABORT] = abortController
      instance.abortSignal = abortController.signal
      this[INSTANCE] = instance
      let afterMountCallback = null
      let afterMountRegistered = false
      const flushAfterMount = () => {
        if (this[GENERATION] !== generation || !this.isConnected || this[ERRORED]) return
        try {
          afterMountCallback()
        } catch (error) {
          reportComponentError(this, error)
        }
      }
      instance.afterMount = (callback) => {
        if (typeof callback !== 'function') {
          throw new Error(`imp: component '${this.localName}': afterMount expects a function`)
        }
        if (afterMountRegistered) {
          throw new Error(
            `imp: component '${this.localName}': afterMount can only be called once - do all your post-mount DOM work in a single callback`,
          )
        }
        afterMountRegistered = true
        afterMountCallback = callback
        requestAnimationFrame(flushAfterMount)
      }
      const scope = {
        host: this,
        addCleanup: (cleanup) => this[CLEANUPS].push(cleanup),
        addRebind: (rebind) => this[REBINDS].add(rebind),
        removeRebind: (rebind) => this[REBINDS].delete(rebind),
      }
      if (definition.fallback) {
        const renderErrorFallback = (event) => {
          if (this[ERRORED]) return
          event.stopPropagation()
          event.preventDefault()
          this[ERRORED] = true
          let rendered
          try {
            rendered = runInMountScope(
              scope,
              () => definition.fallback(event.detail.error, ...this[ARGS]),
            )
          } catch (error) {
            impLogger.error(`component '${this.localName}': fallback failed`, error)
            return
          }
          const fallbackNodes = asNodes(rendered)
          this.shadowRoot.replaceChildren(...fallbackNodes)
          try {
            activateBindings(scope, fallbackNodes)
          } catch (error) {
            impLogger.error(`component '${this.localName}': fallback failed`, error)
          }
        }
        this.addEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        this[CLEANUPS].push(() =>
          this.removeEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        )
      }
      let output
      try {
        output = runInMountScope(scope, () => definition.build(instance, ...this[ARGS]))
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
      }
      if (output && typeof output.then === 'function') {
        output.then(
          (resolved) => {
            if (this[GENERATION] !== generation || !this.isConnected || this[ERRORED]) return
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
      if (this[PLACEHOLDER_CONTENT] && !placeholderNeverSeenWarned) {
        placeholderNeverSeenWarned = true
        impLogger.warn(
          `component '${this.localName}': placeholder is set but build returned synchronously, so it is swapped out before paint and never seen - make build async (or return a promise) to show it while loading, or remove the placeholder`,
        )
      }
      placeAndActivate(output)
    }

    connectedMoveCallback() {
      if (this[MOUNTED]) rebindSubscriptions(this)
    }

    disconnectedCallback() {
      if (this.isConnected || !this[MOUNTED]) return
      const instance = this[INSTANCE]
      queueMicrotask(async () => {
        if (this.isConnected || !this[MOUNTED]) return
        this[MOUNTED] = false
        const generation = ++this[GENERATION]
        this[INSTANCE] = null
        this[ERRORED] = false
        for (const cleanup of this[CLEANUPS].splice(0)) {
          try {
            cleanup()
          } catch (error) {
            impLogger.error(`component '${this.localName}': a cleanup failed`, error)
          }
        }
        this[REBINDS].clear()
        try {
          await startTeardown(this, definition, instance, this[ARGS])
        } catch (error) {
          impLogger.error(`component '${this.localName}': teardown failed`, error)
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
    const placeholderNodes = renderPlaceholder(name, definition, args)
    host[PLACEHOLDER_CONTENT] = placeholderNodes.length > 0
    host.shadowRoot.append(...placeholderNodes)
    return host
  }
  componentFactories.set(name, factory)
  return factory
}
