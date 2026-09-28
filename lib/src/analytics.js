import { analyticsBus } from './analytics-bus.js'
import { zoneNameOf } from './zone.js'
import { impLogger } from './logger.js'
import { isStateShaped } from './render.js'

const ACTIVE_WINDOW_MS = 5000

const MESSAGE_LIMIT = 200

const HOLD_LIMIT = 200

const DEFAULT_BATCH_SIZE = 20

const DEFAULT_BATCH_MS = 5000

const NO_INTERACTION_KEYS = new Set([
  'Tab',
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock',
  'Fn',
  'FnLock',
  'NumLock',
  'ScrollLock',
  'Hyper',
  'Super',
  'Symbol',
  'SymbolLock',
])

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'input', 'wheel']

const FLUSH = Symbol('imp.analytics.flush')

const registrations = new Set()

let collection = null

let visitId = null

const now = () => globalThis.performance.now()

const randomId = () =>
  Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(8)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')

const firstLine = (text) => {
  const line = String(text).split('\n')[0].trim()
  return line.length > MESSAGE_LIMIT ? line.slice(0, MESSAGE_LIMIT) : line
}

const requestPath = (url) => {
  try {
    return new URL(url, globalThis.location.href).pathname
  } catch {
    return String(url).split(/[?#]/)[0]
  }
}

const requestMessage = ({ status, code, method, url }) =>
  firstLine(
    `request failed: ${code === 'status' ? status : code} ${method ?? 'GET'} ${requestPath(url)}`,
  )

const ABSOLUTE_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/?#]+([^\s?#]*)[^\s]*/gi

const RELATIVE_URL_QUERY = /(\/[^\s?#]*)[?#][^\s]*/g

const withoutUrlDetails = (text) =>
  String(text)
    .replace(ABSOLUTE_URL, (_url, path) => path || '/')
    .replace(RELATIVE_URL_QUERY, (_url, path) => path)

const isRequestError = (error) =>
  error instanceof Error && typeof error.code === 'string' && typeof error.url === 'string'

const errorMessage = (error) => {
  if (isRequestError(error)) return requestMessage(error)
  if (error instanceof Error) {
    return firstLine(
      withoutUrlDetails(error.message ? `${error.name}: ${error.message}` : error.name),
    )
  }
  try {
    return firstLine(withoutUrlDetails(
      typeof error === 'object' && error !== null ? JSON.stringify(error) : error,
    ))
  } catch {
    return firstLine(withoutUrlDetails(error))
  }
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

const hold = (registration, record) => {
  const { held } = registration
  held.push(record)
  if (held.length <= HOLD_LIMIT) return
  held.splice(held.findIndex((kept) => kept.type === 'view') === 0 ? 1 : 0, 1)
}

const deliver = (registration, record) => {
  if (registration.open) callSink(registration.sink, record)
  else hold(registration, record)
}

const dispatch = (record) => {
  for (const registration of [...registrations]) deliver(registration, record)
}

const flushBatches = () => {
  for (const registration of [...registrations]) flushSink(registration.sink)
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

const isEngaged = () => isVisible() && globalThis.document.hasFocus()

const createCollection = () => {
  const zones = new Map()
  let stats = new Map()
  let current = null
  let engagedMs = 0
  let engagedSince = null
  const reportedRequests = new WeakSet()

  const alreadyReported = (error) => typeof error === 'object' && reportedRequests.has(error)

  const send = (type, fields, view = current) =>
    dispatch({ type, visit: visitId, view: view?.id ?? null, page: view?.page ?? null, ...fields })

  const sendView = (view) => {
    if (view.sent) return
    view.sent = true
    send('view', {
      from: view.from,
      readyMs: view.readyMs ?? null,
      ...(view.page === null ? { path: view.path } : {}),
    }, view)
  }

  const updateEngaged = () => {
    const at = now()
    if (engagedSince !== null) engagedMs += at - engagedSince
    engagedSince = isEngaged() ? at : null
  }

  const statOf = (name) => {
    let stat = stats.get(name)
    if (!stat) {
      stat = { seen: false, activeMs: 0, windowStart: null, windowEnd: null }
      stats.set(name, stat)
    }
    return stat
  }

  const closeWindow = (stat, until) => {
    if (stat.windowStart === null) return
    stat.activeMs += Math.max(0, Math.min(stat.windowEnd, until) - stat.windowStart)
    stat.windowStart = null
    stat.windowEnd = null
  }

  const interact = (name) => {
    const at = now()
    const stat = statOf(name)
    if (stat.windowEnd !== null && at <= stat.windowEnd) {
      stat.windowEnd = at + ACTIVE_WINDOW_MS
      return
    }
    closeWindow(stat, at)
    stat.windowStart = at
    stat.windowEnd = at + ACTIVE_WINDOW_MS
  }

  const markSeen = () => {
    if (!isVisible()) return
    for (const runtime of zones.values()) {
      if (runtime.intersecting.size) statOf(runtime.name).seen = true
    }
  }

  const flushView = (view) => {
    updateEngaged()
    if (engagedMs > 0 && view) send('time', { ms: Math.round(engagedMs) }, view)
    engagedMs = 0
    const at = now()
    const ended = stats
    stats = new Map()
    for (const [name, stat] of ended) {
      closeWindow(stat, at)
      if (!stat.seen && stat.activeMs <= 0) continue
      send('zone', { name, seen: stat.seen, activeMs: Math.round(stat.activeMs) }, view)
    }
    markSeen()
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
      intersecting: new Set(),
      walkQueued: false,
      observer: new globalThis.IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) runtime.intersecting.add(entry.target)
          else runtime.intersecting.delete(entry.target)
        }
        if (runtime.intersecting.size && isVisible()) statOf(name).seen = true
      }),
      mutations: new globalThis.MutationObserver(() => queueWalk(runtime)),
      onInteraction: (event) => {
        if (event.type === 'keydown' && NO_INTERACTION_KEYS.has(event.key)) return
        interact(name)
      },
    }
    for (const type of INTERACTION_EVENTS) {
      zone.addEventListener(type, runtime.onInteraction, { capture: true, passive: true })
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
    for (const type of INTERACTION_EVENTS) {
      zone.removeEventListener(type, runtime.onInteraction, { capture: true })
    }
  }

  const onVisibility = () => {
    updateEngaged()
    if (isVisible()) {
      markSeen()
      return
    }
    flushView(current)
    flushBatches()
  }

  const sendError = (source, error) => {
    if (alreadyReported(error)) return
    send('error', { source, message: errorMessage(error) })
  }

  const onScriptError = (event) => {
    if (event.error === undefined && !event.message) return
    sendError('script', event.error ?? event.message)
  }

  const onRejection = (event) => sendError('script', event.reason)

  const windowListeners = [
    ['focus', updateEngaged],
    ['blur', updateEngaged],
    ['error', onScriptError],
    ['unhandledrejection', onRejection],
  ]

  const viewStarted = (view) => {
    view.id = randomId()
    view.sent = false
    current = view
    engagedMs = 0
    updateEngaged()
    if (view.readyMs !== undefined) sendView(view)
  }

  return {
    start: () => {
      visitId ??= randomId()
      globalThis.document.addEventListener('visibilitychange', onVisibility)
      for (const [type, listener] of windowListeners) {
        globalThis.addEventListener(type, listener)
      }
      updateEngaged()
      for (const zone of analyticsBus.zones) startZone(zone)
      if (analyticsBus.view) viewStarted(analyticsBus.view)
    },
    stop: () => {
      globalThis.document.removeEventListener('visibilitychange', onVisibility)
      for (const [type, listener] of windowListeners) {
        globalThis.removeEventListener(type, listener)
      }
      for (const zone of [...zones.keys()]) stopZone(zone)
      current = null
      stats = new Map()
    },
    viewStarted,
    viewReady: (view) => {
      if (view.id) sendView(view)
    },
    viewEnded: (view) => {
      if (!view.id) return
      sendView(view)
      flushView(view)
      if (current === view) current = null
    },
    viewDropped: (view) => {
      if (current === view) current = null
      stats = new Map()
      markSeen()
    },
    zoneConnected: startZone,
    zoneDisconnected: stopZone,
    action: (name, value) => send('action', value === undefined ? { name } : { name, value }),
    error: sendError,
    requestFailed: (failure) => {
      if (alreadyReported(failure)) return
      if (typeof failure === 'object' && failure !== null) reportedRequests.add(failure)
      send('error', { source: 'request', message: requestMessage(failure) })
    },
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

const openHold = (registration) => {
  registration.open = true
  const held = registration.held.splice(0)
  for (const record of held) callSink(registration.sink, record)
}

const readOptions = (options) => {
  if (options === undefined) return { when: null }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error(
      'imp: onAnalytics(sink, { when }) - the options are an object, like { when: consent }',
    )
  }
  const unknown = Object.keys(options).filter((key) => key !== 'when')
  if (unknown.length) {
    throw new Error(
      `imp: onAnalytics(sink, { when }) takes when only - remove ${unknown.join(', ')}`,
    )
  }
  if (options.when !== undefined && !isStateShaped(options.when)) {
    throw new Error(
      'imp: onAnalytics(sink, { when }) - when is a state that holds true while records may go to the sink, like { when: consent }',
    )
  }
  return { when: options.when ?? null }
}

const register = (sink, options) => {
  if (typeof sink !== 'function') {
    throw new Error(
      'imp: onAnalytics(sink) - the sink is a function that receives each record, like onAnalytics((record) => console.log(record))',
    )
  }
  const { when } = readOptions(options)
  const registration = { sink, open: when === null, held: [], stopWatch: null }
  if (when !== null) {
    registration.open = when.get() === true
    registration.stopWatch = when.watch((value) => {
      if (value === true && !registration.open) openHold(registration)
      else if (value !== true && registration.open) {
        registration.open = false
        flushSink(sink)
      }
    })
  }
  registrations.add(registration)
  if (!collection) startCollection()
  let registered = true
  return () => {
    if (!registered) return
    registered = false
    registrations.delete(registration)
    registration.stopWatch?.()
    flushSink(sink)
    if (!registrations.size) stopCollection()
  }
}

export const onAnalytics = (...args) => {
  const [first] = args
  if (typeof first?.abortSignal?.addEventListener === 'function') {
    const unregister = register(args[1], args[2])
    first.abortSignal.addEventListener('abort', unregister, { once: true })
    return unregister
  }
  return register(first, args[1])
}

const readBatchOptions = (options) => {
  const { size = DEFAULT_BATCH_SIZE, ms = DEFAULT_BATCH_MS, ...rest } = options ?? {}
  const unknown = Object.keys(rest)
  if (unknown.length) {
    throw new Error(
      `imp: batch(send, { size, ms }) takes size and ms - remove ${unknown.join(', ')}`,
    )
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('imp: batch(send, { size }) - size is a whole number of records, like 20')
  }
  if (typeof ms !== 'number' || !(ms > 0)) {
    throw new Error('imp: batch(send, { ms }) - ms is a number of milliseconds, like 5000')
  }
  return { size, ms }
}

export const batch = (send, options) => {
  if (typeof send !== 'function') {
    throw new Error(
      "imp: batch(send) - send is a function that receives an array of records, like batch((records) => navigator.sendBeacon('/collect', JSON.stringify(records)))",
    )
  }
  const { size, ms } = readBatchOptions(options)
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
    held.push(record)
    if (held.length >= size) {
      flush()
      return
    }
    timer ??= setTimeout(flush, ms)
  }
  sink[FLUSH] = flush
  return sink
}
