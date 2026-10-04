import { analyticsBus } from './analytics-bus.js'
import { zoneNameOf } from './zone.js'
import { impLogger } from './logger.js'

const ERROR_INTERVAL_MS = 5000

const DEFAULT_BATCH_SIZE = 20

const DEFAULT_BATCH_MS = 5000

const USE_EVENTS = ['click', 'input', 'keydown']

const NOT_USE_KEY = /^(?:Tab|Shift|Control|Alt|Meta|CapsLock|Escape|F[1-9]|F1[0-9]|F2[0-4])$/

export const FLUSH = Symbol('imp.analytics.flush')

const sinks = new Set()

let collection = null

let visitId = null

const now = () => globalThis.performance.now()

const randomId = () =>
  Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(8)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')

const RESIZE_OBSERVER_LOOP =
  /ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/

const CROSS_ORIGIN_SCRIPT_ERROR = /^(?:Uncaught )?Script error\.?$/

const isBrowserNoise = (event) => {
  const message = String(event.message ?? '')
  if (RESIZE_OBSERVER_LOOP.test(message)) return true
  return event.error == null && !event.filename && CROSS_ORIGIN_SCRIPT_ERROR.test(message)
}

const callSink = (sink, record) => {
  try {
    const result = sink(record)
    if (result && typeof result.then === 'function') {
      result.then(undefined, (error) => impLogger.error('an analytics sink failed', error))
    }
  } catch (error) {
    impLogger.error('an analytics sink failed', error)
  }
}

const flushSink = (sink) => {
  if (typeof sink[FLUSH] !== 'function') return
  try {
    sink[FLUSH]()
  } catch (error) {
    impLogger.error('an analytics sink failed', error)
  }
}

const dispatch = (record) => {
  for (const sink of [...sinks]) callSink(sink, record)
}

const flushBatches = () => {
  for (const sink of [...sinks]) flushSink(sink)
}

const boxTargets = (parent, targets, containers) => {
  containers.push(parent)
  for (const child of parent.children) {
    if (globalThis.getComputedStyle(child).display !== 'contents') {
      targets.push(child)
      continue
    }
    if (child.shadowRoot) boxTargets(child.shadowRoot, targets, containers)
    boxTargets(child, targets, containers)
  }
}

const isVisible = () => globalThis.document.visibilityState === 'visible'

const createCollection = () => {
  const zones = new Map()
  let current = null
  let lastErrorAt = -Infinity
  let seenZones = new Set()
  let usedZones = new Set()

  const send = (type, fields) => {
    if (current === null || current.page === null) return null
    const record = {
      type,
      visit: visitId,
      at: Date.now(),
      page: current.page,
      ...fields,
    }
    dispatch(record)
    return record
  }

  const sendSeen = (name) => {
    if (seenZones.has(name)) return
    seenZones.add(name)
    send('seen', { zone: name })
  }

  const sendUsed = (name) => {
    if (usedZones.has(name)) return
    usedZones.add(name)
    if (name !== null) sendSeen(name)
    send('used', { zone: name })
  }

  const markSeen = (runtime) => {
    if (runtime.seen || seenZones.has(runtime.name)) return
    if (!runtime.intersecting.size || !isVisible()) return
    runtime.seen = true
    sendSeen(runtime.name)
  }

  const walkZone = (runtime) => {
    runtime.walkQueued = false
    runtime.observer.disconnect()
    runtime.mutations.disconnect()
    runtime.intersecting.clear()
    const targets = []
    const containers = []
    boxTargets(runtime.zone, targets, containers)
    for (const container of containers) runtime.mutations.observe(container, { childList: true })
    for (const target of targets) runtime.observer.observe(target)
  }

  const queueWalk = (runtime) => {
    if (runtime.walkQueued) return
    runtime.walkQueued = true
    queueMicrotask(() => {
      if (zones.get(runtime.zone) === runtime) walkZone(runtime)
    })
  }

  const startZone = (zone) => {
    const name = zoneNameOf(zone)
    if (name === null || zones.has(zone)) return
    const runtime = {
      zone,
      name,
      seen: false,
      intersecting: new Set(),
      walkQueued: false,
      observer: new globalThis.IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) runtime.intersecting.add(entry.target)
          else runtime.intersecting.delete(entry.target)
        }
        markSeen(runtime)
      }),
      mutations: new globalThis.MutationObserver(() => queueWalk(runtime)),
    }
    zones.set(zone, runtime)
    queueWalk(runtime)
  }

  const stopZone = (zone) => {
    const runtime = zones.get(zone)
    if (!runtime) return
    zones.delete(zone)
    runtime.observer.disconnect()
    runtime.mutations.disconnect()
  }

  const onUse = (event) => {
    if (!event.isTrusted) return
    if (event.type === 'keydown' && NOT_USE_KEY.test(event.key)) return
    sendUsed(null)
    for (const node of event.composedPath()) {
      const runtime = zones.get(node)
      if (runtime) sendUsed(runtime.name)
    }
  }

  const onVisibility = () => {
    if (!isVisible()) {
      flushBatches()
      return
    }
    for (const runtime of zones.values()) markSeen(runtime)
  }

  const error = () => {
    const at = now()
    if (at - lastErrorAt < ERROR_INTERVAL_MS) return
    lastErrorAt = at
    send('error')
  }

  const onScriptError = (event) => {
    if (event.error === undefined && !event.message) return
    if (isBrowserNoise(event)) return
    error()
  }

  const windowListeners = [
    ['error', onScriptError],
    ['unhandledrejection', error],
    ['pagehide', flushBatches],
  ]

  const viewStarted = (view) => {
    current = view
    lastErrorAt = -Infinity
    seenZones = new Set()
    usedZones = new Set()
  }

  const viewReady = (view) => {
    if (view !== current) return
    view.record = send('page')
  }

  return {
    start: () => {
      visitId ??= randomId()
      globalThis.document.addEventListener('visibilitychange', onVisibility)
      for (const type of USE_EVENTS) {
        globalThis.document.addEventListener(type, onUse, { capture: true, passive: true })
      }
      for (const [type, listener] of windowListeners) {
        globalThis.addEventListener(type, listener)
      }
      for (const zone of analyticsBus.zones) startZone(zone)
      if (!analyticsBus.view) return
      viewStarted(analyticsBus.view)
      if (current.ready) viewReady(current)
    },
    stop: () => {
      globalThis.document.removeEventListener('visibilitychange', onVisibility)
      for (const type of USE_EVENTS) {
        globalThis.document.removeEventListener(type, onUse, { capture: true })
      }
      for (const [type, listener] of windowListeners) {
        globalThis.removeEventListener(type, listener)
      }
      for (const zone of [...zones.keys()]) stopZone(zone)
      current = null
    },
    viewStarted,
    viewReady,
    viewEnded: (view) => {
      if (current === view) current = null
    },
    currentPageRecord: () => current?.record ?? null,
    zoneConnected: startZone,
    zoneDisconnected: stopZone,
    outcome: (name) => send('outcome', { name }),
    error,
  }
}

const startCollection = () => {
  collection = createCollection()
  analyticsBus.collector = collection
  collection.start()
}

const stopCollection = () => {
  analyticsBus.collector = null
  collection?.stop()
  collection = null
}

const register = (sink) => {
  if (typeof sink !== 'function') {
    throw new Error(
      'imp: onAnalytics(sink) - the sink is a function that receives each record, like onAnalytics((record) => console.log(record))',
    )
  }
  sinks.add(sink)
  if (collection) {
    const record = collection.currentPageRecord()
    if (record) callSink(sink, record)
  } else {
    startCollection()
  }
  let registered = true
  return () => {
    if (!registered) return
    registered = false
    sinks.delete(sink)
    flushSink(sink)
    if (!sinks.size) stopCollection()
  }
}

const rejectExtraArguments = (args, expected) => {
  if (args.length <= expected) return
  throw new Error(
    'imp: onAnalytics(sink) takes a sink only - add the segments of the app inside the sink, and register the sink when the store can receive records',
  )
}

export const onAnalytics = (...args) => {
  const [first] = args
  if (typeof first?.abortSignal?.addEventListener === 'function') {
    rejectExtraArguments(args, 2)
    const unregister = register(args[1])
    first.abortSignal.addEventListener('abort', unregister, { once: true })
    return unregister
  }
  rejectExtraArguments(args, 1)
  return register(first)
}

const readBatchOptions = (options) => {
  const { size = DEFAULT_BATCH_SIZE, ms = DEFAULT_BATCH_MS, segments, ...rest } = options ?? {}
  const unknown = Object.keys(rest)
  if (unknown.length) {
    throw new Error(
      `imp: batch(send, { size, ms, segments }) takes these options - remove ${unknown.join(', ')}`,
    )
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('imp: batch(send, { size }) - size is a whole number of records, like 20')
  }
  if (typeof ms !== 'number' || !(ms > 0)) {
    throw new Error('imp: batch(send, { ms }) - ms is a number of milliseconds, like 5000')
  }
  if (segments !== undefined && typeof segments !== 'function') {
    throw new Error(
      "imp: batch(send, { segments }) - segments is a function that returns the segments of a record, like () => ({ plan: 'pro' })",
    )
  }
  return { size, ms, segments }
}

export const batch = (send, options) => {
  if (typeof send !== 'function') {
    throw new Error(
      "imp: batch(send) - send is a function that receives an array of records, like batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)))",
    )
  }
  const { size, ms, segments } = readBatchOptions(options)
  let held = []
  let timer = null
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (!held.length) return
    const records = held
    held = []
    callSink(send, records)
  }
  const sink = (record) => {
    held.push(segments ? { ...segments(record), ...record } : record)
    if (held.length >= size) {
      flush()
      return
    }
    timer ??= setTimeout(flush, ms)
  }
  sink[FLUSH] = flush
  return sink
}
