import { activateBindings, asNodes, registerBinding } from './nodes.js'
import { claimThroughSelf, cleanupThroughSelf, resolveThroughSelf } from './component.js'
import { isPlainObject, isStateShaped } from './render.js'
import {
  collectProvided,
  findProvided,
  namespacedNameProblem,
  providedOn,
  provideOnHost,
} from './provide.js'
import { impLogger } from './logger.js'
import { reportError } from './analytics-bus.js'
import { bindCreator, reportLostStyles, shadowOwnerOf } from './styles-boundary.js'

const STATE_KIND = 'state'

const PROVIDER_SUBSCRIBE = Symbol('imp.state.providerSubscribe')

const MAX_UPDATE_DEPTH = 100

let updateDepth = 0

const createUpdateCycleError = (name) =>
  Object.assign(
    new Error(
      `imp: state '${name}': set was called ${MAX_UPDATE_DEPTH} levels deep inside subscribers - subscribers are setting states in a cycle; make the updates conditional or restructure the states`,
    ),
    { impUpdateCycle: true },
  )

const createNotifier = (name) => {
  const subscribers = new Set()
  let version = 0
  const subscribe = (subscriber) => {
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  }
  const notify = (value) => {
    const notifying = ++version
    impLogger.debug(`state '${name}': notifying ${subscribers.size} subscriber(s)`)
    for (const subscriber of [...subscribers]) {
      if (notifying !== version) {
        impLogger.debug(
          `state '${name}': a subscriber set a newer value - the rest already saw it, skipping the stale one`,
        )
        return
      }
      if (!subscribers.has(subscriber)) continue
      try {
        subscriber(value)
      } catch (error) {
        if (error?.impUpdateCycle) throw error
        impLogger.error(`state '${name}': a subscriber failed reacting to a new value`, error)
        reportError()
      }
    }
  }
  return { subscribe, notify }
}

export const stateNameProblem = (name) => namespacedNameProblem(name, 'state name', 'myapp.user')

const assertValidStateName = (name) => {
  const problem = stateNameProblem(name)
  if (problem) throw new Error(`imp: ${problem}`)
}

const TEMPORAL_TYPE_NAMES = [
  'Instant',
  'ZonedDateTime',
  'PlainDate',
  'PlainTime',
  'PlainDateTime',
  'PlainYearMonth',
  'PlainMonthDay',
  'Duration',
]

const isTemporalValue = (value) =>
  TEMPORAL_TYPE_NAMES.some((typeName) => {
    const temporalType = globalThis.Temporal?.[typeName]
    return temporalType !== undefined && value instanceof temporalType
  })

const isValueObject = (value) =>
  value instanceof Date || value instanceof URL || value instanceof URLSearchParams ||
  value instanceof RegExp || isTemporalValue(value)

const valueObjectsEqual = (a, b) => {
  if (a instanceof Date) return b instanceof Date && Object.is(a.getTime(), b.getTime())
  if (a instanceof URL) return b instanceof URL && a.href === b.href
  if (a instanceof URLSearchParams) {
    return b instanceof URLSearchParams && a.toString() === b.toString()
  }
  if (a instanceof RegExp) {
    return b instanceof RegExp && a.source === b.source && a.flags === b.flags
  }
  if (!isTemporalValue(b) || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  return typeof a.equals === 'function' ? a.equals(b) : a.toString() === b.toString()
}

const describeNonPlainValue = (value) => {
  if (typeof value === 'function') return 'is a function'
  if (typeof value === 'symbol') return 'is a symbol'
  if (isStateShaped(value)) return 'is another state - store its current value (get()) instead'
  const kind = value?.constructor?.name
  return kind ? `is a ${kind}` : 'is a non-plain object'
}

const cycleProblem = (path, validate) =>
  validate
    ? { problem: { path, problem: 'references itself in a cycle' }, equal: false }
    : { problem: null, equal: false }

const inspectValue = (next, prev, validate, path, active) => {
  if (Object.is(next, prev)) return { problem: null, equal: true }
  if (next === null || next === undefined) return { problem: null, equal: false }
  const type = typeof next
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return { problem: null, equal: false }
  }
  if (isValueObject(next)) return { problem: null, equal: valueObjectsEqual(next, prev) }
  if (Array.isArray(next)) {
    if (active.has(next)) return cycleProblem(path, validate)
    active.add(next)
    let equal = Array.isArray(prev) && next.length === prev.length
    for (const [index, item] of next.entries()) {
      const result = inspectValue(
        item,
        Array.isArray(prev) ? prev[index] : undefined,
        validate,
        `${path}[${index}]`,
        active,
      )
      if (result.problem) {
        active.delete(next)
        return result
      }
      if (!result.equal) equal = false
    }
    active.delete(next)
    return { problem: null, equal }
  }
  if (isPlainObject(next) && !isStateShaped(next)) {
    if (active.has(next)) return cycleProblem(path, validate)
    active.add(next)
    const prevIsObject = isPlainObject(prev)
    const keys = Object.keys(next)
    let equal = prevIsObject && keys.length === Object.keys(prev).length
    for (const key of keys) {
      const result = inspectValue(
        next[key],
        prevIsObject ? prev[key] : undefined,
        validate,
        path ? `${path}.${key}` : key,
        active,
      )
      if (result.problem) {
        active.delete(next)
        return result
      }
      if (equal && !(prevIsObject && Object.hasOwn(prev, key) && result.equal)) equal = false
    }
    active.delete(next)
    return { problem: null, equal }
  }
  return validate
    ? { problem: { path, problem: describeNonPlainValue(next) }, equal: false }
    : { problem: null, equal: false }
}

export const valuesEqual = (a, b) => inspectValue(a, b, false, '', new Set()).equal

const reportValueProblem = (name, { path, problem }) => {
  const location = path ? ` at '${path}'` : ''
  impLogger.error(
    `state '${name}': the value${location} ${problem} - state values must be plain data without cycles: plain objects, arrays, dates (Date or Temporal), URLs, URLSearchParams, regexes, and primitives like strings, numbers, and booleans`,
  )
}

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
  } else if (isPlainObject(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key])
  }
  return value
}

const createRegionScope = (cleanups) => ({
  addCleanup: (cleanup) => cleanups.push(cleanup),
})

const createReadable = (name, read, subscribe) => {
  const watch = (selfOrSubscriber, ownedSubscriber) => {
    if (typeof selfOrSubscriber !== 'function') {
      if (typeof ownedSubscriber !== 'function') {
        throw new Error(
          `imp: state '${name}': watch takes a subscriber function, or self and a subscriber - watch(self, fn) stops when the component unmounts, watch(fn) returns the stop for you to call`,
        )
      }
      const owner = selfOrSubscriber
      const stop = watch((value) => {
        if (owner?.host?.isConnected === false) return
        ownedSubscriber(value)
      })
      try {
        cleanupThroughSelf(selfOrSubscriber, name, stop)
      } catch (error) {
        stop()
        throw error
      }
      return stop
    }
    const subscriber = selfOrSubscriber
    const unsubscribe = subscribe(subscriber)
    impLogger.debug(`state '${name}': watch attached`)
    let detached = false
    const detach = () => {
      if (!detached) {
        detached = true
        impLogger.debug(`state '${name}': watch detached`)
      }
      unsubscribe()
    }
    try {
      subscriber(read())
    } catch (error) {
      detach()
      throw error
    }
    return detach
  }

  const attach = (scope, subscriber) => {
    const detach = watch(subscriber)
    scope.addCleanup(detach)
    return detach
  }

  const text = (select = (current) => current) => {
    const node = document.createTextNode('')
    registerBinding(node, (scope) =>
      attach(scope, (current) => {
        const next = String(select(current) ?? '')
        if (node.data !== next) node.data = next
      }))
    return node
  }

  const liveRegion = (kind, renderCurrent) => {
    const start = document.createComment(`imp:${kind} ${name}`)
    const end = document.createComment(`/imp:${kind} ${name}`)
    const region = document.createDocumentFragment()
    region.append(start, end)
    registerBinding(start, (owner) => {
      const renderCleanups = []
      const disposeLastRender = () => {
        for (const cleanup of renderCleanups.splice(0)) cleanup()
      }
      const renderScope = createRegionScope(renderCleanups)
      const stop = attach(owner, (current) => {
        disposeLastRender()
        if (!start.parentNode) {
          stop()
          return
        }
        while (start.nextSibling !== end) start.nextSibling.remove()
        const rendered = renderCurrent(current)
        end.before(...rendered)
        if (globalThis.__IMP_DEV__ === true) reportLostStyles(shadowOwnerOf(start), rendered)
        activateBindings(renderScope, rendered)
      })
      owner.addCleanup(disposeLastRender)
    })
    return region
  }

  const view = (render) => {
    if (typeof render !== 'function') {
      throw new Error(
        `imp: state '${name}': view needs a function rendering the current value into DOM`,
      )
    }
    const renderValue = globalThis.__IMP_DEV__ === true ? bindCreator(render) : render
    return liveRegion('view', (current) => asNodes(renderValue(current)))
  }

  const asItems = (current) => {
    if (Array.isArray(current)) return current
    if (current !== null && current !== undefined) {
      impLogger.error(
        `state '${name}': each needs an array value, got ${typeof current} - rendering nothing`,
      )
    }
    return []
  }

  const placeAfter = (previous, node) => {
    if (previous.nextSibling === node) return
    const parent = previous.parentNode
    if (node.parentNode === parent) parent.moveBefore(node, previous.nextSibling)
    else parent.insertBefore(node, previous.nextSibling)
  }

  const deepActiveElement = () => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return active
  }

  const stepsFrom = (element, top) => {
    const path = []
    for (let at = element; at !== top;) {
      const parent = at.parentNode
      const shadow = parent instanceof ShadowRoot
      path.unshift({
        shadow,
        name: at.localName,
        cls: at.className,
        nth: [...parent.children].indexOf(at),
      })
      at = shadow ? parent.host : parent
    }
    return path
  }

  const focusSpotIn = (records, recordOfNode, root) => {
    const element = deepActiveElement()
    let node = element
    while (node && node.getRootNode() !== root) node = node.getRootNode().host
    if (!node) return null
    let top = node
    while (top && !recordOfNode.has(top)) top = top.parentNode
    if (!top) return null
    const record = recordOfNode.get(top)
    return {
      record,
      position: [...records.values()].indexOf(record),
      element,
      at: record.nodes.indexOf(top),
      path: stepsFrom(element, top),
    }
  }

  const alike = (child, { name, cls }) => child.localName === name && child.className === cls

  const stepInto = (scope, step) => {
    const children = [...(scope?.children ?? [])]
    const atIndex = children[step.nth]
    if (atIndex && alike(atIndex, step)) return atIndex
    return children.find((child) => alike(child, step)) ??
      (atIndex?.localName === step.name ? atIndex : null)
  }

  const followSteps = (start, path) => {
    let node = start
    for (const step of path) {
      const next = stepInto(step.shadow ? node.shadowRoot : node, step)
      if (!next) return node
      node = next
    }
    return node
  }

  const refocus = ({ record, position, element, at, path }, records) => {
    if (element.isConnected) return
    const ordered = [...records.values()]
    const target = ordered.includes(record)
      ? record
      : ordered[Math.min(position, ordered.length - 1)]
    const node = target?.nodes[at] ? followSteps(target.nodes[at], path) : null
    node?.focus?.({ preventScroll: true })
  }

  const longestIncreasingRun = (values) => {
    const tails = []
    const previous = new Array(values.length)
    for (const [index, value] of values.entries()) {
      let low = 0
      let high = tails.length
      while (low < high) {
        const middle = (low + high) >> 1
        if (values[tails[middle]] < value) low = middle + 1
        else high = middle
      }
      previous[index] = low > 0 ? tails[low - 1] : -1
      tails[low] = index
    }
    const run = []
    for (let at = tails.at(-1) ?? -1; at >= 0; at = previous[at]) run.push(at)
    return run
  }

  const recordsInPlace = (ordered, fresh) => {
    const candidates = []
    const positions = []
    for (const [index, record] of ordered.entries()) {
      if (fresh.has(record) || !record.nodes.length) continue
      candidates.push(index)
      positions.push(record.position)
    }
    return new Set(longestIncreasingRun(positions).map((at) => candidates[at]))
  }

  const keyedRegion = (renderItem, keyOf) => {
    const start = document.createComment(`imp:each ${name}`)
    const end = document.createComment(`/imp:each ${name}`)
    const region = document.createDocumentFragment()
    region.append(start, end)
    registerBinding(start, (owner) => {
      let records = new Map()
      const recordOfNode = new WeakMap()
      const disposeRecord = (record) => {
        for (const cleanup of record.cleanups.splice(0)) cleanup()
      }
      const discardRecord = (record) => {
        disposeRecord(record)
        for (const node of record.nodes) {
          recordOfNode.delete(node)
          node.remove()
        }
      }
      const skipRecord = (record, error) => {
        discardRecord(record)
        record.nodes = []
        record.pendingScope = null
        impLogger.error(`state '${name}': each failed to render an item - skipping it`, error)
      }
      const renderRecord = (record, item, index) => {
        const itemScope = createRegionScope(record.cleanups)
        try {
          record.nodes = asNodes(renderItem(item, index))
        } catch (error) {
          if (error?.impUpdateCycle) throw error
          skipRecord(record, error)
          return
        }
        for (const node of record.nodes) recordOfNode.set(node, record)
        record.pendingScope = itemScope
      }
      const activateRecord = (record) => {
        const itemScope = record.pendingScope
        if (!itemScope) return
        record.pendingScope = null
        try {
          activateBindings(itemScope, record.nodes)
        } catch (error) {
          if (error?.impUpdateCycle) throw error
          skipRecord(record, error)
        }
      }
      const stop = attach(owner, (current) => {
        if (!start.parentNode) {
          for (const record of records.values()) disposeRecord(record)
          records.clear()
          stop()
          return
        }
        const focusSpot = focusSpotIn(records, recordOfNode, start.getRootNode())
        const nextRecords = new Map()
        const fresh = new Set()
        let position = 0
        for (const record of records.values()) record.position = position++
        const keyed = []
        for (const [index, item] of asItems(current).entries()) {
          let key
          try {
            key = keyOf(item, index)
          } catch (error) {
            if (error?.impUpdateCycle) throw error
            impLogger.error(
              `state '${name}': each could not compute the key of item ${index} - skipping it`,
              error,
            )
            continue
          }
          keyed.push({ key, item, index })
        }
        for (let { key, item, index } of keyed) {
          if (nextRecords.has(key)) {
            impLogger.error(
              `state '${name}': each got duplicate key '${
                String(key)
              }' - keys must be unique per item; rendering the duplicate as an independent item`,
            )
            key = Symbol('imp.each.duplicateKey')
          }
          const record = records.get(key)
          if (record) {
            records.delete(key)
            if (!valuesEqual(record.item, item)) {
              discardRecord(record)
              renderRecord(record, item, index)
              fresh.add(record)
            }
            record.item = item
            nextRecords.set(key, record)
          } else {
            const created = { item, nodes: [], cleanups: [], pendingScope: null, position: -1 }
            renderRecord(created, item, index)
            fresh.add(created)
            nextRecords.set(key, created)
          }
        }
        for (const removed of records.values()) discardRecord(removed)
        records = nextRecords
        const ordered = [...records.values()]
        const inPlace = recordsInPlace(ordered, fresh)
        let previous = start
        for (const [index, record] of ordered.entries()) {
          if (inPlace.has(index)) {
            previous = record.nodes.at(-1)
            continue
          }
          for (const node of record.nodes) {
            placeAfter(previous, node)
            previous = node
          }
        }
        for (const record of ordered) activateRecord(record)
        if (focusSpot) refocus(focusSpot, records)
        if (globalThis.__IMP_DEV__ === true) {
          for (const record of fresh) reportLostStyles(shadowOwnerOf(start), record.nodes)
        }
      })
      owner.addCleanup(() => {
        for (const record of records.values()) disposeRecord(record)
      })
    })
    return region
  }

  const each = (render, keyOf) => {
    if (typeof render !== 'function') {
      throw new Error(
        `imp: state '${name}': each needs a function rendering an item into DOM`,
      )
    }
    const renderItem = globalThis.__IMP_DEV__ === true ? bindCreator(render) : render
    if (keyOf === undefined) {
      return liveRegion(
        'each',
        (current) => asItems(current).flatMap((item, index) => asNodes(renderItem(item, index))),
      )
    }
    if (typeof keyOf !== 'function') {
      throw new Error(
        `imp: state '${name}': each's second argument must be a function returning a stable key for an item - like (item) => item.id`,
      )
    }
    return keyedRegion(renderItem, keyOf)
  }

  return { name, get: read, watch, text, view, each }
}

export const readableState = (name, resolve, get = () => resolve().get()) => ({
  name,
  get,
  watch: (...args) => resolve().watch(...args),
  text: (select) => resolve().text(select),
  view: (render) => resolve().view(render),
  each: (renderItem, keyOf) => resolve().each(renderItem, keyOf),
})

export const createState = (name, initialValue) => {
  const { problem: initialProblem } = inspectValue(initialValue, undefined, true, '', new Set())
  if (initialProblem) reportValueProblem(name, initialProblem)
  let value = deepFreeze(initialValue)
  const { subscribe, notify } = createNotifier(name)

  const read = () => {
    impLogger.debug(`state '${name}' read`, value)
    return value
  }

  const set = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (Object.is(resolved, value)) {
      impLogger.debug(`state '${name}' set skipped - the value is unchanged`)
      return
    }
    const { problem, equal } = inspectValue(resolved, value, true, '', new Set())
    if (problem) reportValueProblem(name, problem)
    if (equal) {
      impLogger.debug(`state '${name}' set skipped - the new value is structurally equal`)
      return
    }
    if (updateDepth >= MAX_UPDATE_DEPTH) throw createUpdateCycleError(name)
    value = deepFreeze(resolved)
    impLogger.debug(`state '${name}' set`, value)
    updateDepth++
    try {
      notify(value)
    } finally {
      updateDepth--
    }
  }

  return { ...createReadable(name, read, subscribe), set, [PROVIDER_SUBSCRIBE]: subscribe }
}

const findStateFrom = (origin, name) => {
  const found = findProvided(STATE_KIND, name, origin)
  return found && { state: found.value, provider: found.provider }
}

export const collectStatesFrom = (origin) =>
  collectProvided(STATE_KIND, origin).map(({ name, value }) => ({ name, value: value.get() }))

export const statesProvidedBy = (host) =>
  providedOn(STATE_KIND, host).map(({ name, value }) => ({ name, state: value }))

export const createFollowingState = (name, initialProvider, resolveProvider, scope) => {
  let provider = initialProvider
  const { subscribe, notify } = createNotifier(name)

  let detachProvider = provider[PROVIDER_SUBSCRIBE](notify)
  scope.addCleanup(() => detachProvider())

  scope.addRebind(() => {
    const next = resolveProvider()
    if (!next || next === provider) return
    impLogger.debug(
      `state '${name}': <${scope.host.localName}> moved - rebinding to the provider here`,
    )
    const previousValue = provider.get()
    detachProvider()
    provider = next
    detachProvider = provider[PROVIDER_SUBSCRIBE](notify)
    const value = provider.get()
    if (!valuesEqual(value, previousValue)) notify(value)
  })

  return {
    ...createReadable(name, () => provider.get(), subscribe),
    current: () => provider,
  }
}

const createConsumer = (name, initialProvider, scope) => {
  const resolveProvider = () => {
    const found = findStateFrom(scope.host, name)
    if (found) return found.state
    impLogger.error(
      `state '${name}' is not provided at the new position of <${scope.host.localName}> - keeping the previous state: get/set still target it, but nothing at this position shares it`,
    )
    return null
  }
  const { current, ...readable } = createFollowingState(
    name,
    initialProvider,
    resolveProvider,
    scope,
  )
  return { ...readable, set: (next) => current().set(next) }
}

const provideState = (scope, name, initialValue) => {
  const providerNode = scope.host
  const existing = findStateFrom(providerNode, name)
  if (existing && existing.provider === providerNode) {
    throw new Error(
      `imp: state '${name}' is already initialized in this scope - initState runs once per scope; call useState(self, '${name}') to reach the existing state`,
    )
  }
  const state = createState(name, initialValue)
  impLogger.debug(`state '${name}' initialized in <${providerNode.localName}>`, initialValue)
  provideOnHost(STATE_KIND, name, state, providerNode, scope)
  return state
}

const consumeState = (scope, name) => {
  const found = findStateFrom(scope.host, name)
  if (!found) {
    throw new Error(
      `imp: no state '${name}' is initialized in the ancestors of <${scope.host.localName}> - call initState(self, '${name}', initialValue) in the setup of an ancestor component first`,
    )
  }
  impLogger.debug(`state '${name}' resolved from <${found.provider.localName}>`)
  return createConsumer(name, found.state, scope)
}

export function initState(self, name, initialValue) {
  return claimThroughSelf(self, STATE_KIND, 'initState', name, (scope) => {
    assertValidStateName(name)
    return provideState(scope, name, initialValue)
  })
}

export function useState(self, name) {
  return resolveThroughSelf(self, STATE_KIND, 'useState', name, (scope) => {
    assertValidStateName(name)
    return consumeState(scope, name)
  })
}

export function computed(states, compute) {
  if (!Array.isArray(states) || states.length === 0 || !states.every(isStateShaped)) {
    throw new Error(
      'imp: computed needs a non-empty array of states (from initState, useState, or computed)',
    )
  }
  if (typeof compute !== 'function') {
    throw new Error('imp: computed needs a function computing one result from the state values')
  }

  const name = `computed(${states.map((state) => state.name).join('+')})`

  const { subscribe: addSubscriber, notify } = createNotifier(name)
  const sourceCleanups = []
  let subscriberCount = 0
  let lastResult

  const computeResult = () => deepFreeze(compute(...states.map((state) => state.get())))

  const read = () => {
    const result = subscriberCount > 0 ? lastResult : computeResult()
    impLogger.debug(`state '${name}' read`, result)
    return result
  }

  const recomputeAndNotify = () => {
    const result = computeResult()
    if (valuesEqual(result, lastResult)) {
      impLogger.debug(`state '${name}' recomputed - the result is unchanged`)
      return
    }
    lastResult = result
    impLogger.debug(`state '${name}' recomputed`, result)
    notify(result)
  }

  const attachSources = () => {
    lastResult = computeResult()
    let attaching = true
    for (const state of states) {
      sourceCleanups.push(state.watch(() => {
        if (!attaching) recomputeAndNotify()
      }))
    }
    attaching = false
  }

  const detachSources = () => {
    for (const cleanup of sourceCleanups.splice(0)) cleanup()
  }

  const subscribe = (subscriber) => {
    if (subscriberCount === 0) attachSources()
    subscriberCount++
    const removeSubscriber = addSubscriber(subscriber)
    let removed = false
    return () => {
      if (removed) return
      removed = true
      removeSubscriber()
      subscriberCount--
      if (subscriberCount === 0) detachSources()
    }
  }

  return createReadable(name, read, subscribe)
}
