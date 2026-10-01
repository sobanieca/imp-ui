import { impLogger } from './logger.js'
import { namespacedNameProblem } from './provide.js'

export const analyticsNameProblem = (name, subject, example) =>
  namespacedNameProblem(name, `${subject} name`, example)

export const analyticsBus = {
  collector: null,
  zones: new Set(),
  view: null,
  entryPending: true,
  navigationStart: null,
}

const now = () => globalThis.performance.now()

export const markNavigationStart = () => {
  const mark = { at: now() }
  analyticsBus.navigationStart ??= mark
  return mark
}

export const clearNavigationStart = (mark) => {
  if (analyticsBus.navigationStart === mark) analyticsBus.navigationStart = null
}

export const endView = (view) => {
  if (view.ended) return
  view.ended = true
  if (analyticsBus.view === view) analyticsBus.view = null
  analyticsBus.entryPending = false
  analyticsBus.collector?.viewEnded(view)
}

export const startView = (page) => {
  const bus = analyticsBus
  if (bus.view) endView(bus.view)
  const startedAt = bus.entryPending ? 0 : bus.navigationStart?.at ?? now()
  bus.navigationStart = null
  const view = { page, startedAt, readyMs: undefined, ended: false }
  bus.view = view
  bus.collector?.viewStarted(view)
  return view
}

export const readyView = (view) => {
  if (view.ended || view.readyMs !== undefined) return
  view.readyMs = Math.round(now() - view.startedAt)
  analyticsBus.entryPending = false
  analyticsBus.collector?.viewReady(view)
}

export const dropView = (view) => {
  if (view.ended) return
  view.ended = true
  if (analyticsBus.view === view) analyticsBus.view = null
  analyticsBus.navigationStart = { at: view.startedAt }
  analyticsBus.collector?.viewDropped(view)
}

export const reportError = () => {
  analyticsBus.collector?.error()
}

export const zoneConnected = (zone) => {
  analyticsBus.zones.add(zone)
  analyticsBus.collector?.zoneConnected(zone)
}

export const zoneDisconnected = (zone) => {
  analyticsBus.zones.delete(zone)
  analyticsBus.collector?.zoneDisconnected(zone)
}

export const track = (...args) => {
  if (args.length !== 1) {
    throw new Error(
      "imp: track(name) takes a name only, like track('myapp.invoice-sent') - put a different outcome under its own name",
    )
  }
  const [name] = args
  const problem = analyticsNameProblem(name, 'outcome', 'myapp.invoice-sent')
  if (problem) {
    impLogger.error(`${problem} - the outcome is dropped`)
    return
  }
  analyticsBus.collector?.outcome(name)
}
