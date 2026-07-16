import { asNodes } from './nodes.js'
import { activeMountScope, runInMountScope } from './component.js'
import { isPlainObject, isStateShaped } from './render.js'

const STATE_SUBSCRIPTION_EVENT = 'StateSubscription'

const PROVIDER_SUBSCRIBE = Symbol('imp.state.providerSubscribe')

const NAMESPACED_NAME = /^[^\s.]+(\.[^\s.]+)+$/

const MAX_UPDATE_DEPTH = 100

let updateDepth = 0

const createUpdateCycleError = (name) =>
  Object.assign(
    new Error(
      `imp: state '${name}': set was called ${MAX_UPDATE_DEPTH} levels deep inside subscribers — subscribers are setting states in a cycle; make the updates conditional or restructure the states`,
    ),
    { impUpdateCycle: true },
  )

const createNotifier = (name) => {
  const subscribers = new Set()
  const subscribe = (subscriber) => {
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  }
  const notify = (value) => {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(value)
      } catch (error) {
        if (error?.impUpdateCycle) throw error
        console.error(`imp: state '${name}': a subscriber failed reacting to a new value`, error)
      }
    }
  }
  return { subscribe, notify }
}

export const stateNameProblem = (name) => {
  if (typeof name !== 'string') {
    return `state name must be a namespaced string like 'myapp.user'`
  }
  if (!NAMESPACED_NAME.test(name)) {
    return `state name '${name}' must include a namespace — use dot-separated segments like 'myapp.user'`
  }
  return null
}

const assertValidStateName = (name) => {
  const problem = stateNameProblem(name)
  if (problem) throw new Error(`imp: ${problem}`)
}

const ownedScope = (cleanups) => ({
  host: undefined,
  addCleanup: (cleanup) => cleanups.push(cleanup),
  addRebind: () => {},
  removeRebind: () => {},
})

const createRegionScope = (owner, cleanups) => ({
  host: owner?.host,
  addCleanup: (cleanup) => cleanups.push(cleanup),
  addRebind: (rebind) => {
    owner.addRebind(rebind)
    cleanups.push(() => owner.removeRebind(rebind))
  },
  removeRebind: (rebind) => owner.removeRebind(rebind),
})

const createReadable = (name, read, subscribe) => {
  const watch = (subscriber) => {
    const scope = activeMountScope()
    if (!scope) {
      throw new Error(
        `imp: state '${name}': watch/text/view/each and state-bound props need a mounting component — subscribe inside onMount or a view/each render (before any await); get/set work anywhere`,
      )
    }
    subscriber(read())
    const unsubscribe = subscribe(subscriber)
    scope.addCleanup(unsubscribe)
    return unsubscribe
  }

  const text = (select = (current) => current) => {
    const node = document.createTextNode('')
    watch((current) => {
      const next = String(select(current) ?? '')
      if (node.data !== next) node.data = next
    })
    return node
  }

  const liveRegion = (kind, renderCurrent) => {
    const owner = activeMountScope()
    const start = document.createComment(`imp:${kind} ${name}`)
    const end = document.createComment(`/imp:${kind} ${name}`)
    const region = document.createDocumentFragment()
    region.append(start, end)
    const renderCleanups = []
    const disposeLastRender = () => {
      for (const cleanup of renderCleanups.splice(0)) cleanup()
    }
    const renderScope = createRegionScope(owner, renderCleanups)
    watch((current) => {
      disposeLastRender()
      while (start.nextSibling !== end) start.nextSibling.remove()
      end.before(...runInMountScope(renderScope, () => renderCurrent(current)))
    })
    owner.addCleanup(disposeLastRender)
    return region
  }

  const view = (render) => {
    if (typeof render !== 'function') {
      throw new Error(
        `imp: state '${name}': view needs a function rendering the current value into DOM`,
      )
    }
    return liveRegion('view', (current) => asNodes(render(current)))
  }

  const asItems = (current) => {
    if (Array.isArray(current)) return current
    if (current !== null && current !== undefined) {
      console.error(
        `imp: state '${name}': each needs an array value, got ${typeof current} — rendering nothing`,
      )
    }
    return []
  }

  const placeAfter = (previous, node) => {
    if (previous.nextSibling === node) return
    const parent = previous.parentNode
    if (typeof parent.moveBefore === 'function' && node.parentNode === parent) {
      parent.moveBefore(node, previous.nextSibling)
    } else {
      parent.insertBefore(node, previous.nextSibling)
    }
  }

  const keyedRegion = (renderItem, keyOf) => {
    const owner = activeMountScope()
    const start = document.createComment(`imp:each ${name}`)
    const end = document.createComment(`/imp:each ${name}`)
    const region = document.createDocumentFragment()
    region.append(start, end)
    let records = new Map()
    const disposeRecord = (record) => {
      for (const cleanup of record.cleanups.splice(0)) cleanup()
    }
    const discardRecord = (record) => {
      disposeRecord(record)
      for (const node of record.nodes) node.remove()
    }
    const renderRecord = (record, item, index) => {
      const itemScope = createRegionScope(owner, record.cleanups)
      try {
        record.nodes = runInMountScope(itemScope, () => asNodes(renderItem(item, index)))
      } catch (error) {
        if (error?.impUpdateCycle) throw error
        disposeRecord(record)
        record.nodes = []
        console.error(
          `imp: state '${name}': each failed to render an item — skipping it`,
          error,
        )
      }
    }
    watch((current) => {
      const nextRecords = new Map()
      for (const [index, item] of asItems(current).entries()) {
        let key = keyOf(item, index)
        if (nextRecords.has(key)) {
          console.error(
            `imp: state '${name}': each got duplicate key '${
              String(key)
            }' — keys must be unique per item; rendering the duplicate as an independent item`,
          )
          key = Symbol('imp.each.duplicateKey')
        }
        const record = records.get(key)
        if (record) {
          records.delete(key)
          if (!valuesEqual(record.item, item)) {
            discardRecord(record)
            renderRecord(record, item, index)
          }
          record.item = item
          nextRecords.set(key, record)
        } else {
          const created = { item, nodes: [], cleanups: [] }
          renderRecord(created, item, index)
          nextRecords.set(key, created)
        }
      }
      for (const removed of records.values()) discardRecord(removed)
      records = nextRecords
      let previous = start
      for (const record of records.values()) {
        for (const node of record.nodes) {
          placeAfter(previous, node)
          previous = node
        }
      }
    })
    owner.addCleanup(() => {
      for (const record of records.values()) disposeRecord(record)
    })
    return region
  }

  const each = (renderItem, keyOf) => {
    if (typeof renderItem !== 'function') {
      throw new Error(
        `imp: state '${name}': each needs a function rendering an item into DOM`,
      )
    }
    if (keyOf === undefined) {
      return liveRegion(
        'each',
        (current) => asItems(current).flatMap((item, index) => asNodes(renderItem(item, index))),
      )
    }
    if (typeof keyOf !== 'function') {
      throw new Error(
        `imp: state '${name}': each's second argument must be a function returning a stable key for an item — like (item) => item.id`,
      )
    }
    return keyedRegion(renderItem, keyOf)
  }

  return { name, get: read, watch, text, view, each }
}

const createState = (name, initialValue) => {
  let value = initialValue
  const { subscribe, notify } = createNotifier(name)

  const read = () => value

  const set = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (Object.is(resolved, value)) return
    if (updateDepth >= MAX_UPDATE_DEPTH) throw createUpdateCycleError(name)
    value = resolved
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
  let found = null
  const detail = {
    name,
    subscribe: (state, provider) => {
      found = { state, provider }
    },
  }
  origin.dispatchEvent(
    new CustomEvent(STATE_SUBSCRIPTION_EVENT, { detail, bubbles: true, composed: true }),
  )
  return found
}

const findState = (name) => findStateFrom(activeMountScope()?.host ?? document, name)

const valuesEqual = (a, b, comparing = new Set()) => {
  if (Object.is(a, b)) return true
  if (comparing.has(a)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    comparing.add(a)
    const equal = a.length === b.length &&
      a.every((item, index) => valuesEqual(item, b[index], comparing))
    comparing.delete(a)
    return equal
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    comparing.add(a)
    const keys = Object.keys(a)
    const equal = keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && valuesEqual(a[key], b[key], comparing))
    comparing.delete(a)
    return equal
  }
  return false
}

const createConsumer = (name, initialProvider, scope) => {
  let provider = initialProvider
  let lastDelivered = provider.get()
  const { subscribe, notify } = createNotifier(name)

  const deliver = (value) => {
    lastDelivered = value
    notify(value)
  }

  let detachProvider = provider[PROVIDER_SUBSCRIBE](deliver)
  scope.addCleanup(() => detachProvider())

  scope.addRebind(() => {
    const found = findStateFrom(scope.host, name)
    if (!found) {
      console.error(
        `imp: state '${name}' is not provided at the new position of <${scope.host.localName}> — keeping the previous state: get/set still target it, but nothing at this position shares it`,
      )
      return
    }
    if (found.state === provider) return
    detachProvider()
    provider = found.state
    detachProvider = provider[PROVIDER_SUBSCRIBE](deliver)
    const value = provider.get()
    if (!valuesEqual(value, lastDelivered)) deliver(value)
  })

  const read = () => provider.get()

  return {
    ...createReadable(name, read, subscribe),
    set: (next) => provider.set(next),
  }
}

export function initState(name, initialValue) {
  assertValidStateName(name)
  const scope = activeMountScope()
  const providerNode = scope?.host ?? document
  const existing = findState(name)
  if (existing && existing.provider === providerNode) {
    throw new Error(
      `imp: state '${name}' is already initialized in this scope — initState runs once per scope; call useState('${name}') to reach the existing state`,
    )
  }
  const state = createState(name, initialValue)
  const provideState = (event) => {
    if (event.detail?.name !== name) return
    event.stopImmediatePropagation()
    event.detail.subscribe(state, providerNode)
  }
  providerNode.addEventListener(STATE_SUBSCRIPTION_EVENT, provideState)
  scope?.addCleanup(() => {
    providerNode.removeEventListener(STATE_SUBSCRIPTION_EVENT, provideState)
  })
  return state
}

export function useState(name) {
  assertValidStateName(name)
  const found = findState(name)
  if (!found) {
    throw new Error(
      `imp: no state '${name}' is initialized — call initState('${name}', initialValue) in a parent component first`,
    )
  }
  const scope = activeMountScope()
  return scope ? createConsumer(name, found.state, scope) : found.state
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

  const read = () => compute(...states.map((state) => state.get()))

  const { subscribe: addSubscriber, notify } = createNotifier(name)
  const sourceCleanups = []
  let subscriberCount = 0
  let lastResult

  const recomputeAndNotify = () => {
    const result = read()
    if (valuesEqual(result, lastResult)) return
    lastResult = result
    notify(result)
  }

  const attachSources = () => {
    lastResult = read()
    let attaching = true
    runInMountScope(ownedScope(sourceCleanups), () => {
      for (const state of states) {
        state.watch(() => {
          if (!attaching) recomputeAndNotify()
        })
      }
    })
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

  const rejectWrite = () => {
    throw new Error('imp: a computed state is read-only — set its source states instead')
  }

  return { ...createReadable(name, read, subscribe), set: rejectWrite }
}
