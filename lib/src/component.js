import { activateBindings, asNodes } from './nodes.js'
import { createLogger } from './logger.js'

const log = createLogger('imp')

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
    log.error(`component '${host.localName}' failed to mount`, error)
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

const renderPlaceholder = (definition, args) =>
  runInMountScope(null, () => asNodes(definition.placeholder?.(...args)))

const rebindSubscriptions = (host) => {
  if (host[REBINDS].size) {
    log.debug(`component '${host.localName}' moved — rebinding state subscriptions`)
  }
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
    throw new Error(`imp: component '${name}': styles could not be parsed — ${error.message}`)
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
      this.attachShadow({ mode: 'open' })
      this.shadowRoot.adoptedStyleSheets = styleSheets
      this[ARGS] = []
      this[MOUNTED] = false
      this[GENERATION] = 0
      this[CLEANUPS] = []
      this[REBINDS] = new Set()
      this[ERRORED] = false
      this[INSTANCE] = null
      this[ABORT] = null
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
          this.shadowRoot.replaceChildren(...renderPlaceholder(definition, this[ARGS]))
        } catch (error) {
          log.error(`component '${this.localName}': placeholder failed`, error)
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
            `imp: component '${this.localName}': afterMount can only be called once — do all your post-mount DOM work in a single callback`,
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
            log.error(`component '${this.localName}': onError failed`, error)
            return
          }
          const fallbackNodes = asNodes(fallback)
          this.shadowRoot.replaceChildren(...fallbackNodes)
          try {
            activateBindings(scope, fallbackNodes)
          } catch (error) {
            log.error(`component '${this.localName}': onError failed`, error)
          }
        }
        this.addEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        this[CLEANUPS].push(() =>
          this.removeEventListener(COMPONENT_ERROR_EVENT, renderErrorFallback)
        )
      }
      let output
      try {
        output = runInMountScope(scope, () => definition.onMount(instance, ...this[ARGS]))
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
        log.debug(`component '${this.localName}' mounted`)
      }
      if (output && typeof output.then === 'function') {
        output.then(
          (resolved) => {
            if (this[GENERATION] !== generation || !this.isConnected || this[ERRORED]) return
            placeAndActivate(resolved)
          },
          (error) => {
            if (this[GENERATION] !== generation || !this.isConnected) {
              log.error(`component '${this.localName}' failed to mount`, error)
              return
            }
            reportComponentError(this, error)
          },
        )
        return
      }
      if (definition.placeholder && !placeholderNeverSeenWarned) {
        placeholderNeverSeenWarned = true
        log.warn(
          `component '${this.localName}': placeholder is set but onMount returned synchronously, so it is swapped out before paint and never seen — make onMount async (or return a promise) to show it while loading, or remove the placeholder`,
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
            log.error(`component '${this.localName}': a cleanup failed`, error)
          }
        }
        this[REBINDS].clear()
        try {
          await definition.onUnmount?.(instance, ...this[ARGS])
        } catch (error) {
          log.error(`component '${this.localName}': onUnmount failed`, error)
        }
        if (this[GENERATION] !== generation) return
        this[ABORT]?.abort()
        this[ABORT] = null
        log.debug(`component '${this.localName}' unmounted`)
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
    log.warn(
      `component '${name}' is already defined — reusing it and ignoring the new definition`,
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
  log.debug(`component '${name}' defined`)
  const factory = (...args) => {
    const host = document.createElement(name)
    host[ARGS] = args
    host.shadowRoot.append(...renderPlaceholder(definition, args))
    return host
  }
  componentFactories.set(name, factory)
  return factory
}
